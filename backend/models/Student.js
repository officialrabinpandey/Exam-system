const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Student name is required"],
      trim: true,
    },
    // Matched against a Faculty document by name — no longer a fixed enum,
    // so new faculties can be added from the admin UI without a code change.
    faculty: {
      type: String,
      required: [true, "Faculty is required"],
      trim: true,
    },
    studentClass: {
      type: String,
      required: [true, "Class is required"],
      enum: {
        values: ["11", "12"],
        message: "Class must be either 11 or 12",
      },
    },
    // The student's choice within their faculty's elective group, e.g.
    // "Biology" or "Computer" for Science. Blank/unset for a faculty with no
    // elective group at all. Validated against that faculty's electiveOptions
    // in the controller, not here, since that requires a DB lookup.
    optionalSubject: {
      type: String,
      trim: true,
      default: "",
    },
    // Official identifiers for external reporting (e.g. to an exam board) —
    // both optional, since not every school assigns these immediately.
    symbolNumber: {
      type: String,
      trim: true,
      default: "",
    },
    registrationNumber: {
      type: String,
      trim: true,
      default: "",
    },
    guardianName: {
      type: String,
      trim: true,
      default: "",
    },
    guardianContact: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      default: "",
    },
    batchYear: {
      type: Number,
      required: [true, "Batch year is required"],
      min: [2000, "Batch year looks invalid"],
      max: [2200, "Batch year looks invalid"],
    },
    // Auto-generated on creation as <2-digit batch year>-<sequence number>, e.g. "81-7049".
    roll: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    // Soft-delete flag — deleting a student archives them instead of removing
    // the record, so historical seating plans and results stay meaningful.
    archived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema);

