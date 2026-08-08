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

const svg = typeof document !== 'undefined' ? d3.select('#network-canvas') : null;
const emptyState = typeof document !== 'undefined' ? document.getElementById('network-empty-state') : null;

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

if (selectEl) {
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
}
