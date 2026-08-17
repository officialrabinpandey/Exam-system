const Student = require("../models/Student");
const Seating = require("../models/Seating");
const Result = require("../models/Result");
const Faculty = require("../models/Faculty");
const asyncHandler = require("../utils/asyncHandler");
const XLSX = require("xlsx");

const VALID_CLASSES = ["11", "12"];

// Validates faculty + optionalSubject against the Faculty collection's
// actual configuration. Throws a descriptive Error rather than returning a
// boolean, so callers can turn it directly into a 400 response.
const validateFacultyChoice = async (facultyName, optionalSubject) => {
  const faculty = await Faculty.findOne({ name: facultyName });
  if (!faculty) {
    throw new Error(`"${facultyName}" is not a configured faculty. Add it under Faculties first.`);
  }
  if (faculty.electiveOptions.length > 0) {
    if (!faculty.electiveOptions.includes(optionalSubject)) {
      throw new Error(
        `Optional subject must be one of: ${faculty.electiveOptions.join(", ")} for ${facultyName}`
      );
    }
  }
  return faculty;
};

// Generates a roll number as <2-digit batch year>-<sequence number>, e.g. "81-7049"
// (batch year 2081 -> "81"). The sequence number is the next one after the highest
// existing sequence number already used for that batch year, so rolls stay ordered
// and gap-free even if students are deleted later.
const generateSequentialRoll = async (batchYear) => {
  const shortYear = String(Number(batchYear) % 100).padStart(2, "0");
  const prefix = `${shortYear}-`;

  const existing = await Student.find({ roll: { $regex: `^${prefix}` } }).select("roll");
  let maxSeq = 0;
  existing.forEach((s) => {
    const seq = parseInt(s.roll.slice(prefix.length), 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  });

  const nextSeq = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
};

// @desc    Get all students (sorted by roll number for easy lookup).
//          Archived (soft-deleted) students are excluded unless
//          includeArchived=true is passed. Supports pagination via
//          ?page=&limit= — when page is given, results come back with
//          totalCount/page/totalPages so the frontend can "load more"
//          instead of fetching the entire roster in one request.
// @route   GET /api/students
const getStudents = asyncHandler(async (req, res) => {
  const filter = req.query.includeArchived === "true" ? {} : { archived: false };

  if (!req.query.page) {
    const students = await Student.find(filter).sort({ roll: 1 });
    return res.status(200).json({ success: true, count: students.length, data: students });
  }

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const totalCount = await Student.countDocuments(filter);
  const students = await Student.find(filter)
    .sort({ roll: 1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.status(200).json({
    success: true,
    count: students.length,
    totalCount,
    page,
    totalPages: Math.ceil(totalCount / limit) || 1,
    data: students,
  });
});

// @desc    Get single student
// @route   GET /api/students/:id
const getStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({ success: false, message: "Student not found" });
  }
  res.status(200).json({ success: true, data: student });
});

// @desc    Create student (roll number is auto-generated: <short batch year>-<sequence>)
// @route   POST /api/students
const createStudent = asyncHandler(async (req, res) => {
  const {
    name,
    faculty,
    optionalSubject,
    batchYear,
    studentClass,
    symbolNumber,
    registrationNumber,
    guardianName,
    guardianContact,
    email,
  } = req.body;

  try {
    await validateFacultyChoice(faculty, optionalSubject);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }

  const roll = await generateSequentialRoll(batchYear);
  const student = await Student.create({
    name,
    faculty,
    optionalSubject: optionalSubject || "",
    batchYear,
    studentClass,
    roll,
    symbolNumber: symbolNumber || "",
    registrationNumber: registrationNumber || "",
    guardianName: guardianName || "",
    guardianContact: guardianContact || "",
    email: email || "",
  });
  res.status(201).json({ success: true, data: student });
});

// @desc    Update student (roll number is never editable once generated)
// @route   PUT /api/students/:id
const updateStudent = asyncHandler(async (req, res) => {
  const {
    name,
    faculty,
    optionalSubject,
    batchYear,
    studentClass,
    symbolNumber,
    registrationNumber,
    guardianName,
    guardianContact,
    email,
  } = req.body;

  if (faculty !== undefined) {
    try {
      await validateFacultyChoice(faculty, optionalSubject);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  const student = await Student.findByIdAndUpdate(
    req.params.id,
    {
      name,
      faculty,
      optionalSubject,
      batchYear,
      studentClass,
      symbolNumber,
      registrationNumber,
      guardianName,
      guardianContact,
      email,
    },
    { new: true, runValidators: true }
  );
  if (!student) {
    return res.status(404).json({ success: false, message: "Student not found" });
  }
  res.status(200).json({ success: true, data: student });
});

// @desc    Archive (soft-delete) a student. Blocked if they're seated in any
//          active (non-archived) seating plan — remove them from that plan
//          first, or delete the plan, then archive the student.
// @route   DELETE /api/students/:id
const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({ success: false, message: "Student not found" });
  }

  const activeSeating = await Seating.findOne({
    archived: false,
    "seats.student": student._id,
  });
  if (activeSeating) {
    return res.status(400).json({
      success: false,
      message: "This student is seated in an active seating plan. Remove them from that seat first.",
    });
  }

  student.archived = true;
  await student.save();
  res.status(200).json({ success: true, data: {} });
});

// @desc    Bulk-promote every (non-archived) student in one class to another,
//          e.g. Class 11 -> Class 12 at the end of the academic year.
// @route   PATCH /api/students/promote
// @body    { fromClass, toClass }
const promoteStudents = asyncHandler(async (req, res) => {
  const { fromClass, toClass } = req.body;
  if (!VALID_CLASSES.includes(fromClass) || !VALID_CLASSES.includes(toClass)) {
    return res.status(400).json({ success: false, message: "fromClass and toClass must be '11' or '12'" });
  }
  const result = await Student.updateMany(
    { studentClass: fromClass, archived: false },
    { $set: { studentClass: toClass } }
  );
  res.status(200).json({ success: true, promotedCount: result.modifiedCount });
});

// @desc    Parse an uploaded CSV/Excel file and validate every row WITHOUT
//          saving anything, so the caller can review errors before committing.
//          Expected columns (case-insensitive, order-independent): name,
//          faculty, class, optionalSubject, batchYear.
// @route   POST /api/students/import/preview
// @body    multipart/form-data, field name "file"
const importPreview = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  let rows;
  try {
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
  } catch (err) {
    return res.status(400).json({ success: false, message: "Could not parse the file — is it a valid CSV or Excel file?" });
  }

  if (rows.length === 0) {
    return res.status(400).json({ success: false, message: "The file has no data rows" });
  }

  const faculties = await Faculty.find();
  const facultyByName = {};
  faculties.forEach((f) => (facultyByName[f.name] = f));

  const normalizeKey = (obj, ...aliases) => {
    for (const key of Object.keys(obj)) {
      if (aliases.includes(key.trim().toLowerCase())) return obj[key];
    }
    return "";
  };

  const preview = rows.map((row, index) => {
    const name = String(normalizeKey(row, "name", "full name")).trim();
    const faculty = String(normalizeKey(row, "faculty")).trim();
    const studentClass = String(normalizeKey(row, "class", "studentclass")).trim();
    const optionalSubject = String(normalizeKey(row, "optionalsubject", "optional subject")).trim();
    const batchYearRaw = normalizeKey(row, "batchyear", "batch year", "batch");
    const batchYear = Number(batchYearRaw);

    const errors = [];
    if (!name) errors.push("Name is required");

    const facultyDoc = facultyByName[faculty];
    if (!facultyDoc) {
      errors.push(`Faculty must be one of: ${Object.keys(facultyByName).join(", ")}`);
    } else if (facultyDoc.electiveOptions.length > 0 && !facultyDoc.electiveOptions.includes(optionalSubject)) {
      errors.push(`Optional subject must be one of: ${facultyDoc.electiveOptions.join(", ")}`);
    }
    if (!VALID_CLASSES.includes(studentClass)) errors.push(`Class must be one of: ${VALID_CLASSES.join(", ")}`);
    if (!batchYear || batchYear < 2000 || batchYear > 2200) errors.push("Batch year looks invalid");

    return {
      row: index + 2, // +2 accounts for the header row and 1-based numbering
      name,
      faculty,
      studentClass,
      optionalSubject,
      batchYear: batchYear || null,
      valid: errors.length === 0,
      errors,
    };
  });

  const validCount = preview.filter((r) => r.valid).length;
  res.status(200).json({
    success: true,
    count: preview.length,
    validCount,
    invalidCount: preview.length - validCount,
    data: preview,
  });
});

// @desc    Commit a previously-previewed, validated list of student rows.
//          Any row failing server-side validation here is skipped (not
//          fatal to the whole batch) and reported back.
// @route   POST /api/students/import/commit
// @body    { rows: [{ name, faculty, studentClass, optionalSubject, batchYear }] }
const importCommit = asyncHandler(async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: "No rows to import" });
  }

  const created = [];
  const failed = [];

  for (const row of rows) {
    const { name, faculty, studentClass, optionalSubject, batchYear } = row;
    if (!name || !VALID_CLASSES.includes(studentClass) || !batchYear) {
      failed.push({ row, reason: "Invalid or incomplete row" });
      continue;
    }
    try {
      await validateFacultyChoice(faculty, optionalSubject);
      const roll = await generateSequentialRoll(batchYear);
      const student = await Student.create({ name, faculty, studentClass, optionalSubject, batchYear, roll });
      created.push(student);
    } catch (err) {
      failed.push({ row, reason: err.message });
    }
  }

  res.status(201).json({
    success: true,
    createdCount: created.length,
    failedCount: failed.length,
    data: created,
    failed,
  });
});

module.exports = {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  promoteStudents,
  importPreview,
  importCommit,
};
