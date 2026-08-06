function createRollCard(roll) {
  const threshold = Number(state.data.settings.lowStockThresholdG) || 0;
  const lowStock = !roll.archived && Number(roll.currentFilamentWeightG) < threshold;
  const card = document.createElement('article');
  card.className = 'roll-card';
  card.dataset.id = roll.id;
  card.dataset.archived = String(roll.archived);

  const heading = document.createElement('div');
  heading.className = 'roll-heading';

  if (roll.swatchPhotoPath) {
    const image = document.createElement('img');
    image.className = 'roll-photo';
    image.alt = `${roll.colorName} swatch`;
    heading.append(image);
    loadManagedImageInto(image, roll.swatchPhotoPath).catch(() => {});
  } else {
    const swatch = document.createElement('input');
    swatch.type = 'color';
    swatch.className = 'roll-swatch';
    swatch.value = roll.colorHex;
    swatch.disabled = true;
    swatch.setAttribute('aria-label', `${roll.colorName} display color`);
    heading.append(swatch);
  }

  const identity = document.createElement('div');
  identity.className = 'roll-identity';
  identity.append(createTextElement('h3', '', roll.colorName), createTextElement('p', '', roll.rollCode));
  heading.append(identity);

  const badges = document.createElement('div');
  badges.className = 'roll-badges';
  badges.append(createTextElement('span', '', roll.brand), createTextElement('span', '', roll.material));
  if (lowStock) badges.append(createTextElement('span', 'warning-chip', 'Low stock'));
  if (roll.archived) badges.append(createTextElement('span', 'archived-chip', 'Archived'));
  if (roll.swatchPhotoPath) badges.append(createTextElement('span', '', 'Managed swatch'));
  heading.append(badges);

  const details = document.createElement('dl');
  details.className = 'roll-details';
  details.append(
    createDetail('Remaining', formatGrams(roll.currentFilamentWeightG)),
    createDetail('Starting', formatGrams(roll.startingFilamentWeightG)),
    createDetail('Location', roll.binLocation || 'Not assigned'),
    createDetail('Purchase cost', formatCurrency(roll.purchaseCost)),
    createDetail('Remaining value', formatCurrency(remainingRollValue(roll))),
    createDetail('Stock TD', roll.tdStock === null ? 'Not entered' : `${Number(roll.tdStock).toFixed(2)} mm`)
  );

  const actions = document.createElement('div');
  actions.className = 'roll-actions';
  const edit = createButton('Edit', 'edit');
  const subtract = createButton('Subtract weight', 'subtract');
  subtract.disabled = roll.archived || Number(roll.currentFilamentWeightG) <= 0;
  const archive = createButton(roll.archived ? 'Restore' : 'Archive', 'archive');
  const remove = createButton('Delete', 'delete', 'danger');
  actions.append(edit, subtract, archive, remove);

  card.append(heading, details, actions);
  return card;
}

function renderInventory() {
  if (!state.data) return;
  const active = state.data.filaments.filter((roll) => !roll.archived);
  const threshold = Number(state.data.settings.lowStockThresholdG) || 0;
  const low = active.filter((roll) => Number(roll.currentFilamentWeightG) < threshold);
  const totalWeight = active.reduce((sum, roll) => sum + Number(roll.currentFilamentWeightG || 0), 0);
  const totalValue = active.reduce((sum, roll) => sum + remainingRollValue(roll), 0);

  $('#activeRollCount').textContent = String(active.length);
  $('#lowStockCount').textContent = String(low.length);
  $('#lowStockLabel').textContent = `Below ${formatGrams(threshold)}`;
  $('#lowStockFilterText').textContent = `Under ${formatGrams(threshold)}`;
  $('#totalWeight').textContent = formatGrams(totalWeight);
  $('#remainingValue').textContent = formatCurrency(totalValue);

  const rolls = filteredRolls();
  const list = $('#inventoryList');
  list.replaceChildren(...rolls.map(createRollCard));

  const hasAny = state.data.filaments.length > 0;
  const noVisible = rolls.length === 0;
  $('#inventoryEmpty').hidden = !noVisible;
  $('#inventoryEmpty b').textContent = hasAny ? 'No rolls match these filters' : 'No rolls yet';
  $('#inventoryEmpty p').textContent = hasAny
    ? 'Clear the search or change the filters.'
    : 'Add your first physical filament roll to begin building Roll Brain.';
  $('#addFirstRoll').hidden = hasAny;
}

function renderBackups() {
  const count = state.backups.length;
  $('#backupCount').textContent = `${count} rolling backup${count === 1 ? '' : 's'}`;
  const select = $('#backupSelect');
  select.replaceChildren();
  if (!count) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No backups available';
    select.append(option);
  } else {
    for (const backup of state.backups) {
      const option = document.createElement('option');
      option.value = backup.fileName;
      const date = new Date(backup.modifiedAt || backup.savedAt);
      option.textContent = `${date.toLocaleString()} · ${backup.rollCount} roll${backup.rollCount === 1 ? '' : 's'}`;
      select.append(option);
    }
  }
  $('#restoreBackup').disabled = !count;
}

function renderAll() {
  renderInventory();
  renderBackups();
  $('#dataPath').textContent = state.dataPath || 'Unavailable';
  $('#backupPath').textContent = state.backupPath || 'Unavailable';
}

function setInventoryDisabled(disabled, message = '') {
  ['#addRoll', '#addRollHero', '#addFirstRoll', '#searchRolls', '#statusFilter', '#lowStockOnly', '#exportInventory', '#importInventory']
    .forEach((selector) => { $(selector).disabled = disabled; });
  $('#inventoryNotice').hidden = !message;
  $('#inventoryNotice').textContent = message;
  if (disabled) {
    $('#inventoryList').replaceChildren();
    $('#inventoryEmpty').hidden = true;
  }
}
