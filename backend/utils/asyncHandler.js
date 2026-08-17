// Wraps async route handlers so errors are forwarded to Express's error middleware
// instead of needing a try/catch in every controller function.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
