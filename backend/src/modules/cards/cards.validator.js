const { z } = require("zod");

const idParam = z.object({
  params: z.object({ id: z.string().uuid("ID invalido.") }),
});

const body = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio."),
  bank: z.string().optional(),
  brand: z.string().trim().min(1).optional(),
  lastDigits: z.string().regex(/^[0-9]{3}$/, "Informe apenas os ultimos 3 numeros.").optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor invalida.").optional(),
  totalLimit: z.coerce.number().positive("Limite deve ser maior que zero."),
  availableLimit: z.coerce.number().min(0).optional(),
  closingDay: z.coerce.number().int().min(1).max(31),
  dueDay: z.coerce.number().int().min(1).max(31),
  notes: z.string().optional(),
});

const createCard = z.object({ body, params: z.object({}).optional(), query: z.object({}).optional() });
const updateCard = z.object({ body: body.partial(), params: idParam.shape.params, query: z.object({}).optional() });

module.exports = { createCard, idParam, updateCard };
