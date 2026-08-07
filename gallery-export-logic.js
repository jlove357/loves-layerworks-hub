(function exposeGalleryExportLogic(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GalleryExportLogic = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function text(value) {
    return String(value ?? '').trim();
  }

  function projectDisplayName(project) {
    return text(project?.customerName) || (project?.isCustom ? 'Custom project' : 'Stock / personal project');
  }

  function sizeLabel(project) {
    const width = Number(project?.widthMm);
    const height = Number(project?.heightMm);
    if (!(width > 0) || !(height > 0)) return 'finished';
    return `${width.toLocaleString(undefined, { maximumFractionDigits: 1 })} × ${height.toLocaleString(undefined, { maximumFractionDigits: 1 })} mm`;
  }

  function projectRolls(project, filaments) {
    const rollMap = new Map((filaments || []).map((roll) => [roll.id, roll]));
    return (project?.filamentUsage || [])
      .map((usage) => rollMap.get(usage?.filamentId))
      .filter(Boolean);
  }

  function colorList(project, filaments) {
    const colors = [];
    for (const roll of projectRolls(project, filaments)) {
      const color = text(roll.colorName);
      if (color && !colors.some((item) => item.toLocaleLowerCase() === color.toLocaleLowerCase())) colors.push(color);
    }
    if (!colors.length) return 'the selected filament colors';
    if (colors.length === 1) return colors[0];
    if (colors.length === 2) return `${colors[0]} and ${colors[1]}`;
    return `${colors.slice(0, -1).join(', ')}, and ${colors.at(-1)}`;
  }

  function brandSentence(brandLabel) {
    const brand = text(brandLabel);
    return brand ? `Created by ${brand}.` : '';
  }

  function createCaptionTemplates(project, filaments, brandLabel) {
    const size = sizeLabel(project);
    const colors = colorList(project, filaments);
    const brand = brandSentence(brandLabel);
    const captions = [
      `From reference to finished filament painting. This ${size} piece was built layer by layer using ${colors}. ${brand}`,
      `Finished and ready for the portfolio: a ${size} filament painting created with ${colors}. The side-by-side shows the original reference and the completed print. ${brand}`,
      `Layer by layer, color by color. This ${size} piece uses ${colors} to turn a flat reference into physical filament art. ${brand}`
    ];
    return captions.map((caption) => caption.replace(/\s+/g, ' ').trim());
  }

  function normalizeDrafts(drafts) {
    const normalized = [];
    for (const draft of Array.isArray(drafts) ? drafts : []) {
      const value = text(draft);
      if (!value) continue;
      if (!normalized.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) normalized.push(value);
    }
    return normalized;
  }

  function addDraft(drafts, draft) {
    return normalizeDrafts([...(Array.isArray(drafts) ? drafts : []), draft]);
  }

  function removeDraft(drafts, index) {
    const normalized = normalizeDrafts(drafts);
    if (!Number.isInteger(index) || index < 0 || index >= normalized.length) return normalized;
    normalized.splice(index, 1);
    return normalized;
  }

  function safeExportStem(project) {
    const base = projectDisplayName(project)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLocaleLowerCase();
    return (base || 'gallery-project').slice(0, 60);
  }

  return {
    projectDisplayName,
    sizeLabel,
    projectRolls,
    colorList,
    createCaptionTemplates,
    normalizeDrafts,
    addDraft,
    removeDraft,
    safeExportStem
  };
}));
