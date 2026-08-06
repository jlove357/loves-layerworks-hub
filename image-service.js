const { dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  UUID_PATTERN,
  IMAGE_EXTENSIONS,
  MIME_BY_EXTENSION,
  hubPaths,
  ensureHubStructure,
  requiredText
} = require('./hub-config');
const { normalizeManagedRelativePath } = require('./hub-validation');

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function resolveManagedPath(relativePath) {
  const normalized = normalizeManagedRelativePath(relativePath);
  if (!normalized) throw new Error('No managed image path was provided.');
  const root = path.resolve(hubPaths().root);
  const resolved = path.resolve(root, normalized);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Managed path escaped the Hub folder.');
  }
  return resolved;
}

async function inspectSourceImage(sourcePath, label = 'image') {
  const resolved = path.resolve(requiredText(sourcePath, 'Image source path'));
  const extension = path.extname(resolved).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) throw new Error('Choose a PNG, JPG, JPEG, or WEBP image.');
  const stats = await fs.stat(resolved);
  if (!stats.isFile() || stats.size <= 0) throw new Error(`The selected ${label} is empty or unavailable.`);
  if (stats.size > MAX_IMAGE_BYTES) throw new Error(`Choose a ${label} smaller than 25 MB.`);
  return { resolved, extension, stats };
}

async function selectImage(title, label) {
  const result = await dialog.showOpenDialog({
    title,
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const sourcePath = result.filePaths[0];
  const { extension } = await inspectSourceImage(sourcePath, label);
  const buffer = await fs.readFile(sourcePath);
  return {
    canceled: false,
    sourcePath,
    fileName: path.basename(sourcePath),
    dataUrl: `data:${MIME_BY_EXTENSION[extension]};base64,${buffer.toString('base64')}`
  };
}

async function copyManagedImage({ sourcePath, recordId, directory, relativeDirectory, label }) {
  if (!UUID_PATTERN.test(recordId)) throw new Error(`The ${label} ID is invalid.`);
  const { resolved, extension, stats } = await inspectSourceImage(sourcePath, label);
  const fileName = `${recordId}-${crypto.randomUUID()}${extension}`;
  const destination = path.join(directory, fileName);
  await fs.copyFile(resolved, destination);
  const copiedStats = await fs.stat(destination);
  if (copiedStats.size !== stats.size) {
    await fs.rm(destination, { force: true });
    throw new Error(`The managed ${label} copy did not verify correctly.`);
  }
  return { ok: true, relativePath: `${relativeDirectory}/${fileName}` };
}

async function selectSwatchImage() {
  return selectImage('Choose a filament swatch photo', 'swatch image');
}

async function selectProjectImage() {
  return selectImage('Choose a customer reference image', 'reference image');
}

async function copySwatchImage(_event, request) {
  const paths = await ensureHubStructure();
  return copyManagedImage({
    sourcePath: request?.sourcePath,
    recordId: requiredText(request?.rollId, 'Roll ID'),
    directory: paths.swatchesDir,
    relativeDirectory: 'images/swatches',
    label: 'roll'
  });
}

async function copyProjectImage(_event, request) {
  const paths = await ensureHubStructure();
  return copyManagedImage({
    sourcePath: request?.sourcePath,
    recordId: requiredText(request?.projectId, 'Project ID'),
    directory: paths.originalsDir,
    relativeDirectory: 'images/originals',
    label: 'project'
  });
}

async function readManagedImage(_event, relativePath) {
  if (!relativePath) return { ok: false, error: 'No image attached.' };
  const filePath = resolveManagedPath(relativePath);
  const extension = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXTENSION[extension];
  if (!mime) return { ok: false, error: 'Unsupported managed image type.' };
  try {
    const buffer = await fs.readFile(filePath);
    return { ok: true, dataUrl: `data:${mime};base64,${buffer.toString('base64')}` };
  } catch (error) {
    return { ok: false, error: `Managed image unavailable: ${error.message}` };
  }
}

async function deleteManagedImage(_event, relativePath) {
  if (!relativePath) return { ok: true };
  const filePath = resolveManagedPath(relativePath);
  await fs.rm(filePath, { force: true });
  return { ok: true };
}

module.exports = {
  selectSwatchImage,
  selectProjectImage,
  copySwatchImage,
  copyProjectImage,
  readManagedImage,
  deleteManagedImage
};
