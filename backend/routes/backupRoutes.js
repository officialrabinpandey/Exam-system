const express = require("express");
const router = express.Router();
const { downloadBackup } = require("../controllers/backupController");
const { requireRole } = require("../middleware/auth");

router.get("/", requireRole("admin"), downloadBackup);

module.exports = router;
