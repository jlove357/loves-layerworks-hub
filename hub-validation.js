const path = require('node:path');
const {
  SCHEMA_VERSION, UUID_PATTERN, HEX_PATTERN, DEFAULT_SETTINGS, asText, requiredText,
  finiteNumber, nullableNumber, nullableDate, timestamp
} = require('./hub-config');

function normalizeSettings(settings) {
  return {
    lowStockThresholdG: finiteNumber(
      settings?.lowStockThresholdG ?? DEFAULT_SETTINGS.lowStockThresholdG,
      'Low-stock threshold',
      { minimum: 0 }
    ),
    machineRatePerHour: finiteNumber(
      settings?.machineRatePerHour ?? DEFAULT_SETTINGS.machineRatePerHour,
      'Machine rate',
      { minimum: 0 }
    ),
    defaultDesignFee: finiteNumber(
      settings?.defaultDesignFee ?? DEFAULT_SETTINGS.defaultDesignFee,
      'Default design fee',
      { minimum: 0 }
    ),
    materialMarkupPercent: finiteNumber(
      settings?.materialMarkupPercent ?? DEFAULT_SETTINGS.materialMarkupPercent,
      'Material markup',
      { minimum: 0 }
    ),
    targetMarginPercent: finiteNumber(
      settings?.targetMarginPercent ?? DEFAULT_SETTINGS.targetMarginPercent,
      'Target margin',
      { minimum: 0, maximum: 99.99 }
    ),
    galleryBrandLabel: asText(settings?.galleryBrandLabel) || DEFAULT_SETTINGS.galleryBrandLabel
  };
}

function normalizeManagedRelativePath(value) {
  const text = asText(value).replaceAll('\\', '/');
  if (!text) return null;
  if (path.isAbsolute(text) || text.startsWith('../') || text.includes('/../')) {
    throw new Error('Managed image paths must stay inside the Hub folder.');
  }
  if (!text.startsWith('images/')) throw new Error('Managed image paths must begin with images/.');
  return text;
}

function normalizeFilament(item, index) {
  const prefix = `Roll ${index + 1}`;
  const now = new Date().toISOString();
  const id = requiredText(item?.id, `${prefix} ID`);
  if (!UUID_PATTERN.test(id)) throw new Error(`${prefix} has an invalid system ID.`);

  const startingFilamentWeightG = finiteNumber(
    item?.startingFilamentWeightG,
    `${prefix} starting filament weight`,
    { minimum: 0.01 }
  );
  const currentFilamentWeightG = finiteNumber(
    item?.currentFilamentWeightG,
    `${prefix} current filament weight`,
    { minimum: 0 }
  );
  if (currentFilamentWeightG > startingFilamentWeightG) {
    throw new Error(`${prefix} current filament weight cannot exceed its starting weight.`);
  }

  const colorHex = requiredText(item?.colorHex, `${prefix} display color`).toLowerCase();
  if (!HEX_PATTERN.test(colorHex)) throw new Error(`${prefix} display color must be a six-digit hex color.`);

  return {
    id,
    rollCode: requiredText(item?.rollCode, `${prefix} roll code`),
    brand: requiredText(item?.brand, `${prefix} brand`),
    material: requiredText(item?.material, `${prefix} material`),
    colorName: requiredText(item?.colorName, `${prefix} color name`),
    colorHex,
    startingFilamentWeightG,
    currentFilamentWeightG,
    spoolTareWeightG: nullableNumber(item?.spoolTareWeightG, `${prefix} spool tare weight`, { minimum: 0 }),
    purchaseCost: finiteNumber(item?.purchaseCost ?? 0, `${prefix} purchase cost`, { minimum: 0 }),
    purchaseDate: nullableDate(item?.purchaseDate, `${prefix} purchase date`),
    binLocation: asText(item?.binLocation),
    tdStock: nullableNumber(item?.tdStock, `${prefix} stock TD`, { minimum: 0 }),
    tdMeasured: nullableNumber(item?.tdMeasured, `${prefix} measured TD`, { minimum: 0 }),
    tdMeasuredDate: nullableDate(item?.tdMeasuredDate, `${prefix} measured TD date`),
    swatchPhotoPath: normalizeManagedRelativePath(item?.swatchPhotoPath),
    notes: String(item?.notes ?? '').trim(),
    archived: Boolean(item?.archived),
    createdAt: timestamp(item?.createdAt, now),
    updatedAt: timestamp(item?.updatedAt, now)
  };
}

function normalizeHubData(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Hub data must be one complete object.');
  }
  if (Number(input.schemaVersion ?? SCHEMA_VERSION) !== SCHEMA_VERSION) {
    throw new Error(`Unsupported data schema version: ${input.schemaVersion}.`);
  }
  if (!Array.isArray(input.filaments)) throw new Error('The filament collection is missing or invalid.');
  if (!Array.isArray(input.projects)) throw new Error('The project collection is missing or invalid.');

  const filaments = input.filaments.map(normalizeFilament);
  const ids = new Set();
  const rollCodes = new Set();
  for (const roll of filaments) {
    if (ids.has(roll.id)) throw new Error(`Duplicate filament ID: ${roll.id}.`);
    ids.add(roll.id);
    const codeKey = roll.rollCode.toLocaleLowerCase();
    if (rollCodes.has(codeKey)) throw new Error(`Roll code ${roll.rollCode} is already in use.`);
    rollCodes.add(codeKey);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: timestamp(input.updatedAt, new Date().toISOString()),
    settings: normalizeSettings(input.settings),
    filaments,
    projects: structuredClone(input.projects)
  };
}


module.exports = { normalizeManagedRelativePath, normalizeHubData };
