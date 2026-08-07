const { dialog } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { hubPaths, ensureHubStructure, UUID_PATTERN, requiredText } = require('./hub-config');
const { normalizeProductionRelativePath } = require('./hub-validation');
const { loadHubData } = require('./hub-persistence');

const CONFIG_VERSION = 1;
const LIBRARY_FOLDER_NAME = "Love's LayerWorks Production Files";
const COPY_SAFETY_BUFFER_BYTES = 256 * 1024 * 1024;
const activeOperations = new Map();

function defaultStorageRoot() {
  return path.resolve(hubPaths().filesDir);
}

function configPath() {
  return hubPaths().productionStorageConfigFile;
}

function normalizeConfiguredRoot(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (!path.isAbsolute(text)) throw new Error('Configured Production Files storage must use an absolute path.');
  return path.resolve(text);
}

function isInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function readStorageConfig() {
  await ensureHubStructure();
  try {
    const raw = await fsp.readFile(configPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Storage config must be an object.');
    if (Number(parsed.version) !== CONFIG_VERSION) throw new Error(`Unsupported Production Files storage config version: ${parsed.version}.`);
    return {
      version: CONFIG_VERSION,
      customRoot: normalizeConfiguredRoot(parsed.customRoot),
      updatedAt: parsed.updatedAt && !Number.isNaN(Date.parse(parsed.updatedAt)) ? new Date(parsed.updatedAt).toISOString() : null
    };
  } catch (error) {
    if (error?.code === 'ENOENT') return { version: CONFIG_VERSION, customRoot: null, updatedAt: null };
    if (error instanceof SyntaxError) throw new Error(`Production Files storage config is malformed: ${error.message}`);
    throw error;
  }
}

async function writeStorageConfig(customRoot) {
  const paths = await ensureHubStructure();
  const normalized = normalizeConfiguredRoot(customRoot);
  const payload = {
    version: CONFIG_VERSION,
    customRoot: normalized,
    updatedAt: new Date().toISOString()
  };
  const temp = path.join(paths.dataDir, `production-storage.${crypto.randomUUID()}.tmp.json`);
  await fsp.writeFile(temp, JSON.stringify(payload, null, 2), 'utf8');
  const verified = JSON.parse(await fsp.readFile(temp, 'utf8'));
  if (Number(verified.version) !== CONFIG_VERSION || normalizeConfiguredRoot(verified.customRoot) !== normalized) {
    await fsp.rm(temp, { force: true }).catch(() => {});
    throw new Error('Production Files storage config verification failed.');
  }
  await fsp.rename(temp, configPath());
  return payload;
}

async function getProductionStorageRoot() {
  const config = await readStorageConfig();
  return config.customRoot || defaultStorageRoot();
}

function storageRelativePath(relativePath) {
  const normalized = normalizeProductionRelativePath(relativePath);
  if (!normalized) throw new Error('No production file path was provided.');
  return normalized.replace(/^files\//, '');
}

async function resolveProductionPath(relativePath, rootOverride = null) {
  const storageRoot = path.resolve(rootOverride || await getProductionStorageRoot());
  const resolved = path.resolve(storageRoot, storageRelativePath(relativePath));
  if (resolved !== storageRoot && !resolved.startsWith(`${storageRoot}${path.sep}`)) {
    throw new Error('Production file path escaped managed storage.');
  }
  return resolved;
}

async function resolveProjectProductionDir(projectId, rootOverride = null) {
  const id = requiredText(projectId, 'Project ID');
  if (!UUID_PATTERN.test(id)) throw new Error('The project ID is invalid.');
  const storageRoot = path.resolve(rootOverride || await getProductionStorageRoot());
  const projectsRoot = path.resolve(storageRoot, 'projects');
  const resolved = path.resolve(projectsRoot, id, 'production');
  if (!resolved.startsWith(`${projectsRoot}${path.sep}`)) throw new Error('Project production folder escaped managed storage.');
  return resolved;
}

async function ensureProductionStorage() {
  await ensureHubStructure();
  const root = await getProductionStorageRoot();
  await fsp.mkdir(path.join(root, 'projects'), { recursive: true });
  return root;
}

async function directoryUsage(directory) {
  let total = 0;
  try {
    const entries = await fsp.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) total += await directoryUsage(child);
      else if (entry.isFile()) total += (await fsp.stat(child)).size;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return total;
}

async function freeSpaceFor(targetPath) {
  try {
    let probe = path.resolve(targetPath);
    while (true) {
      try {
        await fsp.access(probe);
        break;
      } catch {
        const parent = path.dirname(probe);
        if (parent === probe) return { freeBytes: null, totalBytes: null };
        probe = parent;
      }
    }
    const stats = await fsp.statfs(probe);
    const blockSize = Number(stats.bsize || 0);
    const freeBlocks = Number(stats.bavail ?? stats.bfree ?? 0);
    const totalBlocks = Number(stats.blocks || 0);
    if (!(blockSize > 0)) return { freeBytes: null, totalBytes: null };
    return {
      freeBytes: freeBlocks >= 0 ? freeBlocks * blockSize : null,
      totalBytes: totalBlocks >= 0 ? totalBlocks * blockSize : null
    };
  } catch {
    return { freeBytes: null, totalBytes: null };
  }
}

async function getProductionStorageStatus() {
  const config = await readStorageConfig();
  const root = config.customRoot || defaultStorageRoot();
  await fsp.mkdir(path.join(root, 'projects'), { recursive: true });
  const [usageBytes, disk] = await Promise.all([
    directoryUsage(path.join(root, 'projects')),
    freeSpaceFor(root)
  ]);
  return {
    ok: true,
    root,
    defaultRoot: defaultStorageRoot(),
    isDefault: path.resolve(root) === defaultStorageRoot(),
    usageBytes,
    freeBytes: disk.freeBytes,
    totalBytes: disk.totalBytes,
    configPath: configPath()
  };
}

function allProductionFiles(data) {
  const entries = [];
  for (const project of data?.projects || []) {
    for (const file of project.productionFiles || []) entries.push({ project, file });
  }
  return entries;
}

async function hashFile(filePath, signal = null) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  if (signal) {
    if (signal.aborted) stream.destroy(Object.assign(new Error('Operation canceled.'), { name: 'AbortError' }));
    signal.addEventListener('abort', () => stream.destroy(Object.assign(new Error('Operation canceled.'), { name: 'AbortError' })), { once: true });
  }
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

async function inspectEntry(entry, root, verifyHash = false, signal = null) {
  const filePath = await resolveProductionPath(entry.file.relativePath, root);
  try {
    const stats = await fsp.stat(filePath);
    if (!stats.isFile()) return { projectId: entry.project.id, fileId: entry.file.id, status: 'missing', fileName: entry.file.originalFileName };
    if (Number(stats.size) !== Number(entry.file.sizeBytes)) {
      return { projectId: entry.project.id, fileId: entry.file.id, status: 'size_mismatch', fileName: entry.file.originalFileName, expectedBytes: entry.file.sizeBytes, actualBytes: stats.size };
    }
    if (verifyHash) {
      const actualHash = await hashFile(filePath, signal);
      if (actualHash.toLowerCase() !== String(entry.file.sha256 || '').toLowerCase()) {
        return { projectId: entry.project.id, fileId: entry.file.id, status: 'hash_mismatch', fileName: entry.file.originalFileName, expectedHash: entry.file.sha256, actualHash };
      }
    }
    return { projectId: entry.project.id, fileId: entry.file.id, status: 'ok', fileName: entry.file.originalFileName };
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    if (error?.code === 'ENOENT') return { projectId: entry.project.id, fileId: entry.file.id, status: 'missing', fileName: entry.file.originalFileName };
    return { projectId: entry.project.id, fileId: entry.file.id, status: 'error', fileName: entry.file.originalFileName, error: error.message };
  }
}

async function checkProjectProductionFiles(_event, projectId) {
  const loaded = await loadHubData();
  if (!loaded?.ok) throw new Error(loaded?.error || 'Hub data could not be loaded.');
  const project = loaded.data.projects.find((item) => item.id === projectId);
  if (!project) throw new Error('The selected project does not exist.');
  const root = await ensureProductionStorage();
  const details = [];
  for (const file of project.productionFiles || []) details.push(await inspectEntry({ project, file }, root, false));
  return { ok: true, details };
}

async function verifyProductionLibrary(event) {
  const operationId = crypto.randomUUID();
  const controller = new AbortController();
  activeOperations.set(operationId, controller);
  try {
    const loaded = await loadHubData();
    if (!loaded?.ok) throw new Error(loaded?.error || 'Hub data could not be loaded.');
    const root = await ensureProductionStorage();
    const entries = allProductionFiles(loaded.data);
    event.sender.send('hub:production-integrity-progress', {
      operationId,
      completed: 0,
      total: entries.length,
      percent: entries.length ? 0 : 100,
      fileName: '',
      status: 'starting'
    });
    const details = [];
    for (let index = 0; index < entries.length; index += 1) {
      if (controller.signal.aborted) throw Object.assign(new Error('Integrity verification canceled.'), { name: 'AbortError' });
      const result = await inspectEntry(entries[index], root, true, controller.signal);
      details.push(result);
      event.sender.send('hub:production-integrity-progress', {
        operationId,
        completed: index + 1,
        total: entries.length,
        percent: entries.length ? Math.round((index + 1) / entries.length * 100) : 100,
        fileName: entries[index].file.originalFileName,
        status: result.status
      });
    }
    const counts = details.reduce((summary, item) => {
      summary[item.status] = (summary[item.status] || 0) + 1;
      return summary;
    }, {});
    return { ok: true, operationId, total: entries.length, counts, details };
  } catch (error) {
    if (error?.name === 'AbortError') return { ok: false, canceled: true, operationId };
    throw error;
  } finally {
    activeOperations.delete(operationId);
  }
}

async function cancelProductionStorageOperation(_event, operationId) {
  const controller = activeOperations.get(String(operationId || ''));
  if (!controller) return { ok: true, active: false };
  controller.abort();
  return { ok: true, active: true };
}

async function assertLibraryHealthy(data, root, signal = null) {
  const problems = [];
  for (const entry of allProductionFiles(data)) {
    if (signal?.aborted) throw Object.assign(new Error('Storage move canceled.'), { name: 'AbortError' });
    const result = await inspectEntry(entry, root, true, signal);
    if (result.status !== 'ok') problems.push(result);
  }
  if (problems.length) {
    const first = problems[0];
    throw new Error(`Storage move stopped because ${problems.length} managed file(s) failed integrity checks. First problem: ${first.fileName} (${first.status}).`);
  }
}

async function libraryRootIsEmpty(root) {
  try {
    const entries = await fsp.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'projects' && entry.isDirectory()) {
        if ((await fsp.readdir(path.join(root, 'projects'))).length === 0) continue;
      }
      return false;
    }
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return true;
    throw error;
  }
}

async function copyTreeWithProgress(event, source, destination, totalBytes, operationId, controller, progressState) {
  await fsp.mkdir(destination, { recursive: true });
  let entries = [];
  try {
    entries = await fsp.readdir(source, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    if (controller.signal.aborted) throw Object.assign(new Error('Storage move canceled.'), { name: 'AbortError' });
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyTreeWithProgress(event, from, to, totalBytes, operationId, controller, progressState);
    } else if (entry.isFile()) {
      const transform = new Transform({
        transform(chunk, encoding, callback) {
          progressState.bytes += chunk.length;
          const now = Date.now();
          if (now - progressState.lastSent >= 150 || progressState.bytes >= totalBytes) {
            progressState.lastSent = now;
            event.sender.send('hub:production-storage-progress', {
              operationId,
              transferredBytes: progressState.bytes,
              totalBytes,
              percent: totalBytes ? Math.min(100, Math.round(progressState.bytes / totalBytes * 100)) : 100,
              fileName: entry.name
            });
          }
          callback(null, chunk);
        }
      });
      await pipeline(fs.createReadStream(from), transform, fs.createWriteStream(to, { flags: 'wx' }), { signal: controller.signal });
    }
  }
}

async function removeOldLibrary(root) {
  const resolved = path.resolve(root);
  if (resolved === defaultStorageRoot()) {
    await fsp.rm(path.join(resolved, 'projects'), { recursive: true, force: true });
    await fsp.mkdir(path.join(resolved, 'projects'), { recursive: true });
  } else {
    await fsp.rm(resolved, { recursive: true, force: true });
  }
}

async function relocateProductionStorage(event, mode = 'choose') {
  const currentRoot = await ensureProductionStorage();
  let targetRoot;
  if (mode === 'default') {
    targetRoot = defaultStorageRoot();
  } else {
    const result = await dialog.showOpenDialog({
      title: 'Choose a parent folder for Production Files storage',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const selected = path.resolve(result.filePaths[0]);
    targetRoot = path.basename(selected).toLocaleLowerCase() === LIBRARY_FOLDER_NAME.toLocaleLowerCase()
      ? selected
      : path.join(selected, LIBRARY_FOLDER_NAME);
  }
  targetRoot = path.resolve(targetRoot);
  const currentResolved = path.resolve(currentRoot);
  if (targetRoot === currentResolved) return { canceled: false, unchanged: true, status: await getProductionStorageStatus() };
  if (isInside(currentResolved, targetRoot) || isInside(targetRoot, currentResolved)) {
    throw new Error('Choose a storage location that is separate from the current Production Files library.');
  }

  const operationId = crypto.randomUUID();
  const controller = new AbortController();
  activeOperations.set(operationId, controller);
  const stageRoot = `${targetRoot}.pf2-staging-${operationId}`;
  let targetActivated = false;
  try {
    const loaded = await loadHubData();
    if (!loaded?.ok) throw new Error(loaded?.error || 'Hub data could not be loaded.');
    const sourceProjects = path.join(currentRoot, 'projects');
    const usageBytes = await directoryUsage(sourceProjects);
    event.sender.send('hub:production-storage-progress', {
      operationId,
      transferredBytes: 0,
      totalBytes: usageBytes,
      percent: 0,
      fileName: 'Verifying source library'
    });

    const disk = await freeSpaceFor(path.dirname(targetRoot));
    if (disk.freeBytes !== null && disk.freeBytes < usageBytes + COPY_SAFETY_BUFFER_BYTES) {
      throw new Error(`Not enough free space to move Production Files safely. The move needs the current library size plus at least ${Math.round(COPY_SAFETY_BUFFER_BYTES / 1024 / 1024)} MB of free headroom.`);
    }
    if (!(await libraryRootIsEmpty(targetRoot))) {
      throw new Error('The destination Production Files folder already exists and is not empty. Choose a different location.');
    }

    await assertLibraryHealthy(loaded.data, currentRoot, controller.signal);
    await fsp.rm(stageRoot, { recursive: true, force: true });
    const progressState = { bytes: 0, lastSent: 0 };
    await copyTreeWithProgress(event, sourceProjects, path.join(stageRoot, 'projects'), usageBytes, operationId, controller, progressState);
    await assertLibraryHealthy(loaded.data, stageRoot, controller.signal);

    if (!(await libraryRootIsEmpty(targetRoot))) throw new Error('The destination changed during the storage move. No source files were deleted.');
    await fsp.rm(targetRoot, { recursive: true, force: true });
    await fsp.rename(stageRoot, targetRoot);
    targetActivated = true;

    const customRoot = targetRoot === defaultStorageRoot() ? null : targetRoot;
    try {
      await writeStorageConfig(customRoot);
    } catch (error) {
      await fsp.rm(targetRoot, { recursive: true, force: true }).catch(() => {});
      targetActivated = false;
      throw error;
    }

    let cleanupWarning = null;
    try {
      await removeOldLibrary(currentRoot);
    } catch (error) {
      cleanupWarning = `The Hub switched to the new storage location, but the old copy could not be removed automatically: ${error.message}`;
    }

    return {
      canceled: false,
      operationId,
      movedBytes: usageBytes,
      cleanupWarning,
      status: await getProductionStorageStatus()
    };
  } catch (error) {
    await fsp.rm(stageRoot, { recursive: true, force: true }).catch(() => {});
    if (!targetActivated) {
      // The source remains authoritative until the verified config update succeeds.
    }
    if (error?.name === 'AbortError') return { canceled: true, operationId };
    throw error;
  } finally {
    activeOperations.delete(operationId);
  }
}

module.exports = {
  CONFIG_VERSION,
  LIBRARY_FOLDER_NAME,
  COPY_SAFETY_BUFFER_BYTES,
  defaultStorageRoot,
  readStorageConfig,
  getProductionStorageRoot,
  resolveProductionPath,
  resolveProjectProductionDir,
  ensureProductionStorage,
  getProductionStorageStatus,
  checkProjectProductionFiles,
  verifyProductionLibrary,
  cancelProductionStorageOperation,
  relocateProductionStorage,
  freeSpaceFor
};
