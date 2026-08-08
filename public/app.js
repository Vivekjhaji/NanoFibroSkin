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

// Detail panel functions
const detailSection = document.getElementById('detail-section');
const detailContent = document.getElementById('detail-content');
const closeDetailBtn = document.getElementById('close-detail');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

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
    ? target.pathologies.map(escapeHtml).join(', ')
    : 'no known pathology link';
  const sourceList = target.sources
    .map((s) => `${escapeHtml(s.sourceDbName)}${s.pmids.length ? ` (PMID ${s.pmids.join(', ')})` : ''}`)
    .join('; ');
  const stringList = target.stringPartners
    .map((p) => `${escapeHtml(p.partnerName)} (${p.score.toFixed(2)})`)
    .join(', ');
  const interactionTypes = target.interactionTypes.map(escapeHtml).join(', ') || 'unspecified';

  return `
    <div class="target-card">
      <h3>${escapeHtml(target.geneSymbol)}${target.uniprot ? ` — ${escapeHtml(target.uniprot.proteinName)}` : ''}</h3>
      <p><strong>Interaction:</strong> ${interactionTypes}${target.score !== null ? ` (score ${target.score.toFixed(2)})` : ''}</p>
      <p><strong>Pathology:</strong> ${pathologyList}</p>
      ${sourceList ? `<p><strong>Evidence:</strong> ${sourceList}</p>` : ''}
      ${stringList ? `<p><strong>STRING interactors:</strong> ${stringList}</p>` : ''}
    </div>
  `;
}

function renderIngredientDetail(detail, focusPathology) {
  if (detail.error) {
    detailContent.innerHTML = `<p class="error">${escapeHtml(detail.error)}</p>`;
    detailSection.hidden = false;
    return;
  }
  const targets = focusPathology
    ? detail.targets.filter((t) => t.pathologies.includes(focusPathology))
    : detail.targets;

  detailContent.innerHTML = `
    <h2>${escapeHtml(detail.name)}</h2>
    <p><strong>Prep:</strong> ${escapeHtml(detail.prep)}</p>
    <p><strong>Role:</strong> ${escapeHtml(detail.role)}</p>
    ${focusPathology ? `<p class="focus-note">Showing targets linked to ${escapeHtml(focusPathology)}</p>` : ''}
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
