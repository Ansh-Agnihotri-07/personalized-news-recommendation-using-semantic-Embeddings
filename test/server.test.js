import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/server.js';

async function withServer(state, run) {
  const server = createApp({ state, recommender: { recommend: async input => ({ articles: [], profile: input }) } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('serves app, model health, dataset and safe unknown-path responses', async () => {
  await withServer({ status: 'ready' }, async base => {
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Current/);
    assert.ok(page.headers.get('content-security-policy'));
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.dimensions, 384);
    const data = await (await fetch(`${base}/api/articles`)).json();
    assert.equal(data.articles.length, 24);
    assert.equal(new Set(data.articles.map(a => a.id)).size, 24);
    assert.equal((await fetch(`${base}/package.json`)).status, 404);
    assert.equal((await fetch(`${base}/data/articles.json`)).status, 404);
  });
});

test('API validates payloads, accepts a profile and reports model loading', async () => {
  await withServer({ status: 'ready' }, async base => {
    for (const body of ['{bad', '{}', JSON.stringify({ interests: 'invalid' }), JSON.stringify({ interests: ['space'], limit: -1 }), JSON.stringify({ interests: ['x'.repeat(17000)] })]) {
      const response = await fetch(`${base}/api/recommend`, { method: 'POST', body });
      assert.equal(response.status, 400);
    }
    const response = await fetch(`${base}/api/recommend`, { method: 'POST', body: JSON.stringify({ interests: ['space'] }) });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).profile.interests, ['space']);
  });
  await withServer({ status: 'loading' }, async base => {
    const response = await fetch(`${base}/api/recommend`, { method: 'POST', body: '{}' });
    assert.equal(response.status, 503);
  });
});
