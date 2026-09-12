const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

(async () => {
  const tempDocuments = await fs.mkdtemp(path.join(os.tmpdir(), 'layerworks-pf2-'));
  const customParent = path.join(tempDocuments, 'ExternalStorage');
  await fs.mkdir(customParent, { recursive: true });
  let selectedFolder = customParent;

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') {
      return {
        app: { getPath: () => tempDocuments },
        dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [selectedFolder] }) }
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

    const events = [];
    const fakeEvent = { sender: { send: (channel, payload) => events.push({ channel, payload }) } };
    const moved = await service.relocateProductionStorage(fakeEvent, 'choose');
    assert.equal(moved.canceled, false);
    assert.equal(moved.status.isDefault, false);
    assert.equal(moved.status.root, path.join(customParent, service.LIBRARY_FOLDER_NAME));
    await fs.access(path.join(moved.status.root, 'projects'));
    assert.equal((await service.readStorageConfig()).customRoot, moved.status.root);
    assert.ok(events.some((entry) => entry.channel === 'hub:production-storage-progress'));

    const restored = await service.relocateProductionStorage(fakeEvent, 'default');
    assert.equal(restored.canceled, false);
    assert.equal(restored.status.isDefault, true);
    assert.equal(restored.status.root, expectedDefault);
    assert.equal((await service.readStorageConfig()).customRoot, null);
    await fs.access(path.join(expectedDefault, 'projects'));

    console.log('PF2 production storage service tests passed.');
  } finally {
    Module._load = originalLoad;
    await fs.rm(tempDocuments, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
