const listeners = new Map();

function on(eventName, handler) {
  if (!listeners.has(eventName)) listeners.set(eventName, new Set());
  listeners.get(eventName).add(handler);
  return () => off(eventName, handler);
}

function off(eventName, handler) {
  listeners.get(eventName)?.delete(handler);
}

async function emit(eventName, payload = {}) {
  const handlers = [...(listeners.get(eventName) || [])];
  const results = [];
  for (const handler of handlers) {
    try {
      results.push(await handler(payload));
    } catch (error) {
      console.error(`[personalization.event] ${eventName}`, error);
      results.push(null);
    }
  }
  return results;
}

module.exports = { on, off, emit };
