function createError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function notFound(req, _res, next) {
  if (req.path.startsWith("/api/")) {
    return next(createError(404, "Route not found"));
  }
  return next();
}

function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || "Something went wrong",
    details: err.details
  });
}

module.exports = { createError, notFound, errorHandler };
