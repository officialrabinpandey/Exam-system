const Teacher = require("../models/Teacher");
const Seating = require("../models/Seating");
const asyncHandler = require("../utils/asyncHandler");

// @desc    Get all teachers
// @route   GET /api/teachers
const getTeachers = asyncHandler(async (req, res) => {
  const teachers = await Teacher.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: teachers.length, data: teachers });
});

// @desc    Get single teacher
// @route   GET /api/teachers/:id
const getTeacher = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) {
    return res.status(404).json({ success: false, message: "Teacher not found" });
  }
  res.status(200).json({ success: true, data: teacher });
});

// @desc    Create teacher
// @route   POST /api/teachers
const createTeacher = asyncHandler(async (req, res) => {
  const { name, subject } = req.body;
  const teacher = await Teacher.create({ name, subject });
  res.status(201).json({ success: true, data: teacher });
});

// @desc    Update teacher
// @route   PUT /api/teachers/:id
const updateTeacher = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!teacher) {
    return res.status(404).json({ success: false, message: "Teacher not found" });
  }
  res.status(200).json({ success: true, data: teacher });
});

// @desc    Delete teacher — blocked if actively invigilating any
//          non-archived seating plan.
// @route   DELETE /api/teachers/:id
const deleteTeacher = asyncHandler(async (req, res) => {
  const activeSeating = await Seating.findOne({ teacher: req.params.id, archived: false });
  if (activeSeating) {
    return res.status(400).json({
      success: false,
      message: "This teacher is assigned to an active seating plan. Reassign that duty first.",
    });
  }

  const teacher = await Teacher.findByIdAndDelete(req.params.id);
  if (!teacher) {
    return res.status(404).json({ success: false, message: "Teacher not found" });
  }
  res.status(200).json({ success: true, data: {} });
});

// @desc    Duty count per teacher, across every generated seating plan, plus
//          any manual adjustment the admin has entered — the basis for
//          "fair rotation" (assign whoever has fewest so far).
// @route   GET /api/teachers/duty-summary
const getDutySummary = asyncHandler(async (req, res) => {
  const teachers = await Teacher.find().sort({ name: 1 });
  const plans = await Seating.find({ teacher: { $ne: null } }).select("teacher examDate room");

  const countByTeacher = {};
  plans.forEach((p) => {
    const key = p.teacher.toString();
    countByTeacher[key] = (countByTeacher[key] || 0) + 1;
  });

  const summary = teachers.map((t) => {
    const autoCount = countByTeacher[t._id.toString()] || 0;
    return {
      _id: t._id,
      name: t.name,
      subject: t.subject,
      autoCount,
      manualDutyAdjustment: t.manualDutyAdjustment || 0,
      dutyCount: autoCount + (t.manualDutyAdjustment || 0),
    };
  });

  res.status(200).json({ success: true, data: summary });
});

// @desc    Manually correct a teacher's duty count by setting the desired
//          total — the difference from the auto-tracked count is stored as
//          manualDutyAdjustment, so future auto-tracked duties still add on
//          top of it correctly.
// @route   PATCH /api/teachers/:id/duty-count
// @body    { totalDuties }
const setDutyCount = asyncHandler(async (req, res) => {
  const { totalDuties } = req.body;
  if (totalDuties === undefined || isNaN(Number(totalDuties))) {
    return res.status(400).json({ success: false, message: "totalDuties (a number) is required" });
  }

  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) {
    return res.status(404).json({ success: false, message: "Teacher not found" });
  }

  const autoCount = await Seating.countDocuments({ teacher: teacher._id });
  teacher.manualDutyAdjustment = Number(totalDuties) - autoCount;
  await teacher.save();

  res.status(200).json({
    success: true,
    data: {
      _id: teacher._id,
      name: teacher.name,
      subject: teacher.subject,
      autoCount,
      manualDutyAdjustment: teacher.manualDutyAdjustment,
      dutyCount: autoCount + teacher.manualDutyAdjustment,
    },
  });
});

// @desc    Suggest the teacher with the fewest duties so far — a starting
//          point for fair rotation, not a binding assignment.
// @route   GET /api/teachers/suggest
const suggestTeacher = asyncHandler(async (req, res) => {
  const teachers = await Teacher.find();
  if (teachers.length === 0) {
    return res.status(200).json({ success: true, data: null });
  }

  const plans = await Seating.find({ teacher: { $ne: null } }).select("teacher");
  const countByTeacher = {};
  plans.forEach((p) => {
    const key = p.teacher.toString();
    countByTeacher[key] = (countByTeacher[key] || 0) + 1;
  });

  const totalFor = (t) => (countByTeacher[t._id.toString()] || 0) + (t.manualDutyAdjustment || 0);

  let best = teachers[0];
  let bestCount = totalFor(best);
  teachers.forEach((t) => {
    const count = totalFor(t);
    if (count < bestCount) {
      best = t;
      bestCount = count;
    }
  });

  res.status(200).json({ success: true, data: { ...best.toObject(), dutyCount: bestCount } });
});

module.exports = {
  getTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  getDutySummary,
  setDutyCount,
  suggestTeacher,
};
