const crypto = require("crypto");

// scrypt-based password hashing using only Node's built-in crypto module —
// no bcrypt dependency needed. Format stored: "<salt-hex>:<hash-hex>".
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password, stored) => {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidateHash = crypto.scryptSync(password, salt, 64).toString("hex");
  const hashBuffer = Buffer.from(hash, "hex");
  const candidateBuffer = Buffer.from(candidateHash, "hex");
  if (hashBuffer.length !== candidateBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, candidateBuffer);
};

const generateToken = () => crypto.randomBytes(32).toString("hex");

module.exports = { hashPassword, verifyPassword, generateToken };
