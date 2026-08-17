const Exam = require("../models/Exam");
const Result = require("../models/Result");
const asyncHandler = require("../utils/asyncHandler");

// @desc    List all exams, most recently created first
// @route   GET /api/exams
const getExams = asyncHandler(async (req, res) => {
  const exams = await Exam.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: exams.length, data: exams });
});

// @desc    Create a new exam name — admin only
// @route   POST /api/exams
const createExam = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: "Exam name is required" });
  }
  const exam = await Exam.create({ name: name.trim() });
  res.status(201).json({ success: true, data: exam });
});

// @desc    Rename an exam — admin only. Cascades: every existing Result
//          under the old name is updated to the new name, so the ledger,
//          progress reports, and everything else stay consistent instead of
//          silently forking into two different-looking exams.
// @route   PUT /api/exams/:id
const updateExam = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: "Exam name is required" });
  }

  const exam = await Exam.findById(req.params.id);
  if (!exam) {
    return res.status(404).json({ success: false, message: "Exam not found" });
  }

  const oldName = exam.name;
  const newName = name.trim();
  if (oldName === newName) {
    return res.status(200).json({ success: true, data: exam });
  }

  exam.name = newName;
  await exam.save();

  const cascade = await Result.updateMany({ examName: oldName }, { $set: { examName: newName } });

  res.status(200).json({ success: true, data: exam, resultsUpdated: cascade.modifiedCount });
});

// @desc    Delete an exam from the picklist — admin only. Does NOT delete or
//          alter any Result documents already saved under that name; it just
//          removes it from the dropdown for new ledger entries going forward.
// @route   DELETE /api/exams/:id
const deleteExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findByIdAndDelete(req.params.id);
  if (!exam) {
    return res.status(404).json({ success: false, message: "Exam not found" });
  }
  res.status(200).json({ success: true, data: {} });
});

module.exports = { getExams, createExam, updateExam, deleteExam };
