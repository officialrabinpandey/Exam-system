const mongoose = require("mongoose");

// A named exam/terminal (e.g. "First Terminal Examination"). Admins manage
// this list from the Dashboard so the Results ledger can offer a dropdown
// instead of free-typed text — which was fragmenting data via typos
// ("First Terminal" vs "1st Terminal Exam" being treated as different exams).
const examSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Exam name is required"],
      trim: true,
      unique: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Exam", examSchema);
