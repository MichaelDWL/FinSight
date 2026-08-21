const crypto = require("crypto");

/** Lazy: argon2 e native e so necessario em login/register/reset — nao no cold path de GET BFF. */
let argon2Module = null;
function getArgon2() {
  if (!argon2Module) {
    argon2Module = require("argon2");
  }
  return argon2Module;
}

function argon2Options() {
  const argon2 = getArgon2();
  return {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  };
}

async function hashPassword(password) {
  const argon2 = getArgon2();
  return argon2.hash(password, argon2Options());
}

async function verifyPassword(hash, password) {
  try {
    const argon2 = getArgon2();
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
