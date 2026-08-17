const express = require("express");
const router = express.Router();
const { getAuditLog } = require("../controllers/auditLogController");
const { requireRole } = require("../middleware/auth");

router.get("/", requireRole("admin"), getAuditLog);

module.exports = router;
