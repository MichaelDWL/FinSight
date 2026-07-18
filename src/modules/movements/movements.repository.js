const pool = require("../../database/pool");
const AppError = require("../../utils/AppError");
const { withTransaction } = require("../../database/transaction");
const { applyMovement, revertMovement } = require("../../services/balance.service");
const invoiceService = require("../../services/invoice.service");
const recurrenceService = require("../../services/recurrence.service");
const financialAudit = require("../audit/financialAudit.service");
const { paginationService } = require("../../services/pagination/pagination.service");
const { SafeQueryBuilder } = require("../../services/query/safe-query-builder");
const paginationConfig = require("../../config/pagination.config");

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

async function resolveCategoryId(client, userId, categoryName, tipo) {
  const name = String(categoryName || "").trim();
  if (!name) return null;

  const categoryType = tipo === "receita" ? "receita" : "despesa";
  const normalized = normalizeName(name);

  const { rows } = await client.query(
    `SELECT id, nome FROM categorias WHERE usuario_id = $1 AND tipo = $2`,
    [userId, categoryType]
  );

  const match = rows.find((row) => normalizeName(row.nome) === normalized);
  return match ? match.id : null;
}

// ------------------------------------------------------------------
// Mapeadores de saida
// ------------------------------------------------------------------

// Visao "transacoes" (compativel com a tela de Transacoes/Dashboard).
function mapTransactionView(row) {
  return {
    id: row.id,
    icon: row.icon || "wallet",
    description: row.descricao,
    category: row.categoria || row.tipo,
    account: row.conta || "Sem conta",
    value: row.tipo === "receita" ? Number(row.valor) : -Number(row.valor),
    date: row.data_transacao,
    type: row.tipo === "receita" ? "Receita" : "Despesa",
    status: row.status,
    payment: row.forma_pagamento,
  };
}

// Visao "contas a pagar" (compativel com a tela de Contas/Despesas).
function mapBillView(row) {
  return {
    id: row.id,
    icon: row.icon || "fa-file-invoice-dollar",
    name: row.descricao,
    category: row.categoria || "Conta",
    value: Number(row.valor),
    dueDate: row.data_transacao,
    status: row.status === "paga" ? "paid" : "pending",
    paymentMethod: row.forma_pagamento,
    recurrence: Boolean(row.recorrente),
  };
}

const BASE_SELECT = `
  SELECT
    m.id,
    m.descricao,
    m.tipo,
    m.origem,
    m.forma_pagamento,
    m.status,
    m.valor,
    m.data_transacao,
    m.recorrente,
    c.nome AS categoria,
    c.icone AS icon,
    co.nome AS conta
  FROM movimentacoes m
  LEFT JOIN categorias c ON c.id = m.categoria_id
  LEFT JOIN contas co ON co.id = m.conta_id
  WHERE m.usuario_id = $1
    AND m.excluido_em IS NULL
`;

async function listAll(userId, options = {}) {
  const pagination =
    options.pagination ||
    paginationService.parseFromQuery(
      {
        page: options.page,
        pageSize: options.pageSize ?? paginationConfig.pageSize.default,
        sort: options.sort,
        order: options.order,
      },
      { resource: "movements", defaultSort: "date" }
    );

  const filters = SafeQueryBuilder.for("movements").buildFromQuery(options.filters || {}, 2);
  const whereExtra = filters.sql ? ` AND ${filters.sql}` : "";

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM movimentacoes m
      WHERE m.usuario_id = $1 AND m.excluido_em IS NULL${whereExtra}`,
    [userId, ...filters.params]
  );

  const order = paginationService.resolveOrderBy(
    pagination,
    "m.data_transacao DESC, m.created_at DESC"
  );
  const limitIdx = 2 + filters.params.length;
  const offsetIdx = limitIdx + 1;

  const { rows } = await pool.query(
    `${BASE_SELECT}${whereExtra}
     ORDER BY ${order.clause}
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [userId, ...filters.params, pagination.limit, pagination.offset]
  );

  return {
    items: rows.map(mapTransactionView),
    ...paginationService.toMeta(pagination, countResult.rows[0].total),
  };
}

async function listTransactionsView(userId, options) {
  return listAll(userId, options);
}

async function listBillsView(userId, options = {}) {
  const pagination =
    options.pagination ||
    paginationService.parseFromQuery(
      {
        page: options.page,
        pageSize: options.pageSize ?? paginationConfig.pageSize.default,
        sort: options.sort,
        order: options.order || "asc",
      },
      { resource: "movements", defaultSort: "date" }
    );

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM movimentacoes
      WHERE usuario_id = $1 AND excluido_em IS NULL
        AND tipo IN ('despesa', 'recorrencia', 'pagamento_fatura')`,
    [userId]
  );

  const order = paginationService.resolveOrderBy(
    { ...pagination, resource: "movements" },
    "m.data_transacao ASC, m.created_at DESC"
  );

  const { rows } = await pool.query(
    `${BASE_SELECT}
       AND m.tipo IN ('despesa', 'recorrencia', 'pagamento_fatura')
     ORDER BY ${order.clause}
     LIMIT $2 OFFSET $3`,
    [userId, pagination.limit, pagination.offset]
  );

  return {
    items: rows.map(mapBillView),
    ...paginationService.toMeta(pagination, countResult.rows[0].total),
  };
}

async function findRawById(client, userId, id) {
  const { rows } = await client.query(
    `SELECT id, tipo, status, valor, conta_id, conta_destino_id, cartao_id, fatura_id,
            descricao, forma_pagamento, data_transacao, versao
       FROM movimentacoes
      WHERE usuario_id = $1 AND id = $2 AND excluido_em IS NULL
      FOR UPDATE`,
    [userId, id]
  );
  return rows[0] || null;
}

// ------------------------------------------------------------------
// Escrita (sempre transacional + reflexo no saldo)
// ------------------------------------------------------------------

// Traduz o payload de dominio (5 tipos) para a linha fisica em movimentacoes.
async function buildInsertData(client, userId, payload) {
  const domainType = payload.tipo;

  const shared = {
    conta_id: null,
    conta_destino_id: null,
    categoria_id: null,
    cartao_id: null,
    fatura_id: null,
    tipo: "despesa",
    origem: "manual",
    forma_pagamento: payload.payment || "pix",
    status: "confirmada",
    descricao: payload.description || "Movimentacao",
    valor: payload.value,
    data_transacao: payload.date,
    recorrente: false,
    recorrencia_intervalo: null,
    observacao: payload.notes || null,
  };

  if (domainType === "receita") {
    shared.tipo = "receita";
    shared.conta_id = payload.accountId || null;
    shared.categoria_id = await resolveCategoryId(client, userId, payload.category, "receita");
    return shared;
  }

  if (domainType === "despesa") {
    shared.tipo = "despesa";
    shared.conta_id = payload.accountId || null;
    shared.categoria_id = await resolveCategoryId(client, userId, payload.category, "despesa");
    return shared;
  }

  if (domainType === "conta") {
    // Conta mensal: despesa pendente com data de vencimento.
    shared.tipo = "despesa";
    shared.status = "pendente";
    shared.forma_pagamento = payload.payment || "boleto";
    shared.conta_id = payload.accountId || null;
    shared.categoria_id = await resolveCategoryId(client, userId, payload.category, "despesa");
    shared.data_transacao = payload.dueDate || payload.date;
    shared.recorrente = Boolean(payload.recurring);
    shared.recorrencia_intervalo = payload.recurring ? "mensal" : null;
    return shared;
  }

  if (domainType === "transferencia") {
    shared.tipo = "transferencia";
    shared.origem = "transferencia";
    shared.forma_pagamento = "transferencia";
    shared.conta_id = payload.fromAccountId;
    shared.conta_destino_id = payload.toAccountId;
    shared.descricao = payload.description || "Transferencia entre contas";
    return shared;
  }

  // 'cartao' e tratado em createCardPurchase (fluxo com parcelas + faturas).
  throw new AppError("Tipo de movimentacao invalido.", 400);
}

// Compra no cartao: cria a movimentacao, distribui as parcelas em suas
// respectivas faturas (criadas automaticamente) e reduz o limite disponivel.
async function createCardPurchase(client, userId, payload) {
  const { rows: cardRows } = await client.query(
    `SELECT id, dia_fechamento, dia_vencimento, limite_total, limite_disponivel
       FROM cartoes WHERE usuario_id = $1 AND id = $2`,
    [userId, payload.cardId]
  );
  const card = cardRows[0];
  if (!card) throw new AppError("Cartao nao encontrado.", 404);

  const installments = Math.max(1, Number.parseInt(payload.installments || 1, 10));
  const total = round2(payload.value);
  const categoriaId = await resolveCategoryId(client, userId, payload.category, "despesa");
  const baseRef = invoiceService.referenceMonthForPurchase(payload.date, Number(card.dia_fechamento));
  const firstInvoice = await invoiceService.getOrCreateInvoice(client, userId, card, baseRef);
  const tipo = installments > 1 ? "compra_parcelada" : "despesa";

  const { rows: movRows } = await client.query(
    `INSERT INTO movimentacoes (
       usuario_id, categoria_id, cartao_id, fatura_id, tipo, origem, forma_pagamento,
       status, descricao, valor, data_transacao, data_competencia, total_parcelas, observacao
     )
     VALUES ($1, $2, $3, $4, $5, 'cartao', 'cartao_credito', 'confirmada', $6, $7, $8,
             date_trunc('month', $8::date)::date, $9, $10)
     RETURNING id`,
    [
      userId,
      categoriaId,
      card.id,
      firstInvoice.id,
      tipo,
      payload.description,
      total,
      payload.date,
      installments > 1 ? installments : null,
      payload.notes || null,
    ]
  );
  const movimentacaoId = movRows[0].id;

  if (installments > 1) {
    const per = round2(total / installments);
    let accumulated = 0;

    for (let numero = 1; numero <= installments; numero += 1) {
      const refMonth = invoiceService.addMonths(baseRef, numero - 1);
      const invoice = await invoiceService.getOrCreateInvoice(client, userId, card, refMonth);
      const valor = numero === installments ? round2(total - accumulated) : per;
      accumulated = round2(accumulated + valor);

      await client.query(
        `INSERT INTO parcelas (usuario_id, movimentacao_id, fatura_id, numero, total, valor, data_vencimento, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendente')`,
        [userId, movimentacaoId, invoice.id, numero, installments, valor, invoice.data_vencimento]
      );

      await invoiceService.addToInvoice(client, invoice.id, valor);
    }
  } else {
    await invoiceService.addToInvoice(client, firstInvoice.id, total);
  }

  await client.query(
    `UPDATE cartoes SET limite_disponivel = GREATEST(limite_disponivel - $2, 0), updated_at = now()
      WHERE id = $1`,
    [card.id, total]
  );

  return { id: movimentacaoId };
}

// Uma despesa paga no cartao de credito segue exatamente o mesmo fluxo de uma
// compra no cartao: gera parcelas/fatura, reduz o limite e nao debita a conta.
function isCreditCardExpense(payload) {
  return (
    payload.tipo === "despesa" &&
    payload.payment === "cartao_credito" &&
    Boolean(payload.cardId)
  );
}

async function create(userId, payload, auditMeta = {}) {
  if (payload.tipo === "cartao" || isCreditCardExpense(payload)) {
    return withTransaction(async (client) => {
      const result = await createCardPurchase(client, userId, payload);
      await financialAudit.record({
        userId,
        entityType: "movimentacao",
        entityId: result.id,
        operation: "create",
        newValues: { tipo: payload.tipo, valor: payload.value },
        origin: auditMeta.origin || "api",
        ip: auditMeta.ip,
        userAgent: auditMeta.userAgent,
        client,
      });
      return result;
    });
  }

  return withTransaction(async (client) => {
    const data = await buildInsertData(client, userId, payload);

    const { rows } = await client.query(
      `INSERT INTO movimentacoes (
         usuario_id, conta_id, conta_destino_id, categoria_id, cartao_id, fatura_id,
         tipo, origem, forma_pagamento, status, descricao, valor,
         data_transacao, data_competencia, recorrente, recorrencia_intervalo, observacao
       )
       VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12,
         $13, date_trunc('month', $13::date)::date, $14, $15, $16
       )
       RETURNING id, tipo, status, valor, conta_id, conta_destino_id, descricao`,
      [
        userId,
        data.conta_id,
        data.conta_destino_id,
        data.categoria_id,
        data.cartao_id,
        data.fatura_id,
        data.tipo,
        data.origem,
        data.forma_pagamento,
        data.status,
        data.descricao,
        data.valor,
        data.data_transacao,
        data.recorrente,
        data.recorrencia_intervalo,
        data.observacao,
      ]
    );

    await applyMovement(client, rows[0], 1);

    if (payload.tipo === "conta" && payload.recurring) {
      const dueDateIso = String(data.data_transacao).slice(0, 10);
      const dueDay = Number(dueDateIso.split("-")[2]);
      const proximaGeracao = recurrenceService.nextOccurrence(dueDateIso, "mensal", dueDay);

      const recorrenciaId = await recurrenceService.createRecurrence(client, userId, {
        conta_id: data.conta_id,
        categoria_id: data.categoria_id,
        tipo: "despesa",
        forma_pagamento: data.forma_pagamento,
        descricao: data.descricao,
        valor: data.valor,
        intervalo: "mensal",
        dia_vencimento: dueDay,
        proxima_geracao: proximaGeracao,
        observacao: data.observacao,
      });

      await client.query(
        `UPDATE movimentacoes SET recorrencia_id = $2, origem = 'recorrente' WHERE id = $1`,
        [rows[0].id, recorrenciaId]
      );
    }

    await financialAudit.record({
      userId,
      entityType: "movimentacao",
      entityId: rows[0].id,
      operation: data.tipo === "transferencia" ? "transfer" : "create",
      newValues: rows[0],
      origin: auditMeta.origin || "api",
      ip: auditMeta.ip,
      userAgent: auditMeta.userAgent,
      client,
    });

    return { id: rows[0].id };
  });
}

async function update(userId, id, payload, auditMeta = {}) {
  return withTransaction(async (client) => {
    const current = await findRawById(client, userId, id);
    if (!current) return null;

    await revertMovement(client, current);

    let categoriaId = payload.categoryId ?? null;
    if (!categoriaId && payload.category) {
      const tipo = payload.type || current.tipo;
      categoriaId = await resolveCategoryId(client, userId, payload.category, tipo);
    }

    const { rows } = await client.query(
      `UPDATE movimentacoes
          SET descricao = COALESCE($3, descricao),
              valor = COALESCE($4, valor),
              forma_pagamento = COALESCE($5, forma_pagamento),
              status = COALESCE($6, status),
              data_transacao = COALESCE($7, data_transacao),
              data_competencia = COALESCE(date_trunc('month', $7::date)::date, data_competencia),
              observacao = COALESCE($8, observacao),
              categoria_id = COALESCE($9, categoria_id),
              conta_id = COALESCE($10, conta_id),
              versao = versao + 1,
              updated_at = now()
        WHERE usuario_id = $1 AND id = $2 AND excluido_em IS NULL
        RETURNING id, tipo, status, valor, conta_id, conta_destino_id, descricao`,
      [
        userId,
        id,
        payload.description ?? null,
        payload.value ?? null,
        payload.payment ?? null,
        payload.status ?? null,
        payload.date ?? payload.dueDate ?? null,
        payload.notes ?? null,
        categoriaId,
        payload.accountId ?? null,
      ]
    );

    await applyMovement(client, rows[0], 1);

    await financialAudit.record({
      userId,
      entityType: "movimentacao",
      entityId: id,
      operation: "update",
      previousValues: current,
      newValues: rows[0],
      origin: auditMeta.origin || "api",
      ip: auditMeta.ip,
      userAgent: auditMeta.userAgent,
      client,
    });

    return { id: rows[0].id };
  });
}

async function markPaid(userId, id, paid, auditMeta = {}) {
  return withTransaction(async (client) => {
    const current = await findRawById(client, userId, id);
    if (!current) return null;

    await revertMovement(client, current);

    const { rows } = await client.query(
      `UPDATE movimentacoes
          SET status = $3, versao = versao + 1, updated_at = now()
        WHERE usuario_id = $1 AND id = $2 AND excluido_em IS NULL
        RETURNING id, tipo, status, valor, conta_id, conta_destino_id, descricao`,
      [userId, id, paid ? "paga" : "pendente"]
    );

    await applyMovement(client, rows[0], 1);

    await financialAudit.record({
      userId,
      entityType: "movimentacao",
      entityId: id,
      operation: "pay",
      previousValues: current,
      newValues: rows[0],
      origin: auditMeta.origin || "api",
      ip: auditMeta.ip,
      userAgent: auditMeta.userAgent,
      client,
    });

    return { id: rows[0].id };
  });
}

// Ao excluir uma compra no cartao precisamos desfazer os efeitos colaterais:
// abater o valor das parcelas de suas faturas e devolver o limite do cartao.
async function revertCardPurchase(client, current) {
  if (!current.cartao_id) return;

  const { rows: parcelas } = await client.query(
    `SELECT fatura_id, valor FROM parcelas WHERE movimentacao_id = $1`,
    [current.id]
  );

  if (parcelas.length > 0) {
    for (const parcela of parcelas) {
      if (parcela.fatura_id) {
        await client.query(
          `UPDATE faturas SET valor_total = GREATEST(valor_total - $2, 0), updated_at = now() WHERE id = $1`,
          [parcela.fatura_id, parcela.valor]
        );
      }
    }
  } else if (current.fatura_id) {
    // Compra a vista no cartao (sem parcelas): abate o total da propria fatura.
    await client.query(
      `UPDATE faturas SET valor_total = GREATEST(valor_total - $2, 0), updated_at = now() WHERE id = $1`,
      [current.fatura_id, current.valor]
    );
  }

  await client.query(
    `UPDATE cartoes SET limite_disponivel = LEAST(limite_disponivel + $2, limite_total), updated_at = now()
      WHERE id = $1`,
    [current.cartao_id, current.valor]
  );
}

async function remove(userId, id, auditMeta = {}) {
  return withTransaction(async (client) => {
    const current = await findRawById(client, userId, id);
    if (!current) return false;

    await revertMovement(client, current);
    await revertCardPurchase(client, current);

    const { rowCount } = await client.query(
      `UPDATE movimentacoes
          SET excluido_em = now(), versao = versao + 1, updated_at = now()
        WHERE usuario_id = $1 AND id = $2 AND excluido_em IS NULL`,
      [userId, id]
    );

    if (rowCount > 0) {
      await financialAudit.record({
        userId,
        entityType: "movimentacao",
        entityId: id,
        operation: "delete",
        previousValues: current,
        origin: auditMeta.origin || "api",
        ip: auditMeta.ip,
        userAgent: auditMeta.userAgent,
        client,
      });
    }

    return rowCount > 0;
  });
}

module.exports = {
  listAll,
  listTransactionsView,
  listBillsView,
  create,
  update,
  markPaid,
  remove,
};
