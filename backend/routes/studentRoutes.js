const express = require("express");
const multer = require("multer");
const router = express.Router();
const {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  promoteStudents,
  importPreview,
  importCommit,
} = require("../controllers/studentController");
const { requireRole } = require("../middleware/auth");

// In-memory storage — files are parsed immediately and never written to disk
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post("/import/preview", requireRole("admin"), upload.single("file"), importPreview);
router.post("/import/commit", requireRole("admin"), importCommit);
router.patch("/promote", requireRole("admin"), promoteStudents);

router.route("/").get(getStudents).post(requireRole("admin"), createStudent);
router
  .route("/:id")
  .get(getStudent)
  .put(requireRole("admin"), updateStudent)
  .delete(requireRole("admin"), deleteStudent);

module.exports = router;
