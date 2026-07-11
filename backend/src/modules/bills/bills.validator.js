const { z } = require("zod");

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "ID invalido.");

const idParam = z.object({
  params: z.object({ id: uuid }),
});

const body = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio."),
  category: z.string().optional(),
  value: z.coerce.number().positive("Valor deve ser maior que zero."),
  dueDate: z.string().min(1, "Vencimento obrigatorio."),
  paymentMethod: z.enum(["dinheiro", "pix", "debito", "credito", "boleto", "transferencia", "cartao_credito", "outros"]).optional(),
  status: z.enum(["pendente", "confirmada", "cancelada", "paga"]).optional(),
  recurrence: z.coerce.boolean().optional(),
  notes: z.string().optional(),
});

const createBill = z.object({ body, params: z.object({}).optional(), query: z.object({}).optional() });
const updateBill = z.object({ body: body.partial(), params: idParam.shape.params, query: z.object({}).optional() });
const payBill = z.object({
  body: z.object({ paid: z.coerce.boolean() }),
  params: idParam.shape.params,
  query: z.object({}).optional(),
});

module.exports = { createBill, idParam, payBill, updateBill };
