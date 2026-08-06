const { dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { UUID_PATTERN, IMAGE_EXTENSIONS, MIME_BY_EXTENSION, hubPaths, ensureHubStructure, requiredText } = require('./hub-config');
const { normalizeManagedRelativePath } = require('./hub-validation');

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

async function selectSwatchImage() {
  const result = await dialog.showOpenDialog({
    title: 'Choose a filament swatch photo',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const sourcePath = result.filePaths[0];
  const extension = path.extname(sourcePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) throw new Error('Choose a PNG, JPG, JPEG, or WEBP image.');
  const stats = await fs.stat(sourcePath);
  if (!stats.isFile() || stats.size <= 0) throw new Error('The selected image is empty or unavailable.');
  if (stats.size > 25 * 1024 * 1024) throw new Error('Choose a swatch image smaller than 25 MB.');
  const buffer = await fs.readFile(sourcePath);
  return {
    canceled: false,
    sourcePath,
    fileName: path.basename(sourcePath),
    dataUrl: `data:${MIME_BY_EXTENSION[extension]};base64,${buffer.toString('base64')}`
  };
}

async function copySwatchImage(_event, request) {
  const paths = await ensureHubStructure();
  const sourcePath = path.resolve(requiredText(request?.sourcePath, 'Image source path'));
  const rollId = requiredText(request?.rollId, 'Roll ID');
  if (!UUID_PATTERN.test(rollId)) throw new Error('The roll ID is invalid.');
  const extension = path.extname(sourcePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) throw new Error('Choose a PNG, JPG, JPEG, or WEBP image.');

  const sourceStats = await fs.stat(sourcePath);
  if (!sourceStats.isFile() || sourceStats.size <= 0) throw new Error('The selected image is empty or unavailable.');
  if (sourceStats.size > 25 * 1024 * 1024) throw new Error('Choose a swatch image smaller than 25 MB.');
  const fileName = `${rollId}-${crypto.randomUUID()}${extension}`;
  const destination = path.join(paths.swatchesDir, fileName);
  await fs.copyFile(sourcePath, destination);
  const copiedStats = await fs.stat(destination);
  if (copiedStats.size !== sourceStats.size) {
    await fs.rm(destination, { force: true });
    throw new Error('The managed swatch copy did not verify correctly.');
  }
  return { ok: true, relativePath: `images/swatches/${fileName}` };
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


module.exports = { selectSwatchImage, copySwatchImage, readManagedImage, deleteManagedImage };
