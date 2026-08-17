const mongoose = require("mongoose");

// A single document holding system-wide, admin-editable grading rules —
// previously hardcoded constants. getSettings() below always returns exactly
// one document, auto-creating it with the original defaults on first use so
// existing behavior doesn't change until an admin actually edits something.
const gradeBandSchema = new mongoose.Schema(
  { min: Number, grade: String, gpa: Number },
  { _id: false }
);

// A per-subject override of the default theory/practical split — e.g.
// Computer is marked out of 50 theory + 50 practical instead of the usual
// 75/25. Any subject not listed here uses the default split.
const subjectOverrideSchema = new mongoose.Schema(
  { subject: String, theoryFullMarks: Number, practicalFullMarks: Number },
  { _id: false }
);

// Optional email (SMTP) configuration, settable directly from the Settings
// page instead of editing .env. If left blank here, the app falls back to
// SMTP_HOST/PORT/USER/PASS/FROM environment variables — either path works.
// Note: the password is stored as plain text in the database, same as any
// other app setting — fine for a self-hosted internal tool, but worth
// knowing if your database itself isn't otherwise secured.
const smtpSchema = new mongoose.Schema(
  {
    host: { type: String, default: "" },
    port: { type: Number, default: 587 },
    user: { type: String, default: "" },
    pass: { type: String, default: "" },
    from: { type: String, default: "" },
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema(
  {
    theoryPassMark: { type: Number, default: 27 },
    theoryFullMarks: { type: Number, default: 75 },
    practicalFullMarks: { type: Number, default: 25 },
    subjectOverrides: {
      type: [subjectOverrideSchema],
      default: [{ subject: "Computer", theoryFullMarks: 50, practicalFullMarks: 50 }],
    },
    smtp: { type: smtpSchema, default: () => ({}) },
    gradeScale: {
      type: [gradeBandSchema],
      default: [
        { min: 90, grade: "A+", gpa: 4.0 },
        { min: 80, grade: "A", gpa: 3.6 },
        { min: 70, grade: "B+", gpa: 3.2 },
        { min: 60, grade: "B", gpa: 2.8 },
        { min: 50, grade: "C+", gpa: 2.4 },
        { min: 40, grade: "C", gpa: 2.0 },
        { min: 0, grade: "NG", gpa: 0.0 },
      ],
    },
  },
  { timestamps: true }
);

const Settings = mongoose.model("Settings", settingsSchema);

// Fetches the single settings document, creating it with defaults if this
// is the very first call. Backfills subjectOverrides for any settings doc
// that predates this field, so the Computer 50/50 override still applies.
const getSettings = async () => {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  } else if (settings.subjectOverrides === undefined) {
    settings.subjectOverrides = [{ subject: "Computer", theoryFullMarks: 50, practicalFullMarks: 50 }];
    await settings.save();
  }
  return settings;
};

// Returns the { theoryFullMarks, practicalFullMarks } that apply to a given
// subject — the subject-specific override if one exists, otherwise the
// system default.
const fullMarksForSubject = (settings, subject) => {
  const override = settings.subjectOverrides?.find((o) => o.subject === subject);
  if (override) {
    return { theoryFullMarks: override.theoryFullMarks, practicalFullMarks: override.practicalFullMarks };
  }
  return { theoryFullMarks: settings.theoryFullMarks, practicalFullMarks: settings.practicalFullMarks };
};

module.exports = { Settings, getSettings, fullMarksForSubject };
