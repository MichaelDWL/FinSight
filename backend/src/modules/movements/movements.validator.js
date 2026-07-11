const { z } = require("zod");

const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "ID invalido.");

const idParam = z.object({
  params: z.object({ id: uuid }),
});

const paymentEnum = z.enum([
  "dinheiro",
  "pix",
  "debito",
  "credito",
  "boleto",
  "transferencia",
  "cartao_credito",
  "outros",
]);

// Payload unificado de dominio. Os campos exigidos variam conforme o tipo,
// validados no superRefine para dar mensagens claras ao usuario.
const createBody = z
  .object({
    tipo: z.enum(["receita", "despesa", "conta", "cartao", "transferencia"]),
    description: z.string().trim().min(1, "Descricao obrigatoria.").optional(),
    value: z.coerce.number().positive("Valor deve ser maior que zero."),
    date: z.string().min(1).optional(),
    notes: z.string().optional().nullable(),

    // receita / despesa / conta
    accountId: uuid.optional().nullable(),
    category: z.string().trim().min(1).optional().nullable(),
    categoryId: uuid.optional().nullable(),
    payment: paymentEnum.optional(),

    // conta mensal
    dueDate: z.string().min(1).optional(),
    recurring: z.coerce.boolean().optional(),

    // transferencia
    fromAccountId: uuid.optional().nullable(),
    toAccountId: uuid.optional().nullable(),

    // cartao (Fase 2)
    cardId: uuid.optional().nullable(),
    installments: z.coerce.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipo === "transferencia") {
      if (!data.fromAccountId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Conta de origem obrigatoria." });
      }
      if (!data.toAccountId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Conta de destino obrigatoria." });
      }
      if (data.fromAccountId && data.toAccountId && data.fromAccountId === data.toAccountId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Contas de origem e destino devem ser diferentes." });
      }
      return;
    }

    if (!data.description) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Descricao obrigatoria." });
    }

    if (data.tipo === "cartao") {
      if (!data.cardId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cartao obrigatorio." });
      }
      if (!data.date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Data obrigatoria." });
      }
    }

    if (data.tipo === "conta" && !data.dueDate && !data.date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Data de vencimento obrigatoria." });
    }

    if ((data.tipo === "receita" || data.tipo === "despesa") && !data.date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Data obrigatoria." });
    }

    // Despesa no cartao de credito exige o cartao (segue o fluxo de compra).
    if (data.tipo === "despesa" && data.payment === "cartao_credito" && !data.cardId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecione o cartao para despesas no credito." });
    }
  });

const updateBody = z.object({
  description: z.string().trim().min(1).optional(),
  value: z.coerce.number().positive().optional(),
  date: z.string().min(1).optional(),
  dueDate: z.string().min(1).optional(),
  type: z.enum(["receita", "despesa", "transferencia", "pagamento_fatura", "compra_parcelada", "recorrencia"]).optional(),
  status: z.enum(["pendente", "confirmada", "cancelada", "paga"]).optional(),
  payment: paymentEnum.optional(),
  accountId: uuid.optional().nullable(),
  category: z.string().trim().min(1).optional().nullable(),
  categoryId: uuid.optional().nullable(),
  notes: z.string().optional().nullable(),
});

const createMovement = z.object({
  body: createBody,
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const updateMovement = z.object({
  body: updateBody,
  params: idParam.shape.params,
  query: z.object({}).optional(),
});

const payMovement = z.object({
  body: z.object({ paid: z.coerce.boolean() }),
  params: idParam.shape.params,
  query: z.object({}).optional(),
});

module.exports = { idParam, createMovement, updateMovement, payMovement };
