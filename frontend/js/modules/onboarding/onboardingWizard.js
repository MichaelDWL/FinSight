import { escapeHtml } from "../../utils/dom.js";
import { hideModal, showModal } from "../../components/modal/modalFocus.js";
import { initCustomSelects } from "../../components/select/customSelect.js";
import { mountChart, destroyAllCharts } from "../../components/charts/ChartWrapper.js";
import {
  STEP_IDS,
  BILL_SUGGESTIONS,
  ALLOCATION_KEYS,
  PROFILES,
  emptyAccount,
  emptyCard,
  emptyBill,
  createInitialState,
} from "./constants.js";
import {
  loadPersistedState,
  persistState,
  markOnboardingDone,
  isOnboardingPending,
  setAllocationPercent,
  allocationSum,
  moneyFromPercent,
} from "./state.js";
import { applyOnboardingSetup } from "./applySetup.js";
import { progressPercent, stepsLeft } from "./helpers.js";
import { buildOnboardingDonut, buildOnboardingBars } from "./charts.js";
import {
  renderWelcome,
  renderIncome,
  renderAccounts,
  renderCards,
  renderBills,
  renderProfile,
  renderCustomize,
  renderSimulation,
  renderNotifications,
  renderFinish,
  renderFooter,
  renderRing,
  renderSimulationCards,
} from "./steps.js";

export function createOnboardingWizard({
  onComplete,
  onSkip,
  showToast,
  getAccounts = () => [],
} = {}) {
  const modal = document.querySelector("#onboardingModal");
  const body = document.querySelector("#onboardingBody");
  const progressFill = document.querySelector("#onboardingProgressFill");
  const progressLabel = document.querySelector("#onboardingProgressLabel");
  const closeBtn = document.querySelector("#closeOnboardingModal");

  if (!modal || !body) {
    return {
      open() {},
      close() {},
      maybeOpen() {},
      isPending: () => false,
    };
  }

  let state = createInitialState();
  let summaryCache = null;

  function save() {
    persistState(state);
  }

  function syncProgress() {
    const pct = progressPercent(state.stepIndex);
    const left = stepsLeft(state.stepIndex);
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressLabel) {
      progressLabel.textContent =
        left === 0
          ? "Última etapa"
          : left === 1
            ? "Falta 1 etapa"
            : `Faltam ${left} etapas`;
    }
    modal.setAttribute("aria-valuenow", String(pct));
  }

  function animateStep() {
    const step = body.querySelector(".onboarding-step");
    if (!step) return;
    step.classList.remove("onboarding-step-in");
    void step.offsetWidth;
    step.classList.add("onboarding-step-in");
  }

  function accountOptions(selectedId = "") {
    const draftAccounts = (state.accounts || [])
      .map((item, index) => ({
        id: `draft-${index}`,
        name: item.name || `Conta ${index + 1}`,
      }))
      .filter((item) => item.name);
    const live = getAccounts() || [];
    const list = [...live, ...draftAccounts];
    if (!list.length) {
      return `<option value="">Nenhuma conta ainda</option>`;
    }
    return list
      .map(
        (item) =>
          `<option value="${escapeHtml(item.id)}" ${
            String(item.id) === String(selectedId) ? "selected" : ""
          }>${escapeHtml(item.name)}</option>`,
      )
      .join("");
  }

  function mountSimulationCharts() {
    const income = Number(state.monthlyIncome) || 0;
    const items = ALLOCATION_KEYS.map((item) => ({
      category: item.label,
      value: moneyFromPercent(income, state.allocation[item.key]),
      color: item.color,
    })).filter((item) => item.value > 0);

    const donutEl = body.querySelector("#onboardingDonutChart");
    const barEl = body.querySelector("#onboardingBarChart");

    if (!items.length) {
      if (donutEl) {
        donutEl.innerHTML =
          '<p class="onboarding-soft-note">Informe sua renda para ver a distribuição.</p>';
      }
      if (barEl) {
        barEl.innerHTML =
          '<p class="onboarding-soft-note">Sem valores para exibir ainda.</p>';
      }
      return;
    }

    if (donutEl) {
      const chart = mountChart(donutEl, buildOnboardingDonut(items));
      requestAnimationFrame(() => chart?.windowResizeHandler?.());
    }
    if (barEl) {
      const chart = mountChart(barEl, buildOnboardingBars(items));
      requestAnimationFrame(() => chart?.windowResizeHandler?.());
    }
  }

  function updateLiveAllocationUi() {
    const sum = allocationSum(state.allocation);
    const ring = body.querySelector(".onboarding-ring");
    if (ring) {
      ring.outerHTML = renderRing(sum);
    }

    for (const item of ALLOCATION_KEYS) {
      const value = Number(state.allocation[item.key]) || 0;
      const label = body.querySelector(`[data-ob-slider-value="${item.key}"]`);
      const slider = body.querySelector(`[data-ob-slider="${item.key}"]`);
      if (label) label.textContent = `${value}%`;
      if (slider && Number(slider.value) !== value) {
        slider.value = String(value);
        slider.setAttribute("aria-valuenow", String(value));
      }
    }

    const simGrid = body.querySelector(".onboarding-sim-grid");
    if (simGrid) {
      simGrid.innerHTML = renderSimulationCards(state);
      mountSimulationCharts();
    }
  }

  function render() {
    destroyAllCharts(body);
    const stepId = STEP_IDS[state.stepIndex];
    const renderers = {
      welcome: () => renderWelcome(),
      income: () => renderIncome(state),
      accounts: () => renderAccounts(state),
      cards: () => renderCards(state, accountOptions),
      bills: () => renderBills(state, accountOptions),
      profile: () => renderProfile(state),
      customize: () => renderCustomize(state),
      simulation: () => renderSimulation(state),
      notifications: () => renderNotifications(state),
      finish: () => renderFinish(state),
    };

    body.innerHTML = `${(renderers[stepId] || (() => renderWelcome()))()}${renderFooter(state)}`;
    syncProgress();
    animateStep();
    save();
    initCustomSelects(body);

    if (stepId === "simulation") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => mountSimulationCharts());
      });
    }
  }

  function goTo(index) {
    state.stepIndex = Math.max(0, Math.min(STEP_IDS.length - 1, index));
    render();
  }

  function next() {
    goTo(state.stepIndex + 1);
  }

  function back() {
    goTo(state.stepIndex - 1);
  }

  async function finish() {
    if (state.applying) return;
    state.applying = true;
    render();

    try {
      summaryCache = await applyOnboardingSetup(state);
      markOnboardingDone({ skipped: false });
      state.completed = true;
      hideModal(modal);
      if (typeof onComplete === "function") {
        await onComplete(summaryCache);
      }
      showToast?.("Seu FinSight foi personalizado com sucesso.");
    } catch (error) {
      console.error(error);
      showToast?.(error.message || "Não foi possível concluir a configuração.");
      state.applying = false;
      render();
    }
  }

  function skipAll() {
    markOnboardingDone({ skipped: true });
    state.skipped = true;
    hideModal(modal);
    onSkip?.();
    showToast?.("Você pode configurar depois nas preferências.");
  }

  function bindEvents() {
    closeBtn?.addEventListener("click", () => {
      save();
      hideModal(modal);
      showToast?.("Progresso salvo. Você pode continuar depois.");
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (modal.classList.contains("isHidden")) return;
      save();
      hideModal(modal);
      showToast?.("Progresso salvo. Você pode continuar depois.");
    });

    body.addEventListener("click", (event) => {
      const target = event.target.closest("[data-ob-action], [data-ob-income], [data-ob-want-accounts], [data-ob-want-cards], [data-ob-want-bills], [data-ob-profile], [data-ob-bill-toggle], [data-ob-remove-account], [data-ob-remove-card], [data-ob-remove-bill]");
      if (!target) return;

      if (target.dataset.obAction === "start") {
        next();
        return;
      }
      if (target.dataset.obAction === "skip-all") {
        skipAll();
        return;
      }
      if (target.dataset.obAction === "back") {
        back();
        return;
      }
      if (target.dataset.obAction === "next" || target.dataset.obAction === "skip-step") {
        next();
        return;
      }
      if (target.dataset.obAction === "finish") {
        finish();
        return;
      }
      if (target.dataset.obAction === "add-account") {
        state.accounts.push(emptyAccount());
        render();
        return;
      }
      if (target.dataset.obAction === "add-card") {
        state.cards.push(emptyCard());
        render();
        return;
      }

      if (target.dataset.obIncome) {
        state.incomeSource = target.dataset.obIncome;
        save();
        render();
        return;
      }

      if (target.dataset.obWantAccounts) {
        state.wantAccounts = target.dataset.obWantAccounts === "yes";
        if (state.wantAccounts && !state.accounts.length) {
          state.accounts = [emptyAccount()];
        }
        save();
        render();
        return;
      }

      if (target.dataset.obWantCards) {
        state.wantCards = target.dataset.obWantCards === "yes";
        if (state.wantCards && !state.cards.length) {
          state.cards = [emptyCard()];
        }
        save();
        render();
        return;
      }

      if (target.dataset.obWantBills) {
        state.wantBills = target.dataset.obWantBills === "yes";
        save();
        render();
        return;
      }

      if (target.dataset.obProfile) {
        const profile = PROFILES.find((item) => item.id === target.dataset.obProfile);
        if (profile) {
          state.profileId = profile.id;
          state.allocation = { ...profile.allocation };
          save();
          render();
        }
        return;
      }

      if (target.dataset.obBillToggle) {
        const suggestion = BILL_SUGGESTIONS.find(
          (item) => item.id === target.dataset.obBillToggle,
        );
        if (!suggestion) return;
        const exists = state.bills.findIndex(
          (item) => item.suggestionId === suggestion.id,
        );
        if (exists >= 0) {
          state.bills.splice(exists, 1);
        } else {
          state.bills.push({
            ...emptyBill(),
            suggestionId: suggestion.id,
            label: suggestion.label,
            category: suggestion.category,
          });
        }
        state.wantBills = true;
        save();
        render();
        return;
      }

      if (target.dataset.obRemoveAccount != null) {
        const index = Number(target.dataset.obRemoveAccount);
        state.accounts.splice(index, 1);
        if (!state.accounts.length) state.accounts = [emptyAccount()];
        render();
        return;
      }

      if (target.dataset.obRemoveCard != null) {
        const index = Number(target.dataset.obRemoveCard);
        state.cards.splice(index, 1);
        if (!state.cards.length) state.cards = [emptyCard()];
        render();
        return;
      }

      if (target.dataset.obRemoveBill != null) {
        const index = Number(target.dataset.obRemoveBill);
        state.bills.splice(index, 1);
        render();
      }
    });

    body.addEventListener("input", (event) => {
      syncFieldFromEvent(event.target);
    });

    // Custom select dispara "change" (não "input")
    body.addEventListener("change", (event) => {
      syncFieldFromEvent(event.target);
    });
  }

  function syncFieldFromEvent(target) {
    if (!target) return;

    if (target.dataset.obField === "monthlyIncome") {
      state.monthlyIncome = target.value;
      save();
      return;
    }

    if (target.dataset.obAccountField != null) {
      const index = Number(target.dataset.index);
      if (state.accounts[index]) {
        state.accounts[index][target.dataset.obAccountField] = target.value;
        save();
      }
      return;
    }

    if (target.dataset.obCardField != null) {
      const index = Number(target.dataset.index);
      if (state.cards[index]) {
        state.cards[index][target.dataset.obCardField] = target.value;
        save();
      }
      return;
    }

    if (target.dataset.obBillField != null) {
      const index = Number(target.dataset.index);
      if (state.bills[index]) {
        state.bills[index][target.dataset.obBillField] = target.value;
        save();
      }
      return;
    }

    if (target.dataset.obSlider) {
      state.allocation = setAllocationPercent(
        state.allocation,
        target.dataset.obSlider,
        target.value,
      );
      save();
      updateLiveAllocationUi();
      return;
    }

    if (target.dataset.obNotification) {
      const id = target.dataset.obNotification;
      if (target.checked) {
        if (!state.notifications.includes(id)) state.notifications.push(id);
      } else {
        state.notifications = state.notifications.filter((item) => item !== id);
      }
      save();
    }
  }

  function open({ force = false } = {}) {
    const saved = loadPersistedState();
    if (saved && !force) {
      state = { ...createInitialState(), ...saved, applying: false };
      if (state.completed || state.skipped) return;
    } else if (force) {
      state = createInitialState();
    }

    showModal(modal);
    render();
  }

  function maybeOpen() {
    if (!isOnboardingPending()) return false;
    open();
    return true;
  }

  function close() {
    save();
    hideModal(modal);
  }

  bindEvents();

  return {
    open,
    close,
    maybeOpen,
    isPending: isOnboardingPending,
  };
}
