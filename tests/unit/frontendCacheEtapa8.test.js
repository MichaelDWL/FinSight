import { describe, expect, it, beforeEach, vi } from "vitest";

/**
 * Testes leves do contrato de cache SWR (sem DOM).
 * Import dinamico do dataLoaders exige mocks minimos.
 */
describe("FASE 5 — Etapa 8 frontend cache", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("invalidateBffCache limpa todas as keys", async () => {
    vi.doMock("../../frontend/js/core/store.js", () => ({
      store: {
        bffCache: {
          home: { data: { ok: 1 }, ts: Date.now() },
          insights: { data: { ok: 2 }, ts: Date.now() },
        },
        bootstrapReady: false,
        loadedRouteKey: null,
        dashboardData: null,
        currentUser: null,
        isLoadingData: false,
        selectedCardId: null,
        selectedAccountId: null,
        creditCards: [],
        accounts: [],
        personalizationContext: null,
      },
    }));
    vi.doMock("../../frontend/js/services/bootstrap.js", () => ({ bootstrapService: {} }));
    vi.doMock("../../frontend/js/services/users.js", () => ({ usersService: {} }));
    vi.doMock("../../frontend/js/services/bff.js", () => ({ bffService: {} }));
    vi.doMock("../../frontend/js/services/api.js", () => ({ api: { post: vi.fn() } }));
    vi.doMock("../../frontend/js/utils/icons.js", () => ({ resolveIcon: (x) => x }));
    vi.doMock("../../frontend/js/utils/normalize.js", () => ({
      normalizeTransaction: (x) => x,
      normalizeInvestment: (x) => x,
      normalizeGoal: (x) => x,
      normalizeBill: (x) => x,
    }));
    vi.doMock("../../frontend/js/core/app/userHeader.js", () => ({ updateUserHeader: vi.fn() }));
    vi.doMock("../../frontend/js/core/app/toast.js", () => ({ showToast: vi.fn() }));

    const { store } = await import("../../frontend/js/core/store.js");
    const { invalidateBffCache } = await import("../../frontend/js/core/app/dataLoaders.js");

    expect(Object.keys(store.bffCache).length).toBe(2);
    invalidateBffCache();
    expect(store.bffCache).toEqual({});
  });
});
