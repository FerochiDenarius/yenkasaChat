module.exports = function redirectMiddleware(req, res, next) {
  if (req.hostname === 'yenkasa.xyz' && !req.path.startsWith('/.well-known/')) {
    return res.redirect(301, `https://www.yenkasa.xyz${req.originalUrl}`);
  }
  next();
};
