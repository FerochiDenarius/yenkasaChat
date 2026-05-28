function normalizeText(input = '') {
  return String(input)
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .toLowerCase();
}

module.exports = {
  normalizeText,
};
