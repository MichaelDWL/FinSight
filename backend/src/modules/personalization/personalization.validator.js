const { z } = require("zod");
const { PROFILE_TYPES } = require("./constants");

const allocationSchema = z
  .object({
    contas: z.coerce.number().min(0).max(100).optional(),
    investimentos: z.coerce.number().min(0).max(100).optional(),
    metas: z.coerce.number().min(0).max(100).optional(),
    lazer: z.coerce.number().min(0).max(100).optional(),
    desenvolvimento: z.coerce.number().min(0).max(100).optional(),
  })
  .optional();

const updateProfile = z.object({
  body: z.object({
    profileType: z
      .enum([
        PROFILE_TYPES.EQUILIBRADO,
        PROFILE_TYPES.CONQUISTADOR,
        PROFILE_TYPES.APROVEITADOR,
        PROFILE_TYPES.CUSTOM,
      ])
      .optional(),
    incomeSource: z.string().trim().max(40).nullable().optional(),
    monthlyIncome: z.coerce.number().min(0).optional(),
    allocation: allocationSchema,
    notifications: z.array(z.string()).optional(),
    onboardingCompleted: z.boolean().optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const completeOnboarding = z.object({
  body: z.object({
    profileId: z
      .enum([
        PROFILE_TYPES.EQUILIBRADO,
        PROFILE_TYPES.CONQUISTADOR,
        PROFILE_TYPES.APROVEITADOR,
        PROFILE_TYPES.CUSTOM,
      ])
      .optional(),
    profileType: z
      .enum([
        PROFILE_TYPES.EQUILIBRADO,
        PROFILE_TYPES.CONQUISTADOR,
        PROFILE_TYPES.APROVEITADOR,
        PROFILE_TYPES.CUSTOM,
      ])
      .optional(),
    incomeSource: z.string().trim().max(40).nullable().optional(),
    monthlyIncome: z.coerce.number().min(0).optional(),
    allocation: allocationSchema,
    notifications: z.array(z.string()).optional(),
    customized: z.boolean().optional(),
    syncGoals: z.boolean().optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

module.exports = { updateProfile, completeOnboarding };
