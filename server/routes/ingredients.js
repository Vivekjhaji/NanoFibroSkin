import express from 'express';
import { INGREDIENTS } from '../ingredients.js';
import { enrichIngredient } from '../ingredientEnrichment.js';

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
    const { targets, pubchemCid } = await enrichIngredient(ingredient);
    const { id, name, kind, prep, role } = ingredient;
    res.json({ id, name, kind, prep, role, targets, pubchemCid });
  } catch (err) {
    res.status(502).json({ error: `Upstream lookup failed: ${err.message}` });
  }
});
