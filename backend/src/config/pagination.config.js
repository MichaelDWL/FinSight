/**
 * Configuracao central de paginacao e ordenacao segura.
 * Altere SOMENTE este arquivo para ajustar limites / whitelists.
 */

const paginationConfig = Object.freeze({
  page: Object.freeze({
    min: 1,
    max: 100_000,
    default: 1,
  }),
  pageSize: Object.freeze({
    min: 1,
    max: 100,
    default: 20,
  }),
  /** Se true, pageSize > max e rejeitado com 400; se false, e clampado para max. */
  rejectOversizedPageSize: false,

  order: Object.freeze({
    allowed: Object.freeze(["asc", "desc"]),
    default: "desc",
  }),

  /**
   * Campos de ordenacao permitidos por recurso.
   * Chave = nome logico da API; value = coluna SQL segura (nunca input cru).
   */
  sortFields: Object.freeze({
    movements: Object.freeze({
      date: "m.data_transacao",
      data: "m.data_transacao",
      valor: "m.valor",
      value: "m.valor",
      created_at: "m.created_at",
      descricao: "m.descricao",
      nome: "m.descricao",
    }),
    accounts: Object.freeze({
      nome: "c.nome",
      name: "c.nome",
      saldo: "c.saldo_atual",
      balance: "c.saldo_atual",
      created_at: "c.created_at",
    }),
    cards: Object.freeze({
      nome: "c.nome",
      name: "c.nome",
      created_at: "c.created_at",
    }),
    investments: Object.freeze({
      nome: "i.nome",
      name: "i.nome",
      valor: "i.valor_atual",
      value: "i.valor_atual",
      data: "i.data_investimento",
      date: "i.data_investimento",
      created_at: "i.created_at",
    }),
    goals: Object.freeze({
      nome: "nome",
      name: "nome",
      prazo: "prazo",
      deadline: "prazo",
      created_at: "created_at",
    }),
    adminUsers: Object.freeze({
      nome: "nome",
      name: "nome",
      email: "email",
      created_at: "created_at",
    }),
    default: Object.freeze({
      created_at: "created_at",
      nome: "nome",
      name: "nome",
    }),
  }),

  /**
   * Filtros permitidos por recurso (QueryBuilder).
   * type: string | number | uuid | date | enum
   */
  filters: Object.freeze({
    movements: Object.freeze({
      status: { column: "m.status", type: "enum", values: ["pendente", "confirmada", "paga", "cancelada"] },
      tipo: { column: "m.tipo", type: "string" },
      type: { column: "m.tipo", type: "string" },
      contaId: { column: "m.conta_id", type: "uuid" },
      accountId: { column: "m.conta_id", type: "uuid" },
      from: { column: "m.data_transacao", type: "date", op: ">=" },
      to: { column: "m.data_transacao", type: "date", op: "<=" },
    }),
    investments: Object.freeze({
      tipo: { column: "i.tipo_investimento", type: "string" },
      type: { column: "i.tipo_investimento", type: "string" },
    }),
  }),
});

module.exports = paginationConfig;
