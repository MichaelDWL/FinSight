const { z } = require("zod");

const idParam = z.object({
  params: z.object({ id: z.string().uuid("ID invalido.") }),
});

const body = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio."),
  target: z.coerce.number().positive("Valor alvo deve ser maior que zero."),
  current: z.coerce.number().min(0, "Valor atual nao pode ser negativo.").optional(),
  deadline: z.string().min(1, "Prazo obrigatorio."),
  status: z.enum(["ativa", "inativa", "confirmada", "cancelada"]).optional(),
});

const createGoal = z.object({ body, params: z.object({}).optional(), query: z.object({}).optional() });
const updateGoal = z.object({ body: body.partial(), params: idParam.shape.params, query: z.object({}).optional() });

module.exports = { createGoal, idParam, updateGoal };
