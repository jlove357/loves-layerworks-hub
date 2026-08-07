const assert = require('node:assert/strict');
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
  { id: 'red', colorName: 'Red', colorHex: '#ee1010', archived: false, tdStock: 3.2, tdMeasured: 2.9 },
  { id: 'blue-archived', colorName: 'Blue', colorHex: '#1010ee', archived: true, tdStock: 4.1, tdMeasured: null },
  { id: 'green', colorName: 'Green', colorHex: '#10dd20', archived: false, tdStock: 3.8, tdMeasured: null }
];
const matches = logic.matchColorsToInventory([
  { hex: '#f00000', weight: 0.6 },
  { hex: '#0000f0', weight: 0.4 }
], filaments);
assert.deepEqual(matches.map((item) => item.filamentId), ['red', 'green']);
assert.ok(matches.every((item) => item.filamentId !== 'blue-archived'));

assert.deepEqual(logic.effectiveTd(filaments[0]), { value: 2.9, source: 'Measured TD' });
assert.deepEqual(logic.effectiveTd(filaments[2]), { value: 3.8, source: 'Stock TD' });
assert.deepEqual(logic.effectiveTd({ tdStock: null, tdMeasured: null }), { value: null, source: 'TD not entered' });

const selections = [
  { sourceColorHex: '#ff0000', filamentId: 'red' },
  { sourceColorHex: '#00ff00', filamentId: 'green' }
];
assert.deepEqual(logic.moveSelection(selections, 1, 'up').map((item) => item.filamentId), ['green', 'red']);
assert.deepEqual(logic.replaceSelection(selections, 0, 'green').map((item) => item.filamentId), ['green', 'red']);
assert.deepEqual(logic.normalizeSelections([
  ...selections,
  { sourceColorHex: '#0000ff', filamentId: 'red' },
  { sourceColorHex: 'bad', filamentId: 'green' }
], filaments), selections);

console.log('Palette Assistant logic tests passed.');
