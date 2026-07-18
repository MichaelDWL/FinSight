const AppError = require("../../utils/AppError");
const { DEFAULT_PERIOD } = require("./constants");

function parseDate(value) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new AppError("Data invalida.", 400);
  }
  return date;
}

function formatISO(date) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  const ms = end.getTime() - start.getTime();
  return Math.max(Math.round(ms / 86400000), 0);
}

function subtractPeriod(endDate, period) {
  const start = new Date(endDate);

  switch (period) {
    case "7d":
      start.setDate(start.getDate() - 6);
      break;
    case "30d":
      start.setDate(start.getDate() - 29);
      break;
    case "3m":
      start.setMonth(start.getMonth() - 3);
      start.setDate(start.getDate() + 1);
      break;
    case "6m":
      start.setMonth(start.getMonth() - 6);
      start.setDate(start.getDate() + 1);
      break;
    case "1y":
      start.setFullYear(start.getFullYear() - 1);
      start.setDate(start.getDate() + 1);
      break;
    default:
      start.setDate(start.getDate() - 29);
  }

  return start;
}

function resolveGranularity(dayCount) {
  if (dayCount <= 31) return "day";
  if (dayCount <= 120) return "week";
  return "month";
}

function resolvePeriod(query = {}) {
  const period = query.period || DEFAULT_PERIOD;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let endDate = query.to ? parseDate(query.to) : today;
  let startDate;

  if (period === "custom") {
    if (!query.from || !query.to) {
      throw new AppError("Informe from e to para period=custom.", 400);
    }
    startDate = parseDate(query.from);
    endDate = parseDate(query.to);
    if (startDate > endDate) {
      throw new AppError("A data inicial deve ser anterior a data final.", 400);
    }
  } else {
    startDate = subtractPeriod(endDate, period);
  }

  const durationDays = daysBetween(startDate, endDate);
  const compareEndDate = new Date(startDate);
  compareEndDate.setDate(compareEndDate.getDate() - 1);
  const compareStartDate = new Date(compareEndDate);
  compareStartDate.setDate(compareStartDate.getDate() - durationDays);

  return {
    period,
    startDate: formatISO(startDate),
    endDate: formatISO(endDate),
    compareStartDate: formatISO(compareStartDate),
    compareEndDate: formatISO(compareEndDate),
    granularity: resolveGranularity(durationDays),
    durationDays,
  };
}

module.exports = { resolvePeriod, parseDate, formatISO };
