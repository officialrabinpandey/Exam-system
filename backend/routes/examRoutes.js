const express = require("express");
const router = express.Router();
const { getExams, createExam, updateExam, deleteExam } = require("../controllers/examController");
const { requireRole } = require("../middleware/auth");

router.route("/").get(getExams).post(requireRole("admin"), createExam);
router.route("/:id").put(requireRole("admin"), updateExam).delete(requireRole("admin"), deleteExam);

module.exports = router;
