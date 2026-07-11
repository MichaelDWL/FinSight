const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

function getCurrentUserId(_req) {
  return DEMO_USER_ID;
}

module.exports = { DEMO_USER_ID, getCurrentUserId };
