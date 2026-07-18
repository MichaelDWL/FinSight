/**
 * Executa promises independentes em paralelo com falha controlada.
 * critical: se rejeitar, a promise composta rejeita.
 * optional: rejeicao vira fallback (null por padrao).
 */
async function parallel(tasks) {
  const entries = Object.entries(tasks);
  const results = await Promise.all(
    entries.map(async ([key, spec]) => {
      const factory = typeof spec === "function" ? spec : spec.fn;
      const optional = typeof spec === "object" && spec.optional === true;
      const fallback = typeof spec === "object" && "fallback" in spec ? spec.fallback : null;

      try {
        const value = await factory();
        return [key, value];
      } catch (error) {
        if (optional) {
          return [key, fallback];
        }
        throw error;
      }
    }),
  );

  return Object.fromEntries(results);
}

module.exports = { parallel };
