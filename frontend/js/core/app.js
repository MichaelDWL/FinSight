/**
 * Nucleo/orquestrador da SPA.
 * A logica foi modularizada em ./app/* (elementos, dados, navegacao, modais,
 * views, dashboards analiticos, handlers de eventos). Este arquivo apenas
 * conecta as pecas: cria singletons, registra eventos e inicia a aplicacao.
 */
import { store } from "./store.js";
import { bindAppEvents } from "./events.js";
import { createOnboardingWizard } from "../modules/onboarding/onboardingWizard.js";
import {
  setupCustomSelects,
} from "../components/select/customSelect.js";
import {
  setupCustomCalendars,
} from "../components/calendar/customCalendar.js";
import { quickAction } from "./app/elements.js";
import { showToast } from "./app/toast.js";
import { applyAuthenticatedUser } from "./app/userHeader.js";
import { renderRoute, reloadAndRender } from "./app/renderRoute.js";
import { movementModal } from "./app/movement.js";
import {
  onFiltersInput,
  onFiltersChange,
  onInvestmentFormInput,
  onFormSubmit,
  onDocumentClick,
  onDocumentKeydown,
} from "./app/handlers.js";

const onboardingWizard = createOnboardingWizard({
  getAccounts: () => store.accounts,
  showToast,
  onComplete: async () => {
    store.bootstrapReady = false;
    store.loadedRouteKey = null;
    await reloadAndRender();
  },
  onSkip: () => {},
});

// Expõe para testes / reabertura manual: onboardingWizard.open({ force: true })
window.onboardingWizard = onboardingWizard;

setupCustomSelects();
setupCustomCalendars();

bindAppEvents({
  onFiltersInput,
  onFiltersChange,
  onInvestmentFormInput,
  onFormSubmit,
  onDocumentClick,
  onDocumentKeydown,
  onHashChange: renderRoute,
  onSessionExpired: () => {
    if (document.body.classList.contains("is-auth-screen")) return;
    window.finsightLogout?.();
  },
  quickAction,
  onQuickActionClick: () => {
    movementModal.open();
  },
});

/**
 * Inicia o nucleo da SPA para um usuario JA autenticado.
 * Chamado por app/app.js apos os templates estarem montados no DOM.
 * A verificacao de sessao acontece antes, no bootstrap (core/auth.js).
 */
export async function startApp(user) {
  applyAuthenticatedUser(user);
  document.body.classList.remove("is-auth-screen");
  await renderRoute();

  const forceOnboarding = window.location.hash === "#onboarding";
  if (forceOnboarding) {
    onboardingWizard.open({ force: true });
    return;
  }
  onboardingWizard.maybeOpen();
}
