const Session = require("../models/Session");

// Requires a valid session token in the "Authorization: Bearer <token>"
// header. Attaches req.user = { id, username, role, teacherId } on success.
const requireAuth = async (req, res, next) => {
  const authHeader = req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }

  const session = await Session.findOne({ token }).populate("user");
  if (!session || !session.user || session.expiresAt < new Date()) {
    return res.status(401).json({ success: false, message: "Session expired or invalid — please log in again" });
  }

  req.user = {
    id: session.user._id,
    username: session.user.username,
    role: session.user.role,
    teacherId: session.user.teacher,
  };
  next();
};

// Restricts a route to one or more roles. Use after requireAuth.
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "You don't have permission to do this" });
  }
  next();
};

module.exports = { requireAuth, requireRole };
