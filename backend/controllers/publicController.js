const Student = require("../models/Student");
const Result = require("../models/Result");
const asyncHandler = require("../utils/asyncHandler");
const { decorateResult } = require("../utils/gradeUtils");
const { getSettings } = require("../models/Settings");

// @desc    Public, unauthenticated result lookup — a student (or parent) can
//          check a result themselves by roll number + exam name, without any
//          login. Deliberately returns only what's needed to identify the
//          result belongs to them and show the outcome — no other students'
//          data, no admin-only fields.
// @route   GET /api/public/result?roll=...&examName=...
const lookupResult = asyncHandler(async (req, res) => {
  const { roll, examName } = req.query;
  if (!roll || !examName) {
    return res.status(400).json({ success: false, message: "roll and examName are both required" });
  }

  const student = await Student.findOne({ roll: roll.trim(), archived: false });
  if (!student) {
    return res.status(404).json({ success: false, message: "No student found with that roll number" });
  }

  const result = await Result.findOne({ student: student._id, examName: examName.trim() });
  if (!result) {
    return res.status(404).json({ success: false, message: "No result found for that exam yet" });
  }

  const settings = await getSettings();
  const decorated = decorateResult(result, settings);

  res.status(200).json({
    success: true,
    data: {
      name: student.name,
      roll: student.roll,
      faculty: student.faculty,
      studentClass: student.studentClass,
      examName: decorated.examName,
      marks: decorated.marks.map((m) => ({
        subject: m.subject,
        theoryObtained: m.theoryObtained,
        theoryFullMarks: m.theoryFullMarks,
        practicalObtained: m.practicalObtained,
        practicalFullMarks: m.practicalFullMarks,
        grade: m.grade,
        passed: m.passed,
      })),
      totalObtained: decorated.totalObtained,
      totalFull: decorated.totalFull,
      percentage: decorated.percentage,
      grade: decorated.grade,
      gpa: decorated.gpa,
      passed: decorated.passed,
      absent: decorated.absent,
    },
  });
});

module.exports = { lookupResult };
