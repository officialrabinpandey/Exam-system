const express = require("express");
const router = express.Router();
const { getFaculties, createFaculty, updateFaculty, deleteFaculty } = require("../controllers/facultyController");
const { requireRole } = require("../middleware/auth");

router.route("/").get(getFaculties).post(requireRole("admin"), createFaculty);
router.route("/:id").put(requireRole("admin"), updateFaculty).delete(requireRole("admin"), deleteFaculty);

module.exports = router;
