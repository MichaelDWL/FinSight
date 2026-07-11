const { z } = require("zod");

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "ID invalido.");

const idParam = z.object({
  params: z.object({ id: uuid }),
});

const lastDigitsField = z.preprocess(
  (value) => {
    if (value == null || value === "") return undefined;

    const digits = String(value).replace(/\D/g, "").slice(-3);
    return digits.padStart(3, "0");
  },
  z.string().regex(/^[0-9]{3}$/, "Informe apenas os ultimos 3 numeros.").optional()
);

const body = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio."),
  bank: z.string().optional(),
  brand: z.string().trim().min(1).optional(),
  lastDigits: lastDigitsField,
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
