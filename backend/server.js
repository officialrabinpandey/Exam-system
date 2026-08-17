require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { errorHandler, notFound } = require("./utils/errorHandler");
const { requireAuth } = require("./middleware/auth");
const { writeLimiter } = require("./middleware/rateLimiter");
const { auditLogger } = require("./middleware/auditLogger");
const { startScheduledBackups } = require("./utils/scheduledBackup");

const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const roomRoutes = require("./routes/roomRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const seatingRoutes = require("./routes/seatingRoutes");
const resultRoutes = require("./routes/resultRoutes");
const facultyRoutes = require("./routes/facultyRoutes");
const examRoutes = require("./routes/examRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const backupRoutes = require("./routes/backupRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const publicRoutes = require("./routes/publicRoutes");

// Connect to MongoDB
connectDB();

const app = express();

// CORS: restricted to the configured frontend origin(s). FRONTEND_URL can be
// a single URL or a comma-separated list (e.g. local + deployed). Falls back
// to allowing all origins only when FRONTEND_URL isn't set, so local
// development without a .env value still works out of the box.
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length === 0 ? true : allowedOrigins,
  })
);
app.use(express.json());

// Health check — always open, no login required, so uptime checks work
app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, message: "API is running" });
});

// Login is open (you need to be able to log in before you have a token to
// attach to requests). Everything else under /api/auth (me, logout, user
// management) requires a valid session, enforced per-route in authRoutes.
app.use("/api/auth", authRoutes);

// Public, unauthenticated read-only routes — e.g. a student looking up their
// own result by roll number. Deliberately outside the auth gate.
app.use("/api/public", publicRoutes);

// Everything else requires a logged-in session. Writes are additionally
// restricted to admins, rate-limited, and audit-logged with the acting user.
// Everything past this point requires a logged-in session. Which roles can
// write to which routes is enforced per-route (see each routes file) —
// e.g. teachers can enter marks only for their own subject, but can't touch
// students/rooms/seating; viewers can't write anywhere.
app.use("/api", requireAuth, writeLimiter, auditLogger);

// Routes
app.use("/api/students", studentRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/seating", seatingRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/faculties", facultyRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/audit-log", auditLogRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/settings", settingsRoutes);

// 404 + error handling (must be last)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startScheduledBackups();
});
