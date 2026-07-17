const { z } = require("zod");

const consent = z.object({
  body: z.object({
    type: z.enum(["privacy_policy", "terms", "marketing", "analytics"]),
    accepted: z.boolean().optional().default(true),
  }),
});

module.exports = { consent };
