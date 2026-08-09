import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraphData } from '../public/network.js';

const fixture = {
  id: 'curcumin',
  name: 'Curcumin',
  kind: 'compound',
  prep: 'Botanical extract',
  role: 'Phytochemical modulator',
  pubchemCid: 969516,
  targets: [
    {
      geneSymbol: 'PTGS1',
      interactionTypes: [],
      score: 0.26,
      sources: [],
      pathologies: ['Inflammation'],
      uniprot: { accession: 'P23219', proteinName: 'Prostaglandin G/H synthase 1', geneName: 'PTGS1' },
      stringPartners: [
        { partnerName: 'PTGIS', score: 0.436 },
        { partnerName: 'ALOX15', score: 0.459 },
      ],
    },
    {
      geneSymbol: 'PTGS2',
      interactionTypes: [],
      score: 0.20,
      sources: [],
      pathologies: ['Inflammation', 'Oxidative Stress'],
      uniprot: { accession: 'P35354', proteinName: 'Prostaglandin G/H synthase 2', geneName: 'PTGS2' },
      stringPartners: [
        { partnerName: 'PTGIS', score: 0.436 },
        { partnerName: 'IL1B', score: 0.621 },
      ],
    },
  ],
};

test('buildGraphData creates one root node for the ingredient', () => {
  const { nodes } = buildGraphData(fixture);
  const root = nodes.find((n) => n.kind === 'ingredient');
  assert.ok(root);
  assert.equal(root.label, 'Curcumin');
});

test('buildGraphData creates one target node per target', () => {
  const { nodes } = buildGraphData(fixture);
  const targetNodes = nodes.filter((n) => n.kind === 'target');
  assert.equal(targetNodes.length, 2);
  assert.ok(targetNodes.some((n) => n.label === 'PTGS1'));
  assert.ok(targetNodes.some((n) => n.label === 'PTGS2'));
});

test('buildGraphData deduplicates interactor nodes shared across targets', () => {
  const { nodes } = buildGraphData(fixture);
  const interactorNodes = nodes.filter((n) => n.kind === 'interactor');
  // PTGIS appears under both PTGS1 and PTGS2 — must be one node, not two
  const ptgisNodes = interactorNodes.filter((n) => n.label === 'PTGIS');
  assert.equal(ptgisNodes.length, 1);
  // ALOX15 (only under PTGS1) and IL1B (only under PTGS2) are separate nodes
  assert.equal(interactorNodes.length, 3);
});

test('buildGraphData links root to every target', () => {
  const { nodes, links } = buildGraphData(fixture);
  const root = nodes.find((n) => n.kind === 'ingredient');
  const rootLinks = links.filter((l) => l.source === root.id);
  assert.equal(rootLinks.length, 2);
});

test('buildGraphData links each target to its STRING partners with score', () => {
  const { links } = buildGraphData(fixture);
  const ptgs1ToPtgis = links.find((l) => l.source === 'target:PTGS1' && l.target === 'interactor:PTGIS');
  assert.ok(ptgs1ToPtgis);
  assert.equal(ptgs1ToPtgis.score, 0.436);
});

test('buildGraphData assigns empty pathologies array to interactor nodes', () => {
  const { nodes } = buildGraphData(fixture);
  const interactor = nodes.find((n) => n.kind === 'interactor');
  assert.deepEqual(interactor.pathologies, []);
});
