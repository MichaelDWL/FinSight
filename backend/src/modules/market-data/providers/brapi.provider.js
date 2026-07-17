const env = require("../../../config/env");
const { MarketProvider } = require("./base.provider");
const { ProviderError } = require("./errors");
const { fetchJson } = require("../resilience/httpClient");
const { withRetry } = require("../resilience/retry");

const BRAPI_BASE = "https://brapi.dev/api";

function toNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percentChange(current, previous) {
  if (current == null || previous == null || previous === 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(4));
}

function unixToDate(unix) {
  if (unix == null) return null;
  const ms = Number(unix) > 1e12 ? Number(unix) : Number(unix) * 1000;
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function normalizeSymbol(symbol) {
  return String(symbol || "")
    .toUpperCase()
    .trim()
    .replace(/^\^/, "")
    .replace(/\.SA$/i, "");
}

class BrapiProvider extends MarketProvider {
  get name() {
    return "brapi";
  }

  get supportedClasses() {
    return ["equity_br"];
  }

  #authHeaders() {
    const headers = { Accept: "application/json" };
    if (env.brapiToken) {
      headers.Authorization = `Bearer ${env.brapiToken}`;
    }
    return headers;
  }

  #withToken(url) {
    if (!env.brapiToken) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}token=${encodeURIComponent(env.brapiToken)}`;
  }

  async #request(path) {
    const url = this.#withToken(`${BRAPI_BASE}${path}`);
    return withRetry(
      () =>
        fetchJson(url, {
          timeoutMs: 15000,
          provider: this.name,
          headers: this.#authHeaders(),
        }),
      {
        retries: 2,
        shouldRetry: (error) => Boolean(error?.retryable),
      }
    );
  }

  #mapQuote(result) {
    if (!result) return null;
    const price = toNumber(result.regularMarketPrice);
    if (price == null) return null;

    const previous = toNumber(result.regularMarketPreviousClose);
    const history = Array.isArray(result.historicalDataPrice)
      ? result.historicalDataPrice
          .map((item) => ({
            date: unixToDate(item.date),
            open: toNumber(item.open),
            high: toNumber(item.high),
            low: toNumber(item.low),
            close: toNumber(item.close ?? item.adjustedClose),
            volume: toNumber(item.volume),
          }))
          .filter((item) => item.date && item.close != null)
          .sort((a, b) => a.date.localeCompare(b.date))
      : [];

    const closes = history.map((item) => item.close);
    const lastClose = price;
    const prevClose = previous ?? (closes.length >= 2 ? closes[closes.length - 2] : null);
    const monthAgo = closes.length >= 22 ? closes[closes.length - 22] : closes[0] || null;
    const yearAgo = closes.length >= 252 ? closes[closes.length - 252] : closes[0] || null;

    const quoteDate =
      (result.regularMarketTime && String(result.regularMarketTime).slice(0, 10)) ||
      (history.length ? history[history.length - 1].date : new Date().toISOString().slice(0, 10));

    return {
      symbol: normalizeSymbol(result.symbol),
      name: result.longName || result.shortName || result.symbol,
      price: lastClose,
      date: quoteDate,
      currency: result.currency || "BRL",
      high: toNumber(result.regularMarketDayHigh),
      low: toNumber(result.regularMarketDayLow),
      volume: toNumber(result.regularMarketVolume),
      dailyChange:
        toNumber(result.regularMarketChangePercent) ?? percentChange(lastClose, prevClose),
      monthlyChange: percentChange(lastClose, monthAgo),
      yearlyChange: percentChange(lastClose, yearAgo),
      history,
      provider: this.name,
    };
  }

  async getQuote(symbol) {
    const ticker = normalizeSymbol(symbol);
    if (!ticker) {
      throw new ProviderError("Simbolo BRAPI invalido", {
        provider: this.name,
        code: "INVALID_SYMBOL",
        soft: false,
      });
    }

    const { data } = await this.#request(`/quote/${encodeURIComponent(ticker)}`);
    const result = data?.results?.[0];
    const mapped = this.#mapQuote(result);
    if (!mapped) {
      throw new ProviderError(`Cotacao BRAPI indisponivel para ${ticker}`, {
        provider: this.name,
        code: "QUOTE_UNAVAILABLE",
        soft: true,
      });
    }
    return mapped;
  }

  async getHistory(symbol, { range = "1y", interval = "1d" } = {}) {
    const ticker = normalizeSymbol(symbol);
    const { data } = await this.#request(
      `/quote/${encodeURIComponent(ticker)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`
    );
    const mapped = this.#mapQuote(data?.results?.[0]);
    return mapped?.history || [];
  }

  async getAsset(symbol, { range = "1y", interval = "1d" } = {}) {
    const ticker = normalizeSymbol(symbol);
    const { data } = await this.#request(
      `/quote/${encodeURIComponent(ticker)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`
    );
    const mapped = this.#mapQuote(data?.results?.[0]);
    if (!mapped) {
      throw new ProviderError(`Ativo BRAPI indisponivel para ${ticker}`, {
        provider: this.name,
        code: "ASSET_UNAVAILABLE",
        soft: true,
      });
    }
    return mapped;
  }

  async searchAsset(query, { limit = 10 } = {}) {
    const q = String(query || "").trim();
    if (!q) return [];

    try {
      const { data } = await this.#request(
        `/quote/list?search=${encodeURIComponent(q)}&limit=${Number(limit) || 10}`
      );
      const stocks = data?.stocks || data?.results || [];
      return (Array.isArray(stocks) ? stocks : []).slice(0, limit).map((item) => ({
        symbol: normalizeSymbol(item.stock || item.symbol),
        name: item.name || item.longName || item.stock || item.symbol,
        assetType: String(item.type || "stock").toLowerCase(),
        provider: this.name,
      }));
    } catch {
      return [];
    }
  }

  async healthCheck() {
    const started = Date.now();
    await this.getQuote("PETR4");
    return {
      provider: this.name,
      status: "online",
      responseTimeMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
    };
  }
}

module.exports = new BrapiProvider();
module.exports.BrapiProvider = BrapiProvider;
