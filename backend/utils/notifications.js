// Optional email notifications. Every function here is a no-op unless SMTP
// is configured — either via the Settings page (stored in the database) or
// via SMTP_HOST/SMTP_USER/SMTP_PASS environment variables. The database
// config takes priority when both are present. Safe to call unconditionally
// throughout the app without "if configured" checks at every call site.

// Resolves the active SMTP config from DB settings (if set) or env vars.
// Returns null if neither source has enough to actually send mail.
const resolveSmtpConfig = async () => {
  const { getSettings } = require("../models/Settings");
  const settings = await getSettings();
  const dbSmtp = settings.smtp || {};

  const host = dbSmtp.host || process.env.SMTP_HOST;
  const user = dbSmtp.user || process.env.SMTP_USER;
  const pass = dbSmtp.pass || process.env.SMTP_PASS;
  const port = dbSmtp.host ? dbSmtp.port : Number(process.env.SMTP_PORT) || 587;
  const from = dbSmtp.host ? dbSmtp.from || dbSmtp.user : process.env.SMTP_FROM || process.env.SMTP_USER;

  if (!host || !user || !pass) return null;
  return { host, port, user, pass, from };
};

const isConfigured = async () => Boolean(await resolveSmtpConfig());

const buildTransporter = (config) => {
  const nodemailer = require("nodemailer");
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: Number(config.port) === 465,
    auth: { user: config.user, pass: config.pass },
  });
};

// Sends an email if SMTP is configured; otherwise resolves immediately.
// Failures are logged, never thrown — a notification failing must never
// break the actual request that triggered it (e.g. generating a seating plan).
const sendEmail = async ({ to, subject, text }) => {
  if (!to) return;
  const config = await resolveSmtpConfig();
  if (!config) return; // not configured — silently skip

  try {
    const transporter = buildTransporter(config);
    await transporter.sendMail({ from: config.from, to, subject, text });
  } catch (err) {
    console.error(`Email notification failed (to: ${to}):`, err.message);
  }
};

// Sends a test email and THROWS on failure (unlike sendEmail above) — used
// by the "Send test email" button in Settings, where the admin needs to see
// the actual error rather than have it silently swallowed.
const sendTestEmail = async (to) => {
  const config = await resolveSmtpConfig();
  if (!config) {
    throw new Error("SMTP isn't configured yet — fill in the fields above and save first.");
  }
  const transporter = buildTransporter(config);
  await transporter.sendMail({
    from: config.from,
    to,
    subject: "Test email — Examination Management System",
    text: "If you're reading this, your SMTP configuration is working correctly.",
  });
};

// @desc  Notify a teacher they've been assigned invigilation duty.
const notifyTeacherDutyAssigned = async (teacher, room, examDate) => {
  if (!teacher?.email) return;
  await sendEmail({
    to: teacher.email,
    subject: `Exam duty assigned — ${examDate}`,
    text: `Hello ${teacher.name},\n\nYou have been assigned to invigilate ${room.name} on ${examDate}.\n\n— Examination Management System`,
  });
};

// @desc  Notify a student's guardian that a result has been published.
const notifyResultPublished = async (student, examName) => {
  if (!student?.guardianContact || !student.guardianContact.includes("@")) return; // only email-looking contacts
  await sendEmail({
    to: student.guardianContact,
    subject: `Result published — ${examName}`,
    text: `Dear Guardian,\n\n${student.name}'s result for "${examName}" has been published. Please check with the school or the result lookup page for details.\n\n— Examination Management System`,
  });
};

module.exports = {
  isConfigured,
  sendEmail,
  sendTestEmail,
  notifyTeacherDutyAssigned,
  notifyResultPublished,
};
