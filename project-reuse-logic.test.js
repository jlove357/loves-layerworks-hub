const assert = require('node:assert/strict');
const logic = require('./project-reuse-logic');

const source = {
  id: 'source-project',
  customerName: 'Original Customer',
  status: 'gallery',
  isCustom: true,
  originalImagePath: 'images/originals/source.png',
  finishedImagePath: 'images/finished/finished.png',
  widthMm: 200,
  heightMm: 150,
  filamentUsage: [
    { filamentId: 'roll-a', gramsEstimated: 42.5, gramsActual: 44, printOrder: 1, swapLayer: 8 }
  ],
  paletteSelections: [
    { filamentId: 'roll-a', sourceColorHex: '#ABCDEF' }
  ],
  productionFiles: [
    { id: 'old-file', sizeBytes: 1024, isPrimary: true }
  ],
  estimatedTimeMinutes: 180,
  actualTimeMinutes: 190,
  estimatedFilamentCost: 3.25,
  actualFilamentCost: 3.4,
  otherCosts: 1.5,
  floorPrice: 22,
  sellPrice: 40,
  dateCreated: '2026-01-01T00:00:00.000Z',
  dateQuoted: '2026-01-02T00:00:00.000Z',
  datePrinted: '2026-01-03T00:00:00.000Z',
  dateDelivered: '2026-01-04T00:00:00.000Z',
  inventoryDeductedAt: '2026-01-03T00:00:00.000Z',
  inventoryDeductedUsage: [{ filamentId: 'roll-a', grams: 42.5 }],
  captionDrafts: ['old caption'],
  notes: 'Keep the useful production notes.'
};

const copiedProduction = [{
  id: 'new-file',
  label: 'Final',
  role: 'bambu_project',
  originalFileName: 'piece.3mf',
  storedFileName: 'new-file_piece.3mf',
  relativePath: 'files/projects/new-project/production/new-file_piece.3mf',
  extension: '.3mf',
  sizeBytes: 1024,
  sha256: 'a'.repeat(64),
  isPrimary: true,
  notes: 'Ready to print',
  addedAt: '2026-08-07T00:00:00.000Z'
}];

const duplicate = logic.buildDuplicateProject(source, {
  id: 'new-project',
  customerName: 'New Customer',
  productionFiles: copiedProduction,
  originalImagePath: 'images/originals/new.png',
  now: '2026-08-07T12:00:00.000Z'
});

assert.equal(duplicate.id, 'new-project');
assert.equal(duplicate.customerName, 'New Customer');
assert.equal(duplicate.status, 'draft');
assert.equal(duplicate.isCustom, true);
assert.equal(duplicate.originalImagePath, 'images/originals/new.png');
assert.equal(duplicate.finishedImagePath, null);
assert.equal(duplicate.sellPrice, null);
assert.equal(duplicate.dateQuoted, null);
assert.equal(duplicate.datePrinted, null);
assert.equal(duplicate.dateDelivered, null);
assert.equal(duplicate.inventoryDeductedAt, null);
assert.deepEqual(duplicate.inventoryDeductedUsage, []);
assert.deepEqual(duplicate.captionDrafts, []);
assert.equal(duplicate.actualTimeMinutes, null);
assert.equal(duplicate.actualFilamentCost, null);
assert.equal(duplicate.floorPrice, 0);
assert.equal(duplicate.estimatedFilamentCost, 0);
assert.equal(duplicate.notes, source.notes);
assert.deepEqual(duplicate.productionFiles, copiedProduction);
assert.deepEqual(duplicate.paletteSelections, [{ filamentId: 'roll-a', sourceColorHex: '#abcdef' }]);
assert.deepEqual(duplicate.filamentUsage, [{
  filamentId: 'roll-a',
  gramsEstimated: 42.5,
  gramsActual: null,
  printOrder: 1,
  swapLayer: 8
}]);
assert.equal(source.filamentUsage[0].gramsActual, 44, 'source project must not be mutated');

assert.equal(logic.totalProductionBytes({ productionFiles: [{ sizeBytes: 1024 }, { sizeBytes: 2048 }] }), 3072);
assert.equal(logic.duplicationSummary(source).fileCount, 1);
assert.equal(logic.duplicationSummary(source).hasReferenceImage, true);

const remapped = logic.remapProductionFile({
  label: 'Reusable plate',
  role: 'bambu_project',
  originalFileName: 'plate.3mf',
  extension: '.3mf',
  sizeBytes: 200,
  sha256: 'b'.repeat(64),
  isPrimary: true,
  notes: 'Use textured plate'
}, {
  originalFileName: 'plate.3mf',
  storedFileName: 'new-id_plate.3mf',
  relativePath: 'files/projects/new-project/production/new-id_plate.3mf',
  extension: '.3mf',
  sizeBytes: 200,
  sha256: 'b'.repeat(64)
}, 'new-id', '2026-08-07T12:00:00.000Z');

assert.deepEqual(remapped, {
  id: 'new-id',
  label: 'Reusable plate',
  role: 'bambu_project',
  originalFileName: 'plate.3mf',
  storedFileName: 'new-id_plate.3mf',
  relativePath: 'files/projects/new-project/production/new-id_plate.3mf',
  extension: '.3mf',
  sizeBytes: 200,
  sha256: 'b'.repeat(64),
  isPrimary: true,
  notes: 'Use textured plate',
  addedAt: '2026-08-07T12:00:00.000Z'
});

console.log('PF3 project reuse logic tests passed.');
