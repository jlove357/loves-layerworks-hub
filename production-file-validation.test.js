const assert = require('node:assert/strict');
const { normalizeHubData } = require('./hub-validation');

const projectId = '11111111-1111-4111-8111-111111111111';
const fileId = '22222222-2222-4222-8222-222222222222';
const secondFileId = '33333333-3333-4333-8333-333333333333';
const now = '2026-08-07T04:30:00.000Z';

function baseData(project) {
  return {
    schemaVersion: 2,
    updatedAt: now,
    settings: {},
    filaments: [],
    projects: [project]
  };
}

function productionFile(id = fileId, overrides = {}) {
  const storedFileName = `${id}_Dragon_Eye.stl`;
  return {
    id,
    label: 'Final Dragon Eye',
    role: 'stl_model',
    originalFileName: 'Dragon Eye.stl',
    storedFileName,
    relativePath: `files/projects/${projectId}/production/${storedFileName}`,
    extension: '.stl',
    sizeBytes: 123456,
    sha256: 'a'.repeat(64),
    isPrimary: true,
    notes: 'Known-good printable model',
    addedAt: now,
    ...overrides
  };
}

const legacy = normalizeHubData(baseData({ id: projectId, status: 'draft' }));
assert.deepEqual(legacy.projects[0].productionFiles, []);

const normalized = normalizeHubData(baseData({
  id: projectId,
  status: 'quoted',
  productionFiles: [productionFile()]
}));
assert.equal(normalized.projects[0].productionFiles.length, 1);
assert.equal(normalized.projects[0].productionFiles[0].role, 'stl_model');
assert.equal(normalized.projects[0].productionFiles[0].isPrimary, true);

assert.throws(() => normalizeHubData(baseData({
  id: projectId,
  status: 'draft',
  productionFiles: [
    productionFile(),
    productionFile(secondFileId, { isPrimary: true })
  ]
})), /only have one primary production file/i);

assert.throws(() => normalizeHubData(baseData({
  id: projectId,
  status: 'draft',
  productionFiles: [productionFile(fileId, {
    relativePath: `files/projects/44444444-4444-4444-8444-444444444444/production/${fileId}_Dragon_Eye.stl`
  })]
})), /does not belong to its project/i);

assert.throws(() => normalizeHubData(baseData({
  id: projectId,
  status: 'draft',
  productionFiles: [productionFile(fileId, { sha256: 'not-a-hash' })]
})), /SHA256 must contain 64 hexadecimal characters/i);

console.log('PF1 production file validation tests passed.');
