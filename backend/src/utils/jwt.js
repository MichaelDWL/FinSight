const jwt = require("jsonwebtoken");
const env = require("../config/env");
const AppError = require("./AppError");

function signAccessToken(payload) {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
    issuer: "finsight",
    audience: "finsight-api",
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
    issuer: "finsight",
    audience: "finsight-refresh",
  });
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.jwtAccessSecret, {
      issuer: "finsight",
      audience: "finsight-api",
    });
  } catch {
    throw new AppError("Sessao invalida ou expirada.", 401);
  }
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, env.jwtRefreshSecret, {
      issuer: "finsight",
      audience: "finsight-refresh",
    });
  } catch {
    throw new AppError("Refresh token invalido ou expirado.", 401);
  }
}

function decodeTokenUnsafe(token) {
  return jwt.decode(token);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeTokenUnsafe,
};
