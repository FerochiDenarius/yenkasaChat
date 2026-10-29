const test = require('node:test');
const assert = require('node:assert/strict');

const { render, requestMetrics } = require('../src/observability/metrics');
const { validateAuthBody } = require('../src/middleware/validate');

test('metrics middleware records request counters and durations', () => {
  const listeners = {};
  const req = { method: 'GET', path: '/health', route: { path: '/health' } };
  const res = {
    statusCode: 200,
    on(event, callback) {
      listeners[event] = callback;
    },
  };

  requestMetrics(req, res, () => {});
  listeners.finish();

  const output = render();
  assert.match(output, /yenkasa_http_requests_total/);
  assert.match(output, /route="\/health"/);
  assert.match(output, /yenkasa_http_request_duration_seconds_count/);
});

test('auth validation rejects malformed login bodies', () => {
  let receivedError;
  validateAuthBody('login')({ body: { identifier: 'x', password: '' } }, {}, (error) => {
    receivedError = error;
  });

  assert.equal(receivedError.code, 'VALIDATION_ERROR');
  assert.deepEqual(receivedError.fields, ['identifier', 'password']);
  assert.equal(receivedError.statusCode, 400);
});

test('auth validation accepts a minimally valid login body', () => {
  let called = false;
  validateAuthBody('login')({ body: { identifier: 'bright', password: 'correct horse battery staple' } }, {}, () => {
    called = true;
  });

  assert.equal(called, true);
});
