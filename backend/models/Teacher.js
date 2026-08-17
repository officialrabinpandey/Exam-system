const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Teacher name is required"],
      trim: true,
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
    },
    // Optional — used to send a duty-assignment notification email if SMTP
    // is configured on the server. Left blank, notifications are simply skipped.
    email: {
      type: String,
      trim: true,
      default: "",
    },
    // Lets an admin manually correct the duty count shown for this teacher —
    // e.g. duties done before this system was in use, or a correction for
    // a duty tracked incorrectly. Added to the auto-counted total, and can
    // be negative to subtract.
    manualDutyAdjustment: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Teacher", teacherSchema);
