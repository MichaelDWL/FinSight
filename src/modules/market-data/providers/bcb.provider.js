const { MarketProvider } = require("./base.provider");
const { ProviderError } = require("./errors");
const { fetchJson } = require("../resilience/httpClient");
const { withRetry } = require("../resilience/retry");
const { BCB_SERIES } = require("../market.constants");

const SGS_BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

function parseBrDate(value) {
  if (!value || typeof value !== "string") return null;
  const [day, month, year] = value.split("/");
  if (!day || !month || !year) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function toNumber(value) {
  if (value == null) return null;
  const normalized = String(value).replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

const INDICATOR_SERIES = {
  SELIC: BCB_SERIES.SELIC,
  CDI: BCB_SERIES.CDI,
  IPCA: BCB_SERIES.IPCA,
  USD: BCB_SERIES.USD,
  EUR: BCB_SERIES.EUR,
  DOLAR: BCB_SERIES.USD,
  EURO: BCB_SERIES.EUR,
};

class BancoCentralProvider extends MarketProvider {
  get name() {
    return "bcb";
  }

  get supportedClasses() {
    return ["economic"];
  }

  async #fetchSeriesLast(seriesCode, count = 1) {
    const url = `${SGS_BASE}.${seriesCode}/dados/ultimos/${count}?formato=json`;
    const { data } = await withRetry(
      () => fetchJson(url, { timeoutMs: 12000, provider: this.name, headers: { Accept: "application/json" } }),
      {
        retries: 2,
        shouldRetry: (error) => error?.retryable !== false,
      }
    );

    if (!Array.isArray(data) || data.length === 0) {
      throw new ProviderError(`Serie BCB ${seriesCode} sem dados`, {
        provider: this.name,
        code: "EMPTY_SERIES",
        soft: true,
      });
    }

    return data.map((item) => ({
      referenceDate: parseBrDate(item.data),
      value: toNumber(item.valor),
    }));
  }

  async #fetchLatestValue(seriesCode) {
    const [latest] = await this.#fetchSeriesLast(seriesCode, 1);
    if (!latest?.referenceDate || latest.value == null) {
      throw new ProviderError(`Serie BCB ${seriesCode} invalida`, {
        provider: this.name,
        code: "INVALID_SERIES",
        soft: true,
      });
    }
    return latest;
  }

  resolveSeries(symbol) {
    const key = String(symbol || "").toUpperCase().trim();
    const series = INDICATOR_SERIES[key];
    if (!series) {
      throw new ProviderError(`Indicador BCB nao suportado: ${symbol}`, {
        provider: this.name,
        code: "UNSUPPORTED_SYMBOL",
        soft: false,
      });
    }
    return { key, series };
  }

  async getQuote(symbol) {
    const { key, series } = this.resolveSeries(symbol);
    const point = await this.#fetchLatestValue(series);
    const normalized = key === "DOLAR" ? "USD" : key === "EURO" ? "EUR" : key;

    return {
      symbol: normalized,
      price: point.value,
      date: point.referenceDate,
      currency: normalized === "USD" || normalized === "EUR" ? "BRL" : "PCT",
      provider: this.name,
      raw: point,
    };
  }

  async getHistory(symbol, { count = 30 } = {}) {
    const { key, series } = this.resolveSeries(symbol);
    const points = await this.#fetchSeriesLast(series, count);
    return points
      .filter((item) => item.referenceDate && item.value != null)
      .map((item) => ({
        date: item.referenceDate,
        close: item.value,
        price: item.value,
      }))
      .reverse();
  }

  async getAsset(symbol) {
    const quote = await this.getQuote(symbol);
    return {
      symbol: quote.symbol,
      name: quote.symbol,
      price: quote.price,
      date: quote.date,
      currency: quote.currency,
      dailyChange: null,
      monthlyChange: null,
      yearlyChange: null,
      history: [],
      provider: this.name,
    };
  }

  async searchAsset(query) {
    const key = String(query || "").toUpperCase().trim();
    if (!INDICATOR_SERIES[key]) return [];
    return [{ symbol: key, name: key, assetType: "economic", provider: this.name }];
  }

  async healthCheck() {
    const started = Date.now();
    await this.#fetchLatestValue(BCB_SERIES.SELIC);
    return {
      provider: this.name,
      status: "online",
      responseTimeMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
    };
  }

  async fetchSelic() {
    return this.#fetchLatestValue(BCB_SERIES.SELIC);
  }

  async fetchCdi() {
    try {
      return await this.#fetchLatestValue(BCB_SERIES.CDI);
    } catch {
      const selic = await this.fetchSelic();
      return {
        referenceDate: selic.referenceDate,
        value: Number((selic.value * 0.99).toFixed(4)),
        derived: true,
      };
    }
  }

  async fetchIpca() {
    return this.#fetchLatestValue(BCB_SERIES.IPCA);
  }

  async fetchUsd() {
    return this.#fetchLatestValue(BCB_SERIES.USD);
  }

  async fetchEur() {
    return this.#fetchLatestValue(BCB_SERIES.EUR);
  }
}

module.exports = new BancoCentralProvider();
module.exports.BancoCentralProvider = BancoCentralProvider;
