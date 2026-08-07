import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INGREDIENTS } from '../server/ingredients.js';

test('exactly 9 ingredients are defined', () => {
  assert.equal(INGREDIENTS.length, 9);
});

test('every ingredient has required fields', () => {
  for (const ing of INGREDIENTS) {
    assert.ok(ing.id, `missing id on ${JSON.stringify(ing)}`);
    assert.ok(ing.name);
    assert.ok(['compound', 'protein'].includes(ing.kind), `bad kind for ${ing.name}`);
    assert.ok(ing.prep);
    assert.ok(ing.role);
    assert.ok(ing.lookupName);
  }
});

test('ingredient ids are unique', () => {
  const ids = INGREDIENTS.map(i => i.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('silver nanoparticles ingredient is present with protein/infection framing', () => {
  const ag = INGREDIENTS.find(i => i.id === 'ag-nanoparticles');
  assert.ok(ag);
  assert.equal(ag.kind, 'compound');
});

test('belladonna is not present', () => {
  const bella = INGREDIENTS.find(i => /belladonna/i.test(i.name));
  assert.equal(bella, undefined);
});
