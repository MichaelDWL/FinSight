const { AsyncLocalStorage } = require("async_hooks");

/**
 * Contexto isolado por request (AsyncLocalStorage).
 * Memoiza promises/resultados para evitar queries duplicadas
 * na mesma invocacao — sem estado global por usuario.
 */
const storage = new AsyncLocalStorage();

function createStore(seed = {}) {
  return {
    memo: new Map(),
    ...seed,
  };
}

function runWithRequestContext(fn, seed = {}) {
  return storage.run(createStore(seed), fn);
}

function getRequestContext() {
  return storage.getStore() || null;
}

/**
 * Memoiza o resultado de `factory` pela chave, apenas dentro do request atual.
 * Sem store ativo, executa `factory` diretamente (sem cache).
 */
function memoize(key, factory) {
  const store = storage.getStore();
  if (!store) {
    return Promise.resolve().then(factory);
  }

  const memoKey = String(key);
  if (store.memo.has(memoKey)) {
    return store.memo.get(memoKey);
  }

  const pending = Promise.resolve().then(factory);
  store.memo.set(memoKey, pending);
  return pending;
}

module.exports = {
  runWithRequestContext,
  getRequestContext,
  memoize,
  createStore,
};
