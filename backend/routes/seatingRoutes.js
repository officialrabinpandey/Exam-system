const express = require("express");
const router = express.Router();
const {
  generateSeating,
  generateSeatingMulti,
  getSeatings,
  getSeating,
  updateSeating,
  markAttendance,
  restoreSeating,
  deleteSeating,
} = require("../controllers/seatingController");
const { requireRole } = require("../middleware/auth");

router.post("/generate", requireRole("admin"), generateSeating);
router.post("/generate-multi", requireRole("admin"), generateSeatingMulti);
router.get("/", getSeatings);
router.get("/:id", getSeating);
router.put("/:id", requireRole("admin"), updateSeating);
router.patch("/:id/attendance", requireRole("admin"), markAttendance);
router.post("/:id/restore", requireRole("admin"), restoreSeating);
router.delete("/:id", requireRole("admin"), deleteSeating);

module.exports = router;
