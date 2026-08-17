const mongoose = require("mongoose");
const Result = require("../models/Result");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const asyncHandler = require("../utils/asyncHandler");
const { getSubjectsForStudent, getLedgerColumns } = require("../utils/subjectRules");
const { decorateResult } = require("../utils/gradeUtils");
const { getSettings, fullMarksForSubject } = require("../models/Settings");
const { notifyResultPublished } = require("../utils/notifications");

// If the acting user is a "teacher" role, returns their linked subject —
// they may only enter marks for this subject. Returns null for admins
// (unrestricted) or if something's misconfigured (caught as "no subject").
const getTeacherScopeSubject = async (user) => {
  if (user.role !== "teacher") return null; // admin — unrestricted
  if (!user.teacherId) return "__no_teacher_linked__";
  const teacher = await Teacher.findById(user.teacherId);
  return teacher?.subject || "__no_teacher_linked__";
};

// @desc    Get the subject list a given student should be marked on
// @route   GET /api/results/subjects/:studentId
const getSubjectsForStudentRoute = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.studentId);
  if (!student) {
    return res.status(404).json({ success: false, message: "Student not found" });
  }
  try {
    const subjects = await getSubjectsForStudent(student);
    res.status(200).json({ success: true, data: subjects });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @desc    Distinct exam names already used, for autocomplete — helps avoid
//          the same exam being typed two slightly different ways.
// @route   GET /api/results/exam-names
const getExamNames = asyncHandler(async (req, res) => {
  const names = await Result.distinct("examName");
  res.status(200).json({ success: true, data: names.sort() });
});

// Builds a normalized, validated marks array for one student from raw input,
// throwing a descriptive Error if a subject or a mark value is invalid.
const normalizeMarksForStudent = async (student, rawMarks, settings) => {
  const allowedSubjects = await getSubjectsForStudent(student);
  return rawMarks.map((m) => {
    if (!allowedSubjects.includes(m.subject)) {
      throw new Error(`"${m.subject}" is not a valid subject for a ${student.faculty} student`);
    }
    const { theoryFullMarks, practicalFullMarks } = fullMarksForSubject(settings, m.subject);
    const clamp = (value, max) => Math.max(0, Math.min(Number(value) || 0, max));
    return {
      subject: m.subject,
      theoryFullMarks,
      theoryObtained: clamp(m.theoryObtained, theoryFullMarks),
      practicalFullMarks,
      practicalObtained: clamp(m.practicalObtained, practicalFullMarks),
    };
  });
};

// Merges a set of new/updated subject marks into an existing marks array —
// matching subjects are replaced, everything else is left untouched. Used
// so a subject teacher entering just their own subject never wipes out
// other subjects' already-saved marks.
const mergeMarks = (existingMarks, newMarks) => {
  const merged = [...existingMarks];
  newMarks.forEach((nm) => {
    const idx = merged.findIndex((m) => m.subject === nm.subject);
    if (idx !== -1) merged[idx] = nm;
    else merged.push(nm);
  });
  return merged;
};

// @desc    Create or update a single student's marks for a named exam
// @route   POST /api/results
// @body    { studentId, examName, marks: [{ subject, theoryObtained, practicalObtained }], absent? }
const saveResult = asyncHandler(async (req, res) => {
  const { studentId, examName, marks, absent } = req.body;

  if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
    return res.status(400).json({ success: false, message: "A valid studentId is required" });
  }
  if (!examName || !examName.trim()) {
    return res.status(400).json({ success: false, message: "examName is required" });
  }
  if (!Array.isArray(marks) || marks.length === 0) {
    return res.status(400).json({ success: false, message: "marks array is required" });
  }

  const student = await Student.findById(studentId);
  if (!student) {
    return res.status(404).json({ success: false, message: "Student not found" });
  }

  const scopeSubject = await getTeacherScopeSubject(req.user);
  let effectiveMarks = marks;
  if (scopeSubject) {
    effectiveMarks = marks.filter((m) => m.subject === scopeSubject);
    if (effectiveMarks.length === 0) {
      return res.status(403).json({
        success: false,
        message: `You can only enter marks for ${scopeSubject === "__no_teacher_linked__" ? "your subject — your account isn't linked to a teacher record, ask an admin to fix this" : scopeSubject}`,
      });
    }
  }

  const settings = await getSettings();
  let normalizedMarks;
  try {
    normalizedMarks = await normalizeMarksForStudent(student, effectiveMarks, settings);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }

  const existing = await Result.findOne({ student: studentId, examName: examName.trim() });
  // A subject-scoped teacher merges into whatever's already saved (never
  // touches other subjects or the absent flag); an admin fully replaces.
  const finalMarks = scopeSubject && existing ? mergeMarks(existing.marks, normalizedMarks) : normalizedMarks;
  const finalAbsent = scopeSubject ? existing?.absent || false : Boolean(absent);

  const result = await Result.findOneAndUpdate(
    { student: studentId, examName: examName.trim() },
    { student: studentId, examName: examName.trim(), marks: finalMarks, absent: finalAbsent },
    { new: true, upsert: true, runValidators: true }
  ).populate("student", "name roll faculty studentClass optionalSubject");

  notifyResultPublished(student, examName.trim()).catch(() => {});
  res.status(201).json({ success: true, data: decorateResult(result, settings) });
});

// @desc    Get the full marks ledger for a class + faculty on a named exam —
//          every student in that peer group, in one table, whether or not
//          they already have marks saved (unmarked subjects come back as 0).
//          For Science, BOTH "Biology" and "Computer" are separate columns;
//          a student only has a mark entry for the one they actually study —
//          the other column has no matching entry for them at all, so the
//          frontend renders it as blocked/not-applicable rather than editable.
// @route   GET /api/results/ledger?examName=...&studentClass=...&faculty=...
const getLedger = asyncHandler(async (req, res) => {
  const { examName, studentClass, faculty } = req.query;
  if (!examName || !examName.trim()) {
    return res.status(400).json({ success: false, message: "examName is required" });
  }
  if (!studentClass || !faculty) {
    return res.status(400).json({ success: false, message: "studentClass and faculty are required" });
  }

  const students = await Student.find({ studentClass, faculty, archived: false }).sort({ roll: 1 });
  if (students.length === 0) {
    return res.status(200).json({ success: true, subjectColumns: [], data: [] });
  }

  let subjectColumns;
  try {
    subjectColumns = await getLedgerColumns(faculty);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }

  const settings = await getSettings();
  const existingResults = await Result.find({
    examName: examName.trim(),
    student: { $in: students.map((s) => s._id) },
  });
  const resultByStudentId = {};
  existingResults.forEach((r) => (resultByStudentId[r.student.toString()] = r));

  const rows = [];
  for (const student of students) {
    const subjects = await getSubjectsForStudent(student); // only this student's own applicable subjects
    const existing = resultByStudentId[student._id.toString()];

    const marks = subjects.map((subject) => {
      const existingMark = existing?.marks.find((m) => m.subject === subject);
      const { theoryFullMarks, practicalFullMarks } = fullMarksForSubject(settings, subject);
      return {
        subject,
        theoryFullMarks: existingMark?.theoryFullMarks ?? theoryFullMarks,
        theoryObtained: existingMark?.theoryObtained ?? 0,
        practicalFullMarks: existingMark?.practicalFullMarks ?? practicalFullMarks,
        practicalObtained: existingMark?.practicalObtained ?? 0,
      };
    });

    const decorated = existing
      ? decorateResult(existing, settings)
      : decorateResult({ marks, absent: false }, settings);

    rows.push({
      student: {
        _id: student._id,
        name: student.name,
        roll: student.roll,
        optionalSubject: student.optionalSubject,
      },
      hasSavedResult: Boolean(existing),
      absent: existing?.absent || false,
      marks: decorated.marks,
      totalObtained: decorated.totalObtained,
      totalFull: decorated.totalFull,
      percentage: decorated.percentage,
      grade: decorated.grade,
      gpa: decorated.gpa,
      passed: decorated.passed,
    });
  }

  res.status(200).json({ success: true, subjectColumns, data: rows });
});

// @desc    Bulk-save marks for every student in a class+faculty ledger at once.
// @route   POST /api/results/ledger
// @body    { examName, entries: [{ studentId, marks: [...], absent? }] }
const saveLedger = asyncHandler(async (req, res) => {
  const { examName, entries } = req.body;
  if (!examName || !examName.trim()) {
    return res.status(400).json({ success: false, message: "examName is required" });
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ success: false, message: "entries array is required" });
  }

  const studentIds = entries.map((e) => e.studentId);
  const students = await Student.find({ _id: { $in: studentIds } });
  const studentById = {};
  students.forEach((s) => (studentById[s._id.toString()] = s));

  const settings = await getSettings();
  const scopeSubject = await getTeacherScopeSubject(req.user);
  if (scopeSubject === "__no_teacher_linked__") {
    return res.status(403).json({
      success: false,
      message: "Your account isn't linked to a teacher record — ask an admin to fix this before entering marks.",
    });
  }

  const saved = [];
  const failed = [];

  for (const entry of entries) {
    const student = studentById[entry.studentId];
    if (!student) {
      failed.push({ studentId: entry.studentId, reason: "Student not found" });
      continue;
    }

    let entryMarks = entry.marks;
    if (scopeSubject) {
      entryMarks = entry.marks.filter((m) => m.subject === scopeSubject);
      if (entryMarks.length === 0) {
        failed.push({ studentId: entry.studentId, reason: `No marks for your subject (${scopeSubject}) in this row` });
        continue;
      }
    }

    try {
      const normalizedMarks = await normalizeMarksForStudent(student, entryMarks, settings);
      const existing = await Result.findOne({ student: student._id, examName: examName.trim() });
      const finalMarks = scopeSubject && existing ? mergeMarks(existing.marks, normalizedMarks) : normalizedMarks;
      const finalAbsent = scopeSubject ? existing?.absent || false : Boolean(entry.absent);

      const result = await Result.findOneAndUpdate(
        { student: student._id, examName: examName.trim() },
        {
          student: student._id,
          examName: examName.trim(),
          marks: finalMarks,
          absent: finalAbsent,
        },
        { new: true, upsert: true, runValidators: true }
      );
      saved.push(result._id);
      notifyResultPublished(student, examName.trim()).catch(() => {});
    } catch (err) {
      failed.push({ studentId: entry.studentId, reason: err.message });
    }
  }

  res.status(201).json({ success: true, savedCount: saved.length, failedCount: failed.length, failed });
});

// @desc    Get all results, optionally filtered by examName or studentId.
//          Every result is decorated with per-subject grade/GPA/pass-fail
//          and an overall total/percentage/GPA/grade/pass-fail.
// @route   GET /api/results
const getResults = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.examName) filter.examName = req.query.examName;
  if (req.query.studentId && mongoose.Types.ObjectId.isValid(req.query.studentId)) {
    filter.student = req.query.studentId;
  }

  const results = await Result.find(filter)
    .populate("student", "name roll faculty studentClass optionalSubject")
    .sort({ createdAt: -1 });

  const settings = await getSettings();
  res.status(200).json({
    success: true,
    count: results.length,
    data: results.map((r) => decorateResult(r, settings)),
  });
});

// @desc    A combined progress report per student across every exam they
//          have a saved result for. Students are sorted by class then name
//          when no class filter is given, or just by name when one class is
//          selected — either way, alphabetical within its group.
// @route   GET /api/results/progress?studentClass=&faculty=
const getProgressReport = asyncHandler(async (req, res) => {
  const { studentClass, faculty, studentName } = req.query;

  const studentFilter = { archived: false };
  if (studentClass) studentFilter.studentClass = studentClass;
  if (faculty) studentFilter.faculty = faculty;
  if (studentName && studentName.trim()) {
    studentFilter.name = { $regex: studentName.trim(), $options: "i" };
  }

  const students = await Student.find(studentFilter).sort({ studentClass: 1, name: 1 });
  if (students.length === 0) {
    return res.status(200).json({ success: true, data: [] });
  }

  const results = await Result.find({ student: { $in: students.map((s) => s._id) } }).sort({
    createdAt: 1,
  });
  const settings = await getSettings();
  const resultsByStudent = {};
  results.forEach((r) => {
    const key = r.student.toString();
    if (!resultsByStudent[key]) resultsByStudent[key] = [];
    resultsByStudent[key].push(decorateResult(r, settings));
  });

  const data = students.map((student) => {
    const exams = resultsByStudent[student._id.toString()] || [];
    const overallAverage = exams.length
      ? Math.round((exams.reduce((sum, e) => sum + e.percentage, 0) / exams.length) * 100) / 100
      : null;

    return {
      student: {
        _id: student._id,
        name: student.name,
        roll: student.roll,
        faculty: student.faculty,
        studentClass: student.studentClass,
        optionalSubject: student.optionalSubject,
      },
      exams: exams.map((e) => ({
        examName: e.examName,
        totalObtained: e.totalObtained,
        totalFull: e.totalFull,
        percentage: e.percentage,
        grade: e.grade,
        gpa: e.gpa,
        passed: e.passed,
      })),
      overallAverage,
    };
  });

  res.status(200).json({ success: true, count: data.length, data });
});

// @desc    Delete a result
// @route   DELETE /api/results/:id
const deleteResult = asyncHandler(async (req, res) => {
  const result = await Result.findByIdAndDelete(req.params.id);
  if (!result) {
    return res.status(404).json({ success: false, message: "Result not found" });
  }
  res.status(200).json({ success: true, data: {} });
});

module.exports = {
  getSubjectsForStudentRoute,
  getExamNames,
  saveResult,
  getLedger,
  saveLedger,
  getResults,
  getProgressReport,
  deleteResult,
};
