import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getProteinInfo } from '../../server/clients/uniprot.js';

test('resolves NFKB1 to a protein record', async () => {
  const info = await getProteinInfo('NFKB1');
  assert.ok(info);
  assert.equal(typeof info.accession, 'string');
  assert.match(info.proteinName, /NF-kappa-B/i);
});

test('returns null for an unknown gene', async () => {
  const info = await getProteinInfo('NOT_A_REAL_GENE_XYZ123');
  assert.equal(info, null);
});
