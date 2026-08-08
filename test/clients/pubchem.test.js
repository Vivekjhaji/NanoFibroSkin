import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCid } from '../../server/clients/pubchem.js';

test('resolves curcumin to a known CID', async () => {
  const cid = await getCid('curcumin');
  assert.equal(typeof cid, 'number');
  assert.ok(cid > 0);
});

test('returns null for a nonsense compound name', async () => {
  const cid = await getCid('not_a_real_compound_xyz123');
  assert.equal(cid, null);
});
