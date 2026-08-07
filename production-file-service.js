const { dialog, shell } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const {
  UUID_PATTERN,
  hubPaths,
  ensureHubStructure,
  requiredText
} = require('./hub-config');
const { normalizeProductionRelativePath } = require('./hub-validation');
const logic = require('./production-file-logic');

const activeCopies = new Map();

function resolveProductionPath(relativePath) {
  const normalized = normalizeProductionRelativePath(relativePath);
  if (!normalized) throw new Error('No production file path was provided.');
  const root = path.resolve(hubPaths().root);
  const resolved = path.resolve(root, normalized);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Production file path escaped the Hub folder.');
  }
  return resolved;
}

function resolveProjectProductionDir(projectId) {
  const id = requiredText(projectId, 'Project ID');
  if (!UUID_PATTERN.test(id)) throw new Error('The project ID is invalid.');
  const root = path.resolve(hubPaths().productionProjectsDir);
  const resolved = path.resolve(root, id, 'production');
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error('Project production folder escaped managed storage.');
  return resolved;
}

async function inspectSourceFile(sourcePath) {
  const resolved = path.resolve(requiredText(sourcePath, 'Production file source path'));
  const stats = await fsp.stat(resolved);
  if (!stats.isFile() || stats.size <= 0) throw new Error('The selected production file is empty or unavailable.');
  return {
    resolved,
    stats,
    originalFileName: path.basename(resolved),
    extension: path.extname(resolved).toLowerCase()
  };
}

async function selectProductionFile() {
  const result = await dialog.showOpenDialog({
    title: 'Choose a production file',
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const sourcePath = result.filePaths[0];
  const inspected = await inspectSourceFile(sourcePath);
  return {
    canceled: false,
    sourcePath,
    fileName: inspected.originalFileName,
    extension: inspected.extension,
    sizeBytes: inspected.stats.size
  };
}

function progressPayload(copyId, projectId, fileId, fileName, transferredBytes, totalBytes, status = 'copying') {
  return {
    copyId,
    projectId,
    fileId,
    fileName,
    transferredBytes,
    totalBytes,
    percent: totalBytes > 0 ? Math.min(100, Math.round(transferredBytes / totalBytes * 100)) : 0,
    status
  };
}

async function copyProductionFile(event, request) {
  const projectId = requiredText(request?.projectId, 'Project ID');
  const fileId = requiredText(request?.fileId, 'Production file ID');
  if (!UUID_PATTERN.test(projectId)) throw new Error('The project ID is invalid.');
  if (!UUID_PATTERN.test(fileId)) throw new Error('The production file ID is invalid.');

  const inspected = await inspectSourceFile(request?.sourcePath);
  const paths = await ensureHubStructure();
  const productionDir = resolveProjectProductionDir(projectId);
  await fsp.mkdir(productionDir, { recursive: true });

  const sanitizedOriginal = logic.sanitizeFileName(inspected.originalFileName);
  const storedFileName = `${fileId}_${sanitizedOriginal}`;
  const destination = path.join(productionDir, storedFileName);
  const relativePath = `files/projects/${projectId}/production/${storedFileName}`;
  const copyId = fileId;
  const controller = new AbortController();
  const hash = crypto.createHash('sha256');
  let transferredBytes = 0;
  let lastProgressAt = 0;

  activeCopies.set(copyId, { controller, destination, projectId, fileId });
  event.sender.send('hub:production-file-progress', progressPayload(
    copyId, projectId, fileId, inspected.originalFileName, 0, inspected.stats.size
  ));

  const progressTransform = new Transform({
    transform(chunk, encoding, callback) {
      hash.update(chunk);
      transferredBytes += chunk.length;
      const now = Date.now();
      if (now - lastProgressAt >= 100 || transferredBytes === inspected.stats.size) {
        lastProgressAt = now;
        event.sender.send('hub:production-file-progress', progressPayload(
          copyId,
          projectId,
          fileId,
          inspected.originalFileName,
          transferredBytes,
          inspected.stats.size
        ));
      }
      callback(null, chunk);
    }
  });

  try {
    await pipeline(
      fs.createReadStream(inspected.resolved),
      progressTransform,
      fs.createWriteStream(destination, { flags: 'wx' }),
      { signal: controller.signal }
    );

    const copiedStats = await fsp.stat(destination);
    if (!copiedStats.isFile() || copiedStats.size !== inspected.stats.size) {
      throw new Error('The managed production-file copy did not verify correctly.');
    }

    const sha256 = hash.digest('hex');
    event.sender.send('hub:production-file-progress', progressPayload(
      copyId,
      projectId,
      fileId,
      inspected.originalFileName,
      copiedStats.size,
      copiedStats.size,
      'complete'
    ));

    return {
      ok: true,
      fileId,
      originalFileName: inspected.originalFileName,
      storedFileName,
      relativePath,
      extension: inspected.extension,
      sizeBytes: copiedStats.size,
      sha256
    };
  } catch (error) {
    await fsp.rm(destination, { force: true }).catch(() => {});
    const canceled = error?.name === 'AbortError';
    event.sender.send('hub:production-file-progress', progressPayload(
      copyId,
      projectId,
      fileId,
      inspected.originalFileName,
      transferredBytes,
      inspected.stats.size,
      canceled ? 'canceled' : 'error'
    ));
    if (canceled) throw new Error('Production file copy canceled.');
    throw error;
  } finally {
    activeCopies.delete(copyId);
  }
}

async function cancelProductionFileCopy(_event, copyId) {
  const id = requiredText(copyId, 'Copy ID');
  const active = activeCopies.get(id);
  if (!active) return { ok: true, active: false };
  active.controller.abort();
  return { ok: true, active: true };
}

async function openProductionFile(_event, relativePath) {
  const filePath = resolveProductionPath(relativePath);
  await fsp.access(filePath);
  const message = await shell.openPath(filePath);
  if (message) throw new Error(message);
  return { ok: true };
}

async function showProductionFile(_event, relativePath) {
  const filePath = resolveProductionPath(relativePath);
  await fsp.access(filePath);
  shell.showItemInFolder(filePath);
  return { ok: true };
}

async function deleteProductionFile(_event, relativePath) {
  if (!relativePath) return { ok: true };
  const filePath = resolveProductionPath(relativePath);
  await fsp.rm(filePath, { force: true });
  return { ok: true };
}

async function removeProjectProductionFolder(projectId) {
  const directory = resolveProjectProductionDir(projectId);
  const projectDir = path.dirname(directory);
  await fsp.rm(projectDir, { recursive: true, force: true });
  return { ok: true };
}

async function deleteProjectProductionFolder(_event, projectId) {
  return removeProjectProductionFolder(projectId);
}

module.exports = {
  selectProductionFile,
  copyProductionFile,
  cancelProductionFileCopy,
  openProductionFile,
  showProductionFile,
  deleteProductionFile,
  deleteProjectProductionFolder,
  removeProjectProductionFolder
};
