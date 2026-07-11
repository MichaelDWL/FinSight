const { z } = require("zod");

const idParam = z.object({
  params: z.object({ id: z.string().uuid("ID invalido.") }),
});

const body = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio."),
  institution: z.string().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  invested: z.coerce.number().positive("Valor investido deve ser maior que zero."),
  value: z.coerce.number().min(0, "Valor atual nao pode ser negativo.").optional(),
  date: z.string().min(1, "Data obrigatoria."),
  notes: z.string().optional().nullable(),
});

const createInvestment = z.object({ body, params: z.object({}).optional(), query: z.object({}).optional() });
const updateInvestment = z.object({ body: body.partial(), params: idParam.shape.params, query: z.object({}).optional() });

module.exports = { createInvestment, idParam, updateInvestment };
