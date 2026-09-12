(function exposeGalleryLogic(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GalleryLogic = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const ELIGIBLE_STATUSES = Object.freeze(['finished', 'delivered', 'gallery']);
  const ALL_STATUSES = Object.freeze([
    'draft', 'quoted', 'approved', 'printing', 'finished', 'delivered', 'gallery', 'cancelled'
  ]);

  function isEligible(project) {
    return Boolean(project && ELIGIBLE_STATUSES.includes(project.status));
  }

  function projectDate(project) {
    return project?.dateDelivered || project?.datePrinted || project?.updatedAt || project?.dateCreated || null;
  }

  function dateOnly(value) {
    if (!value || Number.isNaN(Date.parse(value))) return '';
    return new Date(value).toISOString().slice(0, 10);
  }

  function longestSide(project) {
    const width = Number(project?.widthMm);
    const height = Number(project?.heightMm);
    const sides = [width, height].filter((value) => Number.isFinite(value) && value > 0);
    return sides.length ? Math.max(...sides) : null;
  }

  function sizeBucket(project) {
    const longest = longestSide(project);
    if (longest === null) return 'unknown';
    if (longest <= 150) return 'small';
    if (longest <= 250) return 'medium';
    return 'large';
  }

  function projectFilamentIds(project) {
    if (!Array.isArray(project?.filamentUsage)) return [];
    return project.filamentUsage.map((usage) => usage?.filamentId).filter(Boolean);
  }

  function searchText(project, filamentMap) {
    const rollText = projectFilamentIds(project).map((id) => {
      const roll = filamentMap.get(id);
      return roll ? `${roll.colorName} ${roll.brand} ${roll.material} ${roll.rollCode}` : id;
    }).join(' ');
    return `${project.customerName || ''} ${project.status || ''} ${project.notes || ''} ${rollText}`.toLocaleLowerCase();
  }

  function filterProjects(projects, filaments, filters = {}) {
    const filamentMap = new Map((filaments || []).map((roll) => [roll.id, roll]));
    const query = String(filters.query || '').trim().toLocaleLowerCase();
    const status = filters.status || 'all';
    const size = filters.size || 'all';
    const filamentId = filters.filamentId || 'all';
    const from = filters.from || '';
    const through = filters.through || '';

    return (projects || [])
      .filter(isEligible)
      .filter((project) => status === 'all' || project.status === status)
      .filter((project) => size === 'all' || sizeBucket(project) === size)
      .filter((project) => filamentId === 'all' || projectFilamentIds(project).includes(filamentId))
      .filter((project) => {
        const date = dateOnly(projectDate(project));
        if (from && (!date || date < from)) return false;
        if (through && (!date || date > through)) return false;
        return true;
      })
      .filter((project) => !query || searchText(project, filamentMap).includes(query))
      .sort((a, b) => String(projectDate(b) || '').localeCompare(String(projectDate(a) || '')));
  }

  function applyStatusDates(project, status, now = new Date().toISOString()) {
    if (!ALL_STATUSES.includes(status)) throw new Error(`Unsupported project status: ${status}.`);
    const next = { ...project, status, updatedAt: now };
    if (['finished', 'delivered', 'gallery'].includes(status) && !next.datePrinted) next.datePrinted = now;
    if (['delivered', 'gallery'].includes(status) && !next.dateDelivered) next.dateDelivered = now;
    return next;
  }

  function displayName(project) {
    return project?.customerName || (project?.isCustom ? 'Custom project' : 'Stock / personal project');
  }

  return {
    ELIGIBLE_STATUSES,
    ALL_STATUSES,
    isEligible,
    projectDate,
    dateOnly,
    longestSide,
    sizeBucket,
    projectFilamentIds,
    filterProjects,
    applyStatusDates,
    displayName
  };
}));
