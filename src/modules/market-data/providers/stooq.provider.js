const logger = require("../../../utils/logger");
const { MarketProvider } = require("./base.provider");
const { ProviderError } = require("./errors");
const { fetchWithTimeout } = require("../resilience/httpClient");
const { withRetry } = require("../resilience/retry");

/**
 * Stooq como provedor complementar.
 * Sem spoofing de User-Agent, sem bypass de challenge e sem scraping.
 * Falhas 403/401/429/rede sao soft e disparam fallback no MarketService.
 */
const STOOQ_ORIGIN = "https://stooq.com";

function toNumber(value) {
  if (value == null || value === "" || value === "N/D") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseCsvLine(line) {
  return line.split(",").map((cell) => cell.trim());
}

function percentChange(current, previous) {
  if (current == null || previous == null || previous === 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(4));
}

function parseQuoteCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new ProviderError("Stooq retornou CSV de cotacao vazio", {
      provider: "stooq",
      code: "EMPTY_CSV",
      soft: true,
    });
  }

  return lines
    .slice(1)
    .map((line) => {
      const cols = parseCsvLine(line);
      return {
        symbol: cols[0]?.toLowerCase() || null,
        date: cols[1] || null,
        time: cols[2] || null,
        open: toNumber(cols[3]),
        high: toNumber(cols[4]),
        low: toNumber(cols[5]),
        close: toNumber(cols[6]),
        volume: toNumber(cols[7]),
      };
    })
    .filter((row) => row.symbol && row.close != null);
}

function parseHistoryCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  return lines
    .slice(1)
    .map((line) => {
      const cols = parseCsvLine(line);
      return {
        date: cols[0],
        open: toNumber(cols[1]),
        high: toNumber(cols[2]),
        low: toNumber(cols[3]),
        close: toNumber(cols[4]),
        volume: toNumber(cols[5]),
      };
    })
    .filter((row) => row.date && row.close != null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

class StooqProvider extends MarketProvider {
  get name() {
    return "stooq";
  }

  get supportedClasses() {
    return ["equity_br", "equity_intl", "crypto", "commodity"];
  }

  async #fetchText(url) {
    const { text } = await withRetry(
      () =>
        fetchWithTimeout(url, {
          timeoutMs: 15000,
          provider: this.name,
          headers: {
            Accept: "text/csv,text/plain,*/*;q=0.8",
          },
        }),
      {
        retries: 1,
        shouldRetry: (error) => Boolean(error?.retryable) && error?.status !== 403 && error?.status !== 401,
      }
    );

    const trimmed = text.trim();
    if (/^access denied$/i.test(trimmed) || /^odmowa dost/i.test(trimmed)) {
      throw new ProviderError("Stooq Access Denied", {
        provider: this.name,
        code: "ACCESS_DENIED",
        status: 403,
        soft: true,
      });
    }

    if (trimmed.startsWith("<") || /__verify/i.test(trimmed)) {
      throw new ProviderError("Stooq retornou HTML/challenge (acesso automatizado bloqueado)", {
        provider: this.name,
        code: "CHALLENGE_BLOCKED",
        status: 403,
        soft: true,
      });
    }

    return text;
  }

  normalizeSymbol(symbol) {
    return String(symbol || "").toLowerCase().trim();
  }

  async getQuote(symbol) {
    const ticker = this.normalizeSymbol(symbol);
    const url = `${STOOQ_ORIGIN}/q/l/?s=${encodeURIComponent(ticker)}&f=sd2t2ohlcv&h&e=csv`;
    const csv = await this.#fetchText(url);
    const [quote] = parseQuoteCsv(csv);

    if (!quote) {
      throw new ProviderError(`Cotacao Stooq indisponivel para ${ticker}`, {
        provider: this.name,
        code: "QUOTE_UNAVAILABLE",
        soft: true,
      });
    }

    return {
      symbol: quote.symbol,
      price: quote.close,
      date: quote.date,
      time: quote.time,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      volume: quote.volume,
      currency: ticker.endsWith(".br") ? "BRL" : "USD",
      provider: this.name,
    };
  }

  async getHistory(symbol, { days = 400 } = {}) {
    const ticker = this.normalizeSymbol(symbol);
    const url = `${STOOQ_ORIGIN}/q/d/l/?s=${encodeURIComponent(ticker)}&i=d`;
    const csv = await this.#fetchText(url);
    const history = parseHistoryCsv(csv);
    if (!history.length) return [];
    return history.slice(-days);
  }

  async getAsset(symbol) {
    const ticker = this.normalizeSymbol(symbol);
    let history = [];
    let quote = null;

    try {
      history = await this.getHistory(ticker);
    } catch (error) {
      logger.warn("Stooq historico indisponivel (complementar)", {
        provider: this.name,
        symbol: ticker,
        error: error.message,
        code: error.code,
      });
    }

    try {
      quote = await this.getQuote(ticker);
    } catch (error) {
      logger.warn("Stooq quote indisponivel (complementar)", {
        provider: this.name,
        symbol: ticker,
        error: error.message,
        code: error.code,
      });
    }

    if (!quote && history.length) {
      const last = history[history.length - 1];
      quote = {
        symbol: ticker,
        date: last.date,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
        volume: last.volume,
        price: last.close,
        currency: ticker.endsWith(".br") ? "BRL" : "USD",
        provider: this.name,
      };
    }

    const price = quote?.price ?? quote?.close;
    if (price == null) {
      throw new ProviderError(`Cotacao Stooq indisponivel para ${ticker}`, {
        provider: this.name,
        code: "ASSET_UNAVAILABLE",
        soft: true,
      });
    }

    const closes = history.map((item) => item.close);
    const prevClose = closes.length >= 2 ? closes[closes.length - 2] : null;
    const monthAgo = closes.length >= 22 ? closes[closes.length - 22] : closes[0] || null;
    const yearAgo = closes.length >= 252 ? closes[closes.length - 252] : closes[0] || null;

    return {
      symbol: ticker,
      name: ticker,
      price,
      date: quote.date,
      high: quote.high,
      low: quote.low,
      volume: quote.volume,
      currency: quote.currency || (ticker.endsWith(".br") ? "BRL" : "USD"),
      dailyChange: percentChange(price, prevClose ?? quote.open),
      monthlyChange: percentChange(price, monthAgo),
      yearlyChange: percentChange(price, yearAgo),
      history,
      provider: this.name,
    };
  }

  async searchAsset() {
    return [];
  }

  async healthCheck() {
    const started = Date.now();
    try {
      await this.getQuote("petr4.br");
      return {
        provider: this.name,
        status: "online",
        responseTimeMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        provider: this.name,
        status: "offline",
        responseTimeMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
        error: error.message,
        code: error.code,
      };
    }
  }
}

module.exports = new StooqProvider();
module.exports.StooqProvider = StooqProvider;
