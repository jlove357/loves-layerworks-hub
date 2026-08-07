(function exposePaletteLogic(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PaletteLogic = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function text(value) {
    return String(value ?? '').trim();
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

    const selectedTotal = selected.reduce((sum, color) => sum + color.count, 0) || 1;
    return selected.map(({ hex, count }) => ({
      hex,
      weight: count / selectedTotal
    }));
  }

  function activeFilaments(filaments) {
    return (Array.isArray(filaments) ? filaments : [])
      .filter((roll) => roll && !roll.archived && hexToRgb(roll.colorHex))
      .sort((a, b) => {
        const colorCompare = text(a.colorName).localeCompare(text(b.colorName), undefined, { sensitivity: 'base' });
        return colorCompare || text(a.rollCode).localeCompare(text(b.rollCode), undefined, { sensitivity: 'base' });
      });
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

  function matchColorsToInventory(colors, filaments) {
    const inventory = activeFilaments(filaments);
    const available = new Set(inventory.map((roll) => roll.id));
    const matches = [];

    for (const color of Array.isArray(colors) ? colors : []) {
      const sourceColorHex = text(color?.hex || color?.sourceColorHex).toLowerCase();
      if (!hexToRgb(sourceColorHex) || !available.size) continue;
      const candidates = inventory
        .filter((roll) => available.has(roll.id))
        .map((roll) => ({
          roll,
          distance: deltaE(sourceColorHex, roll.colorHex)
        }))
        .sort((a, b) => a.distance - b.distance);
      const winner = candidates[0];
      if (!winner) continue;
      available.delete(winner.roll.id);
      matches.push({
        sourceColorHex,
        sourceWeight: Number(color?.weight) || null,
        filamentId: winner.roll.id,
        distance: winner.distance
      });
    }
    return matches;
  }

  function normalizeSelections(selections, filaments) {
    const filamentIds = new Set((Array.isArray(filaments) ? filaments : []).map((roll) => roll?.id).filter(Boolean));
    const seen = new Set();
    const normalized = [];
    for (const selection of Array.isArray(selections) ? selections : []) {
      const filamentId = text(selection?.filamentId);
      const sourceColorHex = text(selection?.sourceColorHex).toLowerCase();
      if (!filamentIds.has(filamentId) || seen.has(filamentId) || !hexToRgb(sourceColorHex)) continue;
      seen.add(filamentId);
      normalized.push({ filamentId, sourceColorHex });
    }
    return normalized;
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
    effectiveTd,
    matchColorsToInventory,
    normalizeSelections,
    moveSelection,
    replaceSelection
  };
}));
