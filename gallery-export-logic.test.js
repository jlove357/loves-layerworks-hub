const assert = require('node:assert/strict');
const logic = require('./gallery-export-logic');

const project = {
  customerName: 'Test Piece',
  isCustom: true,
  widthMm: 200,
  heightMm: 150,
  filamentUsage: [
    { filamentId: 'black' },
    { filamentId: 'white' },
    { filamentId: 'black-2' }
  ]
};
const filaments = [
  { id: 'black', colorName: 'Black' },
  { id: 'white', colorName: 'White' },
  { id: 'black-2', colorName: 'Black' }
];

const captions = logic.createCaptionTemplates(project, filaments, "Love's LayerWorks");
assert.equal(captions.length, 3);
assert.equal(new Set(captions).size, 3);
for (const caption of captions) {
  assert.match(caption, /200 × 150 mm/);
  assert.match(caption, /Black and White/);
  assert.match(caption, /Love's LayerWorks/);
  assert.doesNotMatch(caption, /undefined|null/);
}

assert.deepEqual(logic.normalizeDrafts([' One ', '', 'one', 'Two']), ['One', 'Two']);
assert.deepEqual(logic.addDraft(['One'], 'Two'), ['One', 'Two']);
assert.deepEqual(logic.addDraft(['One'], ' one '), ['One']);
assert.deepEqual(logic.removeDraft(['One', 'Two'], 0), ['Two']);
assert.equal(logic.safeExportStem({ customerName: 'Josh / Test: Piece!' }), 'josh-test-piece');
assert.equal(logic.safeExportStem({ customerName: '' }), 'stock-personal-project');

console.log('Gallery export logic tests passed.');
