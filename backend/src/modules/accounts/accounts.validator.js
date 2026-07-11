const { z } = require("zod");

const idParam = z.object({
  params: z.object({ id: z.string().uuid("ID invalido.") }),
});

const body = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio."),
  type: z.enum(["corrente", "poupanca", "investimento", "carteira", "dinheiro", "outros"]).optional(),
  balance: z.coerce.number().min(0, "Saldo nao pode ser negativo.").optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor invalida.").optional().nullable(),
  icon: z.string().optional().nullable(),
});

const createAccount = z.object({ body, params: z.object({}).optional(), query: z.object({}).optional() });
const updateAccount = z.object({ body: body.partial(), params: idParam.shape.params, query: z.object({}).optional() });

module.exports = { createAccount, idParam, updateAccount };
