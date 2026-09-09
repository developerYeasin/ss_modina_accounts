const env = require('../config/env');
const { ApiError } = require('../utils/errors');

function notFoundHandler(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';

  // Translate the MySQL errors that map cleanly onto HTTP.
  if (err.code === 'ER_DUP_ENTRY') {
    status = 409;
    message = 'এই তথ্য আগে থেকেই আছে (duplicate entry)';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
    status = 409;
    message = 'সম্পর্কিত রেকর্ড থাকায় কাজটি করা যায়নি';
  }

  if (status >= 500) console.error(err);

  res.status(status).json({
    error: true,
    message,
    details: err.details,
    ...(env.nodeEnv === 'development' && status >= 500 ? { stack: err.stack } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
