/** Utilitários de data (ISO / labels pt-BR). */

export function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateLabel(isoDate) {
  if (!isoDate) return "";

  const [year, month, day] = String(isoDate).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";

  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(year, month - 1, day),
  );
}

export function getIsoDateValue(value) {
  return value ? String(value).slice(0, 10) : toIsoDate(new Date());
}

export function relativeDayLabel(isoDate) {
  if (!isoDate) return "Sem movimentações";
  const iso = String(isoDate).slice(0, 10);
  const today = toIsoDate(new Date());
  if (iso === today) return "Hoje";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === toIsoDate(yesterday)) return "Ontem";

  return formatDateLabel(iso);
}

export function formatMonthYear(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const label = date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
