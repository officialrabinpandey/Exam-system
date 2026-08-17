const express = require("express");
const router = express.Router();
const {
  getSubjectsForStudentRoute,
  getExamNames,
  saveResult,
  getLedger,
  saveLedger,
  getResults,
  getProgressReport,
  deleteResult,
} = require("../controllers/resultController");
const { requireRole } = require("../middleware/auth");

// Reads — open to any logged-in role
router.get("/subjects/:studentId", getSubjectsForStudentRoute);
router.get("/exam-names", getExamNames);
router.get("/progress", getProgressReport);
router.get("/ledger", getLedger);
router.get("/", getResults);

// Writes — admins can enter marks for any subject; teachers can enter marks
// only for their own linked subject (enforced inside the controller).
// Viewers can't write at all.
router.post("/ledger", requireRole("admin", "teacher"), saveLedger);
router.post("/", requireRole("admin", "teacher"), saveResult);

// Deletes remain admin-only
router.delete("/:id", requireRole("admin"), deleteResult);

module.exports = router;
