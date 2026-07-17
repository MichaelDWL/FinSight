const { z } = require("zod");

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "ID invalido.");

const investmentTypes = z.enum([
  "tesouro_selic",
  "tesouro_ipca",
  "tesouro_prefixado",
  "cdb",
  "lci",
  "lca",
  "poupanca",
  "acoes",
  "fiis",
  "etfs",
  "criptomoedas",
  "fundos",
  "outro",
]);

const idParam = z.object({
  params: z.object({ id: uuid }),
});

const body = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio."),
  institution: z.string().optional().nullable(),
  categoryId: uuid.optional().nullable(),
  invested: z.coerce.number().positive("Valor investido deve ser maior que zero."),
  value: z.coerce.number().min(0, "Valor atual nao pode ser negativo.").optional(),
  date: z.string().min(1, "Data obrigatoria."),
  notes: z.string().optional().nullable(),
  investmentType: investmentTypes.optional().nullable(),
  assetCode: z.string().trim().max(40).optional().nullable(),
  quantity: z.coerce.number().positive().optional().nullable(),
  cdiPercent: z.coerce.number().min(0).max(500).optional().nullable(),
  prefixedRate: z.coerce.number().min(0).max(100).optional().nullable(),
  ipcaSpread: z.coerce.number().min(-50).max(100).optional().nullable(),
  currency: z.string().trim().length(3).optional().nullable(),
});

const createInvestment = z.object({ body, params: z.object({}).optional(), query: z.object({}).optional() });
const updateInvestment = z.object({ body: body.partial(), params: idParam.shape.params, query: z.object({}).optional() });

const projectBody = z.object({
  invested: z.coerce.number().positive("Valor investido deve ser maior que zero."),
  investmentType: investmentTypes,
  cdiPercent: z.coerce.number().min(0).max(500).optional().nullable(),
  prefixedRate: z.coerce.number().min(0).max(100).optional().nullable(),
  ipcaSpread: z.coerce.number().min(-50).max(100).optional().nullable(),
});

const projectInvestment = z.object({
  body: projectBody,
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

module.exports = { createInvestment, idParam, projectInvestment, updateInvestment };
