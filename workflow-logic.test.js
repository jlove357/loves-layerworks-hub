const assert = require('node:assert/strict');
const logic = require('./workflow-logic');

const project = {
  id: 'project-1',
  status: 'printing',
  inventoryDeductedAt: null,
  filamentUsage: [
    { filamentId: 'black', gramsEstimated: 80 },
    { filamentId: 'red', gramsEstimated: 20 }
  ]
};
const filaments = [
  { id: 'black', rollCode: 'BLACK-001', colorName: 'Black', material: 'PLA+', currentFilamentWeightG: 1000, updatedAt: 'old' },
  { id: 'red', rollCode: 'RED-001', colorName: 'Red', material: 'PLA+', currentFilamentWeightG: 200, updatedAt: 'old' }
];

assert.equal(logic.shouldDeductInventory(project, 'finished'), true);
assert.equal(logic.shouldDeductInventory(project, 'delivered'), true);
assert.equal(logic.shouldDeductInventory(project, 'gallery'), true);
assert.equal(logic.shouldDeductInventory(project, 'printing'), false);
assert.equal(logic.shouldDeductInventory({ ...project, status: 'finished' }, 'delivered'), false);
assert.equal(logic.shouldDeductInventory({ ...project, inventoryDeductedAt: '2026-08-07T00:00:00.000Z' }, 'finished'), false);

const plan = logic.planInventoryDeduction(project, filaments);
assert.deepEqual(plan.map((entry) => [entry.rollCode, entry.grams, entry.remainingG]), [
  ['BLACK-001', 80, 920],
  ['RED-001', 20, 180]
]);
assert.deepEqual(logic.deductionProblems(plan), []);

const data = {
  filaments: structuredClone(filaments),
  projects: [structuredClone(project)]
};
const now = '2026-08-07T03:00:00.000Z';
logic.applyInventoryDeductionInPlace(data, project.id, plan, now);
assert.equal(data.filaments[0].currentFilamentWeightG, 920);
assert.equal(data.filaments[1].currentFilamentWeightG, 180);
assert.equal(data.projects[0].inventoryDeductedAt, now);
assert.deepEqual(data.projects[0].inventoryDeductedUsage, [
  { filamentId: 'black', grams: 80 },
  { filamentId: 'red', grams: 20 }
]);
assert.throws(() => logic.applyInventoryDeductionInPlace(data, project.id, plan, now), /already been deducted/i);

const shortagePlan = logic.planInventoryDeduction({
  ...project,
  filamentUsage: [{ filamentId: 'red', gramsEstimated: 250 }]
}, filaments);
assert.equal(shortagePlan[0].insufficient, true);
assert.throws(() => logic.applyInventoryDeductionInPlace({
  filaments: structuredClone(filaments),
  projects: [structuredClone(project)]
}, project.id, shortagePlan, now), /only 200 g remains/i);

const missingPlan = logic.planInventoryDeduction({
  ...project,
  filamentUsage: [{ filamentId: 'missing', gramsEstimated: 10 }]
}, filaments);
assert.equal(missingPlan[0].missing, true);

console.log('V2 workflow deduction logic tests passed.');
