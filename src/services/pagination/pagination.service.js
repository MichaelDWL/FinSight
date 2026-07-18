const paginationConfig = require("../../config/pagination.config");
const AppError = require("../../utils/AppError");

/**
 * PaginationService — normaliza page/pageSize/sort/order de forma segura.
 * Controllers devem usar parseFromQuery; repositories usam toSql().
 */
class PaginationService {
  constructor(config = paginationConfig) {
    this.config = config;
  }

  /**
   * @param {object} query - req.query
   * @param {{ resource?: string, defaultSort?: string }} [options]
   * @returns {{ page: number, pageSize: number, sort: string|null, order: 'asc'|'desc', offset: number, limit: number }}
   */
  parseFromQuery(query = {}, options = {}) {
    const resource = options.resource || "default";
    const pageCfg = this.config.page;
    const sizeCfg = this.config.pageSize;

    let page = Number(query.page);
    if (!Number.isFinite(page) || page < pageCfg.min) page = pageCfg.default;
    if (page > pageCfg.max) {
      throw new AppError(`page nao pode ser maior que ${pageCfg.max}.`, 400, {
        code: "PAGINATION_PAGE_MAX",
      });
    }
    page = Math.floor(page);

    let pageSize = Number(query.pageSize ?? query.limit);
    if (!Number.isFinite(pageSize) || pageSize < sizeCfg.min) {
      pageSize = sizeCfg.default;
    }
    pageSize = Math.floor(pageSize);

    if (pageSize > sizeCfg.max) {
      if (this.config.rejectOversizedPageSize) {
        throw new AppError(
          `pageSize maximo permitido e ${sizeCfg.max}.`,
          400,
          { code: "PAGINATION_PAGE_SIZE_MAX" }
        );
      }
      pageSize = sizeCfg.max;
    }

    const orderRaw = String(query.order || this.config.order.default).toLowerCase();
    const order = this.config.order.allowed.includes(orderRaw)
      ? orderRaw
      : this.config.order.default;

    const sortMap = this.config.sortFields[resource] || this.config.sortFields.default;
    const sortKey = query.sort ? String(query.sort).toLowerCase() : options.defaultSort || null;
    let sort = null;
    if (sortKey) {
      if (!sortMap[sortKey]) {
        throw new AppError(
          `Campo de ordenacao nao permitido: ${sortKey}.`,
          400,
          { code: "INVALID_SORT_FIELD", allowed: Object.keys(sortMap) }
        );
      }
      sort = sortKey;
    }

    const offset = (page - 1) * pageSize;

    return {
      page,
      pageSize,
      sort,
      order,
      offset,
      limit: pageSize,
      resource,
    };
  }

  /**
   * Resolve ORDER BY seguro (coluna SQL whitelistada).
   * @returns {{ sql: string, params: never[] } | { sql: string }}
   */
  resolveOrderBy(pagination, fallbackSql = "created_at DESC") {
    const sortMap =
      this.config.sortFields[pagination.resource] || this.config.sortFields.default;

    if (!pagination.sort || !sortMap[pagination.sort]) {
      return { clause: fallbackSql };
    }

    const column = sortMap[pagination.sort];
    const direction = pagination.order === "asc" ? "ASC" : "DESC";
    return { clause: `${column} ${direction}` };
  }

  toMeta(pagination, total) {
    const totalPages = Math.max(1, Math.ceil(Number(total || 0) / pagination.pageSize));
    return {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: Number(total || 0),
      totalPages,
      sort: pagination.sort,
      order: pagination.order,
    };
  }

  getConfig() {
    return this.config;
  }
}

const paginationService = new PaginationService();

module.exports = {
  PaginationService,
  paginationService,
};
