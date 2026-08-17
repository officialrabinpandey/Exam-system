const mongoose = require("mongoose");

// A faculty's subject structure: a fixed set of compulsory subjects, plus at
// most one elective group where a student picks exactly one option (this is
// the generalized form of Science's "Computer or Biology" choice — a new
// faculty like Humanities or Law can define its own elective group, or none
// at all, entirely from the admin UI, with no code changes required).
const facultySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Faculty name is required"],
      trim: true,
      unique: true,
    },
    compulsorySubjects: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.every((s) => s && s.trim().length > 0),
        message: "Subject names cannot be blank",
      },
    },
    // Optional — leave both blank for a faculty with no elective choice.
    electiveGroupName: {
      type: String,
      trim: true,
      default: "",
    },
    electiveOptions: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// The full list of subjects a student in this faculty could ever be marked
// on — compulsory subjects plus every elective option (used for ledger
// column headers, which must show every possible elective as its own column).
facultySchema.methods.allSubjectColumns = function () {
  return [...this.compulsorySubjects, ...this.electiveOptions];
};

// The actual subject list for one specific student: compulsory subjects plus
// only the elective option they chose (if this faculty has an elective group).
facultySchema.methods.subjectsForElectiveChoice = function (electiveChoice) {
  if (this.electiveOptions.length === 0) return [...this.compulsorySubjects];
  return [...this.compulsorySubjects, electiveChoice];
};

module.exports = mongoose.model("Faculty", facultySchema);
