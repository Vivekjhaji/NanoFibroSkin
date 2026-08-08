# PPI Network View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new full-page view (`public/network.html`) that renders a force-directed D3 graph of one ingredient's DGIdb targets and their STRING protein-protein interaction partners, selectable via a dropdown, with click-to-inspect detail.

**Architecture:** Pure client-side addition — one new HTML page, one new JS file, CSS additions to the existing stylesheet. No backend changes. The page fetches the already-existing `GET /api/ingredients` (for the dropdown) and `GET /api/ingredients/:id` (for the graph data) routes, builds a node/edge list client-side, and renders it with D3 v7's force simulation into an SVG element.

**Tech Stack:** D3.js v7.9.0 loaded from a pinned jsDelivr CDN URL (`https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js`, verified live and returning HTTP 200), vanilla JS (ES modules, no build step), existing CSS custom properties from `public/styles.css`.

## Global Constraints

- No new backend route — this view is a pure client of the existing `GET /api/ingredients` and `GET /api/ingredients/:id` response shapes.
- No new npm dependency — D3 is loaded via CDN `<script>` tag, not `npm install`.
- No offline fallback or caching — matches the existing app-wide constraint; if the API call fails, the page must show the error, never stale/fabricated data.
- All API-sourced strings (gene symbols, protein names, source names, pathology names) must be HTML-escaped before insertion into the DOM — matches the existing `escapeHtml()` pattern already in `public/app.js`, since this project previously had a real stored-XSS defect fixed for exactly this reason.
- No UI copy may imply prediction of healing outcomes, efficacy, or clinical viability — matches the app-wide decision-support-only framing.
- v1 is single-ingredient view only — no cross-ingredient overlay, no edge/score filtering controls, no saved layouts (all explicitly out of scope per the design spec).

---

## File Structure

```
ppi-sandbox/
  public/
    network.html      # New page: dropdown, SVG canvas, detail panel, D3 CDN script tag
    network.js          # New: fetch, node/edge graph-building, D3 force simulation, render, click handling
    styles.css           # Modified: append graph-specific CSS (node/edge styling, pathology color legend, nav link)
    index.html            # Modified: add a link to network.html
```

`network.js` owns all graph logic (data fetch, D3 setup, rendering, click handling) in one file, mirroring how `app.js` owns all matrix-page logic in one file — consistent with the existing project's one-file-per-page frontend pattern. No shared JS module is introduced between `app.js` and `network.js`; the small amount of duplication (an `escapeHtml` helper, ~5 lines) is preferred here over a premature shared-utilities file for a two-file frontend.

---

## Task 1: Pathology color palette and CSS scaffolding

**Files:**
- Modify: `public/styles.css`

**Interfaces:**
- Produces: five new CSS custom properties (`--path-inflammation`, `--path-oxidative-stress`, `--path-angiogenesis`, `--path-infection`, `--path-ecm`) plus `--path-unclassified`, defined in both the light and dark `:root` blocks (and their `data-theme` override blocks) alongside the existing `--bg`/`--ink`/etc. tokens. Also produces `.node-root`, `.node-target`, `.node-interactor`, `.graph-edge`, `.pathology-legend`, `.nav-link` CSS classes for Task 3 to consume.

- [ ] **Step 1: Add pathology color tokens to all four theme blocks**

Edit `public/styles.css`. The file currently has four blocks that each define the same set of custom properties: `:root { ... }`, `@media (prefers-color-scheme: dark) { :root { ... } }`, `:root[data-theme="dark"] { ... }`, `:root[data-theme="light"] { ... }`. Add the following six properties to **all four** blocks, using the same color value in the default `:root` block and the `:root[data-theme="light"]` block (light theme colors), and the same value in the dark-scheme media query block and the `:root[data-theme="dark"]` block (dark theme colors):

Light theme values (add to `:root { ... }` and `:root[data-theme="light"] { ... }`):
```css
--path-inflammation: #a8433a;
--path-oxidative-stress: #b8863a;
--path-angiogenesis: #5f7052;
--path-infection: #7a4a8f;
--path-ecm: #3a6b8a;
--path-unclassified: #8a8578;
```

Dark theme values (add to `@media (prefers-color-scheme: dark) { :root { ... } }` and `:root[data-theme="dark"] { ... }`):
```css
--path-inflammation: #d17569;
--path-oxidative-stress: #d4a35f;
--path-angiogenesis: #8fa47c;
--path-infection: #b07fc4;
--path-ecm: #6fa3c4;
--path-unclassified: #b7b1a2;
```

The final file should look like this for the light `:root` block (showing the pattern to follow for all four blocks):
```css
:root {
  --bg: #f7f5f0;
  --ink: #1c1a17;
  --ink-soft: #46423a;
  --accent: #5f7052;
  --flag: #a8433a;
  --rule: #d9d4c7;
  --card-bg: #fffdf8;
  --path-inflammation: #a8433a;
  --path-oxidative-stress: #b8863a;
  --path-angiogenesis: #5f7052;
  --path-infection: #7a4a8f;
  --path-ecm: #3a6b8a;
  --path-unclassified: #8a8578;
}
```

- [ ] **Step 2: Append graph and nav CSS to the end of styles.css**

```css
.nav-link {
  font-size: 13px;
  color: var(--accent);
  text-decoration: none;
}
.nav-link:hover { text-decoration: underline; }

#graph-controls {
  max-width: 720px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
#ingredient-select {
  font-size: 14px;
  padding: 6px 10px;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--card-bg);
  color: var(--ink);
}

#graph-canvas {
  width: 100%;
  max-width: 900px;
  height: 560px;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--card-bg);
}

#graph-empty-state {
  padding: 48px 24px;
  text-align: center;
  color: var(--ink-soft);
  font-size: 14px;
}

.node-root circle { fill: var(--ink); stroke: var(--accent); stroke-width: 2px; }
.node-root text { fill: var(--card-bg); font-weight: 700; }
.node-target circle { stroke: var(--ink); stroke-width: 1px; }
.node-interactor circle { fill: var(--rule); stroke: var(--ink-soft); stroke-width: 1px; }
.node-interactor text { fill: var(--ink-soft); }
.node-label { font-size: 10px; pointer-events: none; text-anchor: middle; }
.graph-node { cursor: pointer; }
.graph-edge { stroke: var(--ink-soft); stroke-opacity: 0.4; }

.pathology-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  max-width: 900px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--ink-soft);
}
.pathology-legend .swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
}
```

- [ ] **Step 3: Manually verify no syntax errors**

Run: `node -e "require('fs').readFileSync('public/styles.css', 'utf8')"` — this just confirms the file is readable; CSS syntax isn't checked by Node, so also visually re-read the diff for unmatched braces before moving on.

- [ ] **Step 4: Commit**

```bash
git add public/styles.css
git commit -m "Add pathology color tokens and graph CSS scaffolding for PPI network view"
```

---

## Task 2: network.html page shell

**Files:**
- Create: `public/network.html`
- Modify: `public/index.html`

**Interfaces:**
- Produces: a page with `#ingredient-select` (dropdown), `#graph-canvas` (SVG container), `#graph-empty-state`, `#status`, `#detail-section`/`#detail-content`/`#close-detail` (reusing the exact IDs and structure from `index.html`'s detail panel so Task 4 can reuse `app.js`'s detail-rendering CSS classes), and a `.pathology-legend` container.
- Consumes: nothing yet (Task 3 wires up the JS).

- [ ] **Step 1: Write public/network.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>NanoFibroSkin — PPI Network View</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <header>
    <h1>Protein-Protein Interaction Network</h1>
    <p class="subtitle">Visualizes one ingredient's DGIdb targets and their STRING interaction partners. Decision support only — not a prediction of healing outcomes.</p>
    <a class="nav-link" href="/">&larr; Back to coverage matrix</a>
  </header>

  <main>
    <div id="graph-controls">
      <label for="ingredient-select">Select an ingredient:</label>
      <select id="ingredient-select">
        <option value="">— choose —</option>
      </select>
      <span id="status"></span>
    </div>

    <div id="graph-empty-state">Select an ingredient above to see its interaction network.</div>
    <svg id="graph-canvas" hidden></svg>
    <div class="pathology-legend" id="pathology-legend" hidden></div>

    <section id="detail-section" hidden>
      <button id="close-detail">&times; Close</button>
      <div id="detail-content"></div>
    </section>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"></script>
  <script type="module" src="/network.js"></script>
</body>
</html>
```

- [ ] **Step 2: Add a nav link from index.html to network.html**

Edit `public/index.html`, adding a nav link inside the `<header>`, after the existing subtitle paragraph and before the `<button id="refresh-btn">`:

```html
  <header>
    <h1>NanoFibroSkin Mechanism Plausibility Sandbox</h1>
    <p class="subtitle">Protein-level target evidence for the 9 hydrogel ingredients against the 5 DFU pathologies. Decision support only — not a prediction of healing outcomes.</p>
    <a class="nav-link" href="/network.html">View protein-protein interaction network &rarr;</a>
    <button id="refresh-btn">Refresh targets from DB</button>
    <span id="status"></span>
  </header>
```

- [ ] **Step 3: Verify via curl that both pages serve correctly**

Run: `npm start &` then, after confirming the server is listening (poll `curl -sf http://localhost:3000/ >/dev/null` in a loop rather than a blind sleep), run:
```bash
curl -s http://localhost:3000/network.html | grep -c "graph-canvas"
curl -s http://localhost:3000/ | grep -c "network.html"
```
Expected: both commands print `1` (confirms the new page is served and the nav link exists). Stop the server afterward: `lsof -ti:3000 -sTCP:LISTEN | xargs -r kill`.

- [ ] **Step 4: Commit**

```bash
git add public/network.html public/index.html
git commit -m "Add network.html page shell with nav link from the matrix page"
```

---

## Task 3: Graph data builder and D3 force simulation

**Files:**
- Create: `public/network.js`

**Interfaces:**
- Consumes: `GET /api/ingredients` (returns `[{id, name, kind, prep, role}, ...]`, no `targets` field — exact shape from the existing `server/routes/ingredients.js`), `GET /api/ingredients/:id` (returns `{id, name, kind, prep, role, pubchemCid, targets: [{geneSymbol, interactionTypes, score, sources, pathologies, uniprot, stringPartners: [{partnerName, score}]}]}` — exact shape from the existing route, including the `pubchemCid` field added in a later fix wave and the `stringPartners` field this whole feature exists to visualize).
- Produces: `buildGraphData(ingredientDetail)` — a pure function taking one ingredient detail response and returning `{nodes: [...], links: [...]}` in D3-force-simulation-compatible shape (`nodes` each have a unique `id` string and a `type: 'root' | 'target' | 'interactor'`; `links` each have `source`/`target` as node `id` strings and a `value` numeric score for edge weight). This function has no DOM dependency and is unit-testable in isolation, even though this task has no automated test file (per the "no automated test for frontend" pattern already established for `app.js` in the original plan) — keeping it pure and DOM-free is what makes Task 3's Step 5 self-check possible without a browser.

- [ ] **Step 1: Write the DOM element references and escapeHtml helper**

```javascript
// public/network.js
const statusEl = document.getElementById('status');
const selectEl = document.getElementById('ingredient-select');
const svgEl = document.getElementById('graph-canvas');
const emptyStateEl = document.getElementById('graph-empty-state');
const legendEl = document.getElementById('pathology-legend');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
```

- [ ] **Step 2: Write buildGraphData — the pure graph-construction function**

```javascript
const PATHOLOGY_COLOR_VAR = {
  'Inflammation': '--path-inflammation',
  'Oxidative Stress': '--path-oxidative-stress',
  'Angiogenesis': '--path-angiogenesis',
  'Infection': '--path-infection',
  'ECM': '--path-ecm',
};

function pathologyColorVar(pathologies) {
  if (!pathologies || pathologies.length === 0) return '--path-unclassified';
  return PATHOLOGY_COLOR_VAR[pathologies[0]] ?? '--path-unclassified';
}

export function buildGraphData(detail) {
  const nodes = [];
  const links = [];
  const interactorIds = new Set();

  const rootId = `root:${detail.id}`;
  nodes.push({ id: rootId, type: 'root', label: detail.name, data: detail });

  for (const target of detail.targets) {
    const targetId = `target:${target.geneSymbol}`;
    nodes.push({
      id: targetId,
      type: 'target',
      label: target.geneSymbol,
      colorVar: pathologyColorVar(target.pathologies),
      data: target,
    });
    links.push({ source: rootId, target: targetId, value: target.score ?? 1 });

    for (const partner of target.stringPartners) {
      const interactorId = `interactor:${partner.partnerName}`;
      if (!interactorIds.has(interactorId)) {
        interactorIds.add(interactorId);
        nodes.push({
          id: interactorId,
          type: 'interactor',
          label: partner.partnerName,
          data: partner,
        });
      }
      links.push({ source: targetId, target: interactorId, value: partner.score });
    }
  }

  return { nodes, links };
}
```

- [ ] **Step 3: Write the fetch functions**

```javascript
async function loadIngredientList() {
  const res = await fetch('/api/ingredients');
  return res.json();
}

async function loadIngredientDetail(id) {
  statusEl.textContent = 'Loading targets and interactions from DGIdb/UniProt/STRING...';
  const res = await fetch(`/api/ingredients/${id}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    statusEl.textContent = `Error: ${body.error || 'failed to load ingredient detail'}`;
    return null;
  }
  statusEl.textContent = '';
  return res.json();
}
```

- [ ] **Step 4: Write the D3 render function**

```javascript
function nodeRadius(type) {
  if (type === 'root') return 24;
  if (type === 'target') return 14;
  return 8;
}

function renderGraph(graphData) {
  svgEl.innerHTML = '';
  const width = svgEl.clientWidth || 900;
  const height = 560;
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const svg = d3.select(svgEl);

  const simulation = d3.forceSimulation(graphData.nodes)
    .force('link', d3.forceLink(graphData.links).id((d) => d.id).distance((l) => 40 + (1 - l.value) * 80))
    .force('charge', d3.forceManyBody().strength(-120))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide().radius((d) => nodeRadius(d.type) + 6));

  const link = svg.append('g')
    .selectAll('line')
    .data(graphData.links)
    .join('line')
    .attr('class', 'graph-edge')
    .attr('stroke-width', (d) => 0.5 + d.value * 3);

  const node = svg.append('g')
    .selectAll('g')
    .data(graphData.nodes)
    .join('g')
    .attr('class', (d) => `graph-node node-${d.type}`)
    .call(drag(simulation));

  node.append('circle')
    .attr('r', (d) => nodeRadius(d.type))
    .attr('fill', (d) => d.type === 'target' && d.colorVar ? `var(${d.colorVar})` : null);

  node.append('text')
    .attr('class', 'node-label')
    .attr('dy', (d) => nodeRadius(d.type) + 12)
    .text((d) => d.label);

  node.on('click', (event, d) => showNodeDetail(d));

  simulation.on('tick', () => {
    link
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);
    node.attr('transform', (d) => `translate(${d.x},${d.y})`);
  });
}

function drag(simulation) {
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
  return d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended);
}
```

- [ ] **Step 5: Manually verify buildGraphData with a real API response**

Run: `npm start &`, poll until it responds (`until curl -sf http://localhost:3000/ >/dev/null; do sleep 1; done`), then:
```bash
curl -s http://localhost:3000/api/ingredients/curcumin -m 30 -o /tmp/curcumin-detail.json
node -e "
const detail = require('/tmp/curcumin-detail.json');
// Inline copy of buildGraphData's logic for a Node-side sanity check
// (the real function lives in network.js as a browser ES module import,
// this just confirms the shape of the data it will receive is as expected)
console.log('targets:', detail.targets.length);
let interactorCount = 0;
for (const t of detail.targets) interactorCount += t.stringPartners.length;
console.log('total stringPartners entries (pre-dedup):', interactorCount);
console.log('sample target:', JSON.stringify(detail.targets[0], null, 2).slice(0, 300));
"
```
Expected: prints a target count matching what was seen earlier in this conversation (6 targets for curcumin) and confirms the `stringPartners` field is present and populated — this is the exact field `buildGraphData` reads. Stop the server: `lsof -ti:3000 -sTCP:LISTEN | xargs -r kill`.

- [ ] **Step 6: Commit**

```bash
git add public/network.js
git commit -m "Add graph data builder and D3 force-simulation rendering to network.js"
```

---

## Task 4: Dropdown wiring, node click detail panel, and legend

**Files:**
- Modify: `public/network.js`

**Interfaces:**
- Consumes: `buildGraphData` and `renderGraph` from Task 3 (same file).
- Produces: a fully wired page — populating the dropdown, loading and rendering the graph on selection, rendering the pathology legend, and showing node details on click. This is the final piece that makes the page interactive end-to-end.

- [ ] **Step 1: Write the legend renderer**

```javascript
const LEGEND_ITEMS = [
  ['Inflammation', '--path-inflammation'],
  ['Oxidative Stress', '--path-oxidative-stress'],
  ['Angiogenesis', '--path-angiogenesis'],
  ['Infection', '--path-infection'],
  ['ECM', '--path-ecm'],
  ['Unclassified', '--path-unclassified'],
];

function renderLegend() {
  legendEl.innerHTML = LEGEND_ITEMS.map(
    ([label, colorVar]) =>
      `<span><span class="swatch" style="background: var(${colorVar})"></span>${escapeHtml(label)}</span>`
  ).join('');
  legendEl.hidden = false;
}
```

- [ ] **Step 2: Write the node detail panel renderer**

Reuses the same `#detail-section`/`#detail-content` IDs and `.target-card` CSS class already defined in `public/styles.css` from the original matrix page, so no new detail-panel CSS is needed.

```javascript
const detailSection = document.getElementById('detail-section');
const detailContent = document.getElementById('detail-content');
const closeDetailBtn = document.getElementById('close-detail');

function showNodeDetail(node) {
  if (node.type === 'root') {
    const d = node.data;
    detailContent.innerHTML = `
      <h2>${escapeHtml(d.name)}</h2>
      <p><strong>Prep:</strong> ${escapeHtml(d.prep)}</p>
      <p><strong>Role:</strong> ${escapeHtml(d.role)}</p>
    `;
  } else if (node.type === 'target') {
    const t = node.data;
    const pathologyList = t.pathologies.length ? t.pathologies.map(escapeHtml).join(', ') : 'no known pathology link';
    const stringList = t.stringPartners.map((p) => `${escapeHtml(p.partnerName)} (${p.score.toFixed(2)})`).join(', ');
    detailContent.innerHTML = `
      <div class="target-card">
        <h3>${escapeHtml(t.geneSymbol)}${t.uniprot ? ` — ${escapeHtml(t.uniprot.proteinName)}` : ''}</h3>
        <p><strong>Pathology:</strong> ${pathologyList}</p>
        ${t.score !== null ? `<p><strong>DGIdb score:</strong> ${t.score.toFixed(2)}</p>` : ''}
        ${stringList ? `<p><strong>STRING interactors:</strong> ${stringList}</p>` : ''}
      </div>
    `;
  } else {
    const p = node.data;
    detailContent.innerHTML = `
      <div class="target-card">
        <h3>${escapeHtml(p.partnerName)}</h3>
        <p><strong>STRING confidence score:</strong> ${p.score.toFixed(2)}</p>
        <p class="focus-note">This node is a STRING interaction partner of a DGIdb target, not a direct target itself.</p>
      </div>
    `;
  }
  detailSection.hidden = false;
}

closeDetailBtn.addEventListener('click', () => {
  detailSection.hidden = true;
});
```

- [ ] **Step 3: Write the dropdown population and selection handler**

```javascript
async function populateDropdown() {
  const ingredients = await loadIngredientList();
  for (const ing of ingredients) {
    const option = document.createElement('option');
    option.value = ing.id;
    option.textContent = ing.name;
    selectEl.appendChild(option);
  }
}

selectEl.addEventListener('change', async () => {
  const id = selectEl.value;
  detailSection.hidden = true;
  if (!id) {
    svgEl.hidden = true;
    legendEl.hidden = true;
    emptyStateEl.hidden = false;
    return;
  }
  emptyStateEl.hidden = true;
  const detail = await loadIngredientDetail(id);
  if (!detail) {
    svgEl.hidden = true;
    legendEl.hidden = true;
    return;
  }
  const graphData = buildGraphData(detail);
  svgEl.hidden = false;
  renderGraph(graphData);
  renderLegend();
});

populateDropdown();
```

- [ ] **Step 4: Manually verify end-to-end via server + curl + syntax check**

Since this is a frontend-only interactive feature (dropdown change events, D3 rendering, drag interactions), full verification requires a real browser, which per this project's established precedent (documented in the original implementation plan's Task 10/11 fix rounds) may not be available in every environment. Do the following alternative verification, consistent with that precedent:

```bash
npm start &
until curl -sf http://localhost:3000/ >/dev/null; do sleep 1; done

# 1. Confirm the page and script serve without error
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/network.html
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/network.js

# 2. Syntax-check the served network.js
curl -s http://localhost:3000/network.js -o /tmp/served-network.js
node --check /tmp/served-network.js

# 3. Confirm the dropdown's data source returns the expected shape
curl -s http://localhost:3000/api/ingredients | node -e "
let data=''; process.stdin.on('data',c=>data+=c);
process.stdin.on('end',()=>{ const list = JSON.parse(data); console.log('ingredients for dropdown:', list.length); });
"

lsof -ti:3000 -sTCP:LISTEN | xargs -r kill
```

Expected: both HTTP status codes are `200`, `node --check` reports no syntax errors, and the ingredient count matches the current `server/ingredients.js` list. If real browser access is available in your environment, additionally open `http://localhost:3000/network.html`, select an ingredient from the dropdown, confirm the graph renders with a root node, target nodes colored by pathology, and interactor nodes in neutral gray, click a few nodes to confirm the detail panel populates correctly for each of the three node types, and check the browser console for errors.

- [ ] **Step 5: Commit**

```bash
git add public/network.js
git commit -m "Wire up dropdown selection, node click detail panel, and pathology legend"
```

---

## Self-Review Notes

**Spec coverage check** (against `docs/superpowers/specs/2026-08-09-ppi-network-view-design.md`):
- Background/motivation (surfacing existing `stringPartners` data visually) → the whole plan; Task 3's `buildGraphData` is the direct mechanism.
- Goal 1 (dropdown ingredient selection) → Task 4 Step 3.
- Goal 2 (three node types: root/target/interactor) → Task 3 Step 2 (`buildGraphData`), Task 3 Step 4 (`nodeRadius`/CSS classes).
- Goal 3 (pathology color + edge weight) → Task 1 (color tokens), Task 3 Step 2 (`pathologyColorVar`), Task 3 Step 4 (`stroke-width` from `d.value`).
- Goal 4 (click-to-inspect detail panel, reusing existing style) → Task 4 Step 2, reuses `.target-card` from the original `styles.css`.
- Scope: "one new page, dropdown reusing GET /api/ingredients, fetch GET /api/ingredients/:id, D3 v7 via CDN, node/edge styling, click-to-inspect" → all present across Tasks 1-4.
- Out-of-scope items (cross-ingredient overlay, filtering controls, saved layouts, new backend route, editing) → confirmed absent from every task; no task adds a route, a filter UI, or a save mechanism.
- Data flow diagram (root → targets → deduplicated interactors) → `buildGraphData`'s `interactorIds` Set is exactly this dedup step.
- UI design (nav link, dropdown, canvas, detail panel, empty state, loading state) → Task 2 (`#graph-empty-state`, nav link), Task 4 Step 3 (loading state via `statusEl`, empty state toggling).
- Non-goals (no new pathology logic, no perf optimization beyond what's already capped server-side) → confirmed; `buildGraphData` only reads existing `pathologies` arrays, never computes new classifications.
- Open questions resolved: D3 version pinned to 7.9.0 (verified live in Task 2 brief); color palette defined in Task 1 reusing the existing CSS custom-property pattern; interactor-to-interactor edges explicitly not drawn (confirmed: `buildGraphData` only creates target→interactor links, never interactor→interactor, matching the spec's statement that the API doesn't provide this data).

**Placeholder scan:** no TBD/TODO markers; every code step has complete, runnable code; the one deferred verification (full browser click-testing) is handled the same way the original plan's Task 10/11 handled it — an explicit, documented alternative verification method, not a silent gap.

**Type consistency:** `buildGraphData`'s output shape (`{nodes, links}` with `id`/`type`/`label`/`colorVar`/`data` on nodes, `source`/`target`/`value` on links) is defined once in Task 3 Step 2 and consumed identically by `renderGraph` in Task 3 Step 4 and `showNodeDetail` in Task 4 Step 2 — the `node.type`/`node.data` fields read in `showNodeDetail`'s three branches match exactly what `buildGraphData` assigns for `'root'`/`'target'`/`'interactor'` nodes respectively.
