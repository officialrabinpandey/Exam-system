const express = require("express");
const router = express.Router();
const { getSettingsRoute, updateSettings, testEmail } = require("../controllers/settingsController");
const { requireRole } = require("../middleware/auth");

router.get("/", requireRole("admin"), getSettingsRoute);
router.put("/", requireRole("admin"), updateSettings);
router.post("/test-email", requireRole("admin"), testEmail);

module.exports = router;
