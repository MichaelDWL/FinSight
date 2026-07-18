import { personalizationService } from "../../services/personalization.js";
export function bind(root, { showToast, onSaved } = {}) {
  const form = root.querySelector("#profilePersonalizationForm");
  if (!form) return;

  const sumHint = root.querySelector("#allocationSumHint");

  const updateSum = () => {
    const total = [...root.querySelectorAll("[data-alloc-key]")].reduce(
      (sum, input) => sum + (Number(input.value) || 0),
      0,
    );
    if (sumHint) {
      sumHint.textContent = `Soma: ${total}%${total === 100 ? " ✓" : " — ajuste para 100%"}`;
      sumHint.style.color = total === 100 ? "var(--success)" : "var(--expense)";
    }
  };

  root.querySelectorAll("[data-alloc-key]").forEach((input) => {
    input.addEventListener("input", updateSum);
  });
  updateSum();

  root.querySelector("#logoutBtn")?.addEventListener("click", async () => {
    if (typeof window.finsightLogout === "function") {
      await window.finsightLogout();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const allocation = {};
    for (const item of ALLOCATION_KEYS) {
      const input = form.querySelector(`[data-alloc-key="${item.key}"]`);
      allocation[item.key] = Number(input?.value) || 0;
    }

    const total = Object.values(allocation).reduce((sum, value) => sum + value, 0);
    if (total !== 100) {
      showToast?.("A distribuição do orçamento precisa somar 100%.");
      return;
    }

    const notifications = [...root.querySelectorAll('input[name="notification"]:checked')].map(
      (input) => input.value,
    );

    const payload = {
      profileType: form.profileType.value,
      incomeSource: form.incomeSource.value || null,
      monthlyIncome: Number(form.monthlyIncome.value) || 0,
      allocation,
      notifications,
      onboardingCompleted: true,
    };

    try {
      await personalizationService.updateProfile(payload);
      const name = form.name?.value?.trim();
      const email = form.email?.value?.trim();
      showToast?.("Personalização salva. O FinSight foi atualizado.");
      onSaved?.({ name, email, personalization: payload });
    } catch (error) {
      console.error(error);
      showToast?.(error.message || "Não foi possível salvar a personalização.");
    }
  });
}

export { bind as bindProfilePage };
