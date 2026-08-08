import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getInteractionsForDrug, getInteractionsForGene } from '../../server/clients/dgidb.js';

test('getInteractionsForDrug returns interactions for curcumin', async () => {
  const interactions = await getInteractionsForDrug('CURCUMIN');
  assert.ok(Array.isArray(interactions));
  assert.ok(interactions.length > 0);
  const first = interactions[0];
  assert.ok(typeof first.partnerName === 'string');
  assert.ok(Array.isArray(first.interactionTypes));
  assert.ok(typeof first.score === 'number');
  assert.ok(Array.isArray(first.sources));
});

test('getInteractionsForGene returns interactions for NFKB1', async () => {
  const interactions = await getInteractionsForGene('NFKB1');
  assert.ok(Array.isArray(interactions));
  assert.ok(interactions.length > 0);
  assert.ok(typeof interactions[0].partnerName === 'string');
});

test('getInteractionsForDrug returns empty array for unknown compound', async () => {
  const interactions = await getInteractionsForDrug('NOT_A_REAL_DRUG_XYZ123');
  assert.deepEqual(interactions, []);
});
