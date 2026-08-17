const mongoose = require("mongoose");

// A timestamped, attributed record of every mutating (write) request made
// by a logged-in user.
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: String, default: "unknown" }, // username of who made the change
    method: { type: String, required: true },
    path: { type: String, required: true },
    statusCode: { type: Number, required: true },
    summary: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
