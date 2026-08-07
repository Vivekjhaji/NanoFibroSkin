import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';

test('GET / serves the index page', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/`);
  const body = await res.text();
  server.close();
  assert.equal(res.status, 200);
  assert.match(body, /NanoFibroSkin/);
});
