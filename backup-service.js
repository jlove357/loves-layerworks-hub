const { dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { hubPaths, ensureHubStructure, requiredText } = require('./hub-config');
const { readValidatedHubData, safeTimestamp, listValidBackups, persistHubData, loadHubData } = require('./hub-persistence');
const { getProductionStorageStatus } = require('./production-storage-service');

async function restoreBackup(_event, fileName) {
  const paths = await ensureHubStructure();
  const safeName = path.basename(requiredText(fileName, 'Backup file'));
  if (safeName !== fileName || !safeName.startsWith('hub-data-') || !safeName.endsWith('.json')) {
    throw new Error('The selected backup name is invalid.');
  }
  const source = path.join(paths.backupDir, safeName);
  const restoredData = await readValidatedHubData(source);

  const saved = await persistHubData(restoredData);
  return { ok: true, data: saved, path: paths.dataFile, backups: await listValidBackups() };
}

function isInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function copyDirectory(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyDirectory(from, to);
    else if (entry.isFile()) await fs.copyFile(from, to);
  }
}

async function exportFullBackup() {
  const paths = await ensureHubStructure();
  const loaded = await loadHubData();
  if (!loaded.ok) throw new Error(loaded.error);
  const storage = await getProductionStorageStatus();

  const result = await dialog.showOpenDialog({
    title: 'Choose where to save the full Hub backup',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const selected = path.resolve(result.filePaths[0]);
  if (isInside(paths.root, selected)) {
    throw new Error('Choose a destination outside the live Love\'s LayerWorks Hub folder.');
  }
  if (isInside(storage.root, selected)) {
    throw new Error('Choose a backup destination outside the live Production Files storage folder.');
  }

  const folderName = `Loves-LayerWorks-Hub-Backup-${safeTimestamp()}`;
  const destination = path.join(selected, folderName);
  await fs.mkdir(destination, { recursive: false });
  await fs.copyFile(paths.dataFile, path.join(destination, 'hub-data.json'));
  await copyDirectory(path.join(paths.root, 'images'), path.join(destination, 'images'));
  await copyDirectory(paths.exportsDir, path.join(destination, 'exports'));
  await copyDirectory(path.join(storage.root, 'projects'), path.join(destination, 'files', 'projects'));

  const productionFileCount = loaded.data.projects.reduce(
    (sum, project) => sum + (Array.isArray(project.productionFiles) ? project.productionFiles.length : 0),
    0
  );
  const manifest = {
    backupType: 'loves-layerworks-full-backup',
    schemaVersion: loaded.data.schemaVersion,
    exportedAt: new Date().toISOString(),
    rollCount: loaded.data.filaments.length,
    projectCount: loaded.data.projects.length,
    productionFileCount,
    productionStorageMode: storage.isDefault ? 'default' : 'custom',
    productionStorageSource: storage.root,
    includes: ['hub-data.json', 'images/swatches', 'images/originals', 'images/finished', 'exports', 'files/projects']
  };
  await fs.writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  await readValidatedHubData(path.join(destination, 'hub-data.json'));
  await Promise.all([
    fs.access(path.join(destination, 'images', 'swatches')),
    fs.access(path.join(destination, 'images', 'originals')),
    fs.access(path.join(destination, 'images', 'finished')),
    fs.access(path.join(destination, 'exports')),
    fs.access(path.join(destination, 'files', 'projects')),
    fs.access(path.join(destination, 'manifest.json'))
  ]);
  return { canceled: false, path: destination };
}

async function dataStatus() {
  const paths = await ensureHubStructure();
  let productionFilesDir = null;
  let productionStorageError = null;
  try {
    const storage = await getProductionStorageStatus();
    productionFilesDir = path.join(storage.root, 'projects');
  } catch (error) {
    productionStorageError = error.message;
  }
  return {
    root: paths.root,
    dataFile: paths.dataFile,
    backupDir: paths.backupDir,
    productionFilesDir,
    productionStorageError,
    backups: await listValidBackups()
  };
}

module.exports = { dataStatus, restoreBackup, exportFullBackup };
