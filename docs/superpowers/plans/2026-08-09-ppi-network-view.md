# PPI Network View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new full-page view, `public/network.html`, where the user picks one ingredient from a dropdown and sees a D3 force-directed graph of that ingredient's DGIdb targets and their STRING protein-protein interaction partners, with click-to-inspect detail.

**Architecture:** Pure frontend addition — no new backend route. The view is a client of the existing `GET /api/ingredients` (list) and `GET /api/ingredients/:id` (detail, including `targets[].stringPartners`) routes. A new `public/network.js` builds a node/edge graph from the detail response and renders it with D3.js v7 (loaded from a pinned CDN URL, no build step, no npm dependency).

**Tech Stack:** D3.js v7.9.0 via CDN `<script>` tag, vanilla JS, SVG rendering, existing CSS custom-property theme tokens from `public/styles.css`.

## Global Constraints

- No new backend route — this view only calls `GET /api/ingredients` and `GET /api/ingredients/:id`, both already implemented and unchanged.
- No offline fallback or caching to disk — if `GET /api/ingredients/:id` fails, the view must show an error, never stale or fabricated data (existing app-wide constraint).
- Copy on this page must not imply prediction of healing outcomes or efficacy — decision-support framing only (existing app-wide constraint).
- Reuse existing theme tokens from `public/styles.css` (`--bg`, `--ink`, `--ink-soft`, `--accent`, `--flag`, `--rule`, `--card-bg`) — do not introduce a separate color system for the base page chrome. New pathology-color tokens (below) are additive, not a replacement.
- D3 is loaded from a pinned CDN version (`d3@7.9.0`), not `latest` — verified reachable at `https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js` (HTTP 200 confirmed during planning).
- Largest possible graph per ingredient is bounded: 1 root + up to 6 targets + up to 6 STRING partners per target (36 max, deduplicated) = at most ~43 nodes. No pagination or virtualization needed.

---

## File Structure

```
public/
  network.html      # new page: dropdown, SVG canvas, detail panel
  network.js         # new: fetch, graph construction, D3 rendering, click handling
  styles.css          # modified: append network-view-specific rules (pathology colors, graph canvas, nav link)
  index.html           # modified: add a nav link to network.html
```

`network.js` is a single file (consistent with the existing `app.js` being one file) with four responsibilities kept as separate top-level functions: data fetching, graph-data construction (API response → nodes/edges), D3 rendering, and click/detail-panel handling. No new backend files.

---

## Task 1: Nav link and empty page shell

**Files:**
- Create: `public/network.html`
- Modify: `public/index.html`
- Modify: `public/styles.css`

**Interfaces:**
- Produces: a reachable `/network.html` page with the dropdown/canvas/detail DOM structure in place (unstyled/unwired — later tasks fill in behavior). A `<nav>` link from `index.html` to `network.html` and back.
- Consumes: existing `--bg`, `--ink`, `--ink-soft`, `--accent`, `--rule`, `--card-bg` tokens from `public/styles.css`.

No automated test for this task (static HTML/CSS scaffold, no behavior yet) — verified by the manual check in Step 4.

- [ ] **Step 1: Add nav links between the two pages**

In `public/index.html`, add a link to the network view inside `<header>`, after the `<p class="subtitle">` line and before the `<button id="refresh-btn">` line:

```html
    <p class="subtitle">Protein-level target evidence for the 9 hydrogel ingredients against the 5 DFU pathologies. Decision support only — not a prediction of healing outcomes.</p>
    <p><a href="/network.html">View protein-protein interaction network →</a></p>
    <button id="refresh-btn">Refresh targets from DB</button>
```

- [ ] **Step 2: Create public/network.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>NanoFibroSkin PPI Network</title>
  <link rel="stylesheet" href="/styles.css" />
  <script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"></script>
</head>
<body>
  <header>
    <h1>Protein-Protein Interaction Network</h1>
    <p class="subtitle">Visualizes an ingredient's DGIdb targets and their STRING interaction partners. Decision support only — not a prediction of healing outcomes.</p>
    <p><a href="/index.html">← Back to coverage matrix</a></p>
    <label for="ingredient-select">Select an ingredient</label>
    <select id="ingredient-select">
      <option value="" selected disabled>Choose an ingredient…</option>
    </select>
    <span id="network-status"></span>
  </header>

  <main>
    <section id="network-section">
      <p id="network-empty-state">Select an ingredient above to see its interaction network.</p>
      <svg id="network-canvas" width="900" height="600" hidden></svg>
    </section>
    <section id="network-detail-section" hidden>
      <button id="network-close-detail">&times; Close</button>
      <div id="network-detail-content"></div>
    </section>
  </main>

  <script type="module" src="/network.js"></script>
</body>
</html>
```

- [ ] **Step 3: Append network-view CSS to public/styles.css**

Append at the end of the existing file (do not modify anything above this):

```css
#network-canvas {
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--card-bg);
  max-width: 100%;
  height: auto;
}
#network-empty-state {
  color: var(--ink-soft);
  font-size: 14px;
}
#ingredient-select {
  font-size: 14px;
  padding: 4px 8px;
  border: 1px solid var(--rule);
  border-radius: 3px;
  background: var(--card-bg);
  color: var(--ink);
}
#network-status { font-size: 13px; color: var(--ink-soft); margin-left: 12px; }
#network-detail-section {
  margin-top: 24px;
  max-width: 700px;
  background: var(--card-bg);
  border: 1px solid var(--rule);
  border-radius: 4px;
  padding: 16px 20px;
}
#network-close-detail {
  float: right;
  background: none;
  border: 1px solid var(--rule);
  border-radius: 3px;
  cursor: pointer;
  padding: 4px 10px;
}
```

- [ ] **Step 4: Manually verify the page loads**

```bash
npm start
```

Open `http://localhost:3000/network.html`. Confirm: the page renders with the header, an empty dropdown (just the placeholder option), the "Select an ingredient..." empty-state text, and no console errors (the D3 CDN script should load — check the Network tab or console for a 200 on the d3.min.js request). Confirm clicking "← Back to coverage matrix" returns to the matrix page, and the matrix page's new "View protein-protein interaction network →" link navigates to `/network.html`.

- [ ] **Step 5: Commit**

```bash
git add public/network.html public/index.html public/styles.css
git commit -m "Add PPI network view page shell with nav links"
```

---

## Task 2: Populate the ingredient dropdown

**Files:**
- Create: `public/network.js`

**Interfaces:**
- Produces: `loadIngredientList()` — fetches `GET /api/ingredients`, populates `#ingredient-select` with one `<option>` per ingredient (value = `id`, text = `name`), and returns the list. Exposes a module-level `ingredientsById` map (id → ingredient object) for later tasks to look up names without re-fetching.
- Consumes: `GET /api/ingredients` (existing route, unchanged) — response shape confirmed live during the original build: `[{id, name, kind, prep, role}, ...]`.

No automated test (this is the same DOM-population pattern already used untested in `app.js`'s `loadIngredientList`) — verified manually in Step 3.

- [ ] **Step 1: Write public/network.js — dropdown population**

```javascript
const selectEl = document.getElementById('ingredient-select');
const statusEl = document.getElementById('network-status');

let ingredientsById = {};

async function loadIngredientList() {
  const res = await fetch('/api/ingredients');
  const list = await res.json();
  ingredientsById = Object.fromEntries(list.map((i) => [i.id, i]));
  for (const ingredient of list) {
    const option = document.createElement('option');
    option.value = ingredient.id;
    option.textContent = ingredient.name;
    selectEl.appendChild(option);
  }
  return list;
}

loadIngredientList();
```

- [ ] **Step 2: Run the server and manually verify**

```bash
npm start
```

Open `http://localhost:3000/network.html`, open the dropdown. Confirm it lists all ingredient names currently defined in `server/ingredients.js` (e.g. "Pepsin-solubilized Collagen (PSC)", "Curcumin", "Ag nanoparticles (low-dose)", etc.) below the placeholder "Choose an ingredient…" option.

- [ ] **Step 3: Commit**

```bash
git add public/network.js
git commit -m "Populate ingredient dropdown on network view"
```

---

## Task 3: Fetch ingredient detail and build graph data

**Files:**
- Modify: `public/network.js`
- Create: `test/network-graph.test.js`

**Interfaces:**
- Produces: `loadIngredientDetail(id)` — fetches `GET /api/ingredients/:id`, returns the parsed JSON or `{error}` on failure (same pattern as `app.js`'s existing function of the same name, duplicated here since `network.js` and `app.js` are not sharing a module in this plan — see the File Structure note; this mirrors the existing project pattern of small self-contained page scripts rather than introducing a shared-module refactor out of scope for this feature). `buildGraphData(detail)` — pure function taking one ingredient detail response and returning `{nodes: Node[], links: Link[]}` where:
  - `Node` = `{id: string, kind: 'ingredient' | 'target' | 'interactor', label: string, pathologies: string[]}` (`pathologies` is `[]` for `interactor` nodes, since STRING partners carry no pathology classification in the API response).
  - `Link` = `{source: string, target: string, score: number | null}` (`score` is `null` for ingredient→target links; for target→interactor links, `score` is the STRING interaction score).
  - Deduplicates interactor nodes: if the same `partnerName` appears under multiple targets, it becomes one node with multiple incoming links (verified against real data during design: e.g. curcumin's targets PTGS1/PTGS2/PTGES share overlapping STRING partners like PTGIS, confirmed live during the original design work).
- Consumes: `GET /api/ingredients/:id` response shape (from Task 8 of the original implementation plan, unchanged): `{id, name, kind, prep, role, pubchemCid, targets: [{geneSymbol, interactionTypes, score, sources, pathologies, uniprot, stringPartners: [{partnerName, score}]}]}`.

- [ ] **Step 1: Write the failing test**

`network.js` is loaded in the browser as `<script type="module" src="/network.js">` (per Task 1), so it can use ES module `export` syntax. Node's test runner can import that same file directly with no bundler, since both environments support ES modules natively.

```javascript
// test/network-graph.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `buildGraphData` is not exported from `public/network.js` yet.

- [ ] **Step 3: Add loadIngredientDetail and buildGraphData to public/network.js**

Append to the existing file from Task 2:

```javascript
async function loadIngredientDetail(id) {
  const res = await fetch(`/api/ingredients/${id}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.error || 'failed to load ingredient detail' };
  }
  return res.json();
}

export function buildGraphData(detail) {
  const nodes = [];
  const links = [];
  const interactorIds = new Set();

  const rootId = `ingredient:${detail.id}`;
  nodes.push({ id: rootId, kind: 'ingredient', label: detail.name, pathologies: [] });

  for (const target of detail.targets) {
    const targetId = `target:${target.geneSymbol}`;
    nodes.push({
      id: targetId,
      kind: 'target',
      label: target.geneSymbol,
      pathologies: target.pathologies,
    });
    links.push({ source: rootId, target: targetId, score: null });

    for (const partner of target.stringPartners) {
      const interactorId = `interactor:${partner.partnerName}`;
      if (!interactorIds.has(interactorId)) {
        interactorIds.add(interactorId);
        nodes.push({ id: interactorId, kind: 'interactor', label: partner.partnerName, pathologies: [] });
      }
      links.push({ source: targetId, target: interactorId, score: partner.score });
    }
  }

  return { nodes, links };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 6 new tests plus the existing suite green.

- [ ] **Step 5: Commit**

```bash
git add public/network.js test/network-graph.test.js
git commit -m "Add ingredient detail fetch and graph data construction with dedup"
```

---

## Task 4: D3 force-directed rendering

**Files:**
- Modify: `public/network.js`
- Modify: `public/styles.css`

**Interfaces:**
- Produces: `renderGraph(graphData)` — takes `{nodes, links}` from `buildGraphData`, clears and redraws `#network-canvas` using a D3 force simulation. Wires the dropdown's `change` event to fetch, build, and render.
- Consumes: `buildGraphData` (Task 3), `loadIngredientDetail` (Task 3), the global `d3` object (from the CDN script tag loaded in `network.html`).

No automated test for this task (D3/SVG rendering, not unit-testable without a browser DOM) — verified manually in Step 3, consistent with how the original matrix-view rendering (`app.js`'s `renderMatrix`) was verified in the original implementation plan.

- [ ] **Step 1: Add pathology color tokens to public/styles.css**

Append after the existing `:root` blocks (keep both light and dark variants consistent — these are new tokens, additive to the existing theme, picked to be distinguishable from the existing `--accent`/`--flag` tokens and from each other):

```css
:root {
  --path-inflammation: #b8623f;
  --path-oxidative: #c9a227;
  --path-angiogenesis: #4a7a96;
  --path-infection: #8b4a9c;
  --path-ecm: #5f7052;
  --path-unclassified: #8a8578;
}
@media (prefers-color-scheme: dark) {
  :root {
    --path-inflammation: #d68a68;
    --path-oxidative: #e0c358;
    --path-angiogenesis: #7aa8c2;
    --path-infection: #b57ac4;
    --path-ecm: #8fa47c;
    --path-unclassified: #a8a396;
  }
}
:root[data-theme="dark"] {
  --path-inflammation: #d68a68; --path-oxidative: #e0c358; --path-angiogenesis: #7aa8c2;
  --path-infection: #b57ac4; --path-ecm: #8fa47c; --path-unclassified: #a8a396;
}
:root[data-theme="light"] {
  --path-inflammation: #b8623f; --path-oxidative: #c9a227; --path-angiogenesis: #4a7a96;
  --path-infection: #8b4a9c; --path-ecm: #5f7052; --path-unclassified: #8a8578;
}

.node-ingredient { fill: var(--accent); stroke: var(--ink); stroke-width: 2px; }
.node-target { stroke: var(--ink-soft); stroke-width: 1px; }
.node-interactor { fill: var(--rule); stroke: var(--ink-soft); stroke-width: 1px; }
.node-label { fill: var(--ink); font-size: 10px; pointer-events: none; }
.graph-link { stroke: var(--ink-soft); }
.node-target, .node-interactor, .node-ingredient { cursor: pointer; }
```

- [ ] **Step 2: Add renderGraph and dropdown wiring to public/network.js**

Append to the existing file:

```javascript
const svg = d3.select('#network-canvas');
const emptyState = document.getElementById('network-empty-state');

const PATHOLOGY_COLOR_VAR = {
  Inflammation: '--path-inflammation',
  'Oxidative Stress': '--path-oxidative',
  Angiogenesis: '--path-angiogenesis',
  Infection: '--path-infection',
  ECM: '--path-ecm',
};

function nodeColor(node) {
  if (node.kind !== 'target') return null; // ingredient/interactor styled via CSS class only
  const varName = node.pathologies.length ? PATHOLOGY_COLOR_VAR[node.pathologies[0]] : '--path-unclassified';
  return getComputedStyle(document.documentElement).getPropertyValue(varName || '--path-unclassified').trim();
}

function nodeRadius(node) {
  if (node.kind === 'ingredient') return 14;
  if (node.kind === 'target') return 9;
  return 6;
}

function renderGraph(graphData) {
  const { nodes, links } = graphData;
  const width = 900;
  const height = 600;

  svg.selectAll('*').remove();
  svg.attr('hidden', null);
  emptyState.hidden = true;

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance(60))
    .force('charge', d3.forceManyBody().strength(-120))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide().radius((d) => nodeRadius(d) + 4));

  const link = svg.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('class', 'graph-link')
    .attr('stroke-opacity', (d) => (d.score !== null ? Math.max(0.2, d.score) : 0.5))
    .attr('stroke-width', (d) => (d.score !== null ? 1 + d.score * 2 : 1.5));

  const node = svg.append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('class', (d) => `node-${d.kind}`)
    .attr('r', nodeRadius)
    .attr('fill', (d) => nodeColor(d))
    .on('click', (event, d) => showNodeDetail(d));

  const label = svg.append('g')
    .selectAll('text')
    .data(nodes)
    .join('text')
    .attr('class', 'node-label')
    .attr('dy', -12)
    .text((d) => d.label);

  simulation.on('tick', () => {
    link
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);
    node
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y);
    label
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y);
  });
}

selectEl.addEventListener('change', async () => {
  const id = selectEl.value;
  if (!id) return;
  statusEl.textContent = 'Loading targets from DGIdb, UniProt, STRING...';
  const detail = await loadIngredientDetail(id);
  statusEl.textContent = '';
  if (detail.error) {
    statusEl.textContent = `Error: ${detail.error}`;
    return;
  }
  const graphData = buildGraphData(detail);
  renderGraph(graphData);
});
```

Note: `renderGraph`'s node click handler calls `showNodeDetail`, which is defined in Task 5. Since `showNodeDetail` is written as a `function` declaration (hoisted), this works regardless of source-order within the file as long as both are present by the time a user actually clicks a node — but Task 5 must be completed before this is fully functional end-to-end. This task's manual verification (Step 3 below) only checks that the graph renders, not that clicking works — click behavior is verified in Task 5.

- [ ] **Step 3: Manually verify in a browser**

```bash
npm start
```

Open `http://localhost:3000/network.html`, select "Curcumin" from the dropdown. Confirm: the empty-state text hides, the SVG canvas appears, a force-directed graph renders with one larger root node (curcumin), several medium target nodes colored by pathology (e.g. PTGS1/PTGS2 should show an inflammation-family color), and several small uncolored interactor nodes connected to the targets. Confirm the graph settles into a stable, non-overlapping layout within a few seconds. Confirm switching to a different ingredient clears the old graph and renders a new one. This may take a few seconds per selection due to live upstream API calls — confirm the status text shows a loading message during that time. Clicking nodes will error at this point (`showNodeDetail` not yet defined) — that's expected and resolved in Task 5; do not treat it as a failure of this task.

- [ ] **Step 4: Commit**

```bash
git add public/network.js public/styles.css
git commit -m "Render D3 force-directed graph with pathology-colored nodes"
```

---

## Task 5: Click-to-inspect detail panel

**Files:**
- Modify: `public/network.js`

**Interfaces:**
- Produces: `showNodeDetail(node)` — called from the `node.on('click', ...)` handler wired in Task 4. Renders the clicked node's data into `#network-detail-content` and shows `#network-detail-section`, reusing the `.target-card`-style markup pattern already defined in `public/styles.css` (from the original matrix-view build). Wires `#network-close-detail` to hide the panel.
- Consumes: the same `escapeHtml` pattern already established in `public/app.js` (duplicated here for the same reason as `loadIngredientDetail` in Task 3 — `network.js` is a standalone page script, not sharing a module with `app.js`). Also needs access to the last-fetched detail response's full target data (score, sources, uniprot, interactionTypes) for target-kind nodes — the `buildGraphData` node objects only carry `id/kind/label/pathologies`, so this task keeps a reference to the raw detail response for lookup by gene symbol.

No automated test for this task (DOM click handling and rendering) — verified manually in Step 3.

- [ ] **Step 1: Add escapeHtml and a currentDetail reference to public/network.js**

Add near the top of the file (after the existing `let ingredientsById = {}` declaration from Task 2):

```javascript
let currentDetail = null; // full GET /api/ingredients/:id response for the selected ingredient

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
```

- [ ] **Step 2: Update the dropdown's change handler to store the fetched detail and close the panel on selection change**

Replace the `selectEl.addEventListener('change', ...)` block written in Task 4 with:

```javascript
selectEl.addEventListener('change', async () => {
  const id = selectEl.value;
  if (!id) return;
  statusEl.textContent = 'Loading targets from DGIdb, UniProt, STRING...';
  const detail = await loadIngredientDetail(id);
  statusEl.textContent = '';
  if (detail.error) {
    statusEl.textContent = `Error: ${detail.error}`;
    return;
  }
  currentDetail = detail;
  const graphData = buildGraphData(detail);
  renderGraph(graphData);
  detailSection.hidden = true;
});
```

- [ ] **Step 3: Add the detail panel logic at the end of public/network.js**

```javascript
const detailSection = document.getElementById('network-detail-section');
const detailContent = document.getElementById('network-detail-content');
const closeDetailBtn = document.getElementById('network-close-detail');

function showNodeDetail(node) {
  if (node.kind === 'ingredient') {
    detailContent.innerHTML = `
      <h2>${escapeHtml(currentDetail.name)}</h2>
      <p><strong>Prep:</strong> ${escapeHtml(currentDetail.prep)}</p>
      <p><strong>Role:</strong> ${escapeHtml(currentDetail.role)}</p>
    `;
  } else if (node.kind === 'target') {
    const target = currentDetail.targets.find((t) => t.geneSymbol === node.label);
    const pathologyList = target.pathologies.length
      ? target.pathologies.map(escapeHtml).join(', ')
      : 'no known pathology link';
    const interactionTypes = target.interactionTypes.map(escapeHtml).join(', ') || 'unspecified';
    detailContent.innerHTML = `
      <h2>${escapeHtml(target.geneSymbol)}${target.uniprot ? ` — ${escapeHtml(target.uniprot.proteinName)}` : ''}</h2>
      <p><strong>Interaction:</strong> ${interactionTypes}${target.score !== null ? ` (score ${target.score.toFixed(2)})` : ''}</p>
      <p><strong>Pathology:</strong> ${pathologyList}</p>
    `;
  } else {
    // interactor node — find its score against whichever target(s) link to it
    const scores = currentDetail.targets
      .flatMap((t) => t.stringPartners.filter((p) => p.partnerName === node.label).map((p) => ({ via: t.geneSymbol, score: p.score })))
      .map((s) => `${escapeHtml(s.via)} (${s.score.toFixed(2)})`)
      .join(', ');
    detailContent.innerHTML = `
      <h2>${escapeHtml(node.label)}</h2>
      <p><strong>STRING interaction confidence:</strong> ${scores}</p>
      <p class="focus-note">This node has no direct DGIdb evidence of its own — it is a known STRING interaction partner of the target(s) listed above.</p>
    `;
  }
  detailSection.hidden = false;
}

closeDetailBtn.addEventListener('click', () => {
  detailSection.hidden = true;
});
```

Note: `detailSection`, `detailContent`, and `closeDetailBtn` are declared here in Task 5, but referenced by Task 4's `change` handler (`detailSection.hidden = true`) — since `const` declarations are NOT hoisted in the way `function` declarations are, this ordering matters. Ensure the `const detailSection = ...` line physically appears in the file BEFORE Task 4's `selectEl.addEventListener('change', ...)` block runs (i.e., place Step 3's three `const` lines at the top of this addition, before the change-handler update from Step 2, or move Step 2's handler to run after Step 3's declarations in the final file). The safest approach: add Step 3's three `const` declarations immediately after Step 1's `currentDetail`/`escapeHtml` block (i.e., near the top of the file), and add the `showNodeDetail`/`closeDetailBtn.addEventListener` function bodies at the end of the file as shown above.

- [ ] **Step 4: Manually verify in a browser**

```bash
npm start
```

Open `http://localhost:3000/network.html`, select "Curcumin". Click the root (ingredient) node — confirm the detail panel shows "Curcumin" with prep/role text. Click a target node (e.g. a node labeled "PTGS2") — confirm the panel shows the gene symbol, protein name, interaction type, score, and pathology list. Click an interactor node (a small uncolored node) — confirm the panel shows its label and the STRING confidence score(s) via the target(s) it connects to, plus the "no direct DGIdb evidence" note. Click "Close" — confirm the panel hides. Switch ingredients via the dropdown — confirm the detail panel closes/resets (per Task 4/5's `detailSection.hidden = true` on selection change).

- [ ] **Step 5: Commit**

```bash
git add public/network.js
git commit -m "Add click-to-inspect detail panel for graph nodes"
```

---

## Self-Review Notes

**Spec coverage check** (against `docs/superpowers/specs/2026-08-09-ppi-network-view-design.md`):
- Goal 1 (dropdown selection) → Task 2.
- Goal 2 (three node types, force-directed graph) → Task 3 (data), Task 4 (rendering).
- Goal 3 (pathology color, edge weight by score) → Task 4.
- Goal 4 (click for detail, reusing existing panel style) → Task 5.
- Scope: new page `public/network.html`, nav link, D3 via CDN, no new backend route → Task 1 (page/nav); all tasks confirm no `server/` files are touched.
- Out-of-scope items (cross-ingredient overlay, score filtering, saved layouts, new backend route, editing) → none implemented, confirmed absent from all 5 tasks.
- Data flow section's node/edge construction rules (dedup interactors, root→target and target→interactor edges) → Task 3, with tests verifying dedup specifically.
- UI Design (empty state, loading state, detail panel styling reuse, decision-support copy) → Task 1 (empty state, copy), Task 4/5 (loading state, detail panel).
- Non-goals (no outcome prediction, no new classification logic, no perf optimization needed given the ~43-node bound) → confirmed: no task touches `pathologyMap.js` or introduces prediction language; Global Constraints section states the node-count bound explicitly.
- Open Questions from the spec: D3 version pinned to `7.9.0` (verified reachable) in Global Constraints; color palette reuses existing CSS custom-property pattern, extended with new `--path-*` tokens in Task 4; interactor-to-interactor edges explicitly not drawn (Task 3's `buildGraphData` only creates target→interactor links, matching the spec's stated v1 limitation).

**Placeholder scan:** no TBD/TODO/"handle edge cases" markers; every code step has complete, runnable code; no "similar to Task N" shortcuts.

**Type consistency:** `buildGraphData`'s `Node`/`Link` shapes defined in Task 3 are consumed identically in Task 4's `renderGraph` (`d.kind`, `d.pathologies`, `d.id`, `d.label`) and Task 5's `showNodeDetail` (`node.kind`, `node.label`). `currentDetail` (introduced in Task 5) matches the `GET /api/ingredients/:id` shape referenced in Task 3's Interfaces block. `loadIngredientDetail`'s error shape (`{error: string}`) is handled identically in Task 4/5's dropdown handler and matches the existing pattern in `app.js`. The Task 4/Task 5 declaration-ordering hazard (const hoisting for `detailSection` et al.) is called out explicitly in Task 5 Step 3's note so an implementer doesn't produce a runtime ReferenceError.
