(function exposePaletteLogic(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PaletteLogic = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function text(value) {
    return String(value ?? '').trim();
  }

  function normalized(value) {
    return text(value).toLocaleLowerCase();
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function channelHex(value) {
    return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  }

  function rgbToHex(red, green, blue) {
    return `#${channelHex(red)}${channelHex(green)}${channelHex(blue)}`;
  }

  function hexToRgb(value) {
    const hex = text(value).toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(hex)) return null;
    return {
      red: Number.parseInt(hex.slice(1, 3), 16),
      green: Number.parseInt(hex.slice(3, 5), 16),
      blue: Number.parseInt(hex.slice(5, 7), 16)
    };
  }

  function linearChannel(value) {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  }

  function rgbToLab(red, green, blue) {
    const r = linearChannel(red);
    const g = linearChannel(green);
    const b = linearChannel(blue);
    const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
    const y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750);
    const z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;
    const pivot = (value) => value > 0.008856
      ? Math.cbrt(value)
      : (7.787 * value) + (16 / 116);
    const fx = pivot(x);
    const fy = pivot(y);
    const fz = pivot(z);
    return {
      l: (116 * fy) - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz)
    };
  }

  function deltaE(first, second) {
    const firstRgb = typeof first === 'string' ? hexToRgb(first) : first;
    const secondRgb = typeof second === 'string' ? hexToRgb(second) : second;
    if (!firstRgb || !secondRgb) return Number.POSITIVE_INFINITY;
    const firstLab = rgbToLab(firstRgb.red, firstRgb.green, firstRgb.blue);
    const secondLab = rgbToLab(secondRgb.red, secondRgb.green, secondRgb.blue);
    return Math.hypot(
      firstLab.l - secondLab.l,
      firstLab.a - secondLab.a,
      firstLab.b - secondLab.b
    );
  }

  function extractDominantColors(pixelData, requestedLimit = 5) {
    if (!pixelData || typeof pixelData.length !== 'number' || pixelData.length < 4) return [];
    const limit = clamp(Math.trunc(Number(requestedLimit) || 5), 1, 8);
    const pixelCount = Math.floor(pixelData.length / 4);
    const pixelStep = Math.max(1, Math.floor(pixelCount / 30000));
    const bins = new Map();
    let sampled = 0;

    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += pixelStep) {
      const offset = pixelIndex * 4;
      const alpha = Number(pixelData[offset + 3]);
      if (alpha < 180) continue;
      const red = Number(pixelData[offset]);
      const green = Number(pixelData[offset + 1]);
      const blue = Number(pixelData[offset + 2]);
      if (![red, green, blue].every(Number.isFinite)) continue;
      const key = `${red >> 4}-${green >> 4}-${blue >> 4}`;
      const bin = bins.get(key) || { count: 0, red: 0, green: 0, blue: 0 };
      bin.count += 1;
      bin.red += red;
      bin.green += green;
      bin.blue += blue;
      bins.set(key, bin);
      sampled += 1;
    }

    if (!sampled) return [];

    const candidates = [...bins.values()]
      .map((bin) => ({
        count: bin.count,
        red: bin.red / bin.count,
        green: bin.green / bin.count,
        blue: bin.blue / bin.count
      }))
      .sort((a, b) => b.count - a.count);

    const selected = [];
    for (const candidate of candidates) {
      const hex = rgbToHex(candidate.red, candidate.green, candidate.blue);
      if (selected.some((item) => deltaE(item.hex, hex) < 11)) continue;
      selected.push({ hex, weight: candidate.count / sampled, count: candidate.count });
      if (selected.length >= limit) break;
    }

    if (selected.length < limit) {
      for (const candidate of candidates) {
        const hex = rgbToHex(candidate.red, candidate.green, candidate.blue);
        if (selected.some((item) => item.hex === hex)) continue;
        selected.push({ hex, weight: candidate.count / sampled, count: candidate.count });
        if (selected.length >= limit) break;
      }
    }

    return selected.map(({ hex, weight }) => ({ hex, weight }));
  }

  function activeFilaments(filaments) {
    return (Array.isArray(filaments) ? filaments : [])
      .filter((roll) => roll && !roll.archived && hexToRgb(roll.colorHex))
      .sort((a, b) => {
        const colorCompare = text(a.colorName).localeCompare(text(b.colorName), undefined, { sensitivity: 'base' });
        return colorCompare || text(a.rollCode).localeCompare(text(b.rollCode), undefined, { sensitivity: 'base' });
      });
  }

  function filamentTypeKey(roll) {
    if (!roll || !hexToRgb(roll.colorHex)) return '';
    return [roll.brand, roll.material, roll.colorName, String(roll.colorHex).toLowerCase()]
      .map(normalized)
      .join('|');
  }

  function materialOptions(filaments) {
    const labels = new Map();
    for (const roll of activeFilaments(filaments)) {
      const material = text(roll.material);
      const key = normalized(material);
      if (key && !labels.has(key)) labels.set(key, material);
    }
    return [...labels.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  function activeFilamentTypes(filaments, material = '') {
    const wantedMaterial = normalized(material);
    const groups = new Map();

    for (const roll of activeFilaments(filaments)) {
      if (wantedMaterial && normalized(roll.material) !== wantedMaterial) continue;
      const key = filamentTypeKey(roll);
      if (!key) continue;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          brand: text(roll.brand),
          material: text(roll.material),
          colorName: text(roll.colorName),
          colorHex: String(roll.colorHex).toLowerCase(),
          rolls: []
        });
      }
      groups.get(key).rolls.push(roll);
    }

    return [...groups.values()]
      .map((group) => {
        const rolls = [...group.rolls].sort((a, b) => {
          const weightDifference = Number(b.currentFilamentWeightG || 0) - Number(a.currentFilamentWeightG || 0);
          if (weightDifference) return weightDifference;
          return text(a.rollCode).localeCompare(text(b.rollCode), undefined, { sensitivity: 'base' });
        });
        const representativeRoll = rolls[0];
        return {
          ...group,
          rolls,
          representativeRoll,
          representativeId: representativeRoll?.id || '',
          stockCount: rolls.length,
          totalWeightG: rolls.reduce((sum, roll) => sum + (Number(roll.currentFilamentWeightG) || 0), 0)
        };
      })
      .sort((a, b) => {
        const colorCompare = a.colorName.localeCompare(b.colorName, undefined, { sensitivity: 'base' });
        if (colorCompare) return colorCompare;
        const brandCompare = a.brand.localeCompare(b.brand, undefined, { sensitivity: 'base' });
        if (brandCompare) return brandCompare;
        return a.colorHex.localeCompare(b.colorHex);
      });
  }

  function inferProjectMaterial(project, filaments) {
    const rollMap = new Map((Array.isArray(filaments) ? filaments : []).map((roll) => [roll?.id, roll]));
    const labels = new Map();
    for (const usage of Array.isArray(project?.filamentUsage) ? project.filamentUsage : []) {
      const roll = rollMap.get(usage?.filamentId);
      const material = text(roll?.material);
      const key = normalized(material);
      if (key && !labels.has(key)) labels.set(key, material);
    }
    return labels.size === 1 ? [...labels.values()][0] : '';
  }

  function effectiveTd(roll) {
    const measured = Number(roll?.tdMeasured);
    if (roll?.tdMeasured !== null && roll?.tdMeasured !== undefined && Number.isFinite(measured)) {
      return { value: measured, source: 'Measured TD' };
    }
    const stock = Number(roll?.tdStock);
    if (roll?.tdStock !== null && roll?.tdStock !== undefined && Number.isFinite(stock)) {
      return { value: stock, source: 'Stock TD' };
    }
    return { value: null, source: 'TD not entered' };
  }

  function matchColorsToInventory(colors, filaments, material = '') {
    const inventory = activeFilamentTypes(filaments, material);
    const available = new Set(inventory.map((type) => type.key));
    const matches = [];

    for (const color of Array.isArray(colors) ? colors : []) {
      const sourceColorHex = text(color?.hex || color?.sourceColorHex).toLowerCase();
      if (!hexToRgb(sourceColorHex) || !available.size) continue;
      const candidates = inventory
        .filter((type) => available.has(type.key))
        .map((type) => ({
          type,
          distance: deltaE(sourceColorHex, type.colorHex)
        }))
        .sort((a, b) => a.distance - b.distance);
      const winner = candidates[0];
      if (!winner) continue;
      available.delete(winner.type.key);
      matches.push({
        sourceColorHex,
        sourceWeight: Number(color?.weight) || null,
        filamentId: winner.type.representativeId,
        filamentTypeKey: winner.type.key,
        stockCount: winner.type.stockCount,
        totalWeightG: winner.type.totalWeightG,
        distance: winner.distance
      });
    }
    return matches;
  }

  function normalizeSelections(selections, filaments, material = '') {
    const rolls = Array.isArray(filaments) ? filaments : [];
    const rollMap = new Map(rolls.map((roll) => [roll?.id, roll]));
    const wantedMaterial = normalized(material);
    const seenTypes = new Set();
    const normalizedSelections = [];

    for (const selection of Array.isArray(selections) ? selections : []) {
      const filamentId = text(selection?.filamentId);
      const sourceColorHex = text(selection?.sourceColorHex).toLowerCase();
      const roll = rollMap.get(filamentId);
      const typeKey = filamentTypeKey(roll);
      if (!roll || !typeKey || seenTypes.has(typeKey) || !hexToRgb(sourceColorHex)) continue;
      if (wantedMaterial && normalized(roll.material) !== wantedMaterial) continue;
      seenTypes.add(typeKey);
      normalizedSelections.push({ filamentId, sourceColorHex });
    }
    return normalizedSelections;
  }

  function moveSelection(selections, index, direction) {
    const next = Array.isArray(selections) ? selections.map((item) => ({ ...item })) : [];
    const from = Number(index);
    const offset = direction === 'up' || Number(direction) < 0 ? -1 : 1;
    const to = from + offset;
    if (!Number.isInteger(from) || from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  }

  function replaceSelection(selections, index, filamentId) {
    const next = Array.isArray(selections) ? selections.map((item) => ({ ...item })) : [];
    const target = Number(index);
    if (!Number.isInteger(target) || target < 0 || target >= next.length || !text(filamentId)) return next;
    const duplicate = next.findIndex((item, itemIndex) => itemIndex !== target && item.filamentId === filamentId);
    if (duplicate >= 0) {
      const previous = next[target].filamentId;
      next[target].filamentId = filamentId;
      next[duplicate].filamentId = previous;
    } else {
      next[target].filamentId = filamentId;
    }
    return next;
  }

  return {
    rgbToHex,
    hexToRgb,
    rgbToLab,
    deltaE,
    extractDominantColors,
    activeFilaments,
    filamentTypeKey,
    materialOptions,
    activeFilamentTypes,
    inferProjectMaterial,
    effectiveTd,
    matchColorsToInventory,
    normalizeSelections,
    moveSelection,
    replaceSelection
  };
}));
