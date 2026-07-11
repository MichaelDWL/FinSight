const { z } = require("zod");

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "ID invalido.");

const idParam = z.object({
  params: z.object({
    id: uuid,
  }),
});

const body = z.object({
    description: z.string().trim().min(1, "Descricao obrigatoria."),
    value: z.coerce.number().positive("Valor deve ser maior que zero."),
    date: z.string().min(1, "Data obrigatoria."),
    type: z.enum(["receita", "despesa", "transferencia", "pagamento_fatura", "compra_parcelada", "recorrencia"]).optional(),
    payment: z.enum(["dinheiro", "pix", "debito", "credito", "boleto", "transferencia", "cartao_credito", "outros"]).optional(),
    status: z.enum(["pendente", "confirmada", "cancelada", "paga"]).optional(),
    accountId: uuid.optional().nullable(),
    notes: z.string().optional().nullable(),
  });

const createTransaction = z.object({
  body,
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const updateTransaction = z.object({
  body: body.partial(),
  params: idParam.shape.params,
  query: z.object({}).optional(),
});

module.exports = { idParam, createTransaction, updateTransaction };
