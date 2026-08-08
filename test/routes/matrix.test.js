import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../server/index.js';

test('GET /api/matrix returns a full coverage matrix', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/matrix`);
  const body = await res.json();
  server.close();

  assert.equal(res.status, 200);
  assert.deepEqual(body.pathologies, [
    'Inflammation', 'Oxidative Stress', 'Angiogenesis', 'Infection', 'ECM',
  ]);
  assert.equal(body.ingredients.length, 8);

  for (const ingredientId of body.ingredients) {
    for (const pathology of body.pathologies) {
      const cell = body.cells[ingredientId][pathology];
      assert.ok(['strong', 'weak', 'none'].includes(cell));
    }
  }

  assert.ok(Array.isArray(body.gaps.pathologiesWithNoCoverage));
  assert.ok(Array.isArray(body.gaps.ingredientsWithNoCoverage));
});
