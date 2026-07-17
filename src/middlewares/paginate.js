const { paginationService } = require("../services/pagination/PaginationService");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Middleware de paginacao obrigatoria.
 * Anexa req.pagination com page, pageSize, sort, order, limit, offset.
 *
 * @param {{ resource: string, defaultSort?: string }} options
 */
function paginate(options = {}) {
  const resource = options.resource || "default";

  return asyncHandler(async (req, _res, next) => {
    req.pagination = paginationService.parseFromQuery(req.query, {
      resource,
      defaultSort: options.defaultSort,
    });
    return next();
  });
}

module.exports = { paginate, paginationService };
