(() => {
  const galleryLogic = window.GalleryLogic;
  const exportLogic = window.GalleryExportLogic;
  if (!galleryLogic || !exportLogic) throw new Error('Gallery Export logic failed to load.');

  let selectedExportProjectId = null;
  let generatedCaptions = [];
  let previewSignature = '';
  let lastExportRelativePath = '';
  let brandLabelDirty = false;
  let previewSequence = 0;

  function installGalleryExportWorkspace() {
    const preparation = $('#galleryPreparation');
    if (!preparation || $('#galleryExportStudio')) return;

    const studio = document.createElement('details');
    studio.id = 'galleryExportStudio';
    studio.className = 'workspace-card gallery-export-studio';
    studio.open = true;
    studio.innerHTML = `
      <summary><span><small>GALLERY EXPORT & CAPTIONS</small><strong>Share-ready project assets</strong></span><span>Offline PNG and caption tools</span></summary>
      <div class="gallery-export-layout">
        <section class="gallery-export-panel">
          <div class="gallery-export-heading"><div><small>SIDE-BY-SIDE EXPORT</small><h3>Original and finished image</h3></div><span id="galleryExportReadiness" class="gallery-export-chip">Choose a project</span></div>
          <label><span>Eligible gallery project</span><select id="galleryExportProject"><option value="">Choose a finished project</option></select></label>
          <div id="galleryExportProjectSummary" class="gallery-export-summary">Choose a finished, delivered, or gallery project.</div>
          <div class="gallery-brand-controls">
            <label class="gallery-brand-toggle"><input id="galleryIncludeBrand" type="checkbox" checked><span><strong>Include brand label</strong><small>Adds a footer to the exported PNG.</small></span></label>
            <label><span>Brand label</span><input id="galleryBrandLabel" type="text" maxlength="80" required></label>
            <button id="saveGalleryBrandLabel" type="button">Save label</button>
          </div>
          <div class="gallery-export-preview">
            <canvas id="galleryExportCanvas" width="1600" height="900" aria-label="Side-by-side gallery export preview"></canvas>
          </div>
          <div class="gallery-export-actions">
            <button id="generateGalleryPreview" type="button">Generate preview</button>
            <button id="exportGalleryPng" class="primary" type="button">Export PNG</button>
            <button id="showGalleryExport" type="button" disabled>Show exported file</button>
          </div>
          <p id="galleryExportMessage" class="gallery-export-message">Select an eligible project with both images to begin.</p>
        </section>

        <section class="gallery-caption-panel">
          <div class="gallery-export-heading"><div><small>OFFLINE CAPTION TEMPLATES</small><h3>Generate, edit, copy, and save</h3></div><button id="generateGalleryCaptions" type="button">Generate 3 captions</button></div>
          <p class="gallery-caption-intro">Templates use only the local project record and selected filament rolls. Nothing is posted or sent anywhere.</p>
          <div id="galleryGeneratedCaptions" class="gallery-caption-list"></div>
          <div class="gallery-saved-heading"><h3>Saved caption drafts</h3><span id="gallerySavedDraftCount">0 saved</span></div>
          <div id="gallerySavedCaptions" class="gallery-caption-list saved"></div>
        </section>
      </div>`;
    preparation.insertAdjacentElement('afterend', studio);

    $('#galleryExportProject').addEventListener('change', () => selectExportProject($('#galleryExportProject').value));
    $('#galleryIncludeBrand').addEventListener('change', async () => {
      markPreviewStale('Brand option changed. Generate a new preview or export to apply it.');
      if (selectedProjectReady() && previewSignature) await generatePreview().catch(() => {});
    });
    $('#galleryBrandLabel').addEventListener('input', () => {
      brandLabelDirty = true;
      markPreviewStale('Brand label changed. Save it, then generate a new preview.');
    });
    $('#saveGalleryBrandLabel').addEventListener('click', saveBrandLabel);
    $('#generateGalleryPreview').addEventListener('click', () => generatePreview().catch(handleExportError));
    $('#exportGalleryPng').addEventListener('click', exportPng);
    $('#showGalleryExport').addEventListener('click', showLastExport);
    $('#generateGalleryCaptions').addEventListener('click', generateCaptionOptions);
    $('#galleryGeneratedCaptions').addEventListener('input', handleGeneratedCaptionInput);
    $('#galleryGeneratedCaptions').addEventListener('click', handleGeneratedCaptionAction);
    $('#gallerySavedCaptions').addEventListener('click', handleSavedCaptionAction);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'gallery-export.css';
    document.head.append(link);

    const badge = document.querySelector('.badge');
    if (badge) {
      badge.querySelector('b').textContent = 'M4B';
      const badgeText = [...badge.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
      if (badgeText) badgeText.textContent = ' Gallery Export';
    }
    const footerLead = document.querySelector('footer span:first-child');
    if (footerLead) footerLead.replaceChildren(createTextElement('b', '', 'Milestone 4B:'), document.createTextNode(' Gallery Export'));

    drawCanvasPlaceholder('Choose a gallery project');
  }

  function eligibleProjects() {
    return [...(state.data?.projects || [])]
      .filter(galleryLogic.isEligible)
      .sort((a, b) => String(galleryLogic.projectDate(b) || '').localeCompare(String(galleryLogic.projectDate(a) || '')));
  }

  function selectedProject() {
    return state.data?.projects?.find((project) => project.id === selectedExportProjectId) || null;
  }

  function selectedProjectReady() {
    const project = selectedProject();
    return Boolean(project?.originalImagePath && project?.finishedImagePath);
  }

  function currentBrandLabel() {
    return $('#galleryBrandLabel')?.value.trim() || state.data?.settings?.galleryBrandLabel || "Love's LayerWorks";
  }

  function currentPreviewSignature(project = selectedProject()) {
    if (!project) return '';
    return [
      project.id,
      project.originalImagePath || '',
      project.finishedImagePath || '',
      $('#galleryIncludeBrand')?.checked ? 'brand' : 'plain',
      currentBrandLabel()
    ].join('|');
  }

  function renderExportSelector() {
    const select = $('#galleryExportProject');
    if (!select) return;
    const projects = eligibleProjects();
    select.replaceChildren(new Option('Choose a finished project', ''));
    for (const project of projects) {
      select.append(new Option(`${galleryLogic.displayName(project)} · ${project.status}`, project.id));
    }
    if (selectedExportProjectId && projects.some((project) => project.id === selectedExportProjectId)) {
      select.value = selectedExportProjectId;
    } else if (selectedExportProjectId) {
      selectedExportProjectId = null;
      generatedCaptions = [];
      previewSignature = '';
      lastExportRelativePath = '';
    }
  }

  function renderExportProjectSummary() {
    const project = selectedProject();
    const summary = $('#galleryExportProjectSummary');
    const readiness = $('#galleryExportReadiness');
    const canUseProject = Boolean(project);
    const ready = selectedProjectReady();

    $('#generateGalleryPreview').disabled = !ready;
    $('#exportGalleryPng').disabled = !ready;
    $('#generateGalleryCaptions').disabled = !canUseProject;
    $('#showGalleryExport').disabled = !lastExportRelativePath;

    if (!project) {
      summary.textContent = 'Choose a finished, delivered, or gallery project.';
      readiness.textContent = 'Choose a project';
      readiness.dataset.tone = 'neutral';
      return;
    }

    const size = exportLogic.sizeLabel(project);
    const imageState = ready ? 'Original and finished images are ready.' : 'Both an original and a finished image are required for PNG export.';
    summary.textContent = `${galleryLogic.displayName(project)} · ${project.status} · ${size}. ${imageState}`;
    readiness.textContent = ready ? 'Ready to export' : 'Images incomplete';
    readiness.dataset.tone = ready ? 'success' : 'warning';
  }

  function renderGeneratedCaptions() {
    const container = $('#galleryGeneratedCaptions');
    container.replaceChildren();
    if (!generatedCaptions.length) {
      container.append(createTextElement('div', 'gallery-caption-empty', selectedProject()
        ? 'Generate three editable caption options for this project.'
        : 'Choose an eligible project first.'));
      return;
    }

    generatedCaptions.forEach((caption, index) => {
      const card = document.createElement('article');
      card.className = 'gallery-caption-card';
      card.dataset.captionIndex = String(index);
      const heading = document.createElement('div');
      heading.className = 'gallery-caption-card-heading';
      heading.append(createTextElement('strong', '', `Caption option ${index + 1}`), createTextElement('span', '', 'Editable'));
      const textarea = document.createElement('textarea');
      textarea.rows = 5;
      textarea.maxLength = 3000;
      textarea.value = caption;
      textarea.dataset.captionIndex = String(index);
      const actions = document.createElement('div');
      actions.className = 'gallery-caption-actions';
      actions.append(
        createActionButton('Copy Caption', 'copy-generated-caption', index),
        createActionButton('Save Draft', 'save-generated-caption', index, 'primary')
      );
      card.append(heading, textarea, actions);
      container.append(card);
    });
  }

  function renderSavedCaptions() {
    const container = $('#gallerySavedCaptions');
    const project = selectedProject();
    const drafts = exportLogic.normalizeDrafts(project?.captionDrafts);
    $('#gallerySavedDraftCount').textContent = `${drafts.length} saved`;
    container.replaceChildren();
    if (!project) {
      container.append(createTextElement('div', 'gallery-caption-empty', 'Choose a project to view its saved drafts.'));
      return;
    }
    if (!drafts.length) {
      container.append(createTextElement('div', 'gallery-caption-empty', 'No caption drafts are saved for this project.'));
      return;
    }

    drafts.forEach((draft, index) => {
      const card = document.createElement('article');
      card.className = 'gallery-caption-card saved';
      card.dataset.savedIndex = String(index);
      card.append(createTextElement('p', '', draft));
      const actions = document.createElement('div');
      actions.className = 'gallery-caption-actions';
      actions.append(
        createActionButton('Copy Caption', 'copy-saved-caption', index),
        createActionButton('Delete Draft', 'delete-saved-caption', index, 'danger')
      );
      card.append(actions);
      container.append(card);
    });
  }

  function createActionButton(label, action, index, className = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.index = String(index);
    if (className) button.className = className;
    return button;
  }

  function renderGalleryExport() {
    if (!state.data || !$('#galleryExportStudio')) return;
    renderExportSelector();
    if (!brandLabelDirty) $('#galleryBrandLabel').value = state.data.settings.galleryBrandLabel || "Love's LayerWorks";
    renderExportProjectSummary();
    renderGeneratedCaptions();
    renderSavedCaptions();
    if (previewSignature && previewSignature !== currentPreviewSignature()) {
      previewSignature = '';
      drawCanvasPlaceholder('Preview is out of date');
    }
  }

  function selectExportProject(projectId) {
    selectedExportProjectId = projectId || null;
    generatedCaptions = [];
    previewSignature = '';
    lastExportRelativePath = '';
    drawCanvasPlaceholder(selectedExportProjectId ? 'Generate a side-by-side preview' : 'Choose a gallery project');
    $('#galleryExportMessage').textContent = selectedProjectReady()
      ? 'Project ready. Generate a preview or export the PNG.'
      : selectedExportProjectId
        ? 'This project needs both an original and a finished image before export.'
        : 'Select an eligible project with both images to begin.';
    renderGalleryExport();
  }

  function markPreviewStale(message) {
    previewSignature = '';
    if ($('#galleryExportMessage')) $('#galleryExportMessage').textContent = message;
  }

  function drawCanvasPlaceholder(message) {
    const canvas = $('#galleryExportCanvas');
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#0b0812';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#171122';
    context.fillRect(48, 48, canvas.width - 96, canvas.height - 96);
    context.strokeStyle = '#55466e';
    context.lineWidth = 4;
    context.setLineDash([18, 14]);
    context.strokeRect(80, 80, canvas.width - 160, canvas.height - 160);
    context.setLineDash([]);
    context.fillStyle = '#b7a9c5';
    context.font = '600 42px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(message, canvas.width / 2, canvas.height / 2);
  }

  async function readManagedDataUrl(relativePath) {
    const result = await window.layerWorks.readManagedImage(relativePath);
    if (!result?.ok || !result.dataUrl) throw new Error(result?.error || 'A managed image could not be read.');
    return result.dataUrl;
  }

  function loadCanvasImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image), { once: true });
      image.addEventListener('error', () => reject(new Error('An image could not be decoded for export.')), { once: true });
      image.src = dataUrl;
    });
  }

  function drawContainedImage(context, image, x, y, width, height) {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const drawX = x + (width - drawWidth) / 2;
    const drawY = y + (height - drawHeight) / 2;
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  }

  function fitCanvasText(context, value, maxWidth, startingSize = 48, minimumSize = 24) {
    let size = startingSize;
    do {
      context.font = `700 ${size}px system-ui, sans-serif`;
      if (context.measureText(value).width <= maxWidth) return size;
      size -= 2;
    } while (size > minimumSize);
    return minimumSize;
  }

  async function generatePreview() {
    const project = selectedProject();
    if (!project) throw new Error('Choose an eligible gallery project.');
    if (!project.originalImagePath || !project.finishedImagePath) {
      throw new Error('Both an original and a finished image are required for export.');
    }

    const sequence = ++previewSequence;
    const canvas = $('#galleryExportCanvas');
    const context = canvas.getContext('2d');
    $('#galleryExportMessage').textContent = 'Loading managed images and building the side-by-side preview…';
    setStatus('Building gallery export preview…', 'working');

    const [originalDataUrl, finishedDataUrl] = await Promise.all([
      readManagedDataUrl(project.originalImagePath),
      readManagedDataUrl(project.finishedImagePath)
    ]);
    const [original, finished] = await Promise.all([
      loadCanvasImage(originalDataUrl),
      loadCanvasImage(finishedDataUrl)
    ]);
    if (sequence !== previewSequence) return null;

    const includeBrand = $('#galleryIncludeBrand').checked;
    const brandHeight = includeBrand ? 112 : 0;
    const padding = 48;
    const gap = 32;
    const labelHeight = 54;
    const panelWidth = (canvas.width - padding * 2 - gap) / 2;
    const panelHeight = canvas.height - padding * 2 - brandHeight;
    const imageHeight = panelHeight - labelHeight;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#0b0812';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const panels = [
      { x: padding, image: original, label: 'ORIGINAL' },
      { x: padding + panelWidth + gap, image: finished, label: 'FINISHED' }
    ];
    for (const panel of panels) {
      context.fillStyle = '#171122';
      context.fillRect(panel.x, padding, panelWidth, panelHeight);
      context.fillStyle = '#c7b8ff';
      context.font = '800 24px system-ui, sans-serif';
      context.textAlign = 'left';
      context.textBaseline = 'middle';
      context.fillText(panel.label, panel.x + 22, padding + labelHeight / 2);
      context.save();
      context.beginPath();
      context.rect(panel.x, padding + labelHeight, panelWidth, imageHeight);
      context.clip();
      context.fillStyle = '#0e0b14';
      context.fillRect(panel.x, padding + labelHeight, panelWidth, imageHeight);
      drawContainedImage(context, panel.image, panel.x, padding + labelHeight, panelWidth, imageHeight);
      context.restore();
      context.strokeStyle = '#493b60';
      context.lineWidth = 3;
      context.strokeRect(panel.x, padding, panelWidth, panelHeight);
    }

    if (includeBrand) {
      const footerY = canvas.height - brandHeight;
      context.fillStyle = '#241737';
      context.fillRect(0, footerY, canvas.width, brandHeight);
      const brandLabel = currentBrandLabel();
      fitCanvasText(context, brandLabel, canvas.width - 160);
      context.fillStyle = '#f2edff';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(brandLabel, canvas.width / 2, footerY + brandHeight / 2);
    }

    previewSignature = currentPreviewSignature(project);
    $('#galleryExportMessage').textContent = includeBrand
      ? `Preview ready with the “${currentBrandLabel()}” brand label.`
      : 'Preview ready without a brand label.';
    setStatus('Gallery export preview ready', 'success');
    return canvas;
  }

  async function exportPng() {
    try {
      const project = selectedProject();
      if (!project) throw new Error('Choose an eligible gallery project.');
      const canvas = await generatePreview();
      if (!canvas) return;
      setStatus('Writing and verifying managed gallery export…', 'working');
      $('#galleryExportMessage').textContent = 'Writing and verifying the PNG in the managed exports folder…';
      const result = await window.layerWorks.saveGalleryExport({
        projectId: project.id,
        fileStem: exportLogic.safeExportStem(project),
        pngDataUrl: canvas.toDataURL('image/png')
      });
      if (!result?.ok || !result.relativePath) throw new Error('The managed export was not confirmed.');
      lastExportRelativePath = result.relativePath;
      $('#showGalleryExport').disabled = false;
      $('#galleryExportMessage').textContent = `Export verified: ${result.path}`;
      setStatus(`Gallery PNG exported · ${result.fileName}`, 'success');
    } catch (error) {
      handleExportError(error);
    }
  }

  async function showLastExport() {
    if (!lastExportRelativePath) return;
    try {
      await window.layerWorks.revealGalleryExport(lastExportRelativePath);
    } catch (error) {
      handleExportError(error);
    }
  }

  function generateCaptionOptions() {
    const project = selectedProject();
    if (!project) return;
    generatedCaptions = exportLogic.createCaptionTemplates(
      project,
      state.data.filaments,
      currentBrandLabel()
    );
    renderGeneratedCaptions();
    setStatus('Three offline caption options generated', 'success');
  }

  function handleGeneratedCaptionInput(event) {
    const textarea = event.target.closest('textarea[data-caption-index]');
    if (!textarea) return;
    const index = Number(textarea.dataset.captionIndex);
    if (Number.isInteger(index) && generatedCaptions[index] !== undefined) generatedCaptions[index] = textarea.value;
  }

  async function handleGeneratedCaptionAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const index = Number(button.dataset.index);
    const caption = String(generatedCaptions[index] ?? '').trim();
    if (!caption) {
      setStatus('Caption is blank', 'error');
      return;
    }
    if (button.dataset.action === 'copy-generated-caption') await copyCaption(caption);
    if (button.dataset.action === 'save-generated-caption') await saveCaptionDraft(caption);
  }

  async function handleSavedCaptionAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const project = selectedProject();
    if (!project) return;
    const drafts = exportLogic.normalizeDrafts(project.captionDrafts);
    const index = Number(button.dataset.index);
    const caption = drafts[index];
    if (button.dataset.action === 'copy-saved-caption' && caption) await copyCaption(caption);
    if (button.dataset.action === 'delete-saved-caption' && caption) await deleteCaptionDraft(index);
  }

  async function copyCaption(caption) {
    try {
      const result = await window.layerWorks.copyText(caption);
      if (!result?.ok) throw new Error('The clipboard write was not confirmed.');
      setStatus('Caption copied to clipboard', 'success');
    } catch (error) {
      setStatus(`Caption copy failed: ${error.message}`, 'error');
    }
  }

  async function saveCaptionDraft(caption) {
    const project = selectedProject();
    if (!project) return;
    const existing = exportLogic.normalizeDrafts(project.captionDrafts);
    const nextDrafts = exportLogic.addDraft(existing, caption);
    if (nextDrafts.length === existing.length) {
      setStatus('That caption is already saved', 'neutral');
      return;
    }
    const next = structuredClone(state.data);
    const index = next.projects.findIndex((item) => item.id === project.id);
    next.projects[index].captionDrafts = nextDrafts;
    next.projects[index].updatedAt = new Date().toISOString();
    await commitData(next, 'Caption draft saved');
  }

  async function deleteCaptionDraft(index) {
    const project = selectedProject();
    if (!project) return;
    if (!confirm('Delete this saved caption draft?')) return;
    const next = structuredClone(state.data);
    const projectIndex = next.projects.findIndex((item) => item.id === project.id);
    next.projects[projectIndex].captionDrafts = exportLogic.removeDraft(project.captionDrafts, index);
    next.projects[projectIndex].updatedAt = new Date().toISOString();
    await commitData(next, 'Caption draft deleted');
  }

  async function saveBrandLabel() {
    const value = $('#galleryBrandLabel').value.trim();
    if (!value) {
      setStatus('Brand label cannot be blank', 'error');
      return;
    }
    const next = structuredClone(state.data);
    next.settings.galleryBrandLabel = value;
    const saved = await commitData(next, 'Gallery brand label saved');
    if (saved) {
      brandLabelDirty = false;
      markPreviewStale('Brand label saved. Generate a new preview to apply it.');
    }
  }

  function handleExportError(error) {
    console.error(error);
    $('#galleryExportMessage').textContent = error.message;
    setStatus(`Gallery export failed: ${error.message}`, 'error');
  }

  const baseRenderAll = renderAll;
  renderAll = function renderAllWithGalleryExport() {
    baseRenderAll();
    renderGalleryExport();
  };

  installGalleryExportWorkspace();
  renderGalleryExport();
})();
