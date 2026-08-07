const assert = require('node:assert/strict');
const service = require('./gallery-export-service');

assert.equal(service.safeStem('Josh / Test: Piece!'), 'josh-test-piece');
assert.equal(service.safeStem(''), 'gallery-project');

const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const decoded = service.decodePngDataUrl(`data:image/png;base64,${pngBytes.toString('base64')}`);
assert.deepEqual(decoded, pngBytes);
assert.throws(() => service.decodePngDataUrl('data:image/jpeg;base64,AAAA'), /must be PNG/);
assert.throws(() => service.decodePngDataUrl('data:image/png;base64,AAAA'), /valid PNG signature/);

console.log('Gallery export service tests passed.');
