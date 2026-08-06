const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const SCHEMA_VERSION = 1;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

const DEFAULT_SETTINGS = Object.freeze({
  lowStockThresholdG: 200,
  machineRatePerHour: 0,
  defaultDesignFee: 0,
  materialMarkupPercent: 0,
  targetMarginPercent: 0,
  galleryBrandLabel: "Love's LayerWorks"
});

function createDefaultData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    settings: { ...DEFAULT_SETTINGS },
    filaments: [],
    projects: []
  };
}

function hubRootPath() {
  return path.join(app.getPath('documents'), "Love's LayerWorks Hub");
}

function hubDataDirectory() {
  return path.join(hubRootPath(), 'data');
}

function hubDataPath() {
  return path.join(hubDataDirectory(), 'hub-data.json');
}

function asText(value) {
  return String(value ?? '').trim();
}

function requiredText(value, label) {
  const text = asText(value);
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function finiteNumber(value, label, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a number.`);
  if (options.minimum !== undefined && number < options.minimum) {
    throw new Error(`${label} cannot be less than ${options.minimum}.`);
  }
  if (options.maximum !== undefined && number > options.maximum) {
    throw new Error(`${label} cannot be greater than ${options.maximum}.`);
  }
  return number;
}

function nullableNumber(value, label, options = {}) {
  if (value === null || value === undefined || value === '') return null;
  return finiteNumber(value, label, options);
}

function nullableDate(value, label) {
  const text = asText(value);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw new Error(`${label} must be a valid date.`);
  }
  return text;
}

function timestamp(value, fallback) {
  const text = asText(value);
  if (!text || Number.isNaN(Date.parse(text))) return fallback;
  return new Date(text).toISOString();
}

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

function normalizeFilament(item, index) {
  const prefix = `Roll ${index + 1}`;
  const now = new Date().toISOString();
  const id = requiredText(item?.id, `${prefix} ID`);

  if (!UUID_PATTERN.test(id)) {
    throw new Error(`${prefix} has an invalid system ID.`);
  }

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
    throw new Error(`${prefix} current filament weight cannot exceed its starting filament weight.`);
  }

  const colorHex = requiredText(item?.colorHex, `${prefix} display color`);
  if (!HEX_PATTERN.test(colorHex)) {
    throw new Error(`${prefix} display color must be a six-digit hex color.`);
  }

  return {
    id,
    rollCode: requiredText(item?.rollCode, `${prefix} roll code`),
    brand: requiredText(item?.brand, `${prefix} brand`),
    material: requiredText(item?.material, `${prefix} material`),
    colorName: requiredText(item?.colorName, `${prefix} color name`),
    colorHex: colorHex.toLowerCase(),
    startingFilamentWeightG,
    currentFilamentWeightG,
    spoolTareWeightG: nullableNumber(item?.spoolTareWeightG, `${prefix} spool tare weight`, { minimum: 0 }),
    purchaseCost: finiteNumber(item?.purchaseCost ?? 0, `${prefix} purchase cost`, { minimum: 0 }),
    purchaseDate: nullableDate(item?.purchaseDate, `${prefix} purchase date`),
    binLocation: asText(item?.binLocation),
    tdStock: nullableNumber(item?.tdStock, `${prefix} stock TD`, { minimum: 0 }),
    tdMeasured: nullableNumber(item?.tdMeasured, `${prefix} measured TD`, { minimum: 0 }),
    tdMeasuredDate: nullableDate(item?.tdMeasuredDate, `${prefix} measured TD date`),
    swatchPhotoPath: asText(item?.swatchPhotoPath) || null,
    notes: String(item?.notes ?? '').trim(),
    archived: Boolean(item?.archived),
    createdAt: timestamp(item?.createdAt, now),
    updatedAt: timestamp(item?.updatedAt, now)
  };
}

function normalizeHubData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Hub data must be one complete object.');
  }

  if (Number(data.schemaVersion ?? SCHEMA_VERSION) !== SCHEMA_VERSION) {
    throw new Error(`Unsupported data schema version: ${data.schemaVersion}.`);
  }

  if (!Array.isArray(data.filaments)) throw new Error('The filament collection is missing or invalid.');
  if (!Array.isArray(data.projects)) throw new Error('The project collection is missing or invalid.');

  const filaments = data.filaments.map(normalizeFilament);
  const rollCodes = new Set();

  filaments.forEach((roll) => {
    const key = roll.rollCode.toLocaleLowerCase();
    if (rollCodes.has(key)) throw new Error(`Roll code ${roll.rollCode} is already in use.`);
    rollCodes.add(key);
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: timestamp(data.updatedAt, new Date().toISOString()),
    settings: normalizeSettings(data.settings),
    filaments,
    projects: structuredClone(data.projects)
  };
}

async function readHubData(filePath = hubDataPath()) {
  const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
  return normalizeHubData(parsed);
}

async function persistHubData(input) {
  const safe = normalizeHubData(input);
  safe.updatedAt = new Date().toISOString();

  await fs.mkdir(hubDataDirectory(), { recursive: true });

  const temporaryPath = path.join(hubDataDirectory(), `hub-data.${process.pid}.tmp`);

  try {
    await fs.writeFile(temporaryPath, JSON.stringify(safe, null, 2), 'utf8');
    const verifiedTemporary = await readHubData(temporaryPath);

    await fs.copyFile(temporaryPath, hubDataPath());
    const verifiedWorking = await readHubData(hubDataPath());

    if (JSON.stringify(verifiedTemporary) !== JSON.stringify(verifiedWorking)) {
      throw new Error('The saved data did not match the verified temporary copy.');
    }

    return verifiedWorking;
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
  }
}

async function loadHubData() {
  try {
    return {
      ok: true,
      data: await readHubData(),
      path: hubDataPath(),
      created: false
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      const data = await persistHubData(createDefaultData());
      return { ok: true, data, path: hubDataPath(), created: true };
    }

    return {
      ok: false,
      path: hubDataPath(),
      error: `The local Hub data could not be loaded: ${error.message}`
    };
  }
}

async function saveHubData(_event, data) {
  const saved = await persistHubData(data);
  return {
    ok: true,
    data: saved,
    path: hubDataPath(),
    savedAt: saved.updatedAt
  };
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1040,
    minHeight: 700,
    title: "Love's LayerWorks Hub",
    backgroundColor: '#0b0812',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.loadFile('index.html');
}

app.whenReady().then(() => {
  ipcMain.handle('hub:load-data', loadHubData);
  ipcMain.handle('hub:save-data', saveHubData);
  ipcMain.handle('hub:data-path', () => hubDataPath());

  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length || createWindow());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
