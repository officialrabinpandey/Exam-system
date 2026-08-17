const mongoose = require("mongoose");
const Seating = require("../models/Seating");
const Room = require("../models/Room");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const asyncHandler = require("../utils/asyncHandler");
const { generateAntiCheatSeats } = require("../utils/seatingAlgorithm");
const { notifyTeacherDutyAssigned } = require("../utils/notifications");

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const populateSeating = (query) =>
  query
    .populate("room", "name rows columns")
    .populate("seats.student", "name roll faculty studentClass optionalSubject")
    .populate("teacher", "name subject");

// Student ids already seated (non-empty seat) in ANY active room for a given
// exam date, optionally excluding one seating plan (used when regenerating
// that same plan). Archived plans don't count — they're not in effect.
const getAlreadySeatedStudentIds = async (examDate, excludeSeatingId) => {
  const filter = { examDate, archived: false };
  if (excludeSeatingId) filter._id = { $ne: excludeSeatingId };
  const plans = await Seating.find(filter).select("seats.student");
  const ids = new Set();
  plans.forEach((plan) => {
    plan.seats.forEach((seat) => {
      if (seat.student) ids.add(seat.student.toString());
    });
  });
  return ids;
};

// If a teacher is already assigned to a DIFFERENT room on this same exam
// date, that's a hard scheduling conflict (they can't physically be in two
// rooms at once) — returns a blocking error message, or null if clear.
const checkDoubleBookingConflict = async (teacherId, roomId, examDate, excludeSeatingId) => {
  if (!teacherId) return null;
  const filter = {
    teacher: teacherId,
    examDate,
    archived: false,
    room: { $ne: roomId },
  };
  if (excludeSeatingId) filter._id = { $ne: excludeSeatingId };

  const conflict = await Seating.findOne(filter).populate("room", "name").populate("teacher", "name");
  if (!conflict) return null;
  return `${conflict.teacher.name} is already assigned to ${conflict.room.name} on ${examDate} — a teacher can't invigilate two rooms at once.`;
};

// If assigning `teacherId` to `roomId` would repeat that same teacher in the
// same room on the exam date immediately before `examDate`, returns a
// warning string. Purely advisory — never blocks the request.
const checkConsecutiveRoomWarning = async (teacherId, roomId, examDate) => {
  if (!teacherId) return null;
  const previous = await Seating.findOne({
    room: roomId,
    archived: false,
    examDate: { $lt: examDate },
    teacher: { $ne: null },
  }).sort({ examDate: -1 });

  if (previous && previous.teacher.toString() === teacherId) {
    const teacher = await Teacher.findById(teacherId).select("name");
    return `${teacher?.name || "This teacher"} also invigilated this room on ${previous.examDate} — consider rotating to someone else.`;
  }
  return null;
};

// Archives any active (non-archived) plan already covering this room+date,
// so a fresh one can be generated in its place. Returns the archived plan
// ids (for the caller's info) — nothing is deleted, so it's restorable.
const archiveExistingPlan = async (roomId, examDate) => {
  const existing = await Seating.find({ room: roomId, examDate, archived: false });
  if (existing.length === 0) return [];
  await Seating.updateMany(
    { _id: { $in: existing.map((e) => e._id) } },
    { $set: { archived: true } }
  );
  return existing.map((e) => e._id);
};

// @desc    Generate a seating plan for a single room on a given exam date.
//          Students are shuffled and placed so same optional-subject students
//          aren't seated orthogonally adjacent. Students already seated in
//          another room on the same date are excluded automatically. If a
//          plan already exists for this room+date, the caller must pass
//          `replace: true` to archive it and generate a fresh one.
// @route   POST /api/seating/generate
// @body    { roomId, examDate, studentIds?, teacherId?, replace? }
const generateSeating = asyncHandler(async (req, res) => {
  const { roomId, examDate, studentIds, teacherId, replace } = req.body;

  if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
    return res.status(400).json({ success: false, message: "A valid roomId is required" });
  }
  if (!examDate || !DATE_REGEX.test(examDate)) {
    return res.status(400).json({ success: false, message: "examDate is required (YYYY-MM-DD)" });
  }
  if (teacherId && !mongoose.Types.ObjectId.isValid(teacherId)) {
    return res.status(400).json({ success: false, message: "teacherId is not valid" });
  }

  const room = await Room.findById(roomId);
  if (!room) {
    return res.status(404).json({ success: false, message: "Room not found" });
  }

  const existing = await Seating.findOne({ room: roomId, examDate, archived: false });
  if (existing && !replace) {
    return res.status(409).json({
      success: false,
      conflict: true,
      message: `A seating plan already exists for "${room.name}" on ${examDate}. Resubmit with replace: true to archive it and generate a new one.`,
    });
  }

  const alreadySeated = await getAlreadySeatedStudentIds(examDate, existing?._id);

  let candidates;
  if (Array.isArray(studentIds) && studentIds.length > 0) {
    candidates = await Student.find({ _id: { $in: studentIds }, archived: false });
  } else {
    candidates = await Student.find({ archived: false });
  }
  const eligible = candidates.filter((s) => !alreadySeated.has(s._id.toString()));

  const capacity = room.rows * room.columns;
  if (eligible.length > capacity) {
    return res.status(400).json({
      success: false,
      message: `Room "${room.name}" has capacity ${capacity}, but ${eligible.length} eligible students were provided`,
    });
  }

  const seats = generateAntiCheatSeats(eligible, room.rows, room.columns);

  const doubleBookingError = await checkDoubleBookingConflict(teacherId, roomId, examDate, existing?._id);
  if (doubleBookingError) {
    return res.status(400).json({ success: false, message: doubleBookingError });
  }
  const warning = await checkConsecutiveRoomWarning(teacherId, roomId, examDate);

  if (existing && replace) {
    await archiveExistingPlan(roomId, examDate);
  }

  const seating = await Seating.create({
    room: room._id,
    examDate,
    rows: room.rows,
    columns: room.columns,
    seats,
    teacher: teacherId || null,
  });

  const populated = await populateSeating(Seating.findById(seating._id));
  if (populated.teacher) {
    notifyTeacherDutyAssigned(populated.teacher, populated.room, examDate).catch(() => {});
  }
  res.status(201).json({ success: true, data: populated, warning });
});

// @desc    Generate seating plans across several rooms at once for one exam date.
//          Every eligible student is placed in exactly one of the given rooms —
//          nobody is duplicated across rooms. Rooms that already have an active
//          plan for this date are skipped unless `replace: true` is passed, in
//          which case their old plan is archived first.
// @route   POST /api/seating/generate-multi
// @body    { examDate, roomIds: [...], teacherAssignments?: { [roomId]: teacherId }, replace? }
const generateSeatingMulti = asyncHandler(async (req, res) => {
  const { examDate, roomIds, teacherAssignments = {}, replace } = req.body;

  if (!examDate || !DATE_REGEX.test(examDate)) {
    return res.status(400).json({ success: false, message: "examDate is required (YYYY-MM-DD)" });
  }
  if (!Array.isArray(roomIds) || roomIds.length < 1) {
    return res.status(400).json({ success: false, message: "At least one roomId is required" });
  }
  for (const id of roomIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: `Invalid roomId: ${id}` });
    }
  }

  const rooms = await Room.find({ _id: { $in: roomIds } });
  if (rooms.length !== roomIds.length) {
    return res.status(404).json({ success: false, message: "One or more rooms were not found" });
  }
  // Preserve the order the caller passed rooms in
  const orderedRooms = roomIds.map((id) => rooms.find((r) => r._id.toString() === id));

  // Check for existing active plans on any of these rooms for this date
  const conflicting = await Seating.find({
    room: { $in: roomIds },
    examDate,
    archived: false,
  }).populate("room", "name");
  if (conflicting.length > 0 && !replace) {
    return res.status(409).json({
      success: false,
      conflict: true,
      message: `${conflicting
        .map((c) => c.room.name)
        .join(", ")} already have a seating plan for ${examDate}. Resubmit with replace: true to archive and regenerate.`,
    });
  }

  // If replacing, archive the conflicting plans first so the eligibility
  // lookup below naturally excludes their seated students.
  if (replace && conflicting.length > 0) {
    await Seating.updateMany(
      { _id: { $in: conflicting.map((c) => c._id) } },
      { $set: { archived: true } }
    );
  }
  const alreadySeatedIds = await getAlreadySeatedStudentIds(examDate);
  const allStudents = await Student.find({ archived: false });
  const eligible = allStudents.filter((s) => !alreadySeatedIds.has(s._id.toString()));

  const totalCapacity = orderedRooms.reduce((sum, r) => sum + r.rows * r.columns, 0);
  if (eligible.length > totalCapacity) {
    return res.status(400).json({
      success: false,
      message: `Selected rooms have combined capacity ${totalCapacity}, but ${eligible.length} eligible students need seats. Add another room or reduce the student list.`,
    });
  }

  // Reject upfront if the same teacher was assigned to more than one room in
  // this very batch — no need to hit the DB for that case.
  const assignedTeacherIds = Object.values(teacherAssignments).filter(Boolean);
  const duplicateInBatch = assignedTeacherIds.find(
    (id, i) => assignedTeacherIds.indexOf(id) !== i
  );
  if (duplicateInBatch) {
    return res.status(400).json({
      success: false,
      message: "The same teacher is assigned to more than one room in this batch — a teacher can't invigilate two rooms at once.",
    });
  }

  // Validate every room's teacher assignment BEFORE creating anything, so a
  // conflict found on a later room never leaves an earlier room's plan
  // created with no way to roll it back.
  for (const room of orderedRooms) {
    const teacherId = teacherAssignments[room._id.toString()] || null;
    const doubleBookingError = await checkDoubleBookingConflict(teacherId, room._id, examDate);
    if (doubleBookingError) {
      return res.status(400).json({ success: false, message: doubleBookingError });
    }
  }

  // Shuffle once, then slice into per-room chunks sized by each room's capacity
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  const createdPlans = [];
  const warnings = [];
  let cursor = 0;

  for (const room of orderedRooms) {
    const capacity = room.rows * room.columns;
    const chunk = shuffled.slice(cursor, cursor + capacity);
    cursor += capacity;

    const seats = generateAntiCheatSeats(chunk, room.rows, room.columns);
    const teacherId = teacherAssignments[room._id.toString()] || null;

    const warning = await checkConsecutiveRoomWarning(teacherId, room._id, examDate);
    if (warning) warnings.push(warning);

    const seating = await Seating.create({
      room: room._id,
      examDate,
      rows: room.rows,
      columns: room.columns,
      seats,
      teacher: teacherId,
    });
    createdPlans.push(seating._id);
  }

  const populated = await populateSeating(Seating.find({ _id: { $in: createdPlans } })).sort({
    createdAt: 1,
  });

  populated.forEach((plan) => {
    if (plan.teacher) notifyTeacherDutyAssigned(plan.teacher, plan.room, examDate).catch(() => {});
  });

  res.status(201).json({ success: true, count: populated.length, data: populated, warnings });
});

// @desc    List saved seating plans — optionally filter by examDate, teacherId,
//          roomId. Archived (replaced) plans are excluded unless
//          includeArchived=true is passed, so the default view only shows
//          what's currently in effect.
// @route   GET /api/seating
const getSeatings = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.examDate) filter.examDate = req.query.examDate;
  if (req.query.teacherId && mongoose.Types.ObjectId.isValid(req.query.teacherId)) {
    filter.teacher = req.query.teacherId;
  }
  if (req.query.roomId && mongoose.Types.ObjectId.isValid(req.query.roomId)) {
    filter.room = req.query.roomId;
  }
  if (req.query.includeArchived !== "true") {
    filter.archived = false;
  }

  const seatings = await populateSeating(Seating.find(filter)).sort({
    examDate: -1,
    createdAt: -1,
  });
  res.status(200).json({ success: true, count: seatings.length, data: seatings });
});

// @desc    Get a single seating plan, fully populated with student details
// @route   GET /api/seating/:id
const getSeating = asyncHandler(async (req, res) => {
  const seating = await populateSeating(Seating.findById(req.params.id));
  if (!seating) {
    return res.status(404).json({ success: false, message: "Seating plan not found" });
  }
  res.status(200).json({ success: true, data: seating });
});

// @desc    Edit a seating plan — change the assigned teacher and/or manually
//          reassign which student sits in which seat.
// @route   PUT /api/seating/:id
// @body    { teacherId?, seats? }
const updateSeating = asyncHandler(async (req, res) => {
  const { teacherId, seats } = req.body;

  const seating = await Seating.findById(req.params.id);
  if (!seating) {
    return res.status(404).json({ success: false, message: "Seating plan not found" });
  }

  if (teacherId !== undefined) {
    if (teacherId && !mongoose.Types.ObjectId.isValid(teacherId)) {
      return res.status(400).json({ success: false, message: "teacherId is not valid" });
    }
    if (teacherId) {
      const doubleBookingError = await checkDoubleBookingConflict(
        teacherId,
        seating.room,
        seating.examDate,
        seating._id
      );
      if (doubleBookingError) {
        return res.status(400).json({ success: false, message: doubleBookingError });
      }
    }
    seating.teacher = teacherId || null;
  }

  if (Array.isArray(seats)) {
    if (seats.length !== seating.seats.length) {
      return res.status(400).json({
        success: false,
        message: `Expected ${seating.seats.length} seats, received ${seats.length}`,
      });
    }

    // Guard against accidentally introducing a student who is already seated
    // in a different room on the same exam date.
    const alreadySeatedElsewhere = await getAlreadySeatedStudentIds(
      seating.examDate,
      seating._id
    );
    for (const s of seats) {
      if (s.student && alreadySeatedElsewhere.has(String(s.student))) {
        return res.status(400).json({
          success: false,
          message: "One of the selected students is already seated in another room on this date",
        });
      }
    }

    seating.seats = seats.map((s) => ({
      row: s.row,
      column: s.column,
      student: s.student || null,
    }));
  }

  await seating.save();

  const populated = await populateSeating(Seating.findById(seating._id));
  if (teacherId !== undefined && populated.teacher) {
    notifyTeacherDutyAssigned(populated.teacher, populated.room, populated.examDate).catch(() => {});
  }
  res.status(200).json({ success: true, data: populated });
});

// @desc    Mark exam-day attendance for one seat — present, absent, or reset
//          to unmarked. Separate from a Result's "absent" flag, since this
//          tracks who physically showed up rather than final marks.
// @route   PATCH /api/seating/:id/attendance
// @body    { row, column, present }  -- present: true | false | null
const markAttendance = asyncHandler(async (req, res) => {
  const { row, column, present } = req.body;
  if (row === undefined || column === undefined) {
    return res.status(400).json({ success: false, message: "row and column are required" });
  }

  const seating = await Seating.findById(req.params.id);
  if (!seating) {
    return res.status(404).json({ success: false, message: "Seating plan not found" });
  }

  const seat = seating.seats.find((s) => s.row === row && s.column === column);
  if (!seat) {
    return res.status(404).json({ success: false, message: "Seat not found in this plan" });
  }
  if (!seat.student) {
    return res.status(400).json({ success: false, message: "This seat has no student assigned" });
  }

  seat.present = present === undefined ? null : present;
  await seating.save();

  const populated = await populateSeating(Seating.findById(seating._id));
  res.status(200).json({ success: true, data: populated });
});

// @desc    Restore an archived seating plan — undoes a "replace". Any plan
//          currently active for the same room+date is archived in its place,
//          so only one plan per room+date is ever active at a time.
// @route   POST /api/seating/:id/restore
const restoreSeating = asyncHandler(async (req, res) => {
  const seating = await Seating.findById(req.params.id);
  if (!seating) {
    return res.status(404).json({ success: false, message: "Seating plan not found" });
  }

  await Seating.updateMany(
    { room: seating.room, examDate: seating.examDate, archived: false, _id: { $ne: seating._id } },
    { $set: { archived: true } }
  );
  seating.archived = false;
  await seating.save();

  const populated = await populateSeating(Seating.findById(seating._id));
  res.status(200).json({ success: true, data: populated });
});

// @desc    Delete a seating plan
// @route   DELETE /api/seating/:id
const deleteSeating = asyncHandler(async (req, res) => {
  const seating = await Seating.findByIdAndDelete(req.params.id);
  if (!seating) {
    return res.status(404).json({ success: false, message: "Seating plan not found" });
  }
  res.status(200).json({ success: true, data: {} });
});

module.exports = {
  generateSeating,
  generateSeatingMulti,
  getSeatings,
  getSeating,
  updateSeating,
  markAttendance,
  restoreSeating,
  deleteSeating,
};
