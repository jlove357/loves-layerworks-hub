const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');

(async () => {
  const tempDocuments = await fs.mkdtemp(path.join(os.tmpdir(), 'layerworks-pf3-'));
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') {
      return {
        app: { getPath: () => tempDocuments },
        dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
        shell: { openPath: async () => '', showItemInFolder: () => {} }
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const { ensureHubStructure } = require('./hub-config');
    const storage = require('./production-storage-service');
    const production = require('./production-file-service');
    const images = require('./image-service');
    Module._load = originalLoad;

    const paths = await ensureHubStructure();
    await storage.ensureProductionStorage();

    const sourceProjectId = '11111111-1111-4111-8111-111111111111';
    const targetProjectId = '22222222-2222-4222-8222-222222222222';
    const sourceFileId = '33333333-3333-4333-8333-333333333333';
    const targetFileId = '44444444-4444-4444-8444-444444444444';
    const originalFileName = 'reusable-project.3mf';
    const sourceStoredName = `${sourceFileId}_${originalFileName}`;
    const sourceProductionDir = await storage.resolveProjectProductionDir(sourceProjectId);
    await fs.mkdir(sourceProductionDir, { recursive: true });
    const sourceProductionPath = path.join(sourceProductionDir, sourceStoredName);
    const productionBytes = Buffer.from('PF3 reusable production data');
    await fs.writeFile(sourceProductionPath, productionBytes);
    const expectedHash = crypto.createHash('sha256').update(productionBytes).digest('hex');

    const events = [];
    const fakeEvent = { sender: { send: (channel, payload) => events.push({ channel, payload }) } };
    const copied = await production.copyExistingProductionFile(fakeEvent, {
      sourceRelativePath: `files/projects/${sourceProjectId}/production/${sourceStoredName}`,
      originalFileName,
      projectId: targetProjectId,
      fileId: targetFileId
    });

    assert.equal(copied.ok, true);
    assert.equal(copied.originalFileName, originalFileName);
    assert.equal(copied.storedFileName, `${targetFileId}_${originalFileName}`);
    assert.equal(copied.relativePath, `files/projects/${targetProjectId}/production/${targetFileId}_${originalFileName}`);
    assert.equal(copied.sha256, expectedHash);
    assert.equal(copied.sizeBytes, productionBytes.length);
    assert.deepEqual(await fs.readFile(await storage.resolveProductionPath(copied.relativePath)), productionBytes);
    assert.ok(events.some((entry) => entry.channel === 'hub:production-file-progress' && entry.payload.status === 'complete'));

    const sourceImageName = `${sourceProjectId}-source.png`;
    const sourceImagePath = path.join(paths.originalsDir, sourceImageName);
    const imageBytes = Buffer.from([137, 80, 78, 71, 1, 2, 3, 4]);
    await fs.writeFile(sourceImagePath, imageBytes);
    const copiedImage = await images.copyExistingProjectImage(null, {
      sourceRelativePath: `images/originals/${sourceImageName}`,
      projectId: targetProjectId
    });
    assert.equal(copiedImage.ok, true);
    assert.notEqual(copiedImage.relativePath, `images/originals/${sourceImageName}`);
    assert.ok(copiedImage.relativePath.startsWith(`images/originals/${targetProjectId}-`));
    assert.deepEqual(await fs.readFile(path.join(paths.root, copiedImage.relativePath)), imageBytes);

    console.log('PF3 project reuse service tests passed.');
  } finally {
    Module._load = originalLoad;
    await fs.rm(tempDocuments, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
