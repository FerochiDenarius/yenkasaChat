const assert = require('node:assert/strict');
const test = require('node:test');

const portalPageRouter = require('../softotechBackend/projectManagement/routes/softOTechPortal.page');

function renderRoute(path) {
  const layer = portalPageRouter.stack.find((entry) => entry.route && entry.route.path === path);
  assert.ok(layer, `Expected route ${path} to be registered`);

  let html = '';
  layer.route.stack[0].handle(
    { method: 'GET', url: path },
    {
      locals: { cspNonce: 'test-nonce' },
      send(value) {
        html = String(value || '');
      },
    },
  );

  assert.ok(html, `Expected ${path} to render HTML`);
  return html;
}

function inlineScripts(html) {
  return [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
}

test('Soft-O-Tech admin page emits parseable inline scripts', () => {
  const html = renderRoute('/admin');
  const scripts = inlineScripts(html);

  assert.ok(scripts.length > 0, 'Expected admin page to include inline scripts');
  assert.equal(html.includes('?.'), false, 'Admin page should avoid optional chaining in browser-served scripts');

  for (const script of scripts) {
    assert.doesNotThrow(() => new Function(script));
  }
});
