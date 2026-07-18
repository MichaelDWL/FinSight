/** Helpers puros do onboarding wizard. */
import { STEP_IDS } from "./constants.js";
import { formatCurrency } from "../../utils/currency.js";

export function formatMoney(value) {
  return formatCurrency(value);
}

export function progressPercent(stepIndex) {
  return Math.round(((stepIndex + 1) / STEP_IDS.length) * 100);
}

export function stepsLeft(stepIndex) {
  return Math.max(STEP_IDS.length - stepIndex - 1, 0);
}
