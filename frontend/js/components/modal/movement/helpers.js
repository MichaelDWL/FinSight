/** Helpers do modal de movimentação. */
import { formatCurrency } from "../../../utils/currency.js";
import { PAYMENTS } from "./constants.js";

export function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function toIso(value) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const offset = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 10);
}

export function formatDateBr(iso) {
  const value = toIso(iso);
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function paymentLabelFromCode(code) {
  const found = PAYMENTS.find((item) => item.code === code);
  if (found) return found.label;
  const byLabel = PAYMENTS.find(
    (item) => item.label.toLowerCase() === String(code || "").toLowerCase(),
  );
  return byLabel ? byLabel.label : "Pix";
}

export function formatMoney(value) {
  return formatCurrency(value);
}
