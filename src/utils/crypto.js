const crypto = require("crypto");
const argon2 = require("argon2");

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

async function hashPassword(password) {
  return argon2.hash(password, ARGON2_OPTIONS);
}

async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function timingSafeEqualString(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  hashPassword,
  verifyPassword,
  hashToken,
  generateSecureToken,
  timingSafeEqualString,
};
