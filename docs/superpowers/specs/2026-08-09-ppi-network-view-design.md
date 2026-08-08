# Protein-Protein Interaction Network View — Design

## Background

The mechanism plausibility sandbox already pulls real protein-protein
interaction (PPI) data from STRING for every DGIdb target of every
ingredient — this is the `stringPartners` field already present in
`GET /api/ingredients/:id` responses, added in the original build (Task 8
of the original implementation plan). It is currently only surfaced as a
text list inside the click-through detail panel on the matrix page
(`public/app.js`'s `renderTarget`), which makes it easy to miss and hard to
read at a glance — you have to click into a specific matrix cell and scan a
list of `partnerName (score)` pairs to understand a target's interaction
neighborhood.

During a working session on 2026-08-09, checking curcumin's PPI data this
way surfaced a genuinely interesting finding — curcumin's target MMP9 has a
very strong STRING interaction (0.998) with LCN2, a gene already classified
as Infection-relevant in the pathology table — that would have been easy to
miss in the text list. This kind of second-order relationship (an
ingredient's direct target sitting next to a pathology-relevant gene in the
interaction network, without directly targeting it) is exactly what a
visual graph is suited to surface, and the text list is not.

## Goal

Add a dedicated, full-page network view where the user can:
1. Select one ingredient from a dropdown.
2. See a force-directed graph with three node types: the ingredient
   (root), its DGIdb targets, and each target's STRING interaction
   partners.
3. Read pathology relevance and interaction confidence directly off the
   graph (via node color and edge weight) without clicking through text.
4. Click any node to see its full detail (gene name, protein name,
   pathology classification, STRING confidence score) in a small panel,
   reusing the existing detail-panel visual style from the matrix page.

This is a visualization layer only — it introduces no new data source, no
new backend route, and no new interpretation of what "coverage" or
"plausibility" means. It is a different lens on data the app already
computes and serves.

## Scope

**In scope:**
- One new page, `public/network.html`, linked from the existing matrix
  page (`public/index.html`).
- A dropdown listing all ingredients (reusing `GET /api/ingredients` for
  the list), defaulting to no selection until the user picks one.
- On selection, fetch `GET /api/ingredients/:id` (already returns
  `targets[].stringPartners`) and render the graph client-side.
- Force-directed layout via D3.js v7, loaded from a pinned CDN URL — no
  npm dependency, no build step, consistent with the project's existing
  zero-build frontend.
- Node styling: distinct visual treatment for the three node types
  (ingredient root / DGIdb target / STRING interactor), and a
  color/indicator on target nodes reflecting their `pathologies` array
  (or "unclassified" if empty).
- Edge styling: line weight or opacity proportional to the STRING
  interaction `score` (0–1).
- Click-to-inspect: clicking any node opens a small panel with that
  node's details, styled consistently with the existing `.target-card`
  detail panel on the matrix page.

**Out of scope (explicitly deferred, not part of this spec):**
- Cross-ingredient overlay (showing multiple ingredients' networks at
  once) — v1 is single-ingredient only, per design discussion.
- Edge/score filtering controls (e.g. "hide interactions below 0.5") —
  the score is visible on click, but there is no threshold slider in v1.
- Saved or exportable graph layouts.
- A new backend route — this view is a pure client of the existing
  `GET /api/ingredients/:id` response shape; if that shape ever changes,
  this view changes with it, but no new server code is introduced here.
- Editing pathology classifications or STRING data from this view — it is
  read-only, matching the rest of the app's decision-support-only
  posture.

## Data Flow

```
User picks ingredient in dropdown
  -> fetch GET /api/ingredients/:id (existing route, unchanged)
  -> response.targets[] each has:
       geneSymbol, interactionTypes, score, sources, pathologies,
       uniprot (may be null), stringPartners[] (partnerName, score)
  -> client builds a node/edge list:
       1 root node (the ingredient)
       N target nodes (one per response.targets[])
       M interactor nodes (one per unique partnerName across all
         targets' stringPartners — deduplicated, since the same
         interactor gene can appear under multiple targets)
       edges: root -> each target; each target -> each of its
         stringPartners
  -> D3 force simulation lays out and renders as SVG
```

No caching beyond what the browser does natively for the fetch — this
matches the existing app's "no offline fallback" posture (spec constraint
carried over from the original design spec: never show stale or
fabricated data).

## UI Design

- **Page header**: title, and a link back to the matrix view.
- **Dropdown**: "Select an ingredient" — populated from
  `GET /api/ingredients`, showing `name` (not `id`).
- **Graph canvas**: SVG, force-directed layout. Root node visually
  distinct (larger, different shape or color) from target and interactor
  nodes. Target nodes colored by pathology (or a neutral "unclassified"
  color if `pathologies` is empty). Interactor nodes styled uniformly
  (they don't carry pathology classification in the current data model —
  only DGIdb targets do).
- **Detail panel**: hidden until a node is clicked; shows the clicked
  node's full data, matching the existing detail-panel CSS classes
  (`.target-card`-style) already defined in `public/styles.css`.
- **Empty state**: before any ingredient is selected, the canvas shows a
  simple prompt ("Select an ingredient above to see its interaction
  network") rather than a blank page.
- **Loading state**: while `GET /api/ingredients/:id` is in flight
  (upstream calls can take a few seconds), show the same loading-status
  pattern already used on the matrix page.

Copy on this page must maintain the same decision-support framing as the
rest of the app — no language implying the graph predicts efficacy or
healing outcomes.

## Non-goals

- Predicting wound-healing outcomes or efficacy (unchanged from the
  original app-wide constraint).
- Any new pathology or gene classification logic — this view visualizes
  the existing `pathologyMap.js` classifications, it does not expand or
  correct them.
- Performance optimization for very large networks — with a
  `MAX_TARGETS_PER_INGREDIENT = 6` cap already in place server-side and a
  `limit` of 6 STRING partners per target, the largest possible graph for
  one ingredient is on the order of 1 + 6 + 36 = 43 nodes, well within
  what an unoptimized D3 force simulation handles smoothly in a browser.

## Open Questions for Implementation Planning

- Exact D3 v7 CDN URL/version to pin (a specific version, not `latest`,
  for reproducibility).
- Node/edge visual encoding specifics (exact color palette, node radius
  scale) — deferred to implementation, should reuse the existing
  light/dark theme CSS custom properties already defined in
  `public/styles.css` rather than introducing a new palette.
- Whether interactor-to-interactor edges (STRING relationships between two
  interactor nodes that happen to also interact with each other) should
  be drawn — the current API response does not provide this data (STRING
  is only queried per-target, not for interactor-to-interactor edges), so
  by default no such edges exist to draw. This is a natural v2 extension,
  not something v1 needs to solve.
