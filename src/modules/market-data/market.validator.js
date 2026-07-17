const { z } = require("zod");

const assetCodeParam = z.object({
  params: z.object({
    code: z
      .string()
      .trim()
      .min(1, "Codigo do ativo obrigatorio.")
      .max(40),
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

const listAssetsQuery = z.object({
  query: z
    .object({
      type: z
        .enum(["stock", "index", "commodity", "crypto", "etf", "fii", "fx", "other"])
        .optional(),
    })
    .optional(),
  params: z.object({}).optional(),
  body: z.object({}).optional(),
});

const historyQuery = z.object({
  query: z
    .object({
      indicator: z.enum(["SELIC", "IPCA", "CDI", "USD", "EUR"]).optional(),
      limit: z.coerce.number().int().min(1).max(365).optional(),
    })
    .optional(),
  params: z.object({}).optional(),
  body: z.object({}).optional(),
});

const marketHistoryQuery = z.object({
  query: z.object({
    code: z.string().trim().min(1).max(40).optional(),
    asset: z.string().trim().min(1).max(40).optional(),
    limit: z.coerce.number().int().min(1).max(2000).optional(),
  }),
  params: z.object({}).optional(),
  body: z.object({}).optional(),
});

const providersStatusQuery = z.object({
  query: z
    .object({
      refresh: z
        .union([z.literal("true"), z.literal("false"), z.boolean()])
        .optional()
        .transform((value) => value === true || value === "true"),
    })
    .optional(),
  params: z.object({}).optional(),
  body: z.object({}).optional(),
});

module.exports = {
  assetCodeParam,
  historyQuery,
  listAssetsQuery,
  marketHistoryQuery,
  providersStatusQuery,
};
