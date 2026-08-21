const usersService = require("../../users/users.service");

/**
 * Returns user data from req.user (already loaded by auth middleware)
 * or falls back to a DB query when req.user is insufficient.
 */
function resolveUser(userId, options = {}) {
  const u = options.reqUser;
  if (u && u.id && u.name && u.email) {
    return Promise.resolve({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
    });
  }
  return usersService.getProfile(userId);
}

module.exports = { resolveUser };
