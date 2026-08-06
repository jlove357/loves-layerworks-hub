const { dialog } = require('electron');
const fs = require('node:fs/promises');
const { SCHEMA_VERSION, hubPaths } = require('./hub-config');
const { normalizeHubData } = require('./hub-validation');
const { readJsonFile, loadHubData, persistHubData, listValidBackups } = require('./hub-persistence');

async function exportInventory() {
  const loaded = await loadHubData();
  if (!loaded.ok) throw new Error(loaded.error);
  const payload = {
    exportType: 'loves-layerworks-inventory',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    filaments: loaded.data.filaments
  };
  const result = await dialog.showSaveDialog({
    title: 'Export filament inventory',
    defaultPath: `loves-layerworks-inventory-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON files', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.writeFile(result.filePath, JSON.stringify(payload, null, 2), 'utf8');
  const verified = await readJsonFile(result.filePath);
  if (verified.exportType !== payload.exportType || !Array.isArray(verified.filaments)) {
    throw new Error('The exported inventory file could not be verified.');
  }
  return { canceled: false, path: result.filePath, rollCount: payload.filaments.length };
}

function referencedFilamentIds(projects) {
  const ids = new Set();
  for (const project of projects) {
    if (!Array.isArray(project?.filamentUsage)) continue;
    for (const usage of project.filamentUsage) {
      if (usage?.filamentId) ids.add(String(usage.filamentId));
    }
  }
  return ids;
}

async function importInventory() {
  const result = await dialog.showOpenDialog({
    title: 'Import filament inventory',
    properties: ['openFile'],
    filters: [{ name: 'JSON files', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };

  const imported = await readJsonFile(result.filePaths[0]);
  if (imported?.exportType !== 'loves-layerworks-inventory') {
    throw new Error('This is not a Love\'s LayerWorks inventory export.');
  }
  const importVersion = Number(imported.schemaVersion);
  if (![1, SCHEMA_VERSION].includes(importVersion) || !Array.isArray(imported.filaments)) {
    throw new Error('The inventory export schema is unsupported or incomplete.');
  }

  const loaded = await loadHubData();
  if (!loaded.ok) throw new Error(loaded.error);
  const candidate = structuredClone(loaded.data);
  candidate.filaments = imported.filaments;
  const normalized = normalizeHubData(candidate);
  const importedIds = new Set(normalized.filaments.map((roll) => roll.id));
  const missingReferences = [...referencedFilamentIds(normalized.projects)].filter((id) => !importedIds.has(id));
  if (missingReferences.length) {
    throw new Error('Import rejected because one or more existing projects reference rolls missing from the imported inventory.');
  }

  const saved = await persistHubData(normalized);
  return {
    canceled: false,
    data: saved,
    path: hubPaths().dataFile,
    rollCount: saved.filaments.length,
    backups: await listValidBackups()
  };
}

module.exports = { exportInventory, importInventory };
