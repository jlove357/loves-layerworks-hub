const assert = require('node:assert/strict');
const fs = require('node:fs');
const logic = require('./palette-logic');

function pixels(entries) {
  const values = [];
  for (const [red, green, blue, count] of entries) {
    for (let index = 0; index < count; index += 1) values.push(red, green, blue, 255);
  }
  return new Uint8ClampedArray(values);
}

const dominant = logic.extractDominantColors(pixels([
  [240, 20, 20, 60],
  [20, 220, 30, 30],
  [20, 30, 230, 10]
]), 3);
assert.equal(dominant.length, 3);
assert.equal(dominant[0].hex, '#f01414');
assert.ok(dominant[0].weight > dominant[1].weight);
assert.ok(dominant[1].weight > dominant[2].weight);

const filaments = [
  { id: 'black-1', rollCode: 'sun-black-001', brand: 'SUNLU', material: 'PLA+', colorName: 'Black', colorHex: '#101010', currentFilamentWeightG: 1000, archived: false, tdStock: 0.8, tdMeasured: null },
  { id: 'black-2', rollCode: 'sun-black-002', brand: 'SUNLU', material: 'PLA+', colorName: 'Black', colorHex: '#101010', currentFilamentWeightG: 900, archived: false, tdStock: 0.8, tdMeasured: null },
  { id: 'black-3', rollCode: 'sun-black-003', brand: 'SUNLU', material: 'PLA+', colorName: 'Black', colorHex: '#101010', currentFilamentWeightG: 800, archived: false, tdStock: 0.8, tdMeasured: null },
  { id: 'gray', rollCode: 'sun-gray-001', brand: 'SUNLU', material: 'PLA+', colorName: 'Gray', colorHex: '#4b4b48', currentFilamentWeightG: 700, archived: false, tdStock: 1.4, tdMeasured: null },
  { id: 'red', rollCode: 'sun-red-001', brand: 'SUNLU', material: 'PLA+', colorName: 'Red', colorHex: '#8a201c', currentFilamentWeightG: 650, archived: false, tdStock: 2.1, tdMeasured: 1.9 },
  { id: 'orange', rollCode: 'sun-orange-001', brand: 'SUNLU', material: 'PLA+', colorName: 'Orange', colorHex: '#b94f22', currentFilamentWeightG: 600, archived: false, tdStock: 2.2, tdMeasured: null },
  { id: 'white', rollCode: 'sun-white-001', brand: 'SUNLU', material: 'PLA+', colorName: 'White', colorHex: '#eeeeea', currentFilamentWeightG: 500, archived: false, tdStock: 4.0, tdMeasured: null },
  { id: 'petg-chestnut', rollCode: 'sun-petg-chestnut', brand: 'SUNLU', material: 'PETG', colorName: 'Roasted Chestnut', colorHex: '#571816', currentFilamentWeightG: 1000, archived: false, tdStock: 2.4, tdMeasured: null },
  { id: 'archived-blue', rollCode: 'sun-blue-old', brand: 'SUNLU', material: 'PLA+', colorName: 'Blue', colorHex: '#1010ee', currentFilamentWeightG: 200, archived: true, tdStock: 4.1, tdMeasured: null }
];

const plaTypes = logic.activeFilamentTypes(filaments, 'PLA+');
assert.equal(plaTypes.length, 5);
const blackType = plaTypes.find((type) => type.colorName === 'Black');
assert.ok(blackType);
assert.equal(blackType.stockCount, 3);
assert.equal(blackType.totalWeightG, 2700);
assert.equal(blackType.representativeId, 'black-1');
assert.deepEqual(blackType.rolls.map((roll) => roll.id), ['black-1', 'black-2', 'black-3']);

const darkImageColors = [
  { hex: '#0a0909', weight: 0.29 },
  { hex: '#282625', weight: 0.06 },
  { hex: '#381615', weight: 0.02 },
  { hex: '#4b4643', weight: 0.02 },
  { hex: '#571816', weight: 0.01 }
];
const plaMatches = logic.matchColorsToInventory(darkImageColors, filaments, 'PLA+');
assert.equal(plaMatches.length, 5);
assert.equal(plaMatches.filter((match) => match.filamentTypeKey === blackType.key).length, 1);
assert.equal(new Set(plaMatches.map((match) => match.filamentTypeKey)).size, plaMatches.length);
assert.ok(plaMatches.every((match) => filaments.find((roll) => roll.id === match.filamentId)?.material === 'PLA+'));
assert.ok(plaMatches.every((match) => match.filamentId !== 'petg-chestnut'));
assert.ok(plaMatches.every((match) => match.filamentId !== 'archived-blue'));

const petgMatches = logic.matchColorsToInventory([{ hex: '#571816', weight: 1 }], filaments, 'PETG');
assert.deepEqual(petgMatches.map((match) => match.filamentId), ['petg-chestnut']);
assert.deepEqual(new Set(logic.materialOptions(filaments)), new Set(['PLA+', 'PETG']));
assert.equal(logic.inferProjectMaterial({ filamentUsage: [{ filamentId: 'black-1' }, { filamentId: 'red' }] }, filaments), 'PLA+');
assert.equal(logic.inferProjectMaterial({ filamentUsage: [{ filamentId: 'black-1' }, { filamentId: 'petg-chestnut' }] }, filaments), '');

assert.deepEqual(logic.effectiveTd(filaments.find((roll) => roll.id === 'red')), { value: 1.9, source: 'Measured TD' });
assert.deepEqual(logic.effectiveTd(filaments.find((roll) => roll.id === 'gray')), { value: 1.4, source: 'Stock TD' });
assert.deepEqual(logic.effectiveTd({ tdStock: null, tdMeasured: null }), { value: null, source: 'TD not entered' });

const selections = [
  { sourceColorHex: '#0a0909', filamentId: 'black-1' },
  { sourceColorHex: '#8a201c', filamentId: 'red' }
];
assert.deepEqual(logic.moveSelection(selections, 1, 'up').map((item) => item.filamentId), ['red', 'black-1']);
assert.deepEqual(logic.replaceSelection(selections, 0, 'red').map((item) => item.filamentId), ['red', 'black-1']);
assert.deepEqual(logic.normalizeSelections([
  ...selections,
  { sourceColorHex: '#222222', filamentId: 'black-2' },
  { sourceColorHex: '#571816', filamentId: 'petg-chestnut' },
  { sourceColorHex: 'bad', filamentId: 'gray' }
], filaments, 'PLA+'), selections);

const rendererText = fs.readFileSync('renderer-palette.js', 'utf8');
assert.match(rendererText, /Closest inventory colors/);
assert.match(rendererText, /Material to match/);
assert.match(rendererText, /Identical physical rolls are grouped as one color candidate/);
assert.match(rendererText, /active .* inventory only/);
assert.doesNotMatch(rendererText, /best filament stack/i);
assert.match(rendererText, /Camera processing, lighting, display calibration/);

console.log('Palette Assistant matching patch tests passed.');
