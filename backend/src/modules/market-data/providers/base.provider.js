/**
 * Interface comum de provedores de mercado (Strategy + Provider Pattern).
 * Toda implementacao deve expor exatamente estes metodos.
 */
class MarketProvider {
  get name() {
    throw new Error("MarketProvider.name nao implementado");
  }

  /** Classes suportadas: equity_br | equity_intl | economic | crypto | commodity */
  get supportedClasses() {
    return [];
  }

  supports(assetClass) {
    return this.supportedClasses.includes(assetClass);
  }

  async getQuote(_symbol, _options = {}) {
    throw new Error(`${this.name}.getQuote nao implementado`);
  }

  async getHistory(_symbol, _options = {}) {
    throw new Error(`${this.name}.getHistory nao implementado`);
  }

  async getAsset(_symbol, _options = {}) {
    throw new Error(`${this.name}.getAsset nao implementado`);
  }

  async searchAsset(_query, _options = {}) {
    throw new Error(`${this.name}.searchAsset nao implementado`);
  }

  async healthCheck() {
    throw new Error(`${this.name}.healthCheck nao implementado`);
  }
}

module.exports = { MarketProvider };
