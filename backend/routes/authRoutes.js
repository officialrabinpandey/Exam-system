const express = require("express");
const router = express.Router();
const {
  login,
  forgotPassword,
  logout,
  getMe,
  changeOwnPassword,
  updateOwnEmail,
  getUsers,
  createUser,
  resetUserPassword,
  deleteUser,
} = require("../controllers/authController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { publicLimiter } = require("../middleware/rateLimiter");

// Open — no session required yet
router.post("/login", login);
router.post("/forgot-password", publicLimiter, forgotPassword);

// Require a valid session
router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, getMe);
router.patch("/me/password", requireAuth, changeOwnPassword);
router.patch("/me/email", requireAuth, updateOwnEmail);

// Admin-only user management
router.get("/users", requireAuth, requireRole("admin"), getUsers);
router.post("/users", requireAuth, requireRole("admin"), createUser);
router.patch("/users/:id/reset-password", requireAuth, requireRole("admin"), resetUserPassword);
router.delete("/users/:id", requireAuth, requireRole("admin"), deleteUser);

module.exports = router;
