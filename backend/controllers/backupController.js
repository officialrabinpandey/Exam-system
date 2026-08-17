const Student = require("../models/Student");
const Room = require("../models/Room");
const Teacher = require("../models/Teacher");
const Seating = require("../models/Seating");
const Result = require("../models/Result");
const asyncHandler = require("../utils/asyncHandler");

// @desc    Export every collection as one downloadable JSON file — a manual
//          backup mechanism independent of any hosting provider's own
//          automated backups.
// @route   GET /api/backup
const downloadBackup = asyncHandler(async (req, res) => {
  const [students, rooms, teachers, seatings, results] = await Promise.all([
    Student.find(),
    Room.find(),
    Teacher.find(),
    Seating.find(),
    Result.find(),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    students,
    rooms,
    teachers,
    seatings,
    results,
  };

  res.setHeader("Content-Disposition", `attachment; filename="backup-${Date.now()}.json"`);
  res.setHeader("Content-Type", "application/json");
  res.status(200).send(JSON.stringify(backup, null, 2));
});

module.exports = { downloadBackup };
