const User = require("../models/User");
const Session = require("../models/Session");
const asyncHandler = require("../utils/asyncHandler");
const { hashPassword, verifyPassword, generateToken } = require("../utils/passwordUtils");
const { sendEmail, isConfigured } = require("../utils/notifications");

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

// @desc    Log in with username + password, returns a session token
// @route   POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password are required" });
  }

  const user = await User.findOne({ username: username.trim().toLowerCase() }).populate("teacher", "name subject");
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ success: false, message: "Incorrect username or password" });
  }

  const token = generateToken();
  await Session.create({ token, user: user._id, expiresAt: new Date(Date.now() + SESSION_DURATION_MS) });

  res.status(200).json({
    success: true,
    token,
    user: {
      id: user._id,
      username: user.username,
      role: user.role,
      teacherId: user.teacher?._id || null,
      teacherSubject: user.teacher?.subject || null,
    },
  });
});

// @desc    Self-service password reset — if the username exists and has an
//          email on file, generates a new temporary password, emails it, and
//          invalidates all existing sessions for that account. Always
//          returns the same generic response regardless of whether the
//          account exists, so this can't be used to check which usernames
//          are valid.
// @route   POST /api/auth/forgot-password
// @body    { username }
const forgotPassword = asyncHandler(async (req, res) => {
  const { username } = req.body;
  const genericResponse = {
    success: true,
    message: "If that account exists and has an email on file, a new password has been sent to it.",
  };

  if (!(await isConfigured())) {
    // Nothing to send through — still return the generic response so this
    // endpoint doesn't leak whether email is set up.
    return res.status(200).json(genericResponse);
  }
  if (!username) return res.status(200).json(genericResponse);

  const user = await User.findOne({ username: username.trim().toLowerCase() });
  if (!user || !user.email) {
    return res.status(200).json(genericResponse);
  }

  const tempPassword = generateToken().slice(0, 12);
  user.passwordHash = hashPassword(tempPassword);
  await user.save();
  await Session.deleteMany({ user: user._id }); // force re-login everywhere with the new password

  await sendEmail({
    to: user.email,
    subject: "Your password has been reset",
    text: `Hello ${user.username},\n\nYour password was reset. Your new temporary password is:\n\n${tempPassword}\n\nLog in with it and change it right away from Settings > My Account.\n\nIf you didn't request this, contact your admin immediately.\n\n— Examination Management System`,
  });

  res.status(200).json(genericResponse);
});

// @desc    Log out — invalidates the current session token
// @route   POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  const authHeader = req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) await Session.deleteOne({ token });
  res.status(200).json({ success: true });
});

// @desc    Get the currently logged-in user
// @route   GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: req.user });
});

// @desc    Change your own password
// @route   PATCH /api/auth/me/password
// @body    { currentPassword, newPassword }
const changeOwnPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
  }
  const user = await User.findById(req.user.id);
  if (!verifyPassword(currentPassword || "", user.passwordHash)) {
    return res.status(401).json({ success: false, message: "Current password is incorrect" });
  }
  user.passwordHash = hashPassword(newPassword);
  await user.save();
  res.status(200).json({ success: true });
});

// @desc    Update your own email (used for self-service password reset)
// @route   PATCH /api/auth/me/email
// @body    { email }
const updateOwnEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findById(req.user.id);
  user.email = (email || "").trim().toLowerCase();
  await user.save();
  res.status(200).json({ success: true, data: { email: user.email } });
});

// ---- Admin-only user management ----

// @desc    List all user accounts
// @route   GET /api/auth/users
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().populate("teacher", "name subject").select("-passwordHash").sort({ username: 1 });
  res.status(200).json({ success: true, data: users });
});

// @desc    Create a new user account
// @route   POST /api/auth/users
// @body    { username, password, role, teacherId? }
const createUser = asyncHandler(async (req, res) => {
  const { username, password, role, teacherId, email } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
  }
  if (role === "teacher" && !teacherId) {
    return res.status(400).json({ success: false, message: "A teacher-role account must be linked to a Teacher record" });
  }

  const user = await User.create({
    username: username.trim().toLowerCase(),
    email: email ? email.trim().toLowerCase() : "",
    passwordHash: hashPassword(password),
    role: role || "viewer",
    teacher: role === "teacher" ? teacherId : null,
  });

  res.status(201).json({
    success: true,
    data: { id: user._id, username: user.username, email: user.email, role: user.role, teacher: user.teacher },
  });
});

// @desc    Admin resets another user's password
// @route   PATCH /api/auth/users/:id/reset-password
// @body    { newPassword }
const resetUserPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  user.passwordHash = hashPassword(newPassword);
  await user.save();
  await Session.deleteMany({ user: user._id }); // force re-login everywhere
  res.status(200).json({ success: true });
});

// @desc    Delete a user account
// @route   DELETE /api/auth/users/:id
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  await Session.deleteMany({ user: user._id });
  res.status(200).json({ success: true, data: {} });
});

module.exports = {
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
};
