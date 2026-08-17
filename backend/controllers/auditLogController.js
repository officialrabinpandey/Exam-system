const AuditLog = require("../models/AuditLog");
const asyncHandler = require("../utils/asyncHandler");

// @desc    List recent audit log entries, most recent first
// @route   GET /api/audit-log?limit=100
const getAuditLog = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const entries = await AuditLog.find().sort({ createdAt: -1 }).limit(limit);
  res.status(200).json({ success: true, count: entries.length, data: entries });
});

module.exports = { getAuditLog };
