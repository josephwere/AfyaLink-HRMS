const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) {
    console.error(err.stack || err);
  }
  const payload = {
    success: false,
    message: err.message || 'Server error',
  };
  if (err.code) payload.code = err.code;
  if (err.details) payload.details = err.details;
  res.status(statusCode).json(payload);
};

export default errorHandler;
