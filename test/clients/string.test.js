import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getInteractionPartners } from '../../server/clients/string.js';

test('returns interaction partners for NFKB1', async () => {
  const partners = await getInteractionPartners('NFKB1', 5);
  assert.ok(Array.isArray(partners));
  assert.ok(partners.length > 0);
  assert.ok(typeof partners[0].partnerName === 'string');
  assert.ok(typeof partners[0].score === 'number');
});

test('excludes the queried gene from its own results', async () => {
  const partners = await getInteractionPartners('NFKB1', 10);
  assert.ok(!partners.some((p) => p.partnerName.toUpperCase() === 'NFKB1'));
});
