const multer = require('multer');

module.exports = function multerError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Multer error: ${err.message}` });
  }
  if (err?.message === 'Unsupported file type') {
    return res.status(400).json({ error: err.message });
  }
  next(err);
};
