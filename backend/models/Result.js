const mongoose = require("mongoose");

// NEB-style split: 75 theory marks + 25 practical marks = 100 per subject.
// Pass marks: 27/75 in theory (per NEB convention), 10/25 in practical.
const markSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },
    theoryFullMarks: { type: Number, required: true, default: 75, min: 1 },
    theoryObtained: { type: Number, required: true, min: 0 },
    practicalFullMarks: { type: Number, required: true, default: 25, min: 0 },
    practicalObtained: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    examName: {
      type: String,
      required: [true, "Exam name is required"],
      trim: true,
    },
    // Whole-exam absence — distinct from an actual zero score. When true,
    // every subject is treated as absent/failed regardless of any marks
    // stored, and marks inputs are disabled on the ledger for this student.
    absent: {
      type: Boolean,
      default: false,
    },
    marks: {
      type: [markSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one subject's marks are required",
      },
    },
  },
  { timestamps: true }
);

// One result document per student per named exam
resultSchema.index({ student: 1, examName: 1 }, { unique: true });

module.exports = mongoose.model("Result", resultSchema);
