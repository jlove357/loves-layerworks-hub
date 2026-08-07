(function exposeProductionFileLogic(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProductionFileLogic = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const LARGE_FILE_WARNING_BYTES = 100 * 1024 * 1024;
  const ROLE_OPTIONS = Object.freeze([
    { value: 'final_print', label: 'Final Print File' },
    { value: 'bambu_project', label: 'Bambu Studio Project' },
    { value: 'stl_model', label: 'STL / Model' },
    { value: 'hueforge_project', label: 'HueForge Project' },
    { value: 'chroma_canvas_project', label: 'Chroma Canvas Project' },
    { value: 'source_artwork', label: 'Source Artwork' },
    { value: 'other', label: 'Other' }
  ]);
  const ROLE_VALUES = new Set(ROLE_OPTIONS.map((option) => option.value));

  function safeText(value) {
    return String(value ?? '').trim();
  }

  function extensionOf(fileName) {
    const name = safeText(fileName);
    const slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
    const base = slash >= 0 ? name.slice(slash + 1) : name;
    const dot = base.lastIndexOf('.');
    if (dot <= 0 || dot === base.length - 1) return '';
    return base.slice(dot).toLocaleLowerCase();
  }

  function defaultLabel(fileName) {
    const name = safeText(fileName).replace(/^.*[\\/]/, '');
    const extension = extensionOf(name);
    return (extension ? name.slice(0, -extension.length) : name).trim() || 'Production file';
  }

  function inferRole(fileName) {
    const extension = extensionOf(fileName);
    if (extension === '.3mf') return 'bambu_project';
    if (['.stl', '.obj', '.amf', '.step', '.stp'].includes(extension)) return 'stl_model';
    if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.bmp', '.tif', '.tiff'].includes(extension)) return 'source_artwork';
    return 'other';
  }

  function roleLabel(role) {
    return ROLE_OPTIONS.find((option) => option.value === role)?.label || 'Other';
  }

  function isValidRole(role) {
    return ROLE_VALUES.has(String(role || ''));
  }

  function sanitizeFileName(fileName) {
    const original = safeText(fileName).replace(/^.*[\\/]/, '') || 'production-file';
    let cleaned = original
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/[. ]+$/g, '')
      .replace(/^[. ]+/g, '');
    if (!cleaned) cleaned = 'production-file';
    if (cleaned.length <= 140) return cleaned;

    const extension = extensionOf(cleaned);
    const baseLimit = Math.max(1, 140 - extension.length);
    const base = (extension ? cleaned.slice(0, -extension.length) : cleaned).slice(0, baseLimit).replace(/[. ]+$/g, '');
    return `${base || 'production-file'}${extension}`;
  }

  function formatBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = bytes / 1024;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit += 1;
    }
    const decimals = size >= 100 ? 0 : size >= 10 ? 1 : 2;
    return `${size.toFixed(decimals)} ${units[unit]}`;
  }

  function needsLargeFileWarning(sizeBytes) {
    return Number(sizeBytes) >= LARGE_FILE_WARNING_BYTES;
  }

  return {
    LARGE_FILE_WARNING_BYTES,
    ROLE_OPTIONS,
    extensionOf,
    defaultLabel,
    inferRole,
    roleLabel,
    isValidRole,
    sanitizeFileName,
    formatBytes,
    needsLargeFileWarning
  };
}));
