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
