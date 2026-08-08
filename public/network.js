let ingredientsById = {};

const selectEl = typeof document !== 'undefined' ? document.getElementById('ingredient-select') : null;
const statusEl = typeof document !== 'undefined' ? document.getElementById('network-status') : null;

async function loadIngredientList() {
  const res = await fetch('/api/ingredients');
  const list = await res.json();
  ingredientsById = Object.fromEntries(list.map((i) => [i.id, i]));
  for (const ingredient of list) {
    if (selectEl) {
      const option = document.createElement('option');
      option.value = ingredient.id;
      option.textContent = ingredient.name;
      selectEl.appendChild(option);
    }
  }
  return list;
}

if (typeof document !== 'undefined') {
  loadIngredientList();
}

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
