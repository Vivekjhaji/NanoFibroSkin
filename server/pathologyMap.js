export const PATHOLOGIES = [
  'Inflammation',
  'Oxidative Stress',
  'Angiogenesis',
  'Infection',
  'ECM',
];

// Gene symbol -> DFU pathologies it is documented to participate in.
// Curated from the target genes expected to surface for the 9 ingredients
// (spec section 3 pathology column) plus their common DGIdb/STRING hits.
export const GENE_PATHOLOGY_TABLE = {
  NFKB1: ['Inflammation'],
  RELA: ['Inflammation'],
  PTGS2: ['Inflammation', 'Oxidative Stress'],
  PTGS1: ['Inflammation'],
  TNF: ['Inflammation'],
  IL6: ['Inflammation'],
  IL1B: ['Inflammation'],
  NOS2: ['Oxidative Stress'],
  NFE2L2: ['Oxidative Stress'],
  SOD1: ['Oxidative Stress'],
  CAT: ['Oxidative Stress'],
  VEGFA: ['Angiogenesis'],
  KDR: ['Angiogenesis'],
  FLT1: ['Angiogenesis'],
  HIF1A: ['Angiogenesis'],
  COL1A1: ['ECM'],
  COL3A1: ['ECM'],
  MMP9: ['ECM'],
  MMP2: ['ECM'],
  FGA: ['ECM'],
  FGB: ['ECM'],
  FGG: ['ECM'],
  HAS2: ['ECM', 'Inflammation'],
  CD44: ['Inflammation', 'ECM'],
  CAMP: ['Infection'],
  DEFB4A: ['Infection'],
  LCN2: ['Infection'],
  LTF: ['Infection'],
  TLR4: ['Infection'],
  MPO: ['Infection'],
  NLRP3: ['Infection', 'Inflammation'],
};

export function classifyGene(geneSymbol) {
  const key = Object.keys(GENE_PATHOLOGY_TABLE).find(
    (k) => k.toLowerCase() === geneSymbol.toLowerCase()
  );
  return key ? GENE_PATHOLOGY_TABLE[key] : [];
}
