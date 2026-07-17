const { parseDeviceInfo } = require("../../utils/requestMeta");
const auditRepository = require("./audit.repository");

async function writeAudit(req, {
  userId = null,
  actorId = null,
  action,
  result = "sucesso",
  metadata = {},
  client,
}) {
  const meta = parseDeviceInfo(req || { headers: {}, ip: null });

  await auditRepository.create(
    {
      userId,
      actorId: actorId || userId,
      action,
      result,
      ip: meta.ip,
      device: meta.device,
      browser: meta.browser,
      operatingSystem: meta.operatingSystem,
      userAgent: meta.userAgent,
      metadata,
    },
    client
  );
}

module.exports = { writeAudit };
