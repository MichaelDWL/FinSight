const paginationConfig = require("../../config/pagination.config");
const AppError = require("../../utils/AppError");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * SafeQueryBuilder — monta WHERE apenas com filtros whitelisted.
 * Nunca concatena valores do usuario no SQL.
 */
class SafeQueryBuilder {
  constructor(resource, config = paginationConfig) {
    this.resource = resource;
    this.config = config;
    this.filtersDef = config.filters[resource] || {};
    this.clauses = [];
    this.params = [];
  }

  static for(resource) {
    return new SafeQueryBuilder(resource);
  }

  /**
   * @param {object} query - req.query
   * @param {number} [startIndex=1] - proximo indice $N
   */
  applyQuery(query = {}, startIndex = 1) {
    let idx = startIndex;

    for (const [key, def] of Object.entries(this.filtersDef)) {
      if (query[key] === undefined || query[key] === null || query[key] === "") {
        continue;
      }

      const raw = query[key];
      const value = this.#coerce(raw, def);
      const op = def.op || "=";
      this.clauses.push(`${def.column} ${op} $${idx}`);
      this.params.push(value);
      idx += 1;
    }

    return this;
  }

  #coerce(raw, def) {
    switch (def.type) {
      case "uuid": {
        const v = String(raw);
        if (!UUID_RE.test(v)) {
          throw new AppError(`Filtro invalido (uuid): ${def.column}`, 400);
        }
        return v;
      }
      case "date": {
        const v = String(raw).slice(0, 10);
        if (!DATE_RE.test(v)) {
          throw new AppError(`Filtro invalido (date): ${def.column}`, 400);
        }
        return v;
      }
      case "number": {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          throw new AppError(`Filtro invalido (number): ${def.column}`, 400);
        }
        return n;
      }
      case "enum": {
        const v = String(raw);
        if (!def.values?.includes(v)) {
          throw new AppError(`Filtro nao permitido: ${v}`, 400, {
            allowed: def.values,
          });
        }
        return v;
      }
      case "string":
      default: {
        const v = String(raw).trim().slice(0, 120);
        if (!v) {
          throw new AppError(`Filtro vazio nao permitido.`, 400);
        }
        return v;
      }
    }
  }

  /**
   * @returns {{ sql: string, params: any[], nextIndex: number }}
   */
  build(startIndex = 1) {
    this.clauses = [];
    this.params = [];
    // re-apply nao; use after applyQuery
    return {
      sql: this.clauses.length ? this.clauses.join(" AND ") : "",
      params: this.params,
      nextIndex: startIndex + this.params.length,
    };
  }

  /**
   * Aplica query e retorna fragmento WHERE (sem a palavra WHERE).
   */
  buildFromQuery(query = {}, startIndex = 1) {
    this.clauses = [];
    this.params = [];
    this.applyQuery(query, startIndex);
    return {
      sql: this.clauses.length ? this.clauses.join(" AND ") : "",
      params: [...this.params],
      nextIndex: startIndex + this.params.length,
    };
  }
}

module.exports = {
  SafeQueryBuilder,
};
