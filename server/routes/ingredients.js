import express from 'express';
import { INGREDIENTS } from '../ingredients.js';
import { classifyGene } from '../pathologyMap.js';
import { getInteractionsForDrug } from '../clients/dgidb.js';
import { getProteinInfo } from '../clients/uniprot.js';
import { getInteractionPartners } from '../clients/string.js';

const MAX_TARGETS_PER_INGREDIENT = 6;

async function buildTargetEntry(geneSymbol, interactionTypes, score, sources) {
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

export const ingredientsRouter = express.Router();

ingredientsRouter.get('/', (req, res) => {
  res.json(
    INGREDIENTS.map(({ id, name, kind, prep, role }) => ({ id, name, kind, prep, role }))
  );
});

ingredientsRouter.get('/:id', async (req, res) => {
  const ingredient = INGREDIENTS.find((i) => i.id === req.params.id);
  if (!ingredient) {
    return res.status(404).json({ error: `Unknown ingredient: ${req.params.id}` });
  }

  try {
    let targets;
    if (ingredient.kind === 'protein') {
      const info = await getProteinInfo(ingredient.lookupName).catch(() => null);
      const stringPartners = await getInteractionPartners(ingredient.lookupName, 6).catch(() => []);
      targets = [
        {
          geneSymbol: ingredient.lookupName,
          interactionTypes: ['structural'],
          score: null,
          sources: [],
          pathologies: classifyGene(ingredient.lookupName),
          uniprot: info,
          stringPartners,
        },
      ];
    } else {
      const interactions = (await getInteractionsForDrug(ingredient.lookupName)).slice(
        0,
        MAX_TARGETS_PER_INGREDIENT
      );
      targets = await Promise.all(
        interactions.map((i) =>
          buildTargetEntry(i.partnerName, i.interactionTypes, i.score, i.sources)
        )
      );
    }
    res.json({ ...ingredient, targets });
  } catch (err) {
    res.status(502).json({ error: `Upstream lookup failed: ${err.message}` });
  }
});
