/**
 * Stub de compatibilidade.
 * O FinSight funciona sem Redis e sem cache externo;
 * este modulo permanece apenas para evitar imports quebrados.
 */
function isReady() {
  return false;
}

function getClient() {
  return null;
}

async function connect() {
  return null;
}

async function disconnect() {
  return null;
}

module.exports = {
  connect,
  disconnect,
  getClient,
  isReady,
};
