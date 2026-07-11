const AppError = require("../utils/AppError");

function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      const issue = result.error.issues[0];
      return next(new AppError(issue.message || "Dados invalidos.", 400));
    }

    req.validated = result.data;
    return next();
  };
}

module.exports = validate;
