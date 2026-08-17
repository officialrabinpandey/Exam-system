const AuditLog = require("../models/AuditLog");

// Logs every mutating (POST/PUT/PATCH/DELETE) request after it completes,
// with its final status code. Fire-and-forget — a logging failure must
// never break the actual request, so errors here are swallowed.
const auditLogger = (req, res, next) => {
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (!mutating || req.path.startsWith("/api/audit-log")) return next();

  res.on("finish", () => {
    AuditLog.create({
      actor: req.user?.username || "unknown",
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      summary: summarize(req),
    }).catch(() => {});
  });
  next();
};

// A short human-readable hint of what the request was — best-effort only.
const summarize = (req) => {
  const parts = [req.method, req.baseUrl || req.path];
  if (req.body && typeof req.body === "object") {
    if (req.body.name) parts.push(`name="${req.body.name}"`);
    else if (req.body.examName) parts.push(`exam="${req.body.examName}"`);
  }
  return parts.join(" ");
};

module.exports = { auditLogger };
