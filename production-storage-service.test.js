const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

(async () => {
  const tempDocuments = await fs.mkdtemp(path.join(os.tmpdir(), 'layerworks-pf2-'));
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') {
      return {
        app: { getPath: () => tempDocuments },
        dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) }
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const service = require('./production-storage-service');
    Module._load = originalLoad;

    const expectedDefault = path.resolve(tempDocuments, "Love's LayerWorks Hub", 'files');
    assert.equal(service.defaultStorageRoot(), expectedDefault);

    const config = await service.readStorageConfig();
    assert.equal(config.version, 1);
    assert.equal(config.customRoot, null);

    const status = await service.getProductionStorageStatus();
    assert.equal(status.isDefault, true);
    assert.equal(status.root, expectedDefault);
    assert.equal(status.usageBytes, 0);
    await fs.access(path.join(expectedDefault, 'projects'));

    const disk = await service.freeSpaceFor(expectedDefault);
    assert.equal(Object.hasOwn(disk, 'freeBytes'), true);
    assert.equal(Object.hasOwn(disk, 'totalBytes'), true);
    assert.equal(disk.freeBytes === null || disk.freeBytes >= 0, true);

    console.log('PF2 production storage service tests passed.');
  } finally {
    Module._load = originalLoad;
    await fs.rm(tempDocuments, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
