(function exposeProjectReuseLogic(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProjectReuseLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, () => {
  function text(value) {
    return String(value ?? '').trim();
  }

  function numberOr(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function totalProductionBytes(project) {
    return (Array.isArray(project?.productionFiles) ? project.productionFiles : [])
      .reduce((sum, file) => sum + Math.max(0, numberOr(file?.sizeBytes, 0)), 0);
  }

  function formatBytes(value) {
    const bytes = Math.max(0, numberOr(value, 0));
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let amount = bytes / 1024;
    let unit = units[0];
    for (let index = 1; index < units.length && amount >= 1024; index += 1) {
      amount /= 1024;
      unit = units[index];
    }
    return `${amount >= 100 ? amount.toFixed(0) : amount >= 10 ? amount.toFixed(1) : amount.toFixed(2)} ${unit}`;
  }

  function copyUsage(source) {
    return (Array.isArray(source?.filamentUsage) ? source.filamentUsage : []).map((usage) => ({
      filamentId: text(usage?.filamentId),
      gramsEstimated: Math.max(0, numberOr(usage?.gramsEstimated, 0)),
      gramsActual: null,
      printOrder: usage?.printOrder ?? null,
      swapLayer: usage?.swapLayer ?? null
    }));
  }

  function copyPalette(source) {
    return (Array.isArray(source?.paletteSelections) ? source.paletteSelections : []).map((selection) => ({
      filamentId: text(selection?.filamentId),
      sourceColorHex: text(selection?.sourceColorHex).toLowerCase()
    }));
  }

  function remapProductionFile(sourceFile, copiedFile, fileId, now = new Date().toISOString()) {
    if (!sourceFile || !copiedFile) throw new Error('A production file copy is missing metadata.');
    const id = text(fileId);
    if (!id) throw new Error('The duplicated production file needs a new ID.');
    const relativePath = text(copiedFile.relativePath);
    const storedFileName = text(copiedFile.storedFileName);
    const sha256 = text(copiedFile.sha256).toLowerCase();
    if (!relativePath || !storedFileName || !sha256) {
      throw new Error('The duplicated production file was not fully verified.');
    }
    return {
      id,
      label: text(sourceFile.label) || text(sourceFile.originalFileName) || text(copiedFile.originalFileName),
      role: text(sourceFile.role) || 'other',
      originalFileName: text(sourceFile.originalFileName) || text(copiedFile.originalFileName),
      storedFileName,
      relativePath,
      extension: text(sourceFile.extension || copiedFile.extension).toLowerCase(),
      sizeBytes: Math.max(1, numberOr(copiedFile.sizeBytes, 1)),
      sha256,
      isPrimary: Boolean(sourceFile.isPrimary),
      notes: String(sourceFile.notes ?? '').trim(),
      addedAt: now
    };
  }

  function buildDuplicateProject(source, options = {}) {
    if (!source || typeof source !== 'object') throw new Error('Choose a project to duplicate.');
    const id = text(options.id);
    if (!id) throw new Error('The duplicated project needs a new ID.');
    const now = options.now || new Date().toISOString();
    const customerName = options.customerName === undefined
      ? text(source.customerName)
      : text(options.customerName);
    const productionFiles = Array.isArray(options.productionFiles)
      ? options.productionFiles.map((file) => ({ ...file }))
      : [];

    return {
      id,
      customerName,
      status: 'draft',
      isCustom: Boolean(source.isCustom),
      originalImagePath: options.originalImagePath || null,
      finishedImagePath: null,
      widthMm: source.widthMm ?? null,
      heightMm: source.heightMm ?? null,
      filamentUsage: copyUsage(source),
      paletteSelections: copyPalette(source),
      productionFiles,
      estimatedTimeMinutes: Math.max(0, numberOr(source.estimatedTimeMinutes, 0)),
      actualTimeMinutes: null,
      estimatedFilamentCost: 0,
      actualFilamentCost: null,
      otherCosts: Math.max(0, numberOr(source.otherCosts, 0)),
      floorPrice: 0,
      sellPrice: null,
      dateCreated: now,
      dateQuoted: null,
      datePrinted: null,
      dateDelivered: null,
      inventoryDeductedAt: null,
      inventoryDeductedUsage: [],
      captionDrafts: [],
      notes: String(source.notes ?? '').trim(),
      updatedAt: now
    };
  }

  function duplicationSummary(project) {
    const files = Array.isArray(project?.productionFiles) ? project.productionFiles : [];
    return {
      fileCount: files.length,
      productionBytes: totalProductionBytes(project),
      hasReferenceImage: Boolean(project?.originalImagePath)
    };
  }

  return {
    totalProductionBytes,
    formatBytes,
    remapProductionFile,
    buildDuplicateProject,
    duplicationSummary
  };
});
