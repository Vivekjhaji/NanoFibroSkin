import { classifyGene } from './pathologyMap.js';
import { getInteractionsForDrug } from './clients/dgidb.js';
import { getProteinInfo } from './clients/uniprot.js';
import { getInteractionPartners } from './clients/string.js';
import { getCid } from './clients/pubchem.js';

const MAX_TARGETS_PER_INGREDIENT = 6;

export async function buildTargetEntry(geneSymbol, interactionTypes, score, sources) {
  const [uniprot, stringPartners] = await Promise.all([
    getProteinInfo(geneSymbol).catch(() => null),
    getInteractionPartners(geneSymbol, 6).catch(() => []),
  ]);
  return {
    geneSymbol,
    interactionTypes,
    score,
    sources,
    pathologies: classifyGene(geneSymbol),
    uniprot,
    stringPartners,
  };
}

export async function enrichIngredient(ingredient) {
  if (ingredient.kind === 'protein') {
    const info = await getProteinInfo(ingredient.lookupName).catch(() => null);
    const stringPartners = await getInteractionPartners(ingredient.lookupName, 6).catch(() => []);
    return {
      targets: [
        {
          geneSymbol: ingredient.lookupName,
          interactionTypes: ['structural'],
          score: null,
          sources: [],
          pathologies: classifyGene(ingredient.lookupName),
          uniprot: info,
          stringPartners,
        },
      ],
      pubchemCid: undefined,
    };
  }
  const [interactionsRaw, pubchemCid] = await Promise.all([
    getInteractionsForDrug(ingredient.lookupName),
    getCid(ingredient.lookupName).catch(() => null),
  ]);
  const interactions = interactionsRaw.slice(0, MAX_TARGETS_PER_INGREDIENT);
  const targets = await Promise.all(
    interactions.map((i) => buildTargetEntry(i.partnerName, i.interactionTypes, i.score, i.sources))
  );
  return { targets, pubchemCid };
}
