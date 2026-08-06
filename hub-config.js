const { app } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const SCHEMA_VERSION = 1;
const MAX_BACKUPS = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const MIME_BY_EXTENSION = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

const DEFAULT_SETTINGS = Object.freeze({
  lowStockThresholdG: 200,
  machineRatePerHour: 0,
  defaultDesignFee: 0,
  materialMarkupPercent: 0,
  targetMarginPercent: 0,
  galleryBrandLabel: "Love's LayerWorks"
});

function hubRootPath() {
  return path.join(app.getPath('documents'), "Love's LayerWorks Hub");
}

function hubPaths() {
  const root = hubRootPath();
  return {
    root,
    dataDir: path.join(root, 'data'),
    dataFile: path.join(root, 'data', 'hub-data.json'),
    previousFile: path.join(root, 'data', 'hub-data.previous.json'),
    swatchesDir: path.join(root, 'images', 'swatches'),
    originalsDir: path.join(root, 'images', 'originals'),
    finishedDir: path.join(root, 'images', 'finished'),
    exportsDir: path.join(root, 'exports'),
    backupDir: path.join(root, 'backups', 'hub-data')
  };
}

async function ensureHubStructure() {
  const paths = hubPaths();
  await Promise.all([
    fs.mkdir(paths.dataDir, { recursive: true }),
    fs.mkdir(paths.swatchesDir, { recursive: true }),
    fs.mkdir(paths.originalsDir, { recursive: true }),
    fs.mkdir(paths.finishedDir, { recursive: true }),
    fs.mkdir(paths.exportsDir, { recursive: true }),
    fs.mkdir(paths.backupDir, { recursive: true })
  ]);
  return paths;
}

function createDefaultData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    settings: { ...DEFAULT_SETTINGS },
    filaments: [],
    projects: []
  };
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


module.exports = {
  SCHEMA_VERSION, MAX_BACKUPS, UUID_PATTERN, HEX_PATTERN, IMAGE_EXTENSIONS, MIME_BY_EXTENSION,
  DEFAULT_SETTINGS, hubPaths, ensureHubStructure, createDefaultData, asText, requiredText,
  finiteNumber, nullableNumber, nullableDate, timestamp
};
