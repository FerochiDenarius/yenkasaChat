const assert = require('node:assert/strict');
const test = require('node:test');

const mediaStorage = require('../services/mediaStorage.service');

const ENV_KEYS = [
  'MEDIA_STORAGE_PROVIDER',
  'PRIMARY_MEDIA_STORAGE',
  'R2_MEDIA_BUCKET',
  'CLOUDFLARE_R2_BUCKET',
  'R2_BUCKET',
  'R2_ACCOUNT_ID',
  'CLOUDFLARE_ACCOUNT_ID',
  'R2_ENDPOINT',
  'CLOUDFLARE_R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_PUBLIC_BASE_URL',
  'CLOUDFLARE_R2_PUBLIC_BASE_URL',
  'R2_JURISDICTION',
];

function withEnv(values, fn) {
  const original = {};
  for (const key of ENV_KEYS) {
    original[key] = process.env[key];
    delete process.env[key];
  }
  Object.assign(process.env, values);

  try {
    fn();
  } finally {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  }
}

test('R2 provider builds endpoint and public URLs from environment', () => {
  withEnv({
    MEDIA_STORAGE_PROVIDER: 'r2',
    R2_MEDIA_BUCKET: 'yenkasa-media',
    R2_ACCOUNT_ID: 'abc123',
    R2_ACCESS_KEY_ID: 'access-key',
    R2_SECRET_ACCESS_KEY: 'secret-key',
    R2_PUBLIC_BASE_URL: 'https://media.yenkasa.xyz/',
  }, () => {
    assert.equal(mediaStorage.configuredProvider(), 'r2');
    assert.equal(mediaStorage.r2BucketName(), 'yenkasa-media');
    assert.equal(mediaStorage.r2Endpoint(), 'https://abc123.r2.cloudflarestorage.com');
    assert.equal(mediaStorage.r2PublicBaseUrl(), 'https://media.yenkasa.xyz');
    assert.equal(mediaStorage.publicUrl('posts/photo.jpg'), 'https://media.yenkasa.xyz/posts/photo.jpg');
    assert.equal(mediaStorage.hasR2Config(), true);
  });
});

test('R2 config requires a public base URL for app-facing media links', () => {
  withEnv({
    MEDIA_STORAGE_PROVIDER: 'r2',
    R2_MEDIA_BUCKET: 'yenkasa-media',
    R2_ENDPOINT: 'https://abc123.r2.cloudflarestorage.com',
    R2_ACCESS_KEY_ID: 'access-key',
    R2_SECRET_ACCESS_KEY: 'secret-key',
  }, () => {
    assert.equal(mediaStorage.hasR2Config(), false);
  });
});
