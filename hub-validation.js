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
const PRODUCTION_FILE_ROLES = new Set([
  'final_print',
  'bambu_project',
  'stl_model',
  'hueforge_project',
  'chroma_canvas_project',
  'source_artwork',
  'other'
]);
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

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

function normalizeProductionRelativePath(value, projectId = null) {
  const text = asText(value).replaceAll('\\', '/');
  if (!text) return null;
  if (path.isAbsolute(text) || text.startsWith('../') || text.includes('/../')) {
    throw new Error('Production file paths must stay inside the Hub folder.');
  }
  const parts = text.split('/');
  if (parts.length !== 5 || parts[0] !== 'files' || parts[1] !== 'projects' || parts[3] !== 'production' || !parts[4]) {
    throw new Error('Production file paths must use files/projects/<project-id>/production/<file>.');
  }
  if (!UUID_PATTERN.test(parts[2])) throw new Error('Production file paths contain an invalid project ID.');
  if (projectId && parts[2] !== projectId) throw new Error('Production file path does not belong to its project.');
  if (/[\\/]/.test(parts[4])) throw new Error('Production stored filenames cannot contain folder separators.');
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
    gramsEstimated: finiteNumber(item?.gramsEstimated ?? 0, `${prefix} slicer grams`, { minimum: 0 }),
    gramsActual: nullableNumber(item?.gramsActual, `${prefix} legacy actual grams`, { minimum: 0 }),
    printOrder: nullableNumber(item?.printOrder, `${prefix} print order`, { minimum: 0 }),
    swapLayer: nullableNumber(item?.swapLayer, `${prefix} swap layer`, { minimum: 0 })
  };
}

function normalizePaletteSelection(item, index, filamentIds, projectPrefix) {
  const prefix = `${projectPrefix} palette color ${index + 1}`;
  const filamentId = requiredText(item?.filamentId, `${prefix} filament ID`);
  if (!filamentIds.has(filamentId)) {
    throw new Error(`${prefix} references a roll that does not exist.`);
  }
  const sourceColorHex = requiredText(item?.sourceColorHex, `${prefix} source color`).toLowerCase();
  if (!HEX_PATTERN.test(sourceColorHex)) {
    throw new Error(`${prefix} source color must be a six-digit hex color.`);
  }
  return { filamentId, sourceColorHex };
}

function normalizeDeductionUsage(item, index, filamentIds, projectPrefix) {
  const prefix = `${projectPrefix} inventory deduction ${index + 1}`;
  const filamentId = requiredText(item?.filamentId, `${prefix} filament ID`);
  if (!filamentIds.has(filamentId)) {
    throw new Error(`${prefix} references a roll that does not exist.`);
  }
  return {
    filamentId,
    grams: finiteNumber(item?.grams, `${prefix} grams`, { minimum: 0.01 })
  };
}

function normalizeProductionFile(item, index, projectId, projectPrefix) {
  const prefix = `${projectPrefix} production file ${index + 1}`;
  const now = new Date().toISOString();
  const id = requiredText(item?.id, `${prefix} ID`);
  if (!UUID_PATTERN.test(id)) throw new Error(`${prefix} has an invalid system ID.`);

  const originalFileName = requiredText(item?.originalFileName, `${prefix} original filename`);
  if (/[\\/]/.test(originalFileName)) throw new Error(`${prefix} original filename cannot contain folder separators.`);
  const storedFileName = requiredText(item?.storedFileName, `${prefix} stored filename`);
  if (/[\\/]/.test(storedFileName)) throw new Error(`${prefix} stored filename cannot contain folder separators.`);
  if (!storedFileName.startsWith(`${id}_`)) throw new Error(`${prefix} stored filename must begin with its file ID.`);

  const relativePath = normalizeProductionRelativePath(item?.relativePath, projectId);
  if (!relativePath || relativePath.split('/').at(-1) !== storedFileName) {
    throw new Error(`${prefix} stored filename does not match its managed path.`);
  }

  const role = asText(item?.role) || 'other';
  if (!PRODUCTION_FILE_ROLES.has(role)) throw new Error(`${prefix} has an unsupported role: ${role}.`);
  const sha256 = requiredText(item?.sha256, `${prefix} SHA256`).toLowerCase();
  if (!SHA256_PATTERN.test(sha256)) throw new Error(`${prefix} SHA256 must contain 64 hexadecimal characters.`);

  const extension = asText(item?.extension).toLowerCase();
  if (extension && (!extension.startsWith('.') || /[\\/]/.test(extension) || extension.length > 24)) {
    throw new Error(`${prefix} extension is invalid.`);
  }

  return {
    id,
    label: asText(item?.label) || originalFileName,
    role,
    originalFileName,
    storedFileName,
    relativePath,
    extension,
    sizeBytes: finiteNumber(item?.sizeBytes, `${prefix} size`, { minimum: 1 }),
    sha256,
    isPrimary: Boolean(item?.isPrimary),
    notes: String(item?.notes ?? '').trim(),
    addedAt: timestamp(item?.addedAt, now)
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

  const paletteSource = Array.isArray(item?.paletteSelections) ? item.paletteSelections : [];
  if (paletteSource.length > 12) throw new Error(`${prefix} cannot save more than 12 palette colors.`);
  const paletteSelections = paletteSource.map((selection, paletteIndex) => (
    normalizePaletteSelection(selection, paletteIndex, filamentIds, prefix)
  ));
  const seenPaletteFilaments = new Set();
  for (const selection of paletteSelections) {
    if (seenPaletteFilaments.has(selection.filamentId)) {
      throw new Error(`${prefix} uses the same physical roll more than once in its saved palette.`);
    }
    seenPaletteFilaments.add(selection.filamentId);
  }

  const deductionSource = Array.isArray(item?.inventoryDeductedUsage) ? item.inventoryDeductedUsage : [];
  const inventoryDeductedUsage = deductionSource.map((entry, deductionIndex) => (
    normalizeDeductionUsage(entry, deductionIndex, filamentIds, prefix)
  ));

  const productionSource = Array.isArray(item?.productionFiles) ? item.productionFiles : [];
  const productionFiles = productionSource.map((entry, productionIndex) => (
    normalizeProductionFile(entry, productionIndex, id, prefix)
  ));
  const productionFileIds = new Set();
  const productionPaths = new Set();
  let primaryCount = 0;
  for (const productionFile of productionFiles) {
    if (productionFileIds.has(productionFile.id)) throw new Error(`${prefix} contains a duplicate production file ID.`);
    if (productionPaths.has(productionFile.relativePath)) throw new Error(`${prefix} contains a duplicate production file path.`);
    productionFileIds.add(productionFile.id);
    productionPaths.add(productionFile.relativePath);
    if (productionFile.isPrimary) primaryCount += 1;
  }
  if (primaryCount > 1) throw new Error(`${prefix} can only have one primary production file.`);

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
    paletteSelections,
    productionFiles,
    estimatedTimeMinutes: finiteNumber(item?.estimatedTimeMinutes ?? 0, `${prefix} slicer time`, { minimum: 0 }),
    actualTimeMinutes: nullableNumber(item?.actualTimeMinutes, `${prefix} legacy actual time`, { minimum: 0 }),
    estimatedFilamentCost: finiteNumber(item?.estimatedFilamentCost ?? 0, `${prefix} slicer filament cost`, { minimum: 0 }),
    actualFilamentCost: nullableNumber(item?.actualFilamentCost, `${prefix} legacy actual filament cost`, { minimum: 0 }),
    otherCosts: finiteNumber(item?.otherCosts ?? 0, `${prefix} other costs`, { minimum: 0 }),
    floorPrice: finiteNumber(item?.floorPrice ?? item?.suggestedPrice ?? 0, `${prefix} floor price`, { minimum: 0 }),
    sellPrice: nullableNumber(item?.sellPrice, `${prefix} list price`, { minimum: 0 }),
    dateCreated: timestamp(item?.dateCreated ?? item?.createdAt, now),
    dateQuoted: nullableTimestamp(item?.dateQuoted, `${prefix} quoted date`),
    datePrinted: nullableTimestamp(item?.datePrinted, `${prefix} printed date`),
    dateDelivered: nullableTimestamp(item?.dateDelivered, `${prefix} delivered date`),
    inventoryDeductedAt: nullableTimestamp(item?.inventoryDeductedAt, `${prefix} inventory deduction date`),
    inventoryDeductedUsage,
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
  PRODUCTION_FILE_ROLES,
  normalizeSettings,
  normalizeManagedRelativePath,
  normalizeProductionRelativePath,
  normalizeHubData
};
