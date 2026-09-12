const { shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { UUID_PATTERN, ensureHubStructure, hubPaths, requiredText } = require('./hub-config');

const MAX_EXPORT_BYTES = 25 * 1024 * 1024;
const PNG_PREFIX = 'data:image/png;base64,';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function safeStem(value) {
  const stem = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLocaleLowerCase();
  return (stem || 'gallery-project').slice(0, 60);
}

function decodePngDataUrl(value) {
  const dataUrl = requiredText(value, 'PNG export data');
  if (!dataUrl.startsWith(PNG_PREFIX)) throw new Error('Gallery exports must be PNG images.');
  const encoded = dataUrl.slice(PNG_PREFIX.length);
  if (!encoded || !/^[a-zA-Z0-9+/=\r\n]+$/.test(encoded)) throw new Error('The PNG export data is malformed.');
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length || buffer.length > MAX_EXPORT_BYTES) throw new Error('The PNG export must be between 1 byte and 25 MB.');
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error('The export did not contain a valid PNG signature.');
  }
  return buffer;
}

function exportRelativePath(fileName) {
  return `exports/${fileName}`;
}

function resolveExportPath(relativePath) {
  const value = requiredText(relativePath, 'Export path').replaceAll('\\', '/');
  if (path.isAbsolute(value) || value.startsWith('../') || value.includes('/../') || !value.startsWith('exports/')) {
    throw new Error('The export path must stay inside the managed exports folder.');
  }
  const exportsRoot = path.resolve(hubPaths().exportsDir);
  const resolved = path.resolve(hubPaths().root, value);
  if (resolved !== exportsRoot && !resolved.startsWith(`${exportsRoot}${path.sep}`)) {
    throw new Error('The export path escaped the managed exports folder.');
  }
  return resolved;
}

async function saveGalleryExport(_event, request) {
  const projectId = requiredText(request?.projectId, 'Project ID');
  if (!UUID_PATTERN.test(projectId)) throw new Error('The project ID is invalid.');
  const buffer = decodePngDataUrl(request?.pngDataUrl);
  const paths = await ensureHubStructure();
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const fileName = `${safeStem(request?.fileStem)}-${timestamp}-${crypto.randomUUID().slice(0, 8)}.png`;
  const destination = path.join(paths.exportsDir, fileName);
  const temporary = path.join(paths.exportsDir, `.${fileName}.${crypto.randomUUID()}.tmp`);

  try {
    await fs.writeFile(temporary, buffer, { flag: 'wx' });
    const reread = await fs.readFile(temporary);
    const expectedHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const actualHash = crypto.createHash('sha256').update(reread).digest('hex');
    if (expectedHash !== actualHash) throw new Error('The temporary export did not verify correctly.');
    await fs.rename(temporary, destination);
    const finalBuffer = await fs.readFile(destination);
    const finalHash = crypto.createHash('sha256').update(finalBuffer).digest('hex');
    if (finalHash !== expectedHash) {
      await fs.rm(destination, { force: true });
      throw new Error('The final export did not verify correctly.');
    }
    return {
      ok: true,
      projectId,
      fileName,
      path: destination,
      relativePath: exportRelativePath(fileName),
      bytes: finalBuffer.length
    };
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

async function revealGalleryExport(_event, relativePath) {
  const filePath = resolveExportPath(relativePath);
  const stats = await fs.stat(filePath);
  if (!stats.isFile()) throw new Error('The managed export is unavailable.');
  shell.showItemInFolder(filePath);
  return { ok: true, path: filePath };
}

module.exports = {
  saveGalleryExport,
  revealGalleryExport,
  safeStem,
  decodePngDataUrl,
  resolveExportPath
};
