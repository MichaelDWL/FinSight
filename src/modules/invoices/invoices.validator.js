const { z } = require("zod");

const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "ID invalido.");

const cardParam = z.object({
  params: z.object({ cardId: uuid }),
});

const idParam = z.object({
  params: z.object({ id: uuid }),
});

module.exports = { cardParam, idParam };
