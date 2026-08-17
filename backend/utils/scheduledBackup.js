const fs = require("fs");
const path = require("path");
const Student = require("../models/Student");
const Room = require("../models/Room");
const Teacher = require("../models/Teacher");
const Seating = require("../models/Seating");
const Result = require("../models/Result");

const BACKUP_DIR = path.join(__dirname, "..", "backups");
const MAX_BACKUPS_TO_KEEP = 14; // ~2 weeks at one-per-day, prevents unbounded disk growth

const writeBackupToDisk = async () => {
  const [students, rooms, teachers, seatings, results] = await Promise.all([
    Student.find(),
    Room.find(),
    Teacher.find(),
    Seating.find(),
    Result.find(),
  ]);

  const backup = { exportedAt: new Date().toISOString(), students, rooms, teachers, seatings, results };

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const filename = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  fs.writeFileSync(path.join(BACKUP_DIR, filename), JSON.stringify(backup, null, 2));

  // Prune old backups beyond the retention limit
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("backup-") && f.endsWith(".json"))
    .sort();
  while (files.length > MAX_BACKUPS_TO_KEEP) {
    fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  }

  return filename;
};

// Starts an interval-based automatic backup. Disabled unless BACKUP_ENABLED
// is explicitly set — a scheduled job writing to disk isn't something to
// turn on silently by default. Interval configurable via BACKUP_INTERVAL_HOURS.
const startScheduledBackups = () => {
  if (process.env.BACKUP_ENABLED !== "true") return;

  const intervalHours = Number(process.env.BACKUP_INTERVAL_HOURS) || 24;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  console.log(`Scheduled backups enabled — writing to ${BACKUP_DIR} every ${intervalHours}h`);

  writeBackupToDisk().catch((err) => console.error("Initial backup failed:", err.message));
  setInterval(() => {
    writeBackupToDisk().catch((err) => console.error("Scheduled backup failed:", err.message));
  }, intervalMs);
};

module.exports = { startScheduledBackups, writeBackupToDisk, BACKUP_DIR };
