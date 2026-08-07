# NanoFibroSkin Mechanism Plausibility Sandbox — Design

## Background

The user is developing NanoFibroSkin, a 3D-bioprinted hydrogel for diabetic foot
ulcer (DFU) wound dressings, combining a marine-derived scaffold, a polymer
backbone, a haemostatic anchor, and phytochemical modulators. The published
plan (see `NanoFibroSkin_Diabetic_Wound_Regeneration.pdf`) moves straight from
formulation (Phase 1) to in vitro assays (Phase 2) to an in vivo diabetic mouse
model (Phase 3). There is no step that checks, before physical work begins,
whether the proposed ingredients actually have literature-supported mechanisms
against the five DFU pathologies the deck identifies: chronic inflammation,
oxidative stress, impaired angiogenesis, bacterial infection, and ECM
dysregulation.

A true "does this hydrogel heal the wound" simulation is not feasible — that
outcome is emergent, multi-cell-type, and weeks-long, which is why the
project's own roadmap defers it to a real in vivo model. What is feasible, and
useful, is a **mechanism plausibility sandbox**: for each candidate ingredient,
surface its literature-known molecular targets/pathways, and map those targets
against the five target pathologies. This turns an implicit assumption
("these ingredients should work together") into an explicit, inspectable
claim, and surfaces gaps and unsupported ingredients before money and time go
into synthesis.

This sandbox already did useful work during design: it prompted removing
tilapia "skin" as an ingredient in favor of its two real extraction products
(collagen and lipid fractions), flagged that no original ingredient covered
the Infection pathology (leading to adding low-dose Ag nanoparticles), and
flagged that Atropa belladonna extract had no mechanistic link to any target
pathology and carried unjustified toxicity risk (leading to its removal).

## Goal

Build an interactive local web page where the user can:
1. See the finalized ingredient list, each with its literature extraction/prep
   method.
2. See each ingredient's known molecular targets, pulled from a public
   database — at the level of **actual named proteins** (e.g. curcumin →
   NFKB1, PTGS2/COX-2; AS-IV → VEGFA), not just pathway labels.
3. For each ingredient–target pair, see the underlying **interaction
   evidence**: interaction/binding type (e.g. inhibits, binds, modulates
   expression), evidence source (paper/database record), and a confidence
   score where the source database provides one.
4. Where the target protein is itself known to interact with other proteins
   relevant to DFU biology (e.g. COX-2 in the arachidonic acid/inflammatory
   cascade, VEGFA–VEGFR2 in angiogenesis), show that secondary
   protein-protein interaction as supporting context — this is what lets the
   user judge "does this ingredient's target actually sit in a DFU-relevant
   pathway, protein to protein" rather than trusting a pathway label at face
   value.
5. See a coverage matrix: ingredients × the 5 DFU pathologies, showing which
   pathology each ingredient plausibly addresses via which target, rolled up
   from the protein-level evidence above.
6. Spot gaps (a pathology with no strong coverage) or orphans (an ingredient
   with no clear pathology link) at a glance.

This is a decision-support tool for formulation planning, not a predictive or
diagnostic tool, and the design and UI should not imply otherwise. It checks
mechanistic plausibility at the molecular/protein-interaction level — it does
not simulate or predict wound-healing outcomes.

## Finalized Ingredient List (9 compounds)

| Ingredient | Prep / Extraction | Role | Target Pathology(ies) |
|---|---|---|---|
| Pepsin-solubilized Collagen (PSC) | Descale/defat tilapia skin, acid-swell, pepsin digestion | Structural scaffold (Layer 2/3) | ECM |
| Collagen Hydrolysate Peptides | Enzymatic hydrolysis (Alcalase/papain) of skin protein, <3kDa fractionation | Bioactive nano-inclusion | ECM, Angiogenesis (weak) — screen for AMP activity |
| Marine PUFAs (EPA/DHA) | Lipid extraction (Folch/Bligh-Dyer), separate from protein fraction | Bioactive nano-inclusion | Inflammation, Oxidative Stress |
| LMW-Hyaluronic Acid | Purified, <500 kDa | Polymer backbone (Layer 1) | Inflammation, Angiogenesis, ECM |
| Dried Fibrinogen | Purified, dried | Haemostatic anchor (Layer 2) | ECM (scaffold), growth factor retention |
| Curcumin | Botanical extract | Phytochemical modulator | Inflammation, Oxidative Stress |
| Baicalein | TCM botanical extract | Phytochemical modulator | Inflammation, Oxidative Stress |
| Astragalus (AS-IV) | Botanical extract | Phytochemical modulator | Angiogenesis, ECM, Inflammation |
| Ag nanoparticles (low-dose) | In-situ reduction or pre-formed AgNP, sub-cytotoxic loading | Antimicrobial | Infection |

Note: tilapia "skin" as a raw ingredient was rejected — crushed/raw skin is
insoluble, uncharacterizable, and non-reproducible. It is replaced by its two
real derived fractions (collagen and lipid/peptide extracts) above. Atropa
belladonna was considered and rejected: its known pharmacology
(anticholinergic, antispasmodic) has no literature link to any of the five
target pathologies, and it introduces unjustified systemic toxicity risk for
topical use on broken skin.

## Data Source

Targets are pulled live via API from a public pharmacology/interaction
database rather than manually curated, per user preference for breadth over
manual curation speed. Candidate sources to evaluate during implementation:

- **PubChem** (compound identity, cross-references)
- **STITCH** (chemical–protein interaction network, good coverage for
  natural products like curcumin/baicalein)
- **DGIdb** (drug–gene interactions; weaker for natural compounds, better for
  Ag/pharmacological agents)

Fibrinogen, PSC, and hydrolysate peptides are proteins/protein fragments, not
small molecules — these will need a different lookup path (e.g. UniProt
function annotations plus known interactors) rather than a chemical-interaction
database. The implementation plan should treat "small molecule ingredients"
and "protein/peptide ingredients" as two lookup paths feeding the same UI.

For protein-protein interaction evidence specifically (both for
protein/peptide ingredients and for the secondary interactions of small-molecule
targets), the implementation plan should evaluate:

- **STRING** (protein-protein interaction network with confidence scores;
  covers human targets like COX-2, VEGFA, NFKB1 well, and is the natural
  source for "what does this target protein interact with")
- **UniProt** (canonical protein identity and function, needed to resolve
  ingredient/target names to stable identifiers before querying STRING)

No offline fallback/caching strategy is in scope for v1 — if the API is
unreachable, the UI should say so plainly rather than silently showing stale
or fabricated data.

## UI Design

Single-page app, matrix-first (per user selection over the network-diagram
alternative):

- **Header**: ingredient list with a "Refresh targets from DB" action.
- **Matrix**: rows = 9 ingredients, columns = 5 pathologies (Inflammation,
  Oxidative Stress, Angiogenesis, Infection, ECM). Each cell shows a
  checkmark/weak/empty state based on whether any of the ingredient's known
  targets map to that pathology.
- **Cell click**: opens a detail panel showing the specific named protein
  target(s) behind that cell, the interaction type (binds/inhibits/modulates
  expression), the source database record, a confidence indicator (e.g.
  direct target evidence vs. weak/indirect), and — where available — the
  target's own known protein-protein interactions relevant to that pathology
  (e.g. clicking curcumin → Inflammation shows curcumin inhibits NFKB1, and
  NFKB1's STRING interactors include the cytokines/pathway members that tie
  it to the inflammatory cascade).
- **Ingredient card click**: shows the extraction/prep method field alongside
  its targets (per user's decision to keep prep method attached to each
  ingredient rather than as separate notes).
- **Gap callout**: a visible message when a pathology column has no
  strong-confidence coverage across all ingredients, or when an ingredient
  row has no pathology coverage at all — this is the mechanism that would
  have caught the original Infection gap and the belladonna orphan
  automatically instead of requiring manual review.

## Non-goals

- Predicting wound healing outcomes, efficacy, or clinical viability.
- Modeling hydrogel physical properties (swelling, degradation, mechanical
  strength) — a possible separate sandbox, out of scope here.
- Dose/concentration modeling — the matrix shows mechanistic plausibility,
  not potency or safe dosing (the Ag cytotoxicity dose-tuning noted above
  remains a wet-lab Phase 2 question).
- Contradiction/interaction detection between ingredients and dose-plausibility
  checks were considered and explicitly deferred (not selected by the user for
  v1) — could be a v2 addition to the same matrix.

## Open Questions for Implementation Planning

- Exact target database(s) to call for small molecules vs. proteins/peptides,
  and how to reconcile pathology names across databases into the 5 fixed DFU
  pathology categories.
- How "weak" vs. "strong" confidence is determined from raw API data
  (e.g. binding evidence score thresholds).
- Tech stack for the local web page (plain HTML/JS vs. a small framework) —
  deferred to the implementation plan.
