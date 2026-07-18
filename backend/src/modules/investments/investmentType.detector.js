const TYPE_CATEGORY_MAP = {
  tesouro_selic: "Tesouro Direto",
  tesouro_ipca: "Tesouro Direto",
  tesouro_prefixado: "Tesouro Direto",
  cdb: "CDB",
  lci: "Outros",
  lca: "Outros",
  poupanca: "Poupanca",
  acoes: "Acoes",
  fiis: "Fundo Imobiliario",
  etfs: "ETF",
  criptomoedas: "Criptomoedas",
  fundos: "Fundo de Investimento",
  outro: "Outros",
};

const RULES = [
  { type: "tesouro_selic", pattern: /tesouro\s*selic|selic\s*202\d/i },
  { type: "tesouro_ipca", pattern: /tesouro\s*ipca|ipca\s*\+|ntnb/i },
  { type: "tesouro_prefixado", pattern: /tesouro\s*prefixad|ltn|prefixad/i },
  { type: "lci", pattern: /\blci\b/i },
  { type: "lca", pattern: /\blca\b/i },
  { type: "cdb", pattern: /\bcdb\b/i },
  { type: "poupanca", pattern: /poupan[cç]a/i },
  { type: "fiis", pattern: /\bfii\b|fundo\s*imobili/i },
  { type: "etfs", pattern: /\betf\b|bova11|ivot11|smal11/i },
  { type: "criptomoedas", pattern: /bitcoin|btc|ethereum|eth|cripto|crypto/i },
  { type: "acoes", pattern: /\ba[cç][aã]o\b|\ba[cç][oõ]es\b|[a-z]{4}\d\b/i },
  { type: "fundos", pattern: /fundo\s+de\s+invest|previd[eê]ncia/i },
];

const CATEGORY_TYPE_HINTS = {
  Poupanca: "poupanca",
  CDB: "cdb",
  "Tesouro Direto": "tesouro_selic",
  "Fundo Imobiliario": "fiis",
  Acoes: "acoes",
  ETF: "etfs",
  Criptomoedas: "criptomoedas",
  "Fundo de Investimento": "fundos",
  "Previdencia Privada": "fundos",
  Outros: "outro",
};

function detectInvestmentType({ name = "", categoryName = "", assetCode = "" } = {}) {
  const haystack = `${name} ${assetCode}`.trim();

  for (const rule of RULES) {
    if (rule.pattern.test(haystack)) return rule.type;
  }

  if (categoryName && CATEGORY_TYPE_HINTS[categoryName]) {
    return CATEGORY_TYPE_HINTS[categoryName];
  }

  return "outro";
}

function resolveCategoryName(type) {
  return TYPE_CATEGORY_MAP[type] || "Outros";
}

module.exports = {
  CATEGORY_TYPE_HINTS,
  TYPE_CATEGORY_MAP,
  detectInvestmentType,
  resolveCategoryName,
};
