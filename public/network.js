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
