const assert = require('node:assert/strict');
const logic = require('./production-file-logic');

assert.equal(logic.inferRole('dragon.3mf'), 'bambu_project');
assert.equal(logic.inferRole('portrait.STL'), 'stl_model');
assert.equal(logic.inferRole('reference.png'), 'source_artwork');
assert.equal(logic.inferRole('mystery.hfp'), 'other');
assert.equal(logic.defaultLabel('Dragon Eye Final.3mf'), 'Dragon Eye Final');
assert.equal(logic.roleLabel('final_print'), 'Final Print File');
assert.equal(logic.isValidRole('chroma_canvas_project'), true);
assert.equal(logic.isValidRole('not-a-role'), false);

assert.equal(logic.sanitizeFileName('bad:name?.3mf'), 'bad_name_.3mf');
assert.equal(logic.sanitizeFileName(' folder\\Dragon Eye.stl '), 'Dragon Eye.stl');
assert.equal(logic.formatBytes(1024), '1.00 KB');
assert.equal(logic.formatBytes(10 * 1024 * 1024), '10.0 MB');
assert.equal(logic.needsLargeFileWarning(99 * 1024 * 1024), false);
assert.equal(logic.needsLargeFileWarning(100 * 1024 * 1024), true);

const longName = `${'a'.repeat(200)}.3mf`;
const sanitized = logic.sanitizeFileName(longName);
assert.ok(sanitized.length <= 140);
assert.ok(sanitized.endsWith('.3mf'));

console.log('PF1 production file logic tests passed.');
