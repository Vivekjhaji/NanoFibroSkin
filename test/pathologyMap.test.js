import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATHOLOGIES, classifyGene, GENE_PATHOLOGY_TABLE } from '../server/pathologyMap.js';

test('exactly 5 fixed pathologies', () => {
  assert.deepEqual(PATHOLOGIES, [
    'Inflammation', 'Oxidative Stress', 'Angiogenesis', 'Infection', 'ECM',
  ]);
});

test('classifyGene returns known pathologies for NFKB1', () => {
  assert.deepEqual(classifyGene('NFKB1'), ['Inflammation']);
});

test('classifyGene returns multiple pathologies for VEGFA', () => {
  const result = classifyGene('VEGFA');
  assert.ok(result.includes('Angiogenesis'));
});

test('classifyGene returns empty array for unknown gene', () => {
  assert.deepEqual(classifyGene('NOT_A_REAL_GENE'), []);
});

test('classifyGene is case-insensitive on gene symbol', () => {
  assert.deepEqual(classifyGene('nfkb1'), ['Inflammation']);
});

test('every table entry only references the 5 fixed pathologies', () => {
  for (const [gene, pathologies] of Object.entries(GENE_PATHOLOGY_TABLE)) {
    for (const p of pathologies) {
      assert.ok(PATHOLOGIES.includes(p), `${gene} references unknown pathology "${p}"`);
    }
  }
});
