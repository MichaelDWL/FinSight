// Servico de dominio responsavel por refletir uma movimentacao no saldo das
// contas. Centraliza a regra em um unico lugar para nunca duplicar logica de
// negocio entre os modulos (movimentacoes, faturas, recorrencias, etc.).

const SETTLED_STATUSES = ["confirmada", "paga"];

// Uma movimentacao so impacta o saldo quando esta liquidada. Contas mensais
// (despesa pendente) so afetam o saldo quando sao pagas.
function isSettled(status) {
  return SETTLED_STATUSES.includes(status);
}

// Calcula os deltas que a movimentacao aplica em cada conta.
// Retorna uma lista de { accountId, delta } para permitir movimentacoes que
// tocam mais de uma conta (ex.: transferencia).
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

    // Despesa, conta mensal (recorrencia) e pagamento de fatura debitam a conta.
    // Compra parcelada no cartao nao debita conta no momento da compra: o
    // impacto ocorre no pagamento da fatura (tratado na Fase 2).
    case "despesa":
    case "recorrencia":
    case "pagamento_fatura":
      return movement.conta_id ? [{ accountId: movement.conta_id, delta: -valor }] : [];

    default:
      return [];
  }
}

// Aplica (direction = 1) ou reverte (direction = -1) o efeito da movimentacao
// no saldo das contas. Deve ser chamado dentro de uma transacao SQL (client).
async function applyMovement(client, movement, direction = 1) {
  const deltas = accountDeltas(movement);

  for (const { accountId, delta } of deltas) {
    await client.query(
      `UPDATE contas
         SET saldo_atual = saldo_atual + $2, updated_at = now()
       WHERE id = $1`,
      [accountId, delta * direction]
    );
  }

  return deltas;
}

function revertMovement(client, movement) {
  return applyMovement(client, movement, -1);
}

module.exports = { applyMovement, revertMovement, accountDeltas, isSettled };
