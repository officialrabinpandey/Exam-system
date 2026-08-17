const { getSettings } = require("../models/Settings");
const asyncHandler = require("../utils/asyncHandler");
const { sendTestEmail } = require("../utils/notifications");

const PASSWORD_UNCHANGED_SENTINEL = "__UNCHANGED__";

// @desc    Get the current grading settings (auto-created with defaults on
//          first call). The SMTP password is never sent back to the client —
//          replaced with a sentinel so the Settings page can show "already
//          set" without exposing the actual secret over the network.
// @route   GET /api/settings
const getSettingsRoute = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const safe = settings.toObject();
  safe.smtp = {
    ...safe.smtp,
    pass: safe.smtp?.pass ? PASSWORD_UNCHANGED_SENTINEL : "",
  };
  res.status(200).json({ success: true, data: safe });
});

// @desc    Update grading settings — theory pass mark, marks split, per-subject
//          overrides, the full grade scale, or SMTP email config. Admin only
//          (enforced by the requireRole("admin") guard on this route).
// @route   PUT /api/settings
const updateSettings = asyncHandler(async (req, res) => {
  const { theoryPassMark, theoryFullMarks, practicalFullMarks, subjectOverrides, gradeScale, smtp } = req.body;

  if (Array.isArray(gradeScale)) {
    for (const band of gradeScale) {
      if (typeof band.min !== "number" || !band.grade || typeof band.gpa !== "number") {
        return res.status(400).json({
          success: false,
          message: "Each grade band needs a numeric min, a grade label, and a numeric gpa",
        });
      }
    }
  }

  if (Array.isArray(subjectOverrides)) {
    for (const o of subjectOverrides) {
      if (!o.subject || typeof o.theoryFullMarks !== "number" || typeof o.practicalFullMarks !== "number") {
        return res.status(400).json({
          success: false,
          message: "Each subject override needs a subject name, a numeric theoryFullMarks, and a numeric practicalFullMarks",
        });
      }
    }
  }

  const settings = await getSettings();
  if (theoryPassMark !== undefined) settings.theoryPassMark = theoryPassMark;
  if (theoryFullMarks !== undefined) settings.theoryFullMarks = theoryFullMarks;
  if (practicalFullMarks !== undefined) settings.practicalFullMarks = practicalFullMarks;
  if (Array.isArray(subjectOverrides)) settings.subjectOverrides = subjectOverrides;
  if (smtp && typeof smtp === "object") {
    const keepExistingPass = smtp.pass === undefined || smtp.pass === PASSWORD_UNCHANGED_SENTINEL;
    settings.smtp = {
      host: smtp.host || "",
      port: Number(smtp.port) || 587,
      user: smtp.user || "",
      pass: keepExistingPass ? settings.smtp?.pass || "" : smtp.pass,
      from: smtp.from || "",
    };
  }
  if (Array.isArray(gradeScale)) {
    // Highest threshold first, so gradeForPercentage's "first match" logic works
    settings.gradeScale = [...gradeScale].sort((a, b) => b.min - a.min);
  }
  await settings.save();

  res.status(200).json({ success: true, data: settings });
});

// @desc    Send a test email using the current SMTP config (DB or env) —
//          surfaces the real error if it fails, instead of the silent
//          no-op that every other notification path uses on purpose.
// @route   POST /api/settings/test-email
// @body    { to }
const testEmail = asyncHandler(async (req, res) => {
  const { to } = req.body;
  if (!to) {
    return res.status(400).json({ success: false, message: "An email address to send the test to is required" });
  }
  try {
    await sendTestEmail(to);
    res.status(200).json({ success: true, message: `Test email sent to ${to}.` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = { getSettingsRoute, updateSettings, testEmail };
