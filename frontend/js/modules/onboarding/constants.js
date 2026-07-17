export const STORAGE_KEY = "finsight_onboarding_v1";
export const PREFS_KEY = "finsight_onboarding_prefs";

export const STEP_IDS = [
  "welcome",
  "income",
  "accounts",
  "cards",
  "bills",
  "profile",
  "customize",
  "simulation",
  "notifications",
  "finish",
];

export const INCOME_SOURCES = [
  { id: "salario", label: "Salário", icon: "fa-briefcase" },
  { id: "autonomo", label: "Autônomo", icon: "fa-user-tie" },
  { id: "freelancer", label: "Freelancer", icon: "fa-laptop" },
  { id: "empresario", label: "Empresário", icon: "fa-building" },
  { id: "aposentadoria", label: "Aposentadoria", icon: "fa-umbrella-beach" },
  { id: "outro", label: "Outro", icon: "fa-ellipsis" },
];

export const ACCOUNT_TYPES = [
  { value: "corrente", label: "Conta Corrente" },
  { value: "poupanca", label: "Conta Poupança" },
  { value: "investimento", label: "Conta Digital" },
  { value: "carteira", label: "Carteira" },
  { value: "dinheiro", label: "Dinheiro em espécie" },
  { value: "outros", label: "Outro" },
];

export const BILL_SUGGESTIONS = [
  { id: "agua", label: "Água", icon: "fa-droplet", category: "Moradia" },
  { id: "luz", label: "Luz", icon: "fa-bolt", category: "Moradia" },
  { id: "internet", label: "Internet", icon: "fa-wifi", category: "Assinaturas" },
  { id: "aluguel", label: "Aluguel", icon: "fa-house", category: "Moradia" },
  { id: "condominio", label: "Condomínio", icon: "fa-building", category: "Moradia" },
  { id: "saude", label: "Plano de Saúde", icon: "fa-heart-pulse", category: "Saúde" },
  { id: "academia", label: "Academia", icon: "fa-dumbbell", category: "Saúde" },
  { id: "streaming", label: "Streaming", icon: "fa-tv", category: "Assinaturas" },
  { id: "telefone", label: "Telefone", icon: "fa-mobile-screen", category: "Assinaturas" },
  { id: "escola", label: "Escola", icon: "fa-graduation-cap", category: "Educação" },
  { id: "financiamento", label: "Financiamento", icon: "fa-car", category: "Moradia" },
  { id: "outro", label: "Outro", icon: "fa-plus", category: "Outros" },
];

export const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "boleto", label: "Boleto" },
  { value: "debito", label: "Débito" },
  { value: "cartao_credito", label: "Cartão" },
  { value: "dinheiro", label: "Dinheiro" },
];

export const RECURRENCE_OPTIONS = [
  { value: "mensal", label: "Mensal" },
  { value: "anual", label: "Anual" },
  { value: "semanal", label: "Semanal" },
];

export const ALLOCATION_KEYS = [
  { key: "contas", label: "Contas Fixas", color: "#0d6efd" },
  { key: "investimentos", label: "Investimentos", color: "#14b8a6" },
  { key: "metas", label: "Metas", color: "#8b5cf6" },
  { key: "lazer", label: "Lazer", color: "#f59e0b" },
  { key: "desenvolvimento", label: "Desenvolvimento", color: "#ef5d86" },
];

export const PROFILES = [
  {
    id: "equilibrado",
    emoji: "🌱",
    title: "Vida Equilibrada",
    description: "Quero aproveitar o presente sem deixar de construir meu futuro.",
    allocation: {
      contas: 50,
      investimentos: 20,
      metas: 10,
      lazer: 10,
      desenvolvimento: 10,
    },
  },
  {
    id: "conquistador",
    emoji: "🚀",
    title: "Conquistador",
    description: "Quero acumular patrimônio o mais rápido possível.",
    allocation: {
      contas: 45,
      investimentos: 35,
      metas: 10,
      lazer: 5,
      desenvolvimento: 5,
    },
  },
  {
    id: "aproveitador",
    emoji: "🎉",
    title: "Aproveitador",
    description: "Prefiro aproveitar mais o presente mantendo organização.",
    allocation: {
      contas: 50,
      investimentos: 10,
      metas: 10,
      lazer: 25,
      desenvolvimento: 5,
    },
  },
];

export const NOTIFICATION_OPTIONS = [
  { id: "bills_due", label: "Lembrar contas vencendo" },
  { id: "invoice_closing", label: "Fatura fechando" },
  { id: "goal_reached", label: "Meta atingida" },
  { id: "goal_late", label: "Meta atrasada" },
  { id: "overspend", label: "Gastos acima do planejado" },
  { id: "weekly_summary", label: "Resumo semanal" },
  { id: "monthly_summary", label: "Resumo mensal" },
  { id: "invest_up", label: "Investimento valorizando" },
  { id: "invest_down", label: "Investimento desvalorizando" },
  { id: "emergency_low", label: "Reserva de emergência abaixo da meta" },
];

export const DEFAULT_CATEGORIES = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Saúde",
  "Lazer",
  "Educação",
  "Assinaturas",
  "Investimentos",
  "Metas",
  "Desenvolvimento",
  "Outros",
];

export function emptyAccount() {
  return {
    name: "",
    bank: "",
    balance: "",
    type: "corrente",
  };
}

export function emptyCard() {
  return {
    name: "",
    lastDigits: "",
    limit: "",
    closingDay: "1",
    dueDay: "10",
    accountId: "",
  };
}

export function emptyBill() {
  return {
    suggestionId: "",
    label: "",
    category: "Outros",
    value: "",
    dueDay: "10",
    payment: "boleto",
    accountId: "",
    recurrence: "mensal",
  };
}

export function createInitialState() {
  return {
    stepIndex: 0,
    incomeSource: "",
    monthlyIncome: "",
    wantAccounts: null,
    accounts: [emptyAccount()],
    wantCards: null,
    cards: [emptyCard()],
    wantBills: null,
    bills: [],
    profileId: "equilibrado",
    allocation: { ...PROFILES[0].allocation },
    notifications: NOTIFICATION_OPTIONS.map((item) => item.id),
    completed: false,
    skipped: false,
    applying: false,
  };
}
