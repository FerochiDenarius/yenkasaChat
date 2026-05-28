const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeText } = require('../../src/yme/utils/textNormalizer');

test('normalizeText handles undefined safely', () => {
  assert.equal(normalizeText(undefined), '');
});

test('normalizeText normalizes spacing and casing', () => {
  assert.equal(normalizeText(' Hello   WORLD '), 'hello world');
});
