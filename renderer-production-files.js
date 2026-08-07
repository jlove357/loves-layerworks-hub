(() => {
  const logic = window.ProductionFileLogic;
  if (!logic) throw new Error('Production File logic failed to load.');

  let selectedProjectId = null;
  let draftFiles = [];
  let copyInProgress = null;
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

  function installDialog() {
    if ($('#productionFilesDialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'productionFilesDialog';
    dialog.className = 'modal production-files-modal';
    dialog.innerHTML = `
      <div class="production-files-shell">
        <div class="modal-head">
          <div><small>PF1 · MANAGED PRODUCTION FILES</small><h2 id="productionFilesTitle">Production files</h2></div>
          <button id="closeProductionFiles" class="icon-button" type="button" aria-label="Close">×</button>
        </div>
        <div class="production-files-toolbar">
          <div><strong id="productionFilesSummary">0 files</strong><small id="productionFilesStorage">0 B managed</small></div>
          <button id="addProductionFile" class="primary" type="button">Add file</button>
        </div>
        <p class="production-files-intro">Managed copies live under <code>files/projects/&lt;project-id&gt;/production/</code>. The original filename stays visible in the Hub while a collision-safe file ID is used on disk.</p>
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
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog && !copyInProgress) closeManager();
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
  }

  function roleSelect(file) {
    const select = document.createElement('select');
    for (const option of logic.ROLE_OPTIONS) {
      select.append(new Option(option.label, option.value));
    }
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
    top.append(
      createTextElement('strong', '', file.originalFileName),
      file.isPrimary ? createTextElement('span', 'production-primary-badge', 'Primary') : document.createTextNode('')
    );
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
    if (!project) {
      draftFiles = [];
      $('#productionFilesTitle').textContent = 'Production files';
      $('#productionFilesSummary').textContent = '0 files';
      $('#productionFilesStorage').textContent = '0 B managed';
      $('#productionFilesList').replaceChildren();
      $('#productionFilesEmpty').hidden = false;
      $('#addProductionFile').disabled = true;
      return;
    }

    $('#productionFilesTitle').textContent = `${projectLabel(project)} · Production files`;
    $('#productionFilesSummary').textContent = fileCountLabel(draftFiles);
    $('#productionFilesStorage').textContent = `${logic.formatBytes(projectStorageBytes(draftFiles))} managed`;
    $('#productionFilesList').replaceChildren(...draftFiles.map(makeFileRow));
    $('#productionFilesEmpty').hidden = draftFiles.length > 0;
    $('#addProductionFile').disabled = Boolean(copyInProgress);
    $('#closeProductionFiles').disabled = Boolean(copyInProgress);
    $('#doneProductionFiles').disabled = Boolean(copyInProgress);
    $('#productionFilesMessage').textContent = draftFiles.length
      ? 'Files are managed copies. Open uses the Windows default app; Show in folder opens the managed copy in Explorer.'
      : 'Attach the production assets needed to reproduce this project later.';
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
    $('#productionCopyPanel').hidden = true;
    renderManager();
    $('#productionFilesDialog').showModal();
  }

  function closeManager() {
    if (copyInProgress) return;
    if ($('#productionFilesDialog').open) $('#productionFilesDialog').close();
    selectedProjectId = null;
    draftFiles = [];
  }

  async function addFile() {
    const project = projectById(selectedProjectId);
    if (!project || copyInProgress) return;
    let copiedPath = null;
    try {
      const selected = await window.layerWorks.selectProductionFile();
      if (selected?.canceled) return;
      if (logic.needsLargeFileWarning(selected.sizeBytes)) {
        const accepted = confirm(
          `${selected.fileName} is ${logic.formatBytes(selected.sizeBytes)}.\n\nCopy this file into managed Production Files storage? Large files are included in Full External Backups.`
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
      if (!copied?.ok || !copied.relativePath || !copied.sha256) {
        throw new Error('The managed production-file copy was not confirmed.');
      }
      copiedPath = copied.relativePath;

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
      setStatus('Production file removed from project and managed storage', 'success');
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
    }
  }

  async function showFile(file) {
    try {
      await window.layerWorks.showProductionFile(file.relativePath);
    } catch (error) {
      setStatus(`Could not show production file: ${error.message}`, 'error');
      $('#productionFilesMessage').textContent = `Managed file unavailable: ${error.message}`;
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
      flags.append(createTextElement('span', 'production-file-count', `${fileCountLabel(project.productionFiles || [])} · files`));
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
