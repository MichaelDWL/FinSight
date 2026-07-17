const { z } = require("zod");

const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(128, "Senha muito longa.")
  .regex(/[A-Za-z]/, "A senha deve conter letras.")
  .regex(/[0-9]/, "A senha deve conter numeros.");

const register = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(255),
    password: passwordSchema,
  }),
});

const login = z.object({
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(1).max(128),
  }),
});

const forgotPassword = z.object({
  body: z.object({
    email: z.string().trim().email(),
  }),
});

const resetPassword = z.object({
  body: z.object({
    token: z.string().min(20).max(200),
    password: passwordSchema,
  }),
});

const verifyEmail = z.object({
  body: z.object({
    token: z.string().min(20).max(200),
  }),
});

const changePassword = z.object({
  body: z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  }),
});

const sessionIdParam = z.object({
  params: z.object({
    sessionId: z.string().uuid(),
  }),
});

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  verifyEmail,
  changePassword,
  sessionIdParam,
};
