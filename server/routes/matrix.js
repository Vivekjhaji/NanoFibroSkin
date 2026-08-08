import express from 'express';
import { INGREDIENTS } from '../ingredients.js';
import { PATHOLOGIES } from '../pathologyMap.js';
import { enrichIngredient } from '../ingredientEnrichment.js';
import { mapWithConcurrency } from '../concurrencyLimit.js';

const INGREDIENT_BATCH_SIZE = 3;

const STRONG_SCORE_THRESHOLD = 0.5;

function cellStrength(targets, pathology) {
  let weak = false;
  for (const target of targets) {
    if (!target.pathologies.includes(pathology)) continue;
    if (target.score === null || target.score >= STRONG_SCORE_THRESHOLD) {
      return 'strong';
    }
    weak = true;
  }
  return weak ? 'weak' : 'none';
}

export const matrixRouter = express.Router();

matrixRouter.get('/', async (req, res) => {
  try {
    const enriched = await mapWithConcurrency(
      INGREDIENTS,
      INGREDIENT_BATCH_SIZE,
      async (ingredient) => {
        const { targets } = await enrichIngredient(ingredient);
        return { id: ingredient.id, targets };
      }
    );

    const cells = {};
    for (const { id, targets } of enriched) {
      cells[id] = {};
      for (const pathology of PATHOLOGIES) {
        cells[id][pathology] = cellStrength(targets, pathology);
      }
    }

    const pathologiesWithNoCoverage = PATHOLOGIES.filter(
      (p) => !enriched.some(({ id }) => cells[id][p] === 'strong')
    );
    const ingredientsWithNoCoverage = enriched
      .filter(({ id }) => PATHOLOGIES.every((p) => cells[id][p] === 'none'))
      .map(({ id }) => id);

    res.json({
      pathologies: PATHOLOGIES,
      ingredients: INGREDIENTS.map((i) => i.id),
      cells,
      gaps: { pathologiesWithNoCoverage, ingredientsWithNoCoverage },
    });
  } catch (err) {
    res.status(502).json({ error: `Upstream lookup failed: ${err.message}` });
  }
});
