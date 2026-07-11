// Servico de dominio das recorrencias. Gera automaticamente as proximas
// movimentacoes (ex.: contas mensais) de forma "lazy": e chamado quando o
// usuario carrega o dashboard e cria todas as ocorrencias vencidas ate o fim
// do mes corrente. A idempotencia vem de avancar e persistir proxima_geracao.

const pool = require("../database/pool");
const { withTransaction } = require("../database/transaction");
const { applyMovement } = require("./balanceService");

function pad(value) {
  return String(value).padStart(2, "0");
}

function fmt(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Ultimo dia de um mes (month = 1..12).
function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addDaysIso(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return fmt(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

// Calcula a proxima ocorrencia a partir de uma data ISO.
function nextOccurrence(iso, intervalo, diaVencimento) {
  const [year, month, day] = iso.split("-").map(Number);

  if (intervalo === "diario") return addDaysIso(iso, 1);
  if (intervalo === "semanal") return addDaysIso(iso, 7);

  if (intervalo === "anual") {
    const nextYear = year + 1;
    return fmt(nextYear, month, Math.min(day, lastDayOfMonth(nextYear, month)));
  }

  // mensal (padrao)
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const targetDay = diaVencimento || day;
  return fmt(nextYear, nextMonth, Math.min(targetDay, lastDayOfMonth(nextYear, nextMonth)));
}

async function getMonthLimit(client) {
  const { rows } = await client.query(
    `SELECT to_char((date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date, 'YYYY-MM-DD') AS limite`
  );
  return rows[0].limite;
}

// Gera as movimentacoes pendentes de todas as recorrencias ativas do usuario.
async function generate(client, userId) {
  const limite = await getMonthLimit(client);

  const { rows: recorrencias } = await client.query(
    `SELECT id, conta_id, categoria_id, tipo, forma_pagamento, descricao, valor,
            intervalo, dia_vencimento,
            to_char(proxima_geracao, 'YYYY-MM-DD') AS proxima_geracao
       FROM recorrencias
      WHERE usuario_id = $1 AND ativa = true AND proxima_geracao <= $2
      ORDER BY proxima_geracao ASC`,
    [userId, limite]
  );

  let generated = 0;

  for (const rec of recorrencias) {
    let proxima = rec.proxima_geracao;
    let guard = 0;

    while (proxima <= limite && guard < 120) {
      const status = rec.tipo === "receita" ? "confirmada" : "pendente";

      const { rows } = await client.query(
        `INSERT INTO movimentacoes (
           usuario_id, conta_id, categoria_id, recorrencia_id, tipo, origem,
           forma_pagamento, status, descricao, valor, data_transacao, data_competencia,
           recorrente, recorrencia_intervalo
         )
         VALUES ($1, $2, $3, $4, $5, 'recorrente', $6, $7, $8, $9, $10,
                 date_trunc('month', $10::date)::date, true, $11)
         RETURNING id, tipo, status, valor, conta_id, conta_destino_id`,
        [
          userId,
          rec.conta_id,
          rec.categoria_id,
          rec.id,
          rec.tipo,
          rec.forma_pagamento,
          status,
          rec.descricao,
          rec.valor,
          proxima,
          rec.intervalo,
        ]
      );

      await applyMovement(client, rows[0], 1);
      generated += 1;

      proxima = nextOccurrence(proxima, rec.intervalo, rec.dia_vencimento);
      guard += 1;
    }

    await client.query(
      `UPDATE recorrencias SET proxima_geracao = $2, updated_at = now() WHERE id = $1`,
      [rec.id, proxima]
    );
  }

  return generated;
}

// Ponto de entrada usado pelo carregamento do dashboard.
async function ensureGenerated(userId) {
  return withTransaction((client) => generate(client, userId));
}

// Cria um modelo de recorrencia (usado ao cadastrar uma conta recorrente).
async function createRecurrence(client, userId, data) {
  const { rows } = await client.query(
    `INSERT INTO recorrencias (
       usuario_id, conta_id, categoria_id, tipo, forma_pagamento, descricao,
       valor, intervalo, dia_vencimento, proxima_geracao, observacao
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      userId,
      data.conta_id || null,
      data.categoria_id || null,
      data.tipo || "despesa",
      data.forma_pagamento || "boleto",
      data.descricao,
      data.valor,
      data.intervalo || "mensal",
      data.dia_vencimento || null,
      data.proxima_geracao,
      data.observacao || null,
    ]
  );
  return rows[0].id;
}

async function list(userId) {
  const { rows } = await pool.query(
    `SELECT r.id, r.descricao, r.valor, r.tipo, r.intervalo, r.dia_vencimento,
            r.ativa, to_char(r.proxima_geracao, 'YYYY-MM-DD') AS proxima_geracao,
            c.nome AS categoria
       FROM recorrencias r
       LEFT JOIN categorias c ON c.id = r.categoria_id
      WHERE r.usuario_id = $1
      ORDER BY r.ativa DESC, r.proxima_geracao ASC`,
    [userId]
  );

  return rows.map((row) => ({
    id: row.id,
    description: row.descricao,
    value: Number(row.valor),
    type: row.tipo,
    interval: row.intervalo,
    dueDay: row.dia_vencimento,
    active: row.ativa,
    nextRun: row.proxima_geracao,
    category: row.categoria,
  }));
}

async function deactivate(userId, id) {
  const { rowCount } = await pool.query(
    `UPDATE recorrencias SET ativa = false, updated_at = now() WHERE usuario_id = $1 AND id = $2`,
    [userId, id]
  );
  return rowCount > 0;
}

module.exports = {
  nextOccurrence,
  ensureGenerated,
  generate,
  createRecurrence,
  list,
  deactivate,
};
