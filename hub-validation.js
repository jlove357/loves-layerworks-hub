const path = require('node:path');
const crypto = require('node:crypto');
const {
  SCHEMA_VERSION,
  UUID_PATTERN,
  HEX_PATTERN,
  DEFAULT_SETTINGS,
  asText,
  requiredText,
  finiteNumber,
  nullableNumber,
  nullableDate,
  timestamp,
  nullableTimestamp
} = require('./hub-config');

const SUPPORTED_SCHEMA_VERSIONS = new Set([1, SCHEMA_VERSION]);
const PROJECT_STATUSES = new Set([
  'draft', 'quoted', 'approved', 'printing', 'finished', 'delivered', 'gallery', 'cancelled'
]);

function migratedMargin(settings, sourceVersion) {
  const raw = settings?.targetMarginPercent;
  if (sourceVersion === 1) {
    const legacy = Number(raw);
    if (!Number.isFinite(legacy) || legacy <= 0) return DEFAULT_SETTINGS.targetMarginPercent;
    return legacy >= 1 ? legacy / 100 : legacy;
  }
  return raw ?? DEFAULT_SETTINGS.targetMarginPercent;
}

function normalizeSettings(settings, sourceVersion = SCHEMA_VERSION) {
  return {
    lowStockThresholdG: finiteNumber(
      settings?.lowStockThresholdG ?? DEFAULT_SETTINGS.lowStockThresholdG,
      'Low-stock threshold',
      { minimum: 0 }
    ),
    galleryBrandLabel: asText(settings?.galleryBrandLabel) || DEFAULT_SETTINGS.galleryBrandLabel,
    electricityCostPerKwh: finiteNumber(
      settings?.electricityCostPerKwh ?? DEFAULT_SETTINGS.electricityCostPerKwh,
      'Electricity cost per kWh',
      { minimum: 0 }
    ),
    machineWearCostPerHour: finiteNumber(
      settings?.machineWearCostPerHour ?? DEFAULT_SETTINGS.machineWearCostPerHour,
      'Machine wear cost per hour',
      { minimum: 0 }
    ),
    avgPrinterWattage: finiteNumber(
      settings?.avgPrinterWattage ?? DEFAULT_SETTINGS.avgPrinterWattage,
      'Average printer wattage',
      { minimum: 0 }
    ),
    failureRatePercent: finiteNumber(
      settings?.failureRatePercent ?? DEFAULT_SETTINGS.failureRatePercent,
      'Failure-rate decimal',
      { minimum: 0, maximum: 0.99 }
    ),
    targetMarginPercent: finiteNumber(
      migratedMargin(settings, sourceVersion),
      'Target-margin decimal',
      { minimum: 0, maximum: 0.99 }
    ),
    boxCost: finiteNumber(
      settings?.boxCost ?? DEFAULT_SETTINGS.boxCost,
      'Box cost',
      { minimum: 0 }
    ),
    packingLaborMinutes: finiteNumber(
      settings?.packingLaborMinutes ?? DEFAULT_SETTINGS.packingLaborMinutes,
      'Packing labor minutes',
      { minimum: 0 }
    ),
    packingLaborRatePerHour: finiteNumber(
      settings?.packingLaborRatePerHour ?? DEFAULT_SETTINGS.packingLaborRatePerHour,
      'Packing labor rate',
      { minimum: 0 }
    ),
    defaultFrameCost: finiteNumber(
      settings?.defaultFrameCost ?? DEFAULT_SETTINGS.defaultFrameCost,
      'Default frame cost',
      { minimum: 0 }
    ),
    defaultDesignFee: finiteNumber(
      settings?.defaultDesignFee ?? DEFAULT_SETTINGS.defaultDesignFee,
      'Default design fee',
      { minimum: 0 }
    )
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

function normalizeUsage(item, index, filamentIds, projectPrefix) {
  const prefix = `${projectPrefix} filament ${index + 1}`;
  const filamentId = requiredText(item?.filamentId, `${prefix} ID`);
  if (!filamentIds.has(filamentId)) {
    throw new Error(`${prefix} references a roll that does not exist.`);
  }
  return {
    filamentId,
    gramsEstimated: finiteNumber(item?.gramsEstimated ?? 0, `${prefix} estimated grams`, { minimum: 0 }),
    gramsActual: nullableNumber(item?.gramsActual, `${prefix} actual grams`, { minimum: 0 }),
    printOrder: nullableNumber(item?.printOrder, `${prefix} print order`, { minimum: 0 }),
    swapLayer: nullableNumber(item?.swapLayer, `${prefix} swap layer`, { minimum: 0 })
  };
}

function normalizeProject(item, index, filamentIds) {
  const prefix = `Project ${index + 1}`;
  const now = new Date().toISOString();
  const id = asText(item?.id) || crypto.randomUUID();
  if (!UUID_PATTERN.test(id)) throw new Error(`${prefix} has an invalid system ID.`);

  const status = asText(item?.status) || 'draft';
  if (!PROJECT_STATUSES.has(status)) throw new Error(`${prefix} has an unsupported status: ${status}.`);

  const usageSource = Array.isArray(item?.filamentUsage) ? item.filamentUsage : [];
  const filamentUsage = usageSource.map((usage, usageIndex) => normalizeUsage(usage, usageIndex, filamentIds, prefix));
  const seenFilaments = new Set();
  for (const usage of filamentUsage) {
    if (seenFilaments.has(usage.filamentId)) throw new Error(`${prefix} uses the same roll more than once.`);
    seenFilaments.add(usage.filamentId);
  }

  return {
    id,
    customerName: asText(item?.customerName),
    status,
    isCustom: Boolean(item?.isCustom),
    originalImagePath: normalizeManagedRelativePath(item?.originalImagePath),
    finishedImagePath: normalizeManagedRelativePath(item?.finishedImagePath),
    widthMm: nullableNumber(item?.widthMm, `${prefix} width`, { minimum: 0.01 }),
    heightMm: nullableNumber(item?.heightMm, `${prefix} height`, { minimum: 0.01 }),
    filamentUsage,
    estimatedTimeMinutes: finiteNumber(item?.estimatedTimeMinutes ?? 0, `${prefix} estimated time`, { minimum: 0 }),
    actualTimeMinutes: nullableNumber(item?.actualTimeMinutes, `${prefix} actual time`, { minimum: 0 }),
    estimatedFilamentCost: finiteNumber(item?.estimatedFilamentCost ?? 0, `${prefix} estimated filament cost`, { minimum: 0 }),
    actualFilamentCost: nullableNumber(item?.actualFilamentCost, `${prefix} actual filament cost`, { minimum: 0 }),
    otherCosts: finiteNumber(item?.otherCosts ?? 0, `${prefix} other costs`, { minimum: 0 }),
    floorPrice: finiteNumber(item?.floorPrice ?? item?.suggestedPrice ?? 0, `${prefix} floor price`, { minimum: 0 }),
    sellPrice: nullableNumber(item?.sellPrice, `${prefix} list price`, { minimum: 0 }),
    dateCreated: timestamp(item?.dateCreated ?? item?.createdAt, now),
    dateQuoted: nullableTimestamp(item?.dateQuoted, `${prefix} quoted date`),
    datePrinted: nullableTimestamp(item?.datePrinted, `${prefix} printed date`),
    dateDelivered: nullableTimestamp(item?.dateDelivered, `${prefix} delivered date`),
    captionDrafts: Array.isArray(item?.captionDrafts)
      ? item.captionDrafts.map((caption) => String(caption ?? '').trim()).filter(Boolean)
      : [],
    notes: String(item?.notes ?? '').trim(),
    updatedAt: timestamp(item?.updatedAt, now)
  };
}

function normalizeHubData(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Hub data must be one complete object.');
  }

  const sourceVersion = Number(input.schemaVersion ?? 1);
  if (!SUPPORTED_SCHEMA_VERSIONS.has(sourceVersion)) {
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

  const projects = input.projects.map((project, index) => normalizeProject(project, index, ids));
  const projectIds = new Set();
  for (const project of projects) {
    if (projectIds.has(project.id)) throw new Error(`Duplicate project ID: ${project.id}.`);
    projectIds.add(project.id);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: timestamp(input.updatedAt, new Date().toISOString()),
    settings: normalizeSettings(input.settings, sourceVersion),
    filaments,
    projects
  };
}

module.exports = {
  PROJECT_STATUSES,
  normalizeSettings,
  normalizeManagedRelativePath,
  normalizeHubData
};
