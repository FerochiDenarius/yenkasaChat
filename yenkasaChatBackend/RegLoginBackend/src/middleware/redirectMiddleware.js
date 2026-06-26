module.exports = function redirectMiddleware(req, res, next) {
  const host = String(req.hostname || '').toLowerCase();
  if ((host === 'yenkasa.xyz' || host === 'gcloud.yenkasa.xyz') && !req.path.startsWith('/.well-known/')) {
    return res.redirect(301, `https://www.yenkasa.xyz${req.originalUrl}`);
  }
  next();
};
