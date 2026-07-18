// Servico de dominio responsavel por refletir uma movimentacao no saldo das
// contas. Centraliza a regra em um unico lugar para nunca duplicar logica de
// negocio entre os modulos (movimentacoes, faturas, recorrencias, etc.).

const SETTLED_STATUSES = ["confirmada", "paga"];

function isSettled(status) {
  return SETTLED_STATUSES.includes(status);
}

function accountDeltas(movement) {
  if (!isSettled(movement.status)) return [];

  const valor = Number(movement.valor);
  if (!Number.isFinite(valor) || valor <= 0) return [];

  switch (movement.tipo) {
    case "receita":
      return movement.conta_id ? [{ accountId: movement.conta_id, delta: valor }] : [];

    case "transferencia":
      return [
        movement.conta_id ? { accountId: movement.conta_id, delta: -valor } : null,
        movement.conta_destino_id ? { accountId: movement.conta_destino_id, delta: valor } : null,
      ].filter(Boolean);

    case "despesa":
    case "recorrencia":
    case "pagamento_fatura":
      return movement.conta_id ? [{ accountId: movement.conta_id, delta: -valor }] : [];

    default:
      return [];
  }
}

/**
 * Trava linhas de conta com SELECT FOR UPDATE antes de alterar saldo.
 * Garante serializacao sob concorrencia (integridade financeira).
 */
async function lockAccounts(client, accountIds) {
  const ids = [...new Set((accountIds || []).filter(Boolean))].sort();
  for (const id of ids) {
    await client.query(`SELECT id FROM contas WHERE id = $1 FOR UPDATE`, [id]);
  }
}

async function applyMovement(client, movement, direction = 1) {
  const deltas = accountDeltas(movement);
  await lockAccounts(
    client,
    deltas.map((d) => d.accountId)
  );

  for (const { accountId, delta } of deltas) {
    await client.query(
      `UPDATE contas
         SET saldo_atual = saldo_atual + $2,
             versao = versao + 1,
             updated_at = now()
       WHERE id = $1`,
      [accountId, delta * direction]
    );
  }

  return deltas;
}

function revertMovement(client, movement) {
  return applyMovement(client, movement, -1);
}

module.exports = { applyMovement, revertMovement, accountDeltas, isSettled, lockAccounts };
