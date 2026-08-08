import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../server/index.js';

test('GET /api/ingredients lists all 9 ingredients without upstream data', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/ingredients`);
  const body = await res.json();
  server.close();
  assert.equal(res.status, 200);
  assert.equal(body.length, 9);
  assert.ok(body[0].id);
  assert.equal(body[0].targets, undefined);
});

test('GET /api/ingredients/:id returns targets with pathology classification', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/ingredients/curcumin`);
  const body = await res.json();
  server.close();
  assert.equal(res.status, 200);
  assert.equal(body.id, 'curcumin');
  assert.ok(Array.isArray(body.targets));
  assert.ok(body.targets.length > 0);
  assert.ok(Array.isArray(body.targets[0].pathologies));
});

test('GET /api/ingredients/:id returns 404 for unknown id', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/ingredients/not-real`);
  server.close();
  assert.equal(res.status, 404);
});
