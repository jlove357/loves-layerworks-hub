(() => {
  const reuse = window.ProjectReuseLogic;
  const quote = window.QuoteLogic;
  if (!reuse) throw new Error('PF3 project reuse logic failed to load.');
  if (!quote) throw new Error('Manual Quote Calculator logic failed to load for PF3.');

  let sourceProjectId = null;
  let duplicating = false;
  let cancelRequested = false;
  let activeCopyId = null;
  let activeProgress = null;
  let observer = null;

  function projectById(projectId) {
    return state.data?.projects?.find((project) => project.id === projectId) || null;
  }

  function projectLabel(project) {
    return project?.customerName || (project?.isCustom ? 'Custom project' : 'Stock / personal project');
  }

  function installDialog() {
    if ($('#projectReuseDialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'projectReuseDialog';
    dialog.className = 'modal project-reuse-modal';
    dialog.innerHTML = `
      <form id="projectReuseForm" class="project-reuse-shell">
        <div class="modal-head">
          <div><small>PF3 · PROJECT DUPLICATION / REUSE</small><h2>Reuse a project</h2></div>
          <button id="closeProjectReuse" class="icon-button" type="button" aria-label="Close">×</button>
        </div>

        <section class="project-reuse-source">
          <small>SOURCE PROJECT</small>
          <strong id="projectReuseSourceName">Project</strong>
          <span id="projectReuseSourceDetails"></span>
        </section>

        <label>Customer name for the new draft
          <input id="projectReuseCustomer" type="text" maxlength="120" placeholder="Optional">
        </label>

        <section class="project-reuse-options">
          <label class="project-reuse-option">
            <input id="projectReuseReference" type="checkbox">
            <span><strong>Copy reference image</strong><small id="projectReuseReferenceText">Creates an independent managed copy, so deleting one project cannot remove the other's reference.</small></span>
          </label>
          <label class="project-reuse-option">
            <input id="projectReuseProduction" type="checkbox">
            <span><strong>Copy Production Files</strong><small id="projectReuseProductionText">No production files attached.</small></span>
          </label>
          <ul id="projectReuseFileList" class="project-reuse-file-list"></ul>
        </section>

        <p class="project-reuse-reset-note"><strong>The new project starts as Draft.</strong> PF3 reuses dimensions, slicer time, filament recipe, saved palette, custom-project flag, and project notes. It resets finished photo, completion dates, inventory deduction history, captions, actual/legacy production results, and List Price. Floor pricing is recalculated from the current shop settings and current roll costs.</p>

        <section id="projectReuseProgressPanel" class="project-reuse-progress" hidden>
          <div class="project-reuse-progress-head"><strong id="projectReuseProgressTitle">Preparing copy…</strong><span id="projectReuseProgressText"></span></div>
          <progress id="projectReuseProgress" max="100" value="0"></progress>
          <button id="cancelProjectReuseCopy" type="button">Cancel duplication</button>
        </section>

        <p id="projectReuseMessage" class="project-reuse-message" aria-live="polite"></p>
        <div class="modal-actions"><button id="cancelProjectReuse" type="button">Cancel</button><button id="duplicateProject" class="primary" type="submit">Create reusable draft</button></div>
      </form>`;
    document.body.append(dialog);

    $('#projectReuseForm').addEventListener('submit', duplicateProject);
    $('#closeProjectReuse').addEventListener('click', cancelOrClose);
    $('#cancelProjectReuse').addEventListener('click', cancelOrClose);
    $('#cancelProjectReuseCopy').addEventListener('click', requestCancel);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog && !duplicating) closeDialog();
    });

    window.layerWorks.onProductionFileProgress((payload) => {
      if (!duplicating || !activeCopyId || payload?.copyId !== activeCopyId || !activeProgress) return;
      const transferred = Math.max(0, Number(payload.transferredBytes || 0));
      const completed = activeProgress.completedBytes + Math.min(transferred, activeProgress.currentFileBytes);
      const percent = activeProgress.totalBytes > 0
        ? Math.min(100, Math.round(completed / activeProgress.totalBytes * 100))
        : 100;
      $('#projectReuseProgress').value = percent;
      $('#projectReuseProgressTitle').textContent = `Copying Production Files ${activeProgress.index + 1} / ${activeProgress.totalFiles}`;
      $('#projectReuseProgressText').textContent = `${payload.fileName || activeProgress.fileName} · ${reuse.formatBytes(completed)} / ${reuse.formatBytes(activeProgress.totalBytes)}`;
    });
  }

  function renderSource() {
    const project = projectById(sourceProjectId);
    if (!project) return;
    const summary = reuse.duplicationSummary(project);
    $('#projectReuseSourceName').textContent = projectLabel(project);
    $('#projectReuseSourceDetails').textContent = `${project.status} · ${project.widthMm ?? '—'} × ${project.heightMm ?? '—'} mm · ${Math.round(Number(project.estimatedTimeMinutes || 0))} slicer min`;
    $('#projectReuseCustomer').value = project.customerName || '';

    $('#projectReuseReference').checked = summary.hasReferenceImage;
    $('#projectReuseReference').disabled = !summary.hasReferenceImage;
    $('#projectReuseReferenceText').textContent = summary.hasReferenceImage
      ? 'Creates an independent managed copy, so deleting one project cannot remove the other reference.'
      : 'This project has no managed reference image.';

    $('#projectReuseProduction').checked = summary.fileCount > 0;
    $('#projectReuseProduction').disabled = summary.fileCount === 0;
    $('#projectReuseProductionText').textContent = summary.fileCount
      ? `${summary.fileCount} ${summary.fileCount === 1 ? 'file' : 'files'} · ${reuse.formatBytes(summary.productionBytes)} will be copied as independent managed files.`
      : 'No production files attached.';

    const files = project.productionFiles || [];
    const list = $('#projectReuseFileList');
    list.replaceChildren();
    for (const file of files.slice(0, 6)) {
      list.append(createTextElement('li', '', `${file.originalFileName} · ${reuse.formatBytes(file.sizeBytes)}`));
    }
    if (files.length > 6) list.append(createTextElement('li', '', `…and ${files.length - 6} more`));
    list.hidden = files.length === 0;
  }

  function setMessage(message, tone = 'neutral') {
    const element = $('#projectReuseMessage');
    element.textContent = message || '';
    element.dataset.tone = tone;
  }

  function setDuplicating(value) {
    duplicating = value;
    $('#closeProjectReuse').disabled = value;
    $('#cancelProjectReuse').disabled = value;
    $('#duplicateProject').disabled = value;
    $('#projectReuseCustomer').disabled = value;
    const project = projectById(sourceProjectId);
    $('#projectReuseReference').disabled = value || !project?.originalImagePath;
    $('#projectReuseProduction').disabled = value || !(project?.productionFiles || []).length;
    $('#projectReuseProgressPanel').hidden = !value;
    $('#cancelProjectReuseCopy').disabled = !value;
  }

  function openDialog(projectId) {
    const project = projectById(projectId);
    if (!project || duplicating) return;
    sourceProjectId = project.id;
    cancelRequested = false;
    activeCopyId = null;
    activeProgress = null;
    setMessage('Choose what should be carried into the new reusable draft.');
    renderSource();
    $('#projectReuseProgress').value = 0;
    $('#projectReuseProgressTitle').textContent = 'Preparing copy…';
    $('#projectReuseProgressText').textContent = '';
    $('#projectReuseProgressPanel').hidden = true;
    $('#projectReuseDialog').showModal();
    $('#projectReuseCustomer').focus();
  }

  function closeDialog() {
    if (duplicating) return;
    if ($('#projectReuseDialog').open) $('#projectReuseDialog').close();
    sourceProjectId = null;
    cancelRequested = false;
    activeCopyId = null;
    activeProgress = null;
  }

  async function requestCancel() {
    if (!duplicating) return;
    cancelRequested = true;
    $('#cancelProjectReuseCopy').disabled = true;
    setMessage('Cancel requested. PF3 will remove any new copies already created.', 'neutral');
    if (activeCopyId) {
      try {
        await window.layerWorks.cancelProductionFileCopy(activeCopyId);
      } catch (error) {
        setMessage(`Cancel request failed: ${error.message}`, 'error');
      }
    }
  }

  function cancelOrClose() {
    if (duplicating) requestCancel();
    else closeDialog();
  }

  async function rollbackCopies(productionPaths, imagePath) {
    const tasks = productionPaths.map((relativePath) => window.layerWorks.deleteProductionFile(relativePath));
    if (imagePath) tasks.push(window.layerWorks.deleteManagedImage(imagePath));
    const results = await Promise.allSettled(tasks);
    return results.filter((result) => result.status === 'rejected').length;
  }

  async function duplicateProject(event) {
    event.preventDefault();
    if (duplicating) return;
    const source = projectById(sourceProjectId);
    if (!source) {
      setMessage('The source project no longer exists.', 'error');
      return;
    }

    const targetProjectId = crypto.randomUUID();
    const now = new Date().toISOString();
    const copyReference = $('#projectReuseReference').checked && Boolean(source.originalImagePath);
    const copyProduction = $('#projectReuseProduction').checked && (source.productionFiles || []).length > 0;
    const productionPaths = [];
    let copiedReferencePath = null;
    cancelRequested = false;
    setDuplicating(true);
    setMessage('Preparing independent managed copies…');
    setStatus(`Duplicating ${projectLabel(source)} as a reusable draft…`, 'working');

    try {
      if (copyReference) {
        $('#projectReuseProgressTitle').textContent = 'Copying reference image';
        $('#projectReuseProgressText').textContent = 'Creating an independent managed copy.';
        $('#projectReuseProgress').value = 0;
        const copiedImage = await window.layerWorks.copyExistingProjectImage({
          sourceRelativePath: source.originalImagePath,
          projectId: targetProjectId
        });
        if (!copiedImage?.ok || !copiedImage.relativePath) throw new Error('The duplicated reference image was not confirmed.');
        copiedReferencePath = copiedImage.relativePath;
        if (cancelRequested) throw new Error('Project duplication canceled.');
      }

      const copiedProductionFiles = [];
      if (copyProduction) {
        const sourceFiles = source.productionFiles || [];
        const totalBytes = reuse.totalProductionBytes(source);
        let completedBytes = 0;
        for (let index = 0; index < sourceFiles.length; index += 1) {
          if (cancelRequested) throw new Error('Project duplication canceled.');
          const sourceFile = sourceFiles[index];
          const fileId = crypto.randomUUID();
          activeCopyId = fileId;
          activeProgress = {
            index,
            totalFiles: sourceFiles.length,
            completedBytes,
            currentFileBytes: Number(sourceFile.sizeBytes || 0),
            totalBytes,
            fileName: sourceFile.originalFileName
          };
          $('#projectReuseProgressTitle').textContent = `Copying Production Files ${index + 1} / ${sourceFiles.length}`;
          $('#projectReuseProgressText').textContent = sourceFile.originalFileName;

          const copied = await window.layerWorks.copyExistingProductionFile({
            sourceRelativePath: sourceFile.relativePath,
            originalFileName: sourceFile.originalFileName,
            projectId: targetProjectId,
            fileId
          });
          if (!copied?.ok || !copied.relativePath || !copied.sha256) throw new Error(`The copy of ${sourceFile.originalFileName} was not confirmed.`);
          productionPaths.push(copied.relativePath);
          const sameSize = Number(copied.sizeBytes) === Number(sourceFile.sizeBytes);
          const sameHash = String(copied.sha256).toLowerCase() === String(sourceFile.sha256).toLowerCase();
          if (!sameSize || !sameHash) {
            throw new Error(`${sourceFile.originalFileName} no longer matches its saved size/SHA-256 record. Run Verify library before reusing this project.`);
          }
          copiedProductionFiles.push(reuse.remapProductionFile(sourceFile, copied, fileId, now));
          completedBytes += Number(sourceFile.sizeBytes || 0);
          activeCopyId = null;
          activeProgress = null;
        }
      }

      if (cancelRequested) throw new Error('Project duplication canceled.');
      $('#cancelProjectReuseCopy').disabled = true;
      $('#projectReuseProgressTitle').textContent = 'Saving reusable draft';
      $('#projectReuseProgressText').textContent = 'Recalculating the current cost floor and verifying Hub data.';
      $('#projectReuseProgress').value = 100;

      const duplicate = reuse.buildDuplicateProject(source, {
        id: targetProjectId,
        customerName: $('#projectReuseCustomer').value,
        productionFiles: copiedProductionFiles,
        originalImagePath: copiedReferencePath,
        now
      });
      const currentQuote = quote.calculateQuote({
        project: duplicate,
        settings: state.data.settings,
        filaments: state.data.filaments
      });
      duplicate.estimatedFilamentCost = currentQuote.estimatedFilamentCost;
      duplicate.floorPrice = currentQuote.floorPrice;

      const next = structuredClone(state.data);
      next.projects.push(duplicate);
      const saved = await commitData(next, 'Project duplicated for reuse');
      if (!saved) throw new Error('The reusable draft could not be saved.');

      productionPaths.length = 0;
      copiedReferencePath = null;
      setMessage('Reusable draft created.', 'success');
      setStatus('Reusable draft created. Review rolls and List Price before using it.', 'success');
      setDuplicating(false);
      closeDialog();
      if ($('#projectSearch')) $('#projectSearch').value = '';
      if ($('#projectStatusFilter')) $('#projectStatusFilter').value = 'all';
      activateTab('planner');
      requestAnimationFrame(() => {
        const card = document.querySelector(`[data-project-id="${targetProjectId}"]`);
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } catch (error) {
      activeCopyId = null;
      activeProgress = null;
      const cleanupFailures = await rollbackCopies(productionPaths, copiedReferencePath);
      const canceled = cancelRequested || /canceled/i.test(error.message);
      const cleanupText = cleanupFailures ? ` ${cleanupFailures} rollback cleanup operation(s) failed; check managed storage.` : '';
      setMessage(`${canceled ? 'Duplication canceled.' : `Duplication failed: ${error.message}`}${cleanupText}`, canceled && !cleanupFailures ? 'neutral' : 'error');
      setStatus(canceled ? 'Project duplication canceled' : `Project duplication failed: ${error.message}`, canceled ? 'neutral' : 'error');
      setDuplicating(false);
      $('#projectReuseProgressPanel').hidden = true;
    }
  }

  function addReuseButton(container, projectIdGetter) {
    if (!container || container.querySelector('[data-project-reuse-button]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Duplicate / reuse';
    button.dataset.projectReuseButton = 'true';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const projectId = projectIdGetter();
      if (!projectId) {
        alert('Choose a project first.');
        return;
      }
      openDialog(projectId);
    });
    container.append(button);
  }

  function decorateExisting() {
    document.querySelectorAll('.project-card').forEach((card) => {
      addReuseButton(card.querySelector('.project-actions'), () => card.dataset.projectId);
    });
    document.querySelectorAll('.gallery-card').forEach((card) => {
      addReuseButton(card.querySelector('.gallery-card-actions'), () => card.dataset.galleryProjectId);
    });
    addReuseButton($('#galleryDetailDialog .modal-actions'), () => $('#galleryDetailDialog')?.dataset.projectId || '');
    addReuseButton(document.querySelector('.gallery-prep-actions'), () => $('#galleryProjectSelect')?.value || '');
  }

  function install() {
    installDialog();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'project-reuse.css';
    document.head.append(link);
    decorateExisting();
    observer = new MutationObserver(() => decorateExisting());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.ProjectReuse = { open: openDialog, decorateExisting };
  install();
})();
