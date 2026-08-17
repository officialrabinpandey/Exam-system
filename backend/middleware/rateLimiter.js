const rateLimit = require("express-rate-limit");

// Applied only to mutating requests (POST/PUT/DELETE) — read traffic is
// left unrestricted since GETs are cheap and browsing shouldn't be limited.
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120, // generous for legitimate admin use, tight enough to blunt abuse/scripted bulk writes
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many changes in a short time — please slow down." },
  skip: (req) => !["POST", "PUT", "DELETE"].includes(req.method),
});

// Tighter limit for unauthenticated public endpoints (e.g. the result
// lookup) — no login is required, so this is the only thing stopping
// someone from scripting roll-number/exam-name guesses.
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many lookups — please try again later." },
});

module.exports = { writeLimiter, publicLimiter };
