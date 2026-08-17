const express = require("express");
const router = express.Router();
const {
  getTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  getDutySummary,
  setDutyCount,
  suggestTeacher,
} = require("../controllers/teacherController");
const { requireRole } = require("../middleware/auth");

router.get("/duty-summary", getDutySummary);
router.get("/suggest", suggestTeacher);
router.route("/").get(getTeachers).post(requireRole("admin"), createTeacher);
router
  .route("/:id")
  .get(getTeacher)
  .put(requireRole("admin"), updateTeacher)
  .delete(requireRole("admin"), deleteTeacher);
router.patch("/:id/duty-count", requireRole("admin"), setDutyCount);

module.exports = router;
