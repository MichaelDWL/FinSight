/**
 * Wiring de eventos globais da SPA.
 * Handlers ficam em core/app.js; este módulo só registra listeners.
 */

export function bindAppEvents({
  onFiltersInput,
  onFiltersChange,
  onInvestmentFormInput,
  onFormSubmit,
  onDocumentClick,
  onDocumentKeydown,
  onHashChange,
  onSessionExpired,
  quickAction,
  onQuickActionClick,
}) {
  document.addEventListener("input", onFiltersInput);
  document.addEventListener("change", onFiltersChange);
  document.addEventListener("input", onInvestmentFormInput);
  document.addEventListener("submit", onFormSubmit);
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onDocumentKeydown);
  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("finsight:session-expired", onSessionExpired);
  quickAction?.addEventListener("click", onQuickActionClick);
}
