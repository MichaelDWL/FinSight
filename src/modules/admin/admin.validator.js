const { z } = require("zod");

/** Aceita UUIDs RFC e IDs de seed/demo (ex.: 00000000-0000-0000-0000-000000000001). */
const uuidLike = z.string().guid("ID invalido.");

const roleEnum = z.enum(["USER", "ADMIN", "SUPER_ADMIN", "SUPPORT", "MODERATOR"]);
const statusEnum = z.enum(["ativa", "inativa", "suspensa"]);

const listUsers = z.object({
  query: z
    .object({
      search: z.string().trim().max(120).optional(),
      status: statusEnum.optional(),
      role: roleEnum.optional(),
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(100).optional(),
    })
    .optional()
    .default({}),
});

const userIdParam = z.object({
  params: z.object({
    userId: uuidLike,
  }),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(200).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    })
    .optional()
    .default({}),
});

const updateUser = z.object({
  params: z.object({ userId: uuidLike }),
  body: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().max(255).optional(),
  }),
});

const changeRole = z.object({
  params: z.object({ userId: uuidLike }),
  body: z.object({
    role: roleEnum,
  }),
});

const suspendUser = z.object({
  params: z.object({ userId: uuidLike }),
  body: z
    .object({
      reason: z.string().trim().max(500).optional(),
    })
    .optional()
    .default({}),
});

const auditQuery = z.object({
  query: z
    .object({
      search: z.string().trim().max(120).optional(),
      action: z.string().trim().max(80).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    })
    .optional()
    .default({}),
});

module.exports = {
  listUsers,
  userIdParam,
  updateUser,
  changeRole,
  suspendUser,
  auditQuery,
};
