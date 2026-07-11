const { z } = require("zod");

const updateUser = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Nome invalido.").optional(),
    email: z.string().email("Email invalido.").optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

module.exports = { updateUser };
