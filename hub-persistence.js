const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { SCHEMA_VERSION, MAX_BACKUPS, hubPaths, ensureHubStructure, createDefaultData } = require('./hub-config');
const { normalizeHubData } = require('./hub-validation');

async function readJsonFile(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function readValidatedHubData(filePath) {
  return normalizeHubData(await readJsonFile(filePath));
}

function safeTimestamp(date = new Date()) {
  return date.toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function recoverInterruptedSave(paths) {
  const hasWorking = await fileExists(paths.dataFile);
  const hasPrevious = await fileExists(paths.previousFile);
  if (!hasWorking && hasPrevious) {
    await fs.rename(paths.previousFile, paths.dataFile);
    return;
  }
  if (hasWorking && hasPrevious) {
    try {
      await readValidatedHubData(paths.dataFile);
      await fs.rm(paths.previousFile, { force: true });
    } catch {
      const damagedPath = path.join(paths.dataDir, `hub-data-damaged-${safeTimestamp()}.json`);
      await fs.rename(paths.dataFile, damagedPath);
      await fs.rename(paths.previousFile, paths.dataFile);
    }
  }
}

async function listValidBackups() {
  const paths = await ensureHubStructure();
  const entries = await fs.readdir(paths.backupDir, { withFileTypes: true });
  const backups = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith('hub-data-') || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(paths.backupDir, entry.name);
    try {
      const data = await readValidatedHubData(filePath);
      const stats = await fs.stat(filePath);
      backups.push({
        fileName: entry.name,
        savedAt: data.updatedAt,
        modifiedAt: stats.mtime.toISOString(),
        rollCount: data.filaments.length,
        projectCount: data.projects.length
      });
    } catch {
      // Invalid backup files remain available for inspection but are not offered for restoration.
    }
  }
  return backups.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

async function pruneBackups() {
  const paths = hubPaths();
  const valid = await listValidBackups();
  for (const backup of valid.slice(MAX_BACKUPS)) {
    await fs.rm(path.join(paths.backupDir, backup.fileName), { force: true });
  }
}

async function createRollingBackup(paths) {
  if (!(await fileExists(paths.dataFile))) return null;
  const backupName = `hub-data-${safeTimestamp()}.json`;
  const destination = path.join(paths.backupDir, backupName);
  await fs.copyFile(paths.dataFile, destination);
  await readValidatedHubData(destination);
  return backupName;
}

async function persistHubData(input, options = {}) {
  const paths = await ensureHubStructure();
  await recoverInterruptedSave(paths);

  const safe = normalizeHubData(input);
  safe.updatedAt = new Date().toISOString();
  const temporaryPath = path.join(paths.dataDir, `hub-data-${process.pid}-${crypto.randomUUID()}.tmp`);
  let previousMoved = false;

  try {
    await fs.writeFile(temporaryPath, JSON.stringify(safe, null, 2), 'utf8');
    const verifiedTemporary = await readValidatedHubData(temporaryPath);

    if (options.createBackup !== false) await createRollingBackup(paths);

    if (await fileExists(paths.dataFile)) {
      await fs.rm(paths.previousFile, { force: true });
      await fs.rename(paths.dataFile, paths.previousFile);
      previousMoved = true;
    }

    await fs.rename(temporaryPath, paths.dataFile);
    const verifiedWorking = await readValidatedHubData(paths.dataFile);
    if (JSON.stringify(verifiedTemporary) !== JSON.stringify(verifiedWorking)) {
      throw new Error('The saved working file did not match the verified temporary file.');
    }

    await fs.rm(paths.previousFile, { force: true });
    previousMoved = false;
    await pruneBackups();

    return verifiedWorking;
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    if (previousMoved) {
      await fs.rm(paths.dataFile, { force: true }).catch(() => {});
      await fs.rename(paths.previousFile, paths.dataFile).catch(() => {});
    }
    throw error;
  }
}

async function loadHubData() {
  const paths = await ensureHubStructure();
  await recoverInterruptedSave(paths);
  try {
    const raw = await readJsonFile(paths.dataFile);
    const normalized = normalizeHubData(raw);
    if (Number(raw.schemaVersion ?? 1) !== SCHEMA_VERSION) {
      const migrated = await persistHubData(normalized);
      return {
        ok: true,
        data: migrated,
        path: paths.dataFile,
        created: false,
        migrated: true,
        backups: await listValidBackups()
      };
    }
    return {
      ok: true,
      data: normalized,
      path: paths.dataFile,
      created: false,
      migrated: false,
      backups: await listValidBackups()
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      const data = await persistHubData(createDefaultData(), { createBackup: false });
      return { ok: true, data, path: paths.dataFile, created: true, migrated: false, backups: [] };
    }
    return {
      ok: false,
      path: paths.dataFile,
      error: `The local Hub data could not be loaded. The damaged file was left in place. ${error.message}`,
      backups: await listValidBackups()
    };
  }
}

module.exports = {
  readJsonFile,
  readValidatedHubData,
  safeTimestamp,
  fileExists,
  listValidBackups,
  persistHubData,
  loadHubData
};
