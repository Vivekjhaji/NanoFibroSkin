import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingredientsRouter } from './routes/ingredients.js';
import { matrixRouter } from './routes/matrix.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(express.json());
  app.use('/api/ingredients', ingredientsRouter);
  app.use('/api/matrix', matrixRouter);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
}
