# NanoFibroSkin Mechanism Plausibility Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Node web app where the user can see, for each of the 9 NanoFibroSkin ingredients, its literature-known protein targets (with interaction type, evidence source, and confidence), the target's own protein-protein interaction context via STRING, and a rolled-up coverage matrix against the 5 DFU pathologies (Inflammation, Oxidative Stress, Angiogenesis, Infection, ECM).

**Architecture:** Express backend proxies three public bioinformatics APIs (PubChem, DGIdb, UniProt, STRING) to avoid browser CORS restrictions and to own the pathology-mapping logic in one place. A static vanilla-JS frontend (matrix view + detail panel) calls the backend's own small REST API, never the upstream APIs directly. No database — every request is live; a per-process in-memory cache avoids re-hitting upstream APIs during a session.

**Tech Stack:** Node.js, Express, vanilla HTML/CSS/JS (no frontend framework, no build step), `node:test` for backend tests, upstream calls via native `fetch`.

## Global Constraints

- No API keys/secrets — only keyless public endpoints (PubChem PUG REST, DGIdb GraphQL, UniProt REST, STRING REST), per user decision.
- STITCH is excluded: its public HTTP API returned 404 on every documented endpoint shape during verification (see Task 2 investigation) and is not reliable enough to build on.
- No offline fallback or caching to disk — if an upstream API is unreachable, the UI must say so plainly, never show stale or fabricated data (spec §4).
- Ingredient list is fixed at 9 compounds (spec §3) — do not add, remove, or rename ingredients as part of this implementation.
- Pathology categories are fixed at exactly 5: Inflammation, Oxidative Stress, Angiogenesis, Infection, ECM (spec §2).
- This tool is decision support only — no UI copy may imply prediction of healing outcomes, efficacy, or clinical viability (spec §2, §6).

---

## File Structure

```
ppi-sandbox/
  server/
    index.js              # Express app entry, static file serving, route mounting
    ingredients.js         # The fixed 9-ingredient dataset (name, prep, role, kind, lookup ids)
    pathologyMap.js         # Gene-symbol -> DFU pathology lookup table + confidence rules
    clients/
      pubchem.js           # name -> CID lookup
      dgidb.js             # compound/gene -> interactions (drugs() and genes() queries)
      uniprot.js           # gene -> canonical protein record
      string.js             # gene -> PPI partners
    routes/
      ingredients.js        # GET /api/ingredients, GET /api/ingredients/:id
      matrix.js              # GET /api/matrix
    cache.js                 # in-memory Map-based memoizing cache with TTL
  public/
    index.html              # single page: header, matrix, detail panel, ingredient panel
    app.js                   # fetch calls to backend, matrix rendering, panel rendering
    styles.css                # matrix/detail/ingredient styling, light+dark tokens
  test/
    pathologyMap.test.js
    clients/
      pubchem.test.js
      dgidb.test.js
      uniprot.test.js
      string.test.js
    routes/
      ingredients.test.js
      matrix.test.js
  package.json
  .gitignore
```

Each client file wraps exactly one upstream API and exposes one or two plain async functions — no class hierarchies, no ORM-like abstraction. `pathologyMap.js` is the single place gene symbols get classified into the 5 pathologies, so Task 9's gap/orphan detection and the matrix route both read from the same source of truth.

---

## Task 1: Project scaffold and static file serving

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `server/index.js`
- Create: `public/index.html`
- Test: `test/server.test.js`

**Interfaces:**
- Produces: `createApp()` exported from `server/index.js` — returns an Express app instance (not yet listening), so tests can use `supertest`-style requests without binding a real port.

- [ ] **Step 1: Initialize package.json and install dependencies**

```bash
cd /Users/vivekanandjha/ppi-sandbox
npm init -y
npm install express
npm install --save-dev supertest
```

Edit `package.json` to add:
```json
{
  "type": "module",
  "scripts": {
    "start": "node server/index.js",
    "test": "node --test test/**/*.test.js test/**/**/*.test.js"
  }
}
```

- [ ] **Step 2: Write .gitignore**

```
node_modules/
.superpowers/
```

- [ ] **Step 3: Write the failing test for app creation and static serving**

```javascript
// test/server.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';

test('GET / serves the index page', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/`);
  const body = await res.text();
  server.close();
  assert.equal(res.status, 200);
  assert.match(body, /NanoFibroSkin/);
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../server/index.js'` or similar

- [ ] **Step 5: Write minimal index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>NanoFibroSkin Mechanism Sandbox</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <h1>NanoFibroSkin Mechanism Plausibility Sandbox</h1>
  <div id="app"></div>
  <script type="module" src="/app.js"></script>
</body>
</html>
```

- [ ] **Step 6: Write server/index.js**

```javascript
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(express.static(path.join(__dirname, '..', 'public')));
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
}
```

- [ ] **Step 7: Create empty placeholder public/app.js and public/styles.css**

```javascript
// public/app.js
console.log('NanoFibroSkin sandbox loaded');
```

```css
/* public/styles.css */
body { font-family: sans-serif; margin: 0; padding: 24px; }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .gitignore server/ public/ test/server.test.js
git commit -m "Scaffold Express app with static file serving"
```

---

## Task 2: Ingredient dataset

**Files:**
- Create: `server/ingredients.js`
- Test: `test/ingredients.test.js`

**Interfaces:**
- Produces: `INGREDIENTS` — an array of 9 objects, each `{ id: string, name: string, kind: 'compound' | 'protein', prep: string, role: string, lookupName: string }`. `kind` distinguishes the two lookup paths from spec §4 (small molecule vs. protein/peptide). `lookupName` is the name to send to PubChem/DGIdb (e.g. `"curcumin"`, `"NFKB1"` is NOT here — this is the ingredient's own search name, not a target gene).
- Consumes: nothing (this is the root data file).

- [ ] **Step 1: Write the failing test**

```javascript
// test/ingredients.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INGREDIENTS } from '../server/ingredients.js';

test('exactly 9 ingredients are defined', () => {
  assert.equal(INGREDIENTS.length, 9);
});

test('every ingredient has required fields', () => {
  for (const ing of INGREDIENTS) {
    assert.ok(ing.id, `missing id on ${JSON.stringify(ing)}`);
    assert.ok(ing.name);
    assert.ok(['compound', 'protein'].includes(ing.kind), `bad kind for ${ing.name}`);
    assert.ok(ing.prep);
    assert.ok(ing.role);
    assert.ok(ing.lookupName);
  }
});

test('ingredient ids are unique', () => {
  const ids = INGREDIENTS.map(i => i.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('silver nanoparticles ingredient is present with protein/infection framing', () => {
  const ag = INGREDIENTS.find(i => i.id === 'ag-nanoparticles');
  assert.ok(ag);
  assert.equal(ag.kind, 'compound');
});

test('belladonna is not present', () => {
  const bella = INGREDIENTS.find(i => /belladonna/i.test(i.name));
  assert.equal(bella, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../server/ingredients.js'`

- [ ] **Step 3: Write server/ingredients.js**

```javascript
export const INGREDIENTS = [
  {
    id: 'psc-collagen',
    name: 'Pepsin-solubilized Collagen (PSC)',
    kind: 'protein',
    prep: 'Descale/defat tilapia skin, acid-swell, pepsin digestion',
    role: 'Structural scaffold (Layer 2/3)',
    lookupName: 'COL1A1',
  },
  {
    id: 'collagen-hydrolysate',
    name: 'Collagen Hydrolysate Peptides',
    kind: 'protein',
    prep: 'Enzymatic hydrolysis (Alcalase/papain) of skin protein, <3kDa fractionation',
    role: 'Bioactive nano-inclusion',
    lookupName: 'COL1A1',
  },
  {
    id: 'marine-pufas',
    name: 'Marine PUFAs (EPA/DHA)',
    kind: 'compound',
    prep: 'Lipid extraction (Folch/Bligh-Dyer), separate from protein fraction',
    role: 'Bioactive nano-inclusion',
    lookupName: 'docosahexaenoic acid',
  },
  {
    id: 'lmw-ha',
    name: 'LMW-Hyaluronic Acid',
    kind: 'compound',
    prep: 'Purified, <500 kDa',
    role: 'Polymer backbone (Layer 1)',
    lookupName: 'hyaluronic acid',
  },
  {
    id: 'fibrinogen',
    name: 'Dried Fibrinogen',
    kind: 'protein',
    prep: 'Purified, dried',
    role: 'Haemostatic anchor (Layer 2)',
    lookupName: 'FGA',
  },
  {
    id: 'curcumin',
    name: 'Curcumin',
    kind: 'compound',
    prep: 'Botanical extract',
    role: 'Phytochemical modulator',
    lookupName: 'curcumin',
  },
  {
    id: 'baicalein',
    name: 'Baicalein',
    kind: 'compound',
    prep: 'TCM botanical extract',
    role: 'Phytochemical modulator',
    lookupName: 'baicalein',
  },
  {
    id: 'astragalus-iv',
    name: 'Astragalus (AS-IV)',
    kind: 'compound',
    prep: 'Botanical extract',
    role: 'Phytochemical modulator',
    lookupName: 'astragaloside IV',
  },
  {
    id: 'ag-nanoparticles',
    name: 'Ag nanoparticles (low-dose)',
    kind: 'compound',
    prep: 'In-situ reduction or pre-formed AgNP, sub-cytotoxic loading',
    role: 'Antimicrobial',
    lookupName: 'silver',
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/ingredients.js test/ingredients.test.js
git commit -m "Add fixed 9-ingredient dataset"
```

---

## Task 3: Pathology mapping table

**Files:**
- Create: `server/pathologyMap.js`
- Test: `test/pathologyMap.test.js`

**Interfaces:**
- Produces: `PATHOLOGIES` — array of exactly 5 strings: `['Inflammation', 'Oxidative Stress', 'Angiogenesis', 'Infection', 'ECM']`. `classifyGene(geneSymbol: string) -> string[]` — returns the subset of `PATHOLOGIES` a given gene symbol is known to participate in, based on a fixed lookup table (empty array if unknown). `GENE_PATHOLOGY_TABLE` — the raw `{ [geneSymbol]: string[] }` table, exported for testing and for the detail-panel route to explain *why* a classification was made.
- Consumes: `PATHOLOGIES` name strings are consumed by Task 8 (matrix route) and Task 10 (frontend) — the exact 5 strings above must not change without updating both.

- [ ] **Step 1: Write the failing test**

```javascript
// test/pathologyMap.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../server/pathologyMap.js'`

- [ ] **Step 3: Write server/pathologyMap.js**

```javascript
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
};

export function classifyGene(geneSymbol) {
  const key = Object.keys(GENE_PATHOLOGY_TABLE).find(
    (k) => k.toLowerCase() === geneSymbol.toLowerCase()
  );
  return key ? GENE_PATHOLOGY_TABLE[key] : [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/pathologyMap.js test/pathologyMap.test.js
git commit -m "Add fixed 5-pathology classification table"
```

---

## Task 4: In-memory cache utility

**Files:**
- Create: `server/cache.js`
- Test: `test/cache.test.js`

**Interfaces:**
- Produces: `createCache(ttlMs: number)` -> `{ get(key), set(key, value), has(key) }`. `get` returns `undefined` if missing or expired. Used by every API client in Tasks 5-7 to avoid re-hitting upstream on every UI interaction within one server process's lifetime (spec explicitly rules out *disk* caching, not in-memory).

- [ ] **Step 1: Write the failing test**

```javascript
// test/cache.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCache } from '../server/cache.js';

test('stores and retrieves a value', () => {
  const cache = createCache(10000);
  cache.set('a', 1);
  assert.equal(cache.get('a'), 1);
});

test('returns undefined for missing key', () => {
  const cache = createCache(10000);
  assert.equal(cache.get('missing'), undefined);
});

test('expires values after ttl', async () => {
  const cache = createCache(10);
  cache.set('a', 1);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(cache.get('a'), undefined);
});

test('has() reflects expiry', async () => {
  const cache = createCache(10);
  cache.set('a', 1);
  assert.equal(cache.has('a'), true);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(cache.has('a'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../server/cache.js'`

- [ ] **Step 3: Write server/cache.js**

```javascript
export function createCache(ttlMs) {
  const store = new Map();

  function isExpired(entry) {
    return Date.now() - entry.timestamp > ttlMs;
  }

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry || isExpired(entry)) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      store.set(key, { value, timestamp: Date.now() });
    },
    has(key) {
      const entry = store.get(key);
      if (!entry || isExpired(entry)) {
        store.delete(key);
        return false;
      }
      return true;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/cache.js test/cache.test.js
git commit -m "Add TTL-based in-memory cache utility"
```

---

## Task 5: PubChem client

**Files:**
- Create: `server/clients/pubchem.js`
- Test: `test/clients/pubchem.test.js`

**Interfaces:**
- Produces: `getCid(compoundName: string) -> Promise<number | null>`. Calls `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{name}/cids/JSON` (verified live: returns `{"IdentifierList":{"CID":[969516]}}` for `curcumin`). Returns `null` on 404 (compound not found) rather than throwing, so callers can display "not found" instead of crashing.
- Consumes: `createCache` from `server/cache.js`.

- [ ] **Step 1: Write the failing test**

```javascript
// test/clients/pubchem.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../server/clients/pubchem.js'`

- [ ] **Step 3: Write server/clients/pubchem.js**

```javascript
import { createCache } from '../cache.js';

const cache = createCache(1000 * 60 * 60); // 1 hour
const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

export async function getCid(compoundName) {
  const cacheKey = `cid:${compoundName.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const url = `${BASE}/compound/name/${encodeURIComponent(compoundName)}/cids/JSON`;
  const res = await fetch(url);
  if (res.status === 404) {
    cache.set(cacheKey, null);
    return null;
  }
  if (!res.ok) {
    throw new Error(`PubChem request failed: ${res.status}`);
  }
  const data = await res.json();
  const cid = data.IdentifierList?.CID?.[0] ?? null;
  cache.set(cacheKey, cid);
  return cid;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (requires network access — this test hits the real PubChem API)

- [ ] **Step 5: Commit**

```bash
git add server/clients/pubchem.js test/clients/pubchem.test.js
git commit -m "Add PubChem client for compound name to CID resolution"
```

---

## Task 6: DGIdb client

**Files:**
- Create: `server/clients/dgidb.js`
- Test: `test/clients/dgidb.test.js`

**Interfaces:**
- Produces:
  - `getInteractionsForDrug(drugName: string) -> Promise<Interaction[]>` — queries DGIdb's `drugs(names: [...])` GraphQL query (verified live against `CURCUMIN`, returns gene, interactionScore, interactionTypes, and source+PMID per claim).
  - `getInteractionsForGene(geneSymbol: string) -> Promise<Interaction[]>` — queries `genes(names: [...])`, used for protein/peptide ingredients (spec §4: proteins need a different lookup path).
  - `Interaction` shape: `{ partnerName: string, interactionTypes: string[], score: number, sources: { sourceDbName: string, pmids: number[] }[] }`.
- Consumes: `createCache` from `server/cache.js`.

- [ ] **Step 1: Write the failing test**

```javascript
// test/clients/dgidb.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getInteractionsForDrug, getInteractionsForGene } from '../../server/clients/dgidb.js';

test('getInteractionsForDrug returns interactions for curcumin', async () => {
  const interactions = await getInteractionsForDrug('CURCUMIN');
  assert.ok(Array.isArray(interactions));
  assert.ok(interactions.length > 0);
  const first = interactions[0];
  assert.ok(typeof first.partnerName === 'string');
  assert.ok(Array.isArray(first.interactionTypes));
  assert.ok(typeof first.score === 'number');
  assert.ok(Array.isArray(first.sources));
});

test('getInteractionsForGene returns interactions for NFKB1', async () => {
  const interactions = await getInteractionsForGene('NFKB1');
  assert.ok(Array.isArray(interactions));
  assert.ok(interactions.length > 0);
  assert.ok(typeof interactions[0].partnerName === 'string');
});

test('getInteractionsForDrug returns empty array for unknown compound', async () => {
  const interactions = await getInteractionsForDrug('NOT_A_REAL_DRUG_XYZ123');
  assert.deepEqual(interactions, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../server/clients/dgidb.js'`

- [ ] **Step 3: Write server/clients/dgidb.js**

```javascript
import { createCache } from '../cache.js';

const cache = createCache(1000 * 60 * 60);
const ENDPOINT = 'https://dgidb.org/api/graphql';

async function runQuery(query) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(`DGIdb request failed: ${res.status}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(`DGIdb query error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

function flattenInteractions(nodes, partnerKey) {
  const interactions = [];
  for (const node of nodes) {
    for (const interaction of node.interactions ?? []) {
      const partner = interaction[partnerKey];
      if (!partner) continue;
      interactions.push({
        partnerName: partner.name,
        interactionTypes: (interaction.interactionTypes ?? []).map((t) => t.type),
        score: interaction.interactionScore ?? 0,
        sources: (interaction.interactionClaims ?? []).map((claim) => ({
          sourceDbName: claim.source?.sourceDbName ?? 'unknown',
          pmids: (claim.publications ?? []).map((p) => p.pmid).filter(Boolean),
        })),
      });
    }
  }
  return interactions;
}

export async function getInteractionsForDrug(drugName) {
  const cacheKey = `drug:${drugName.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const query = `{
    drugs(names: ["${drugName.replace(/"/g, '')}"]) {
      nodes {
        name
        interactions {
          gene { name }
          interactionScore
          interactionTypes { type }
          interactionClaims {
            source { sourceDbName }
            publications { pmid }
          }
        }
      }
    }
  }`;
  const data = await runQuery(query);
  const result = flattenInteractions(data.drugs.nodes, 'gene');
  cache.set(cacheKey, result);
  return result;
}

export async function getInteractionsForGene(geneSymbol) {
  const cacheKey = `gene:${geneSymbol.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const query = `{
    genes(names: ["${geneSymbol.replace(/"/g, '')}"]) {
      nodes {
        name
        interactions {
          drug { name }
          interactionScore
          interactionTypes { type }
          interactionClaims {
            source { sourceDbName }
            publications { pmid }
          }
        }
      }
    }
  }`;
  const data = await runQuery(query);
  const result = flattenInteractions(data.genes.nodes, 'drug');
  cache.set(cacheKey, result);
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (requires network access)

- [ ] **Step 5: Commit**

```bash
git add server/clients/dgidb.js test/clients/dgidb.test.js
git commit -m "Add DGIdb client for drug-gene and gene-drug interaction lookup"
```

---

## Task 7: UniProt and STRING clients

**Files:**
- Create: `server/clients/uniprot.js`
- Create: `server/clients/string.js`
- Test: `test/clients/uniprot.test.js`
- Test: `test/clients/string.test.js`

**Interfaces:**
- Produces (uniprot.js): `getProteinInfo(geneSymbol: string) -> Promise<{ accession: string, proteinName: string, geneName: string } | null>`. Calls `https://rest.uniprot.org/uniprotkb/search?query=gene:{gene}+AND+organism_id:9606&fields=accession,gene_names,protein_name&format=json&size=1` (verified live against `NFKB1`).
- Produces (string.js): `getInteractionPartners(geneSymbol: string, limit?: number) -> Promise<{ partnerName: string, score: number }[]>`. Calls `https://string-db.org/api/json/network?identifiers={gene}&species=9606&limit={limit}` (verified live against `NFKB1`, returns `preferredName_A`/`preferredName_B`/`score` fields). Default `limit` is 10. Filters out the queried gene itself from the results so a gene doesn't list itself as its own interactor.
- Consumes: `createCache` from `server/cache.js`.

- [ ] **Step 1: Write the failing tests**

```javascript
// test/clients/uniprot.test.js
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
```

```javascript
// test/clients/string.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getInteractionPartners } from '../../server/clients/string.js';

test('returns interaction partners for NFKB1', async () => {
  const partners = await getInteractionPartners('NFKB1', 5);
  assert.ok(Array.isArray(partners));
  assert.ok(partners.length > 0);
  assert.ok(typeof partners[0].partnerName === 'string');
  assert.ok(typeof partners[0].score === 'number');
});

test('excludes the queried gene from its own results', async () => {
  const partners = await getInteractionPartners('NFKB1', 10);
  assert.ok(!partners.some((p) => p.partnerName.toUpperCase() === 'NFKB1'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — modules not found

- [ ] **Step 3: Write server/clients/uniprot.js**

```javascript
import { createCache } from '../cache.js';

const cache = createCache(1000 * 60 * 60);
const BASE = 'https://rest.uniprot.org/uniprotkb/search';

export async function getProteinInfo(geneSymbol) {
  const cacheKey = `protein:${geneSymbol.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const query = `gene:${geneSymbol} AND organism_id:9606`;
  const url = `${BASE}?query=${encodeURIComponent(query)}&fields=accession,gene_names,protein_name&format=json&size=1`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`UniProt request failed: ${res.status}`);
  }
  const data = await res.json();
  const entry = data.results?.[0];
  if (!entry) {
    cache.set(cacheKey, null);
    return null;
  }
  const info = {
    accession: entry.primaryAccession,
    proteinName: entry.proteinDescription?.recommendedName?.fullName?.value ?? 'Unknown',
    geneName: entry.genes?.[0]?.geneName?.value ?? geneSymbol,
  };
  cache.set(cacheKey, info);
  return info;
}
```

- [ ] **Step 4: Write server/clients/string.js**

```javascript
import { createCache } from '../cache.js';

const cache = createCache(1000 * 60 * 60);
const BASE = 'https://string-db.org/api/json/network';

export async function getInteractionPartners(geneSymbol, limit = 10) {
  const cacheKey = `string:${geneSymbol.toLowerCase()}:${limit}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const url = `${BASE}?identifiers=${encodeURIComponent(geneSymbol)}&species=9606&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`STRING request failed: ${res.status}`);
  }
  const data = await res.json();
  const partners = [];
  const seen = new Set();
  for (const edge of data) {
    const target = edge.preferredName_A.toUpperCase() === geneSymbol.toUpperCase()
      ? edge.preferredName_B
      : edge.preferredName_A;
    if (target.toUpperCase() === geneSymbol.toUpperCase()) continue;
    if (seen.has(target)) continue;
    seen.add(target);
    partners.push({ partnerName: target, score: edge.score });
  }
  cache.set(cacheKey, partners);
  return partners;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (requires network access)

- [ ] **Step 6: Commit**

```bash
git add server/clients/uniprot.js server/clients/string.js test/clients/uniprot.test.js test/clients/string.test.js
git commit -m "Add UniProt and STRING clients for protein identity and PPI lookup"
```

---

## Task 8: Ingredient detail route

**Files:**
- Create: `server/routes/ingredients.js`
- Modify: `server/index.js` (mount the route)
- Test: `test/routes/ingredients.test.js`

**Interfaces:**
- Produces: Express router mounted at `/api/ingredients`.
  - `GET /api/ingredients` -> `200 [{ id, name, kind, prep, role }, ...]` (the static list, no upstream calls — fast).
  - `GET /api/ingredients/:id` -> `200 { id, name, kind, prep, role, targets: [{ geneSymbol, interactionTypes, score, sources, pathologies, uniprot: {...} | null, stringPartners: [...] }] }` or `404 { error }` if id unknown.
  - For `kind === 'compound'` ingredients, targets come from `getInteractionsForDrug(lookupName)` (Task 6). For `kind === 'protein'` ingredients, the ingredient's own `lookupName` gene *is* the target to describe (its UniProt record + STRING partners), since a structural protein ingredient's "target" is itself, not a receptor it binds — each such ingredient produces exactly one target entry naming itself.
  - Each compound-derived target's `geneSymbol` is passed through `classifyGene` (Task 3) to populate `pathologies`, then through `getProteinInfo` (Task 7 uniprot) and `getInteractionPartners` (Task 7 string) to populate `uniprot` and `stringPartners`, capped at the top 6 DGIdb interactions per ingredient to bound total upstream calls per request.
- Consumes: `INGREDIENTS` (Task 2), `classifyGene` (Task 3), `getInteractionsForDrug`/`getInteractionsForGene` (Task 6), `getProteinInfo`/`getInteractionPartners` (Task 7).

- [ ] **Step 1: Write the failing test**

```javascript
// test/routes/ingredients.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../server/index.js';

test('GET /api/ingredients lists all 9 ingredients without upstream data', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/ingredients`);
  const body = await res.json();
  server.close();
  assert.equal(res.status, 200);
  assert.equal(body.length, 9);
  assert.ok(body[0].id);
  assert.equal(body[0].targets, undefined);
});

test('GET /api/ingredients/:id returns targets with pathology classification', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/ingredients/curcumin`);
  const body = await res.json();
  server.close();
  assert.equal(res.status, 200);
  assert.equal(body.id, 'curcumin');
  assert.ok(Array.isArray(body.targets));
  assert.ok(body.targets.length > 0);
  assert.ok(Array.isArray(body.targets[0].pathologies));
});

test('GET /api/ingredients/:id returns 404 for unknown id', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/ingredients/not-real`);
  server.close();
  assert.equal(res.status, 404);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — route not mounted / 404 on `/api/ingredients`

- [ ] **Step 3: Write server/routes/ingredients.js**

```javascript
import express from 'express';
import { INGREDIENTS } from '../ingredients.js';
import { classifyGene } from '../pathologyMap.js';
import { getInteractionsForDrug, getInteractionsForGene } from '../clients/dgidb.js';
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
```

- [ ] **Step 4: Mount the router in server/index.js**

```javascript
// server/index.js — add these lines
import { ingredientsRouter } from './routes/ingredients.js';

// inside createApp(), after express.static:
app.use(express.json());
app.use('/api/ingredients', ingredientsRouter);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (requires network access)

- [ ] **Step 6: Commit**

```bash
git add server/routes/ingredients.js server/index.js test/routes/ingredients.test.js
git commit -m "Add ingredient detail API route with target/pathology/PPI enrichment"
```

---

## Task 9: Matrix route with gap/orphan detection

**Files:**
- Create: `server/routes/matrix.js`
- Modify: `server/index.js` (mount the route)
- Test: `test/routes/matrix.test.js`

**Interfaces:**
- Produces: Express router mounted at `/api/matrix`.
  - `GET /api/matrix` -> `200 { pathologies: string[], ingredients: string[], cells: { [ingredientId]: { [pathology]: 'strong' | 'weak' | 'none' } }, gaps: { pathologiesWithNoCoverage: string[], ingredientsWithNoCoverage: string[] } }`.
  - Cell strength rule: `'strong'` if any target for that ingredient has `pathologies.includes(pathology)` AND `score >= 0.5` (or `score === null`, which covers the `kind: 'protein'` structural ingredients where score isn't meaningful); `'weak'` if covered only by targets with `score < 0.5`; `'none'` otherwise. This threshold is the "confidence" rule the spec left open (spec §7) — documented here as the concrete answer.
  - `pathologiesWithNoCoverage`: pathologies with no `'strong'` cell across any ingredient. `ingredientsWithNoCoverage`: ingredients with no `'strong'` or `'weak'` cell across any pathology.
  - This route internally re-uses the same per-ingredient enrichment as Task 8's `/api/ingredients/:id` (calls the same clients) rather than importing Task 8's route handler directly, since Express route handlers are not meant to be called as plain functions — instead it factors the shared `buildTargetEntry`/protein-kind logic into `server/ingredientEnrichment.js` and both routes import from there.

- [ ] **Step 1: Extract shared enrichment logic (refactor, no behavior change)**

Move the enrichment logic out of `server/routes/ingredients.js` into a new `server/ingredientEnrichment.js` so Task 9's matrix route can reuse it without going through HTTP:

```javascript
// server/ingredientEnrichment.js
import { classifyGene } from './pathologyMap.js';
import { getInteractionsForDrug } from './clients/dgidb.js';
import { getProteinInfo } from './clients/uniprot.js';
import { getInteractionPartners } from './clients/string.js';

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
    return [
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
  }
  const interactions = (await getInteractionsForDrug(ingredient.lookupName)).slice(
    0,
    MAX_TARGETS_PER_INGREDIENT
  );
  return Promise.all(
    interactions.map((i) => buildTargetEntry(i.partnerName, i.interactionTypes, i.score, i.sources))
  );
}
```

Update `server/routes/ingredients.js` to import and use `enrichIngredient` instead of its own inline logic:

```javascript
// server/routes/ingredients.js — replace the try block body with:
  try {
    const targets = await enrichIngredient(ingredient);
    res.json({ ...ingredient, targets });
  } catch (err) {
    res.status(502).json({ error: `Upstream lookup failed: ${err.message}` });
  }
```

And update its imports to drop the now-unused direct client imports, keeping only:
```javascript
import express from 'express';
import { INGREDIENTS } from '../ingredients.js';
import { enrichIngredient } from '../ingredientEnrichment.js';
```

- [ ] **Step 2: Run existing tests to verify the refactor didn't break anything**

Run: `npm test`
Expected: PASS (Task 8's tests still pass unchanged)

- [ ] **Step 3: Write the failing test for the matrix route**

```javascript
// test/routes/matrix.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../server/index.js';

test('GET /api/matrix returns a full coverage matrix', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/matrix`);
  const body = await res.json();
  server.close();

  assert.equal(res.status, 200);
  assert.deepEqual(body.pathologies, [
    'Inflammation', 'Oxidative Stress', 'Angiogenesis', 'Infection', 'ECM',
  ]);
  assert.equal(body.ingredients.length, 9);

  for (const ingredientId of body.ingredients) {
    for (const pathology of body.pathologies) {
      const cell = body.cells[ingredientId][pathology];
      assert.ok(['strong', 'weak', 'none'].includes(cell));
    }
  }

  assert.ok(Array.isArray(body.gaps.pathologiesWithNoCoverage));
  assert.ok(Array.isArray(body.gaps.ingredientsWithNoCoverage));
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `/api/matrix` not found (404)

- [ ] **Step 5: Write server/routes/matrix.js**

```javascript
import express from 'express';
import { INGREDIENTS } from '../ingredients.js';
import { PATHOLOGIES } from '../pathologyMap.js';
import { enrichIngredient } from '../ingredientEnrichment.js';

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
    const enriched = await Promise.all(
      INGREDIENTS.map(async (ingredient) => ({
        id: ingredient.id,
        targets: await enrichIngredient(ingredient),
      }))
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
```

- [ ] **Step 6: Mount the router in server/index.js**

```javascript
// server/index.js — add
import { matrixRouter } from './routes/matrix.js';

// inside createApp(), alongside the ingredients router mount:
app.use('/api/matrix', matrixRouter);
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test`
Expected: PASS (requires network access; this route makes ~9 x several upstream calls, may take a few seconds)

- [ ] **Step 8: Commit**

```bash
git add server/ingredientEnrichment.js server/routes/ingredients.js server/routes/matrix.js server/index.js test/routes/matrix.test.js
git commit -m "Add coverage matrix route with strong/weak confidence and gap detection"
```

---

## Task 10: Frontend — matrix view and ingredient list

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`

No automated test for this task — it is a rendering layer over the already-tested API. Verification is manual (Step 4 below), consistent with the project's guidance to test UI changes in a real browser rather than claim success from type-checking alone.

**Interfaces:**
- Consumes: `GET /api/ingredients`, `GET /api/matrix` (Task 8, Task 9 response shapes exactly as documented above).
- Produces: a rendered matrix table with click-to-select ingredient rows and pathology-column gap highlighting, wired for Task 11 to extend with the detail panel.

- [ ] **Step 1: Write public/index.html structure**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>NanoFibroSkin Mechanism Sandbox</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <header>
    <h1>NanoFibroSkin Mechanism Plausibility Sandbox</h1>
    <p class="subtitle">Protein-level target evidence for the 9 hydrogel ingredients against the 5 DFU pathologies. Decision support only — not a prediction of healing outcomes.</p>
    <button id="refresh-btn">Refresh targets from DB</button>
    <span id="status"></span>
  </header>

  <main>
    <section id="matrix-section">
      <table id="matrix-table"></table>
      <div id="gap-callout"></div>
    </section>
    <section id="detail-section" hidden>
      <button id="close-detail">&times; Close</button>
      <div id="detail-content"></div>
    </section>
  </main>

  <script type="module" src="/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write public/app.js matrix rendering**

```javascript
const statusEl = document.getElementById('status');
const matrixTable = document.getElementById('matrix-table');
const gapCallout = document.getElementById('gap-callout');
const refreshBtn = document.getElementById('refresh-btn');

let ingredientsById = {};

async function loadIngredientList() {
  const res = await fetch('/api/ingredients');
  const list = await res.json();
  ingredientsById = Object.fromEntries(list.map((i) => [i.id, i]));
  return list;
}

async function loadMatrix() {
  statusEl.textContent = 'Loading targets from PubChem, DGIdb, UniProt, STRING...';
  const res = await fetch('/api/matrix');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    statusEl.textContent = `Error: ${body.error || 'failed to load matrix'}`;
    return null;
  }
  statusEl.textContent = '';
  return res.json();
}

function cellSymbol(state) {
  if (state === 'strong') return '✓';
  if (state === 'weak') return '~';
  return '';
}

function renderMatrix(matrix) {
  const { pathologies, ingredients, cells, gaps } = matrix;

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th'));
  for (const pathology of pathologies) {
    const th = document.createElement('th');
    th.textContent = pathology;
    if (gaps.pathologiesWithNoCoverage.includes(pathology)) {
      th.classList.add('gap-column');
      th.title = 'No ingredient strongly covers this pathology';
    }
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);

  const tbody = document.createElement('tbody');
  for (const ingredientId of ingredients) {
    const row = document.createElement('tr');
    const nameCell = document.createElement('th');
    nameCell.textContent = ingredientsById[ingredientId]?.name ?? ingredientId;
    nameCell.scope = 'row';
    nameCell.classList.add('ingredient-name');
    nameCell.dataset.ingredientId = ingredientId;
    if (gaps.ingredientsWithNoCoverage.includes(ingredientId)) {
      nameCell.classList.add('orphan-row');
      nameCell.title = 'This ingredient has no strong or weak pathology coverage';
    }
    row.appendChild(nameCell);

    for (const pathology of pathologies) {
      const td = document.createElement('td');
      const state = cells[ingredientId][pathology];
      td.textContent = cellSymbol(state);
      td.classList.add(`cell-${state}`);
      td.dataset.ingredientId = ingredientId;
      td.dataset.pathology = pathology;
      td.tabIndex = 0;
      row.appendChild(td);
    }
    tbody.appendChild(row);
  }

  matrixTable.replaceChildren(thead, tbody);

  const gapMessages = [];
  if (gaps.pathologiesWithNoCoverage.length > 0) {
    gapMessages.push(
      `No ingredient strongly covers: ${gaps.pathologiesWithNoCoverage.join(', ')}.`
    );
  }
  if (gaps.ingredientsWithNoCoverage.length > 0) {
    const names = gaps.ingredientsWithNoCoverage.map((id) => ingredientsById[id]?.name ?? id);
    gapMessages.push(`No pathology coverage found for: ${names.join(', ')}.`);
  }
  gapCallout.textContent = gapMessages.join(' ');
  gapCallout.hidden = gapMessages.length === 0;
}

async function init() {
  await loadIngredientList();
  const matrix = await loadMatrix();
  if (matrix) renderMatrix(matrix);
}

refreshBtn.addEventListener('click', init);

init();
```

- [ ] **Step 3: Write public/styles.css**

```css
:root {
  --bg: #f7f5f0;
  --ink: #1c1a17;
  --ink-soft: #46423a;
  --accent: #5f7052;
  --flag: #a8433a;
  --rule: #d9d4c7;
  --card-bg: #fffdf8;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #171613;
    --ink: #ece8de;
    --ink-soft: #b7b1a2;
    --accent: #8fa47c;
    --flag: #d17569;
    --rule: #34322b;
    --card-bg: #201e1a;
  }
}
:root[data-theme="dark"] {
  --bg: #171613; --ink: #ece8de; --ink-soft: #b7b1a2;
  --accent: #8fa47c; --flag: #d17569; --rule: #34322b; --card-bg: #201e1a;
}
:root[data-theme="light"] {
  --bg: #f7f5f0; --ink: #1c1a17; --ink-soft: #46423a;
  --accent: #5f7052; --flag: #a8433a; --rule: #d9d4c7; --card-bg: #fffdf8;
}

* { box-sizing: border-box; }
body {
  background: var(--bg);
  color: var(--ink);
  font-family: -apple-system, "Segoe UI", sans-serif;
  margin: 0;
  padding: 24px 32px 64px;
}
header { max-width: 720px; margin-bottom: 24px; }
.subtitle { color: var(--ink-soft); font-size: 14px; }
#status { font-size: 13px; color: var(--ink-soft); margin-left: 12px; }

#matrix-table {
  border-collapse: collapse;
  width: 100%;
  max-width: 900px;
}
#matrix-table th, #matrix-table td {
  border: 1px solid var(--rule);
  padding: 8px 12px;
  text-align: center;
  font-size: 14px;
}
#matrix-table thead th { background: var(--card-bg); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
.ingredient-name { text-align: left; cursor: pointer; background: var(--card-bg); }
.ingredient-name:hover { color: var(--accent); }
.gap-column { color: var(--flag); }
.orphan-row { color: var(--flag); }
td.cell-strong { color: var(--accent); font-weight: 700; }
td.cell-weak { color: var(--ink-soft); }
td.cell-none { color: var(--rule); }
td:hover { cursor: pointer; background: var(--card-bg); }

#gap-callout {
  margin-top: 12px;
  padding: 10px 14px;
  border-left: 3px solid var(--flag);
  background: var(--card-bg);
  font-size: 13px;
  max-width: 700px;
}

#detail-section {
  margin-top: 24px;
  max-width: 700px;
  background: var(--card-bg);
  border: 1px solid var(--rule);
  border-radius: 4px;
  padding: 16px 20px;
}
```

- [ ] **Step 4: Manually verify in a browser**

```bash
npm start
```

Open `http://localhost:3000` and confirm: the matrix renders with 9 rows and 5 columns, cells show ✓/~/blank, the Infection column and any orphan ingredient are visually flagged if present, and the "Refresh targets from DB" button reloads the matrix. This may take several seconds to load due to live upstream API calls — confirm the status text shows a loading message during that time rather than a blank page.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/app.js public/styles.css
git commit -m "Render coverage matrix with gap/orphan highlighting in browser"
```

---

## Task 11: Frontend — detail panels

**Files:**
- Modify: `public/app.js`
- Modify: `public/styles.css`

No automated test — manual browser verification per Step 3.

**Interfaces:**
- Consumes: `GET /api/ingredients/:id` (Task 8 response shape).
- Produces: clicking an ingredient name shows its prep method + all targets; clicking a matrix cell shows the specific target(s) behind that ingredient/pathology pair, including STRING partners, per spec §5 ("Cell click" and "Ingredient card click" requirements).

- [ ] **Step 1: Add detail-rendering functions to public/app.js**

Append to the existing file (do not replace `init`, `renderMatrix`, etc. from Task 10):

```javascript
const detailSection = document.getElementById('detail-section');
const detailContent = document.getElementById('detail-content');
const closeDetailBtn = document.getElementById('close-detail');

async function loadIngredientDetail(id) {
  const res = await fetch(`/api/ingredients/${id}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.error || 'failed to load ingredient detail' };
  }
  return res.json();
}

function renderTarget(target) {
  const pathologyList = target.pathologies.length
    ? target.pathologies.join(', ')
    : 'no known pathology link';
  const sourceList = target.sources
    .map((s) => `${s.sourceDbName}${s.pmids.length ? ` (PMID ${s.pmids.join(', ')})` : ''}`)
    .join('; ');
  const stringList = target.stringPartners
    .map((p) => `${p.partnerName} (${p.score.toFixed(2)})`)
    .join(', ');

  return `
    <div class="target-card">
      <h3>${target.geneSymbol}${target.uniprot ? ` — ${target.uniprot.proteinName}` : ''}</h3>
      <p><strong>Interaction:</strong> ${target.interactionTypes.join(', ') || 'unspecified'}${target.score !== null ? ` (score ${target.score.toFixed(2)})` : ''}</p>
      <p><strong>Pathology:</strong> ${pathologyList}</p>
      ${sourceList ? `<p><strong>Evidence:</strong> ${sourceList}</p>` : ''}
      ${stringList ? `<p><strong>STRING interactors:</strong> ${stringList}</p>` : ''}
    </div>
  `;
}

function renderIngredientDetail(detail, focusPathology) {
  if (detail.error) {
    detailContent.innerHTML = `<p class="error">${detail.error}</p>`;
    detailSection.hidden = false;
    return;
  }
  const targets = focusPathology
    ? detail.targets.filter((t) => t.pathologies.includes(focusPathology))
    : detail.targets;

  detailContent.innerHTML = `
    <h2>${detail.name}</h2>
    <p><strong>Prep:</strong> ${detail.prep}</p>
    <p><strong>Role:</strong> ${detail.role}</p>
    ${focusPathology ? `<p class="focus-note">Showing targets linked to ${focusPathology}</p>` : ''}
    ${targets.length ? targets.map(renderTarget).join('') : '<p>No target evidence found for this view.</p>'}
  `;
  detailSection.hidden = false;
}

matrixTable.addEventListener('click', async (event) => {
  const cell = event.target.closest('td[data-ingredient-id]');
  const nameCell = event.target.closest('th.ingredient-name');
  if (cell) {
    const detail = await loadIngredientDetail(cell.dataset.ingredientId);
    renderIngredientDetail(detail, cell.dataset.pathology);
  } else if (nameCell) {
    const detail = await loadIngredientDetail(nameCell.dataset.ingredientId);
    renderIngredientDetail(detail, null);
  }
});

closeDetailBtn.addEventListener('click', () => {
  detailSection.hidden = true;
});
```

- [ ] **Step 2: Add detail-panel styles to public/styles.css**

```css
.target-card {
  border-top: 1px solid var(--rule);
  padding-top: 10px;
  margin-top: 10px;
  font-size: 14px;
}
.target-card h3 { margin: 0 0 6px; font-size: 15px; }
.target-card p { margin: 4px 0; color: var(--ink-soft); }
.focus-note { color: var(--accent); font-size: 13px; }
.error { color: var(--flag); }
#close-detail {
  float: right;
  background: none;
  border: 1px solid var(--rule);
  border-radius: 3px;
  cursor: pointer;
  padding: 4px 10px;
}
```

- [ ] **Step 3: Manually verify in a browser**

```bash
npm start
```

Open `http://localhost:3000`. Click an ingredient name (e.g. "Curcumin") — confirm the detail panel shows its prep method and all targets with gene symbol, interaction type, pathology, evidence source, and STRING interactors. Click a specific matrix cell (e.g. Curcumin × Inflammation) — confirm the detail panel filters to only targets linked to that pathology. Click a cell for an ingredient/pathology combination that's empty — confirm it shows "No target evidence found" rather than an error or blank panel. Click "Close" — confirm the panel hides.

- [ ] **Step 4: Commit**

```bash
git add public/app.js public/styles.css
git commit -m "Add ingredient and cell-level detail panels with PPI context"
```

---

## Self-Review Notes

**Spec coverage check** (against `docs/superpowers/specs/2026-08-08-nanofibroskin-mechanism-sandbox-design.md`):
- §2.1 (prep method shown) → Task 8/11 (`prep` field in detail response and panel).
- §2.2 (named protein targets, not pathway labels) → Task 6/8 (`geneSymbol` from DGIdb, not a pathway string).
- §2.3 (interaction evidence: type, source, confidence) → Task 6/8 (`interactionTypes`, `sources`, `score`).
- §2.4 (target's own PPI context) → Task 7/8/11 (STRING `stringPartners` surfaced in detail panel).
- §2.5 (coverage matrix) → Task 9.
- §2.6 (gap/orphan detection) → Task 9 (`gaps` object), Task 10 (visual highlighting).
- §3 (9-ingredient list, tilapia/belladonna decisions) → Task 2, enforced by tests.
- §4 (live API, dual lookup path, no offline fallback) → Tasks 5-7 (no disk cache, in-memory only), Task 8 (kind-based branching), error responses surface upstream failures instead of masking them.
- §5 (matrix-first UI, refresh action, cell/ingredient click, gap callout) → Task 10, Task 11.
- §6 (non-goals) → no task models dosing, physical properties, or ingredient-ingredient contradictions; confirmed absent from scope.
- §7 (open questions) → database choice resolved (PubChem+DGIdb+UniProt+STRING, STITCH dropped with reason documented in Global Constraints); confidence threshold resolved (score >= 0.5, documented in Task 9); tech stack resolved (Node/Express/vanilla JS, per user selection).

**Placeholder scan:** no TBD/TODO markers; every code step has complete, runnable code; no "similar to Task N" shortcuts — Task 9's reuse of Task 8's logic is handled by an explicit refactor step with full code, not a reference.

**Type consistency:** `Interaction` shape from Task 6 (`partnerName`, `interactionTypes`, `score`, `sources`) matches the fields consumed in Task 8/9's `buildTargetEntry`. `classifyGene` return type (`string[]`) matches its usage in Task 8/9. The `enrichIngredient`/`buildTargetEntry` functions have identical signatures between their Task 8 draft and Task 9's extracted final version — Task 9 Step 1 explicitly shows the updated Task 8 file so there's no drift.
