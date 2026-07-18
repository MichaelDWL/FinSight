/** Constantes do modal de movimentação. */

export const TYPES = [
  {
    key: "receita",
    icon: "💰",
    title: "Receita",
    desc: "Entrada de dinheiro na sua conta.",
    accent: "#16a34a",
  },
  {
    key: "despesa",
    icon: "💸",
    title: "Despesa",
    desc: "Um gasto pontual do dia a dia.",
    accent: "#ef4444",
  },
  {
    key: "conta",
    icon: "🧾",
    title: "Conta Mensal",
    desc: "Contas fixas, assinaturas e recorrências.",
    accent: "#f59e0b",
  },
  {
    key: "cartao",
    icon: "💳",
    title: "Compra no Cartão",
    desc: "À vista ou parcelada na fatura.",
    accent: "#8b5cf6",
  },
  {
    key: "transferencia",
    icon: "🔄",
    title: "Transferência",
    desc: "Mova saldo entre suas contas.",
    accent: "#0ea5e9",
  },
];

export const TYPE_MAP = Object.fromEntries(TYPES.map((type) => [type.key, type]));

export const CATEGORIES = {
  receita: ["Salário", "Freelance", "Investimentos", "Outros"],
  despesa: [
    "Moradia",
    "Alimentação",
    "Transporte",
    "Saúde",
    "Lazer",
    "Educação",
    "Assinaturas",
    "Outros",
  ],
};
CATEGORIES.conta = CATEGORIES.despesa;
CATEGORIES.cartao = CATEGORIES.despesa;

export const PAYMENTS = [
  { label: "Pix", code: "pix" },
  { label: "Cartão de Débito", code: "debito" },
  { label: "Cartão de Crédito", code: "cartao_credito" },
  { label: "Dinheiro", code: "dinheiro" },
  { label: "Boleto", code: "boleto" },
];
