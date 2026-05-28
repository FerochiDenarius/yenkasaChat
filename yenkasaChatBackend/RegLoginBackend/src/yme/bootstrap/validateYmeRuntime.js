const { normalizeText } = require('../utils/textNormalizer');

function validateYmeRuntime() {
  if (typeof normalizeText !== 'function') {
    throw new Error('YME runtime invalid: normalizeText missing');
  }

  console.log('[YME] Runtime validation passed');
}

module.exports = {
  validateYmeRuntime,
};
