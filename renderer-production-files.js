(() => {
  const logic = window.ProductionFileLogic;
  if (!logic) throw new Error('Production File logic failed to load.');

  let selectedProjectId = null;
  let draftFiles = [];
  let copyInProgress = null;
  let storageOperation = null;
  let storageStatus = null;
  let fileHealth = new Map();
  let observer = null;

  function projectById(projectId) {
    return state.data?.projects?.find((project) => project.id === projectId) || null;
  }

  function projectLabel(project) {
    return project?.customerName || (project?.isCustom ? 'Custom project' : 'Stock / personal project');
  }

  function fileCountLabel(files) {
    const count = Array.isArray(files) ? files.length : 0;
    return `${count} ${count === 1 ? 'file' : 'files'}`;
  }

  function projectStorageBytes(files) {
    return (Array.isArray(files) ? files : []).reduce((sum, file) => sum + Number(file.sizeBytes || 0), 0);
  }

  function busy() {
    return Boolean(copyInProgress || storageOperation);
  }

  function duplicateMatches(sha256) {
    const hash = String(sha256 || '').toLocaleLowerCase();
    if (!hash || !state.data) return [];
    const matches = [];
    for (const project of state.data.projects) {
      for (const file of project.productionFiles || []) {
        if (String(file.sha256 || '').toLocaleLowerCase() === hash) {
          matches.push({ project, file });
        }
      }
    }
    return matches;
  }

  function installDialog() {
    if ($('#productionFilesDialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'productionFilesDialog';
    dialog.className = 'modal production-files-modal';
    dialog.innerHTML = `
      <div class="production-files-shell">
        <div class="modal-head">
          <div><small>PF2 · STORAGE & INTEGRITY</small><h2 id="productionFilesTitle">Production files</h2></div>
          <button id="closeProductionFiles" class="icon-button" type="button" aria-label="Close">×</button>
        </div>

        <section class="production-storage-card">
          <div class="production-storage-head">
            <div><small>PRODUCTION FILE STORAGE</small><strong id="productionStorageMode">Loading storage…</strong></div>
            <div class="production-storage-actions">
              <button id="refreshProductionStorage" type="button">Refresh</button>
              <button id="verifyProductionStorage" type="button">Verify library</button>
              <button id="changeProductionStorage" type="button">Change location</button>
              <button id="defaultProductionStorage" type="button">Use default</button>
            </div>
          </div>
          <code id="productionStoragePath">Loading…</code>
          <div class="production-storage-metrics">
            <span><small>Managed size</small><strong id="productionStorageUsage">—</strong></span>
            <span><small>Free space</small><strong id="productionStorageFree">—</strong></span>
          </div>
          <section id="productionStorageProgressPanel" class="production-copy-panel production-storage-progress" hidden>
            <div><strong id="productionStorageProgressTitle">Working…</strong><span id="productionStorageProgressText">Preparing</span></div>
            <progress id="productionStorageProgress" max="100" value="0"></progress>
            <button id="cancelProductionStorageOperation" type="button">Cancel</button>
          </section>
          <p id="productionStorageMessage" class="production-files-message">PF2 keeps the Hub database in Documents while allowing only the large Production Files library to move.</p>
        </section>

        <div class="production-files-toolbar">
          <div><strong id="productionFilesSummary">0 files</strong><small id="productionFilesStorage">0 B in this project</small></div>
          <button id="addProductionFile" class="primary" type="button">Add file</button>
        </div>
        <p class="production-files-intro">Logical project paths remain <code>files/projects/&lt;project-id&gt;/production/</code> even when the physical library is moved to another drive.</p>
        <section id="productionCopyPanel" class="production-copy-panel" hidden>
          <div><strong id="productionCopyName">Copying file…</strong><span id="productionCopyText">Preparing managed copy</span></div>
          <progress id="productionCopyProgress" max="100" value="0"></progress>
          <button id="cancelProductionCopy" type="button">Cancel copy</button>
        </section>
        <div id="productionFilesList" class="production-files-list"></div>
        <div id="productionFilesEmpty" class="empty-state" hidden>
          <b>No production files attached</b>
          <p>Add the STL, 3MF, HueForge/Chroma Canvas project, source artwork, or another file needed to reproduce this job.</p>
        </div>
        <p id="productionFilesMessage" class="production-files-message">Choose a saved project to manage its production files.</p>
        <div class="modal-actions"><button id="doneProductionFiles" class="primary" type="button">Done</button></div>
      </div>`;
    document.body.append(dialog);

    $('#closeProductionFiles').addEventListener('click', closeManager);
    $('#doneProductionFiles').addEventListener('click', closeManager);
    $('#addProductionFile').addEventListener('click', addFile);
    $('#cancelProductionCopy').addEventListener('click', cancelCopy);
    $('#refreshProductionStorage').addEventListener('click', refreshStorageStatus);
    $('#verifyProductionStorage').addEventListener('click', verifyLibrary);
    $('#changeProductionStorage').addEventListener('click', () => relocateStorage('choose'));
    $('#defaultProductionStorage').addEventListener('click', () => relocateStorage('default'));
    $('#cancelProductionStorageOperation').addEventListener('click', cancelStorageOperation);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog && !busy()) closeManager();
    });

    window.layerWorks.onProductionFileProgress((payload) => {
      if (!copyInProgress || payload?.copyId !== copyInProgress.copyId) return;
      $('#productionCopyProgress').value = Number(payload.percent || 0);
      $('#productionCopyName').textContent = payload.fileName || copyInProgress.fileName;
      $('#productionCopyText').textContent = payload.status === 'copying'
        ? `${logic.formatBytes(payload.transferredBytes)} / ${logic.formatBytes(payload.totalBytes)} · ${payload.percent}%`
        : payload.status === 'complete'
          ? 'Managed copy verified.'
          : payload.status === 'canceled'
            ? 'Copy canceled.'
            : 'Copy stopped.';
    });

    window.layerWorks.onProductionIntegrityProgress((payload) => {
      if (!storageOperation || storageOperation.type !== 'integrity') return;
      storageOperation.operationId = storageOperation.operationId || payload.operationId;
      $('#productionStorageProgress').value = Number(payload.percent || 0);
      $('#productionStorageProgressTitle').textContent = 'Verifying SHA-256 integrity…';
      $('#productionStorageProgressText').textContent = `${payload.completed} / ${payload.total} · ${payload.fileName || ''}`;
    });

    window.layerWorks.onProductionStorageProgress((payload) => {
      if (!storageOperation || storageOperation.type !== 'move') return;
      storageOperation.operationId = storageOperation.operationId || payload.operationId;
      $('#productionStorageProgress').value = Number(payload.percent || 0);
      $('#productionStorageProgressTitle').textContent = 'Moving Production Files…';
      $('#productionStorageProgressText').textContent = `${logic.formatBytes(payload.transferredBytes)} / ${logic.formatBytes(payload.totalBytes)} · ${payload.percent}%`;
    });
  }

  function renderStorageStatus() {
    if (!$('#productionStoragePath')) return;
    if (!storageStatus) {
      $('#productionStorageMode').textContent = 'Storage status unavailable';
      $('#productionStoragePath').textContent = '—';
      $('#productionStorageUsage').textContent = '—';
      $('#productionStorageFree').textContent = '—';
      return;
    }
    $('#productionStorageMode').textContent = storageStatus.isDefault ? 'Default Documents storage' : 'Custom production-file storage';
    $('#productionStoragePath').textContent = storageStatus.root;
    $('#productionStorageUsage').textContent = logic.formatBytes(storageStatus.usageBytes);
    $('#productionStorageFree').textContent = storageStatus.freeBytes === null ? 'Unavailable' : logic.formatBytes(storageStatus.freeBytes);
    $('#defaultProductionStorage').disabled = storageStatus.isDefault || busy();
    $('#refreshProductionStorage').disabled = busy();
    $('#verifyProductionStorage').disabled = busy();
    $('#changeProductionStorage').disabled = busy();
  }

  async function refreshStorageStatus() {
    try {
      storageStatus = await window.layerWorks.productionStorageStatus();
      renderStorageStatus();
    } catch (error) {
      $('#productionStorageMessage').textContent = `Storage status failed: ${error.message}`;
    }
  }

  async function refreshProjectHealth() {
    if (!selectedProjectId) return;
    try {
      const result = await window.layerWorks.checkProjectProductionFiles(selectedProjectId);
      fileHealth = new Map((result?.details || []).map((item) => [item.fileId, item]));
      renderManager();
    } catch (error) {
      $('#productionFilesMessage').textContent = `Could not check managed files: ${error.message}`;
    }
  }

  function healthBadge(file) {
    const health = fileHealth.get(file.id);
    if (!health) return null;
    const labels = {
      ok: 'Available',
      missing: 'Missing',
      size_mismatch: 'Size changed',
      hash_mismatch: 'Hash mismatch',
      error: 'Check failed'
    };
    const badge = createTextElement('span', `production-health production-health-${health.status}`, labels[health.status] || health.status);
    return badge;
  }

  function roleSelect(file) {
    const select = document.createElement('select');
    for (const option of logic.ROLE_OPTIONS) select.append(new Option(option.label, option.value));
    select.value = file.role;
    select.addEventListener('change', () => {
      file.role = select.value;
      markUnsaved(file.id);
    });
    return select;
  }

  function textInput(value, maxLength, onInput) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value || '';
    input.maxLength = maxLength;
    input.addEventListener('input', () => onInput(input.value));
    return input;
  }

  function makeFileRow(file) {
    const row = document.createElement('article');
    row.className = 'production-file-row';
    row.dataset.productionFileId = file.id;

    const identity = document.createElement('div');
    identity.className = 'production-file-identity';
    const top = document.createElement('div');
    top.className = 'production-file-name-line';
    top.append(createTextElement('strong', '', file.originalFileName));
    if (file.isPrimary) top.append(createTextElement('span', 'production-primary-badge', 'Primary'));
    const health = healthBadge(file);
    if (health) top.append(health);
    identity.append(
      top,
      createTextElement('span', '', `${logic.formatBytes(file.sizeBytes)} · ${file.extension || 'no extension'} · SHA256 ${String(file.sha256 || '').slice(0, 12)}…`),
      createTextElement('small', '', `Stored as ${file.storedFileName}`)
    );

    const fields = document.createElement('div');
    fields.className = 'production-file-fields';
    const label = document.createElement('label');
    label.append(createTextElement('span', '', 'Label'));
    label.append(textInput(file.label, 160, (value) => {
      file.label = value;
      markUnsaved(file.id);
    }));
    const role = document.createElement('label');
    role.append(createTextElement('span', '', 'Role'), roleSelect(file));
    const notes = document.createElement('label');
    notes.className = 'production-file-notes';
    notes.append(createTextElement('span', '', 'Notes'));
    const textarea = document.createElement('textarea');
    textarea.rows = 2;
    textarea.maxLength = 1000;
    textarea.value = file.notes || '';
    textarea.placeholder = 'Optional version, slicer, or reproduction notes';
    textarea.addEventListener('input', () => {
      file.notes = textarea.value;
      markUnsaved(file.id);
    });
    notes.append(textarea);
    fields.append(label, role, notes);

    const actions = document.createElement('div');
    actions.className = 'production-file-actions';
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'Open';
    open.addEventListener('click', () => openFile(file));
    const show = document.createElement('button');
    show.type = 'button';
    show.textContent = 'Show in folder';
    show.addEventListener('click', () => showFile(file));
    const primary = document.createElement('button');
    primary.type = 'button';
    primary.textContent = file.isPrimary ? 'Primary file' : 'Mark primary';
    primary.disabled = file.isPrimary;
    primary.addEventListener('click', () => markPrimary(file.id));
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'production-save-details';
    save.dataset.saveProductionId = file.id;
    save.textContent = 'Save details';
    save.disabled = true;
    save.addEventListener('click', () => saveDetails(file.id));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => removeFile(file.id));
    actions.append(open, show, primary, save, remove);

    row.append(identity, fields, actions);
    return row;
  }

  function renderManager() {
    const project = projectById(selectedProjectId);
    renderStorageStatus();
    if (!project) {
      draftFiles = [];
      $('#productionFilesTitle').textContent = 'Production files';
      $('#productionFilesSummary').textContent = '0 files';
      $('#productionFilesStorage').textContent = '0 B in this project';
      $('#productionFilesList').replaceChildren();
      $('#productionFilesEmpty').hidden = false;
      $('#addProductionFile').disabled = true;
      return;
    }

    $('#productionFilesTitle').textContent = `${projectLabel(project)} · Production files`;
    $('#productionFilesSummary').textContent = fileCountLabel(draftFiles);
    $('#productionFilesStorage').textContent = `${logic.formatBytes(projectStorageBytes(draftFiles))} in this project`;
    $('#productionFilesList').replaceChildren(...draftFiles.map(makeFileRow));
    $('#productionFilesEmpty').hidden = draftFiles.length > 0;
    $('#addProductionFile').disabled = busy();
    $('#closeProductionFiles').disabled = busy();
    $('#doneProductionFiles').disabled = busy();
    $('#productionFilesMessage').textContent = draftFiles.length
      ? 'Availability is checked when this manager opens. Use Verify library for full SHA-256 verification.'
      : 'Attach the production assets needed to reproduce this project later.';
  }

  function setStorageOperation(type, title, text) {
    storageOperation = { type, operationId: null };
    $('#productionStorageProgressPanel').hidden = false;
    $('#productionStorageProgress').value = 0;
    $('#productionStorageProgressTitle').textContent = title;
    $('#productionStorageProgressText').textContent = text;
    renderManager();
  }

  function clearStorageOperation() {
    storageOperation = null;
    $('#productionStorageProgressPanel').hidden = true;
    renderManager();
  }

  async function cancelStorageOperation() {
    if (!storageOperation?.operationId) {
      $('#productionStorageProgressText').textContent = 'Waiting for the operation to become cancelable…';
      return;
    }
    $('#cancelProductionStorageOperation').disabled = true;
    try {
      await window.layerWorks.cancelProductionStorageOperation(storageOperation.operationId);
    } catch (error) {
      $('#productionStorageMessage').textContent = `Cancel failed: ${error.message}`;
    } finally {
      $('#cancelProductionStorageOperation').disabled = false;
    }
  }

  async function verifyLibrary() {
    if (busy()) return;
    setStorageOperation('integrity', 'Verifying SHA-256 integrity…', 'Reading managed production files.');
    setStatus('Verifying Production Files integrity…', 'working');
    try {
      const result = await window.layerWorks.verifyProductionLibrary();
      if (result?.canceled) {
        setStatus('Production Files verification canceled', 'neutral');
        $('#productionStorageMessage').textContent = 'Integrity verification canceled. No files were changed.';
        return;
      }
      const counts = result?.counts || {};
      const problems = (result?.details || []).filter((item) => item.status !== 'ok');
      fileHealth = new Map((result?.details || [])
        .filter((item) => item.projectId === selectedProjectId)
        .map((item) => [item.fileId, item]));
      if (problems.length) {
        $('#productionStorageMessage').textContent = `Verification found ${problems.length} problem(s): ${counts.missing || 0} missing, ${counts.size_mismatch || 0} size mismatch, ${counts.hash_mismatch || 0} hash mismatch.`;
        setStatus(`Production Files verification found ${problems.length} problem(s)`, 'error');
      } else {
        $('#productionStorageMessage').textContent = `Verified ${result.total} production file(s). Size and SHA-256 match the project records.`;
        setStatus(`Verified ${result.total} production file(s)`, 'success');
      }
    } catch (error) {
      $('#productionStorageMessage').textContent = `Verification failed: ${error.message}`;
      setStatus(`Production Files verification failed: ${error.message}`, 'error');
    } finally {
      clearStorageOperation();
      await refreshStorageStatus();
    }
  }

  async function relocateStorage(mode) {
    if (busy()) return;
    if (mode === 'default' && storageStatus?.isDefault) return;
    const wording = mode === 'default' ? 'move the Production Files library back to the default Documents location' : 'move the Production Files library to a new location';
    if (!confirm(`PF2 will ${wording}.\n\nEvery referenced file is SHA-256 verified before and after copying. The current source is not removed until the new location is verified and activated. Continue?`)) return;

    setStorageOperation('move', 'Preparing verified storage move…', 'Verifying the current library before copying.');
    setStatus('Preparing Production Files storage move…', 'working');
    try {
      const result = await window.layerWorks.relocateProductionStorage(mode);
      if (result?.canceled) {
        $('#productionStorageMessage').textContent = 'Storage move canceled. The existing storage location remains authoritative.';
        setStatus('Production Files storage move canceled', 'neutral');
        return;
      }
      storageStatus = result.status || await window.layerWorks.productionStorageStatus();
      $('#productionStorageMessage').textContent = result.cleanupWarning || `Production Files moved and verified. ${logic.formatBytes(result.movedBytes || 0)} relocated.`;
      setStatus('Production Files storage moved and verified', result.cleanupWarning ? 'neutral' : 'success');
      await refreshProjectHealth();
    } catch (error) {
      $('#productionStorageMessage').textContent = `Storage move failed safely: ${error.message}`;
      setStatus(`Production Files storage move failed: ${error.message}`, 'error');
    } finally {
      clearStorageOperation();
      await refreshStorageStatus();
    }
  }

  function markUnsaved(fileId) {
    const button = $(`[data-save-production-id="${fileId}"]`);
    if (button) button.disabled = false;
    $('#productionFilesMessage').textContent = 'Unsaved file-detail changes.';
  }

  async function persistDraft(message) {
    const next = structuredClone(state.data);
    const project = next.projects.find((item) => item.id === selectedProjectId);
    if (!project) throw new Error('The selected project no longer exists.');
    project.productionFiles = structuredClone(draftFiles);
    project.updatedAt = new Date().toISOString();
    const saved = await commitData(next, message);
    if (!saved) return false;
    const refreshed = projectById(selectedProjectId);
    draftFiles = structuredClone(refreshed?.productionFiles || []);
    renderManager();
    decorateExisting();
    return true;
  }

  async function openManager(projectId) {
    const project = projectById(projectId);
    if (!project) return;
    selectedProjectId = project.id;
    draftFiles = structuredClone(project.productionFiles || []);
    copyInProgress = null;
    storageOperation = null;
    fileHealth = new Map();
    $('#productionCopyPanel').hidden = true;
    $('#productionStorageProgressPanel').hidden = true;
    renderManager();
    $('#productionFilesDialog').showModal();
    await Promise.all([refreshStorageStatus(), refreshProjectHealth()]);
  }

  function closeManager() {
    if (busy()) return;
    if ($('#productionFilesDialog').open) $('#productionFilesDialog').close();
    selectedProjectId = null;
    draftFiles = [];
    fileHealth = new Map();
  }

  async function addFile() {
    const project = projectById(selectedProjectId);
    if (!project || busy()) return;
    let copiedPath = null;
    try {
      const selected = await window.layerWorks.selectProductionFile();
      if (selected?.canceled) return;
      if (logic.needsLargeFileWarning(selected.sizeBytes)) {
        const available = storageStatus?.freeBytes === null || storageStatus?.freeBytes === undefined
          ? 'Free-space reading unavailable.'
          : `${logic.formatBytes(storageStatus.freeBytes)} free at the current storage location.`;
        const accepted = confirm(
          `${selected.fileName} is ${logic.formatBytes(selected.sizeBytes)}.\n\n${available}\n\nCopy this file into managed Production Files storage? Large files are included in Full External Backups.`
        );
        if (!accepted) return;
      }

      const fileId = crypto.randomUUID();
      copyInProgress = { copyId: fileId, fileName: selected.fileName };
      $('#productionCopyPanel').hidden = false;
      $('#productionCopyProgress').value = 0;
      $('#productionCopyName').textContent = selected.fileName;
      $('#productionCopyText').textContent = `0 B / ${logic.formatBytes(selected.sizeBytes)}`;
      renderManager();
      setStatus(`Copying ${selected.fileName} into managed production storage…`, 'working');

      const copied = await window.layerWorks.copyProductionFile({
        sourcePath: selected.sourcePath,
        projectId: project.id,
        fileId
      });
      if (!copied?.ok || !copied.relativePath || !copied.sha256) throw new Error('The managed production-file copy was not confirmed.');
      copiedPath = copied.relativePath;

      const duplicates = duplicateMatches(copied.sha256);
      if (duplicates.length) {
        const examples = duplicates.slice(0, 3).map((match) => `• ${projectLabel(match.project)} — ${match.file.originalFileName}`).join('\n');
        const more = duplicates.length > 3 ? `\n• …and ${duplicates.length - 3} more` : '';
        const keep = confirm(`PF2 found an identical SHA-256 file already managed by the Hub:\n\n${examples}${more}\n\nKeep another independent managed copy for this project? PF2 does not deduplicate or share physical files.`);
        if (!keep) {
          await window.layerWorks.deleteProductionFile(copiedPath);
          copiedPath = null;
          $('#productionFilesMessage').textContent = 'Duplicate copy discarded. Existing managed file(s) were not changed.';
          setStatus('Duplicate production file not added', 'neutral');
          return;
        }
      }

      draftFiles.push({
        id: fileId,
        label: logic.defaultLabel(copied.originalFileName),
        role: logic.inferRole(copied.originalFileName),
        originalFileName: copied.originalFileName,
        storedFileName: copied.storedFileName,
        relativePath: copied.relativePath,
        extension: copied.extension || '',
        sizeBytes: copied.sizeBytes,
        sha256: copied.sha256,
        isPrimary: draftFiles.length === 0,
        notes: '',
        addedAt: new Date().toISOString()
      });

      const saved = await persistDraft('Production file attached');
      if (!saved) {
        draftFiles = draftFiles.filter((file) => file.id !== fileId);
        await window.layerWorks.deleteProductionFile(copiedPath).catch(() => {});
        copiedPath = null;
        throw new Error('The project save failed, so the copied production file was rolled back.');
      }
      copiedPath = null;
      await Promise.all([refreshStorageStatus(), refreshProjectHealth()]);
    } catch (error) {
      if (copiedPath) await window.layerWorks.deleteProductionFile(copiedPath).catch(() => {});
      const canceled = /copy canceled/i.test(error.message);
      setStatus(canceled ? 'Production file copy canceled' : `Production file failed: ${error.message}`, canceled ? 'neutral' : 'error');
      $('#productionFilesMessage').textContent = canceled ? 'Copy canceled. No project file was added.' : error.message;
    } finally {
      copyInProgress = null;
      $('#productionCopyPanel').hidden = true;
      renderManager();
    }
  }

  async function cancelCopy() {
    if (!copyInProgress) return;
    $('#cancelProductionCopy').disabled = true;
    $('#productionCopyText').textContent = 'Canceling copy…';
    try {
      await window.layerWorks.cancelProductionFileCopy(copyInProgress.copyId);
    } catch (error) {
      setStatus(`Could not cancel copy: ${error.message}`, 'error');
    } finally {
      $('#cancelProductionCopy').disabled = false;
    }
  }

  async function saveDetails(fileId) {
    const file = draftFiles.find((item) => item.id === fileId);
    if (!file) return;
    file.label = String(file.label || '').trim();
    if (!file.label) {
      $('#productionFilesMessage').textContent = 'Production file label cannot be blank.';
      return;
    }
    await persistDraft('Production file details updated');
  }

  async function markPrimary(fileId) {
    draftFiles.forEach((file) => { file.isPrimary = file.id === fileId; });
    await persistDraft('Primary production file updated');
  }

  async function removeFile(fileId) {
    const file = draftFiles.find((item) => item.id === fileId);
    if (!file) return;
    if (!confirm(`Remove this managed production file?\n\n${file.originalFileName}\n${logic.formatBytes(file.sizeBytes)}\n\nThe managed copy will be deleted from disk after the project record saves.`)) return;

    const previous = structuredClone(draftFiles);
    draftFiles = draftFiles.filter((item) => item.id !== fileId);
    if (file.isPrimary && draftFiles.length) draftFiles[0].isPrimary = true;
    const saved = await persistDraft('Production file removed');
    if (!saved) {
      draftFiles = previous;
      renderManager();
      return;
    }
    try {
      await window.layerWorks.deleteProductionFile(file.relativePath);
      fileHealth.delete(file.id);
      setStatus('Production file removed from project and managed storage', 'success');
      await refreshStorageStatus();
    } catch (error) {
      setStatus(`Project updated, but managed file cleanup failed: ${error.message}`, 'error');
      $('#productionFilesMessage').textContent = 'The project no longer references the file, but its managed disk copy could not be removed.';
    }
  }

  async function openFile(file) {
    try {
      await window.layerWorks.openProductionFile(file.relativePath);
      setStatus(`Opened ${file.originalFileName}`, 'success');
    } catch (error) {
      setStatus(`Could not open production file: ${error.message}`, 'error');
      $('#productionFilesMessage').textContent = `Managed file unavailable: ${error.message}`;
      await refreshProjectHealth();
    }
  }

  async function showFile(file) {
    try {
      await window.layerWorks.showProductionFile(file.relativePath);
    } catch (error) {
      setStatus(`Could not show production file: ${error.message}`, 'error');
      $('#productionFilesMessage').textContent = `Managed file unavailable: ${error.message}`;
      await refreshProjectHealth();
    }
  }

  function addManagerButton(container, projectIdGetter, className = '') {
    if (!container || container.querySelector('[data-production-manager-button]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Production files';
    button.dataset.productionManagerButton = 'true';
    if (className) button.className = className;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const projectId = projectIdGetter();
      if (projectId) openManager(projectId);
    });
    container.append(button);
  }

  function decorateProjectCard(card) {
    if (card.dataset.productionFilesDecorated === 'true') return;
    card.dataset.productionFilesDecorated = 'true';
    const project = projectById(card.dataset.projectId);
    if (!project) return;
    addManagerButton(card.querySelector('.project-actions'), () => card.dataset.projectId);
    const flags = card.querySelector('.project-flags');
    if (flags && !flags.querySelector('.production-file-count')) {
      flags.append(createTextElement('span', 'production-file-count', `Production: ${fileCountLabel(project.productionFiles || [])}`));
    }
  }

  function decorateGalleryCard(card) {
    if (card.dataset.productionFilesDecorated === 'true') return;
    card.dataset.productionFilesDecorated = 'true';
    const project = projectById(card.dataset.galleryProjectId);
    if (!project) return;
    addManagerButton(card.querySelector('.gallery-card-actions'), () => card.dataset.galleryProjectId);
    const specs = card.querySelector('.gallery-card-specs');
    if (specs && !specs.querySelector('.production-file-count')) {
      specs.append(createTextElement('span', 'production-file-count', `Production: ${fileCountLabel(project.productionFiles || [])}`));
    }
  }

  function decorateExisting() {
    document.querySelectorAll('.project-card').forEach(decorateProjectCard);
    document.querySelectorAll('.gallery-card').forEach(decorateGalleryCard);
    const detailActions = $('#galleryDetailDialog .modal-actions');
    addManagerButton(detailActions, () => $('#galleryDetailDialog')?.dataset.projectId || '');
    const preparationActions = document.querySelector('.gallery-prep-actions');
    addManagerButton(preparationActions, () => $('#galleryProjectSelect')?.value || '');
  }

  function install() {
    installDialog();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'production-files.css';
    document.head.append(link);
    decorateExisting();
    observer = new MutationObserver(() => decorateExisting());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.ProductionFiles = { openManager, decorateExisting };
  install();
})();
