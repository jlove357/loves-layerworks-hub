const assert = require('node:assert/strict');
const logic = require('./gallery-logic');

const filaments = [
  { id: 'roll-a', colorName: 'Black', brand: 'SUNLU', material: 'PLA+', rollCode: 'BLACK-1' },
  { id: 'roll-b', colorName: 'White', brand: 'SUNLU', material: 'PLA+', rollCode: 'WHITE-1' }
];
const projects = [
  {
    id: 'draft', status: 'draft', customerName: 'Draft', widthMm: 100, heightMm: 100,
    filamentUsage: [{ filamentId: 'roll-a' }], dateCreated: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'small', status: 'finished', customerName: 'Small Black', widthMm: 120, heightMm: 100,
    filamentUsage: [{ filamentId: 'roll-a' }], datePrinted: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z'
  },
  {
    id: 'medium', status: 'delivered', customerName: 'Medium White', widthMm: 200, heightMm: 160,
    filamentUsage: [{ filamentId: 'roll-b' }], dateDelivered: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z'
  },
  {
    id: 'large', status: 'gallery', customerName: 'Large Black', widthMm: 300, heightMm: 200,
    filamentUsage: [{ filamentId: 'roll-a' }], datePrinted: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z'
  }
];

assert.deepEqual(logic.filterProjects(projects, filaments).map((item) => item.id), ['large', 'medium', 'small']);
assert.deepEqual(logic.filterProjects(projects, filaments, { status: 'delivered' }).map((item) => item.id), ['medium']);
assert.deepEqual(logic.filterProjects(projects, filaments, { size: 'small' }).map((item) => item.id), ['small']);
assert.deepEqual(logic.filterProjects(projects, filaments, { filamentId: 'roll-a' }).map((item) => item.id), ['large', 'small']);
assert.deepEqual(logic.filterProjects(projects, filaments, { query: 'white' }).map((item) => item.id), ['medium']);
assert.deepEqual(logic.filterProjects(projects, filaments, { from: '2026-03-01', through: '2026-03-31' }).map((item) => item.id), ['medium']);

const finished = logic.applyStatusDates({ status: 'quoted', datePrinted: null, dateDelivered: null }, 'finished', '2026-05-01T12:00:00Z');
assert.equal(finished.datePrinted, '2026-05-01T12:00:00Z');
assert.equal(finished.dateDelivered, null);
const delivered = logic.applyStatusDates(finished, 'delivered', '2026-05-02T12:00:00Z');
assert.equal(delivered.datePrinted, '2026-05-01T12:00:00Z');
assert.equal(delivered.dateDelivered, '2026-05-02T12:00:00Z');

console.log('Gallery logic tests passed.');
