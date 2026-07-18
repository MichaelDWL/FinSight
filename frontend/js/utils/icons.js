/** Resolução de ícones Font Awesome + aliases. */

export const ICON_ALIASES = {
  "shopping-cart": "fa-cart-shopping",
  "shopping-bag": "fa-bag-shopping",
  cart: "fa-cart-shopping",
  home: "fa-house",
  house: "fa-house",
  car: "fa-car",
  heart: "fa-heart",
  gamepad: "fa-gamepad",
  "book-open": "fa-book-open",
  book: "fa-book",
  repeat: "fa-repeat",
  briefcase: "fa-briefcase",
  laptop: "fa-laptop",
  "trending-up": "fa-arrow-trend-up",
  "trending-down": "fa-arrow-trend-down",
  bank: "fa-building-columns",
  "piggy-bank": "fa-piggy-bank",
  landmark: "fa-landmark",
  "credit-card": "fa-credit-card",
  wallet: "fa-wallet",
  bitcoin: "fa-bitcoin",
  layers: "fa-layer-group",
  umbrella: "fa-umbrella",
  "shield-check": "fa-shield-halved",
  "building-2": "fa-building",
  "circle-dollar-sign": "fa-circle-dollar",
  receipt: "fa-receipt",
  plane: "fa-plane",
  utensils: "fa-utensils",
  "heart-pulse": "fa-heart-pulse",
};

export function resolveIcon(rawIcon, fallback = "fa-wallet") {
  if (!rawIcon) return fallback;

  const value = String(rawIcon).trim();
  if (value.startsWith("fa-") || value.includes("fa-")) return value;

  return ICON_ALIASES[value] || fallback;
}

export function getExpenseIcon(category) {
  const icons = {
    Moradia: "fa-house",
    Alimentação: "fa-cart-shopping",
    Transporte: "fa-car",
    Saúde: "fa-heart",
    Lazer: "fa-gamepad",
    Educação: "fa-book-open",
    Assinaturas: "fa-repeat",
  };

  return icons[category] || "fa-wallet";
}

export function getInvestmentIcon(category) {
  const icons = {
    Cripto: "₿",
    Ações: "📈",
    Fundo: "📊",
    "Renda fixa": "🏦",
    Poupança: "🏦",
  };

  return icons[category] || "💼";
}

export function getBillIcon(category) {
  const icons = {
    Moradia: "fa-house",
    Casa: "fa-wifi",
    Alimentação: "fa-cart-shopping",
    Transporte: "fa-car",
    Saúde: "fa-heart-pulse",
    Lazer: "fa-ticket",
    Assinaturas: "fa-receipt",
  };

  return icons[category] || "fa-file-invoice-dollar";
}

/** Resolve ícone FA; se não houver alias, prefixa fa-. */
export function resolveFaIcon(rawIcon, fallback = "fa-wallet") {
  if (!rawIcon) return fallback;
  const value = String(rawIcon).trim();
  if (value.startsWith("fa-") || value.includes("fa-")) return value;
  return ICON_ALIASES[value] || `fa-${value}`;
}
