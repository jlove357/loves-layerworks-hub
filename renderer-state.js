const $ = (selector) => document.querySelector(selector);
const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];

const state = {
  data: null,
  dataPath: '',
  backupPath: '',
  backups: [],
  editingId: null,
  subtractingId: null,
  selectedSwatch: null,
  removeExistingSwatch: false,
  saving: false,
  loadFailed: false
};

function activateTab(name, focus = false) {
  tabs.forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  });
  panels.forEach((panel) => {
    panel.hidden = panel.id !== `${name}-panel`;
  });
  const tab = tabs.find((item) => item.dataset.tab === name);
  $('#pageTitle').textContent = tab?.dataset.title || 'Workspace';
}

function setStatus(text, tone = 'neutral') {
  $('#status').textContent = text;
  $('#status').dataset.tone = tone;
}

function formatGrams(value) {
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })} g`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
}

function remainingRollValue(roll) {
  const starting = Number(roll.startingFilamentWeightG);
  const current = Number(roll.currentFilamentWeightG);
  const cost = Number(roll.purchaseCost);
  if (!(starting > 0) || !Number.isFinite(current) || !Number.isFinite(cost)) return 0;
  return cost * current / starting;
}

function rollIsReferenced(rollId) {
  return state.data?.projects?.some((project) => {
    const usedForQuote = Array.isArray(project?.filamentUsage)
      && project.filamentUsage.some((usage) => usage?.filamentId === rollId);
    const usedForPalette = Array.isArray(project?.paletteSelections)
      && project.paletteSelections.some((selection) => selection?.filamentId === rollId);
    return usedForQuote || usedForPalette;
  }) || false;
}

function filteredRolls() {
  if (!state.data) return [];
  const query = $('#searchRolls').value.trim().toLocaleLowerCase();
  const statusFilter = $('#statusFilter').value;
  const lowStockOnly = $('#lowStockOnly').checked;
  const threshold = Number(state.data.settings.lowStockThresholdG) || 0;

  return state.data.filaments
    .filter((roll) => {
      if (statusFilter === 'active' && roll.archived) return false;
      if (statusFilter === 'archived' && !roll.archived) return false;
      if (lowStockOnly && Number(roll.currentFilamentWeightG) >= threshold) return false;
      if (!query) return true;
      return [roll.rollCode, roll.brand, roll.material, roll.colorName, roll.binLocation]
        .some((value) => String(value || '').toLocaleLowerCase().includes(query));
    })
    .sort((a, b) => {
      if (a.archived !== b.archived) return Number(a.archived) - Number(b.archived);
      return a.colorName.localeCompare(b.colorName, undefined, { sensitivity: 'base' });
    });
}

function createTextElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function createDetail(label, value) {
  const wrapper = document.createElement('div');
  wrapper.append(createTextElement('dt', '', label), createTextElement('dd', '', value));
  return wrapper;
}

function createButton(label, action, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = action;
  button.textContent = label;
  if (className) button.className = className;
  return button;
}

async function loadManagedImageInto(img, relativePath) {
  const result = await window.layerWorks.readManagedImage(relativePath);
  if (result?.ok && result.dataUrl) {
    img.src = result.dataUrl;
  } else {
    img.replaceWith(createTextElement('div', 'roll-swatch missing-swatch', 'No photo'));
  }
}
