function showFormError(message = '') {
  $('#rollFormError').textContent = message;
  $('#rollFormError').hidden = !message;
}

function setField(selector, value) {
  $(selector).value = value ?? '';
}

async function displayExistingSwatch(relativePath) {
  const preview = $('#swatchPreview');
  preview.replaceChildren(createTextElement('span', '', 'Loading swatch…'));
  const result = await window.layerWorks.readManagedImage(relativePath);
  preview.replaceChildren();
  if (result?.ok && result.dataUrl) {
    const image = document.createElement('img');
    image.src = result.dataUrl;
    image.alt = 'Current managed swatch';
    preview.append(image);
  } else {
    preview.append(createTextElement('span', '', 'Managed swatch unavailable'));
  }
}

function renderSwatchField() {
  const roll = state.editingId ? state.data.filaments.find((item) => item.id === state.editingId) : null;
  const preview = $('#swatchPreview');
  preview.replaceChildren();

  if (state.selectedSwatch?.dataUrl) {
    const image = document.createElement('img');
    image.src = state.selectedSwatch.dataUrl;
    image.alt = 'Selected swatch preview';
    preview.append(image);
    $('#swatchFileName').textContent = state.selectedSwatch.fileName;
  } else if (roll?.swatchPhotoPath && !state.removeExistingSwatch) {
    preview.append(createTextElement('span', '', 'Loading swatch…'));
    $('#swatchFileName').textContent = 'Current managed swatch';
    displayExistingSwatch(roll.swatchPhotoPath).catch(() => {});
  } else {
    preview.append(createTextElement('span', '', 'No swatch attached'));
    $('#swatchFileName').textContent = state.removeExistingSwatch ? 'Image will be removed when saved' : 'No file selected';
  }
  $('#removeSwatch').disabled = !state.selectedSwatch && !(roll?.swatchPhotoPath && !state.removeExistingSwatch);
}

function openRollDialog(id = null) {
  const roll = id ? state.data.filaments.find((item) => item.id === id) : null;
  state.editingId = roll?.id || null;
  state.selectedSwatch = null;
  state.removeExistingSwatch = false;

  $('#rollDialogTitle').textContent = roll ? `Edit ${roll.colorName}` : 'Add filament roll';
  $('#saveRoll').textContent = roll ? 'Save changes' : 'Add roll';
  setField('#rollCode', roll?.rollCode);
  setField('#brand', roll?.brand);
  setField('#material', roll?.material || 'PLA');
  setField('#colorName', roll?.colorName);
  setField('#colorHex', roll?.colorHex || '#7c5cff');
  setField('#startingWeight', roll?.startingFilamentWeightG ?? 1000);
  setField('#currentWeight', roll?.currentFilamentWeightG ?? 1000);
  setField('#spoolTare', roll?.spoolTareWeightG);
  setField('#purchaseCost', roll?.purchaseCost ?? 0);
  setField('#purchaseDate', roll?.purchaseDate);
  setField('#binLocation', roll?.binLocation);
  setField('#tdStock', roll?.tdStock);
  setField('#rollNotes', roll?.notes);
  showFormError();
  renderSwatchField();
  $('#rollDialog').showModal();
  $('#rollCode').focus();
}

function closeRollDialog() {
  state.editingId = null;
  state.selectedSwatch = null;
  state.removeExistingSwatch = false;
  $('#rollDialog').close();
}

function numericValue(selector, defaultValue = null) {
  const raw = $(selector).value;
  if (raw === '') return defaultValue;
  return Number(raw);
}

function buildRoll() {
  const existing = state.editingId ? state.data.filaments.find((roll) => roll.id === state.editingId) : null;
  const now = new Date().toISOString();
  const roll = {
    id: existing?.id || crypto.randomUUID(),
    rollCode: $('#rollCode').value.trim(),
    brand: $('#brand').value.trim(),
    material: $('#material').value.trim(),
    colorName: $('#colorName').value.trim(),
    colorHex: $('#colorHex').value,
    startingFilamentWeightG: numericValue('#startingWeight'),
    currentFilamentWeightG: numericValue('#currentWeight'),
    spoolTareWeightG: numericValue('#spoolTare'),
    purchaseCost: numericValue('#purchaseCost', 0),
    purchaseDate: $('#purchaseDate').value || null,
    binLocation: $('#binLocation').value.trim(),
    tdStock: numericValue('#tdStock'),
    tdMeasured: existing?.tdMeasured ?? null,
    tdMeasuredDate: existing?.tdMeasuredDate ?? null,
    swatchPhotoPath: state.removeExistingSwatch ? null : (existing?.swatchPhotoPath ?? null),
    notes: $('#rollNotes').value.trim(),
    archived: existing?.archived ?? false,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  if (!roll.rollCode || !roll.brand || !roll.material || !roll.colorName) {
    throw new Error('Roll code, brand, material, and color name are required.');
  }
  if (!(roll.startingFilamentWeightG > 0) || !(roll.currentFilamentWeightG >= 0)) {
    throw new Error('Enter valid non-negative filament weights.');
  }
  if (roll.currentFilamentWeightG > roll.startingFilamentWeightG) {
    throw new Error('Current filament weight cannot exceed starting weight.');
  }
  if (state.data.filaments.some((item) => (
    item.id !== roll.id && item.rollCode.toLocaleLowerCase() === roll.rollCode.toLocaleLowerCase()
  ))) {
    throw new Error(`Roll code ${roll.rollCode} is already in use.`);
  }
  return roll;
}
