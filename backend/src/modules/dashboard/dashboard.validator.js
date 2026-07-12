const { z } = require("zod");
const { PERIOD_OPTIONS, DEFAULT_PERIOD } = require("../analytics/constants");

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD.");

const periodQuery = z
  .object({
    query: z.object({
      period: z.enum(PERIOD_OPTIONS).optional().default(DEFAULT_PERIOD),
      from: isoDate.optional(),
      to: isoDate.optional(),
    }),
  })
  .superRefine((value, ctx) => {
    if (value.query.period === "custom" && (!value.query.from || !value.query.to)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe from e to para period=custom.",
        path: ["query", "from"],
      });
    }
  });

module.exports = { periodQuery };
