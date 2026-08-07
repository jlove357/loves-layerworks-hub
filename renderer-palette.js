(() => {
  const logic = window.PaletteLogic;
  if (!logic) throw new Error('Palette Assistant logic failed to load.');

  let selectedPaletteProjectId = null;
  let paletteDraft = [];
  let extractedColors = [];
  let paletteDirty = false;
  let referenceDataUrl = '';
  let referencePath = '';
  let referenceToken = 0;

  function installPaletteWorkspace() {
    const panel = $('#planner-panel');
    if (!panel || $('#paletteAssistant')) return;

    const studio = document.createElement('details');
    studio.id = 'paletteAssistant';
    studio.className = 'workspace-card palette-assistant';
    studio.open = true;
    studio.innerHTML = `
      <summary><span><small>PALETTE ASSISTANT</small><strong>Reference colors matched to rolls on your shelf</strong></span><span>Local planning tool</span></summary>
      <div class="palette-layout">
        <section class="palette-source-panel">
          <div class="palette-heading"><div><small>PROJECT REFERENCE</small><h3>Choose an image to analyze</h3></div><span id="paletteProjectStatus" class="palette-status-chip">No project selected</span></div>
          <label><span>Project with a reference image</span><select id="paletteProjectSelect"><option value="">Choose a project</option></select></label>
          <div id="paletteReferencePreview" class="palette-reference-preview"><span>Choose a project with a managed reference image.</span></div>
          <div class="palette-source-actions">
            <button id="extractPaletteColors" class="primary" type="button">Extract reference colors</button>
            <button id="reloadSavedPalette" type="button">Reload saved palette</button>
          </div>
          <p id="paletteMessage" class="palette-message">The analysis runs locally from the project's managed reference image.</p>
          <div class="palette-limit-note">
            <strong>Planning assistant only</strong>
            <p>Camera processing, lighting, display calibration, filament finish, layer thickness, background color, TD, and filament order can all change the printed appearance. Confirm production choices in HueForge or Chroma Canvas.</p>
          </div>
        </section>

        <section class="palette-results-panel">
          <div class="palette-heading"><div><small>CLOSEST INVENTORY COLORS</small><h3>Closest inventory colors</h3></div><span id="paletteResultCount" class="palette-count">0 colors</span></div>
          <p class="palette-results-intro">Suggestions use active physical rolls only. Replace a roll from the dropdown, change the order, or remove colors before saving.</p>
          <div id="paletteExtractedColors" class="palette-extracted-colors"></div>
          <div id="paletteRows" class="palette-rows"></div>
          <div class="palette-save-row">
            <span id="paletteDirtyLabel">Choose a project to begin.</span>
            <button id="saveProjectPalette" class="primary" type="button">Save chosen palette</button>
          </div>
        </section>
      </div>`;
    panel.append(studio);

    $('#paletteProjectSelect').addEventListener('change', () => selectPaletteProject($('#paletteProjectSelect').value));
    $('#extractPaletteColors').addEventListener('click', extractPaletteColors);
    $('#reloadSavedPalette').addEventListener('click', reloadSavedPalette);
    $('#paletteRows').addEventListener('change', handlePaletteChange);
    $('#paletteRows').addEventListener('click', handlePaletteAction);
    $('#saveProjectPalette').addEventListener('click', saveProjectPalette);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'palette.css';
    document.head.append(link);

    const badge = document.querySelector('.badge');
    if (badge) {
      badge.querySelector('b').textContent = 'M3B';
      const badgeText = [...badge.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
      if (badgeText) badgeText.textContent = ' Palette Assistant';
    }
    const footerLead = document.querySelector('footer span:first-child');
    if (footerLead) footerLead.replaceChildren(createTextElement('b', '', 'Milestone 3B:'), document.createTextNode(' Palette Assistant'));
  }

  function projectById(projectId) {
    return state.data?.projects?.find((project) => project.id === projectId) || null;
  }

  function selectedProject() {
    return projectById(selectedPaletteProjectId);
  }

  function projectLabel(project) {
    return project?.customerName || (project?.isCustom ? 'Custom project' : 'Stock / personal project');
  }

  function paletteProjects() {
    return [...(state.data?.projects || [])]
      .filter((project) => project.originalImagePath)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }

  function activeRolls() {
    return logic.activeFilaments(state.data?.filaments || []);
  }

  function renderProjectSelector() {
    const select = $('#paletteProjectSelect');
    if (!select) return;
    const projects = paletteProjects();
    select.replaceChildren(new Option('Choose a project', ''));
    for (const project of projects) {
      select.append(new Option(`${projectLabel(project)} · ${project.status}`, project.id));
    }
    if (selectedPaletteProjectId && projects.some((project) => project.id === selectedPaletteProjectId)) {
      select.value = selectedPaletteProjectId;
    } else if (selectedPaletteProjectId) {
      selectedPaletteProjectId = null;
      paletteDraft = [];
      extractedColors = [];
      paletteDirty = false;
      referenceDataUrl = '';
      referencePath = '';
    }
  }

  function renderReferencePreview() {
    const preview = $('#paletteReferencePreview');
    if (!preview) return;
    preview.replaceChildren();
    const project = selectedProject();
    if (!project) {
      preview.append(createTextElement('span', '', 'Choose a project with a managed reference image.'));
      return;
    }
    if (!referenceDataUrl) {
      preview.append(createTextElement('span', '', 'Loading managed reference image…'));
      return;
    }
    const image = document.createElement('img');
    image.src = referenceDataUrl;
    image.alt = `${projectLabel(project)} reference`;
    preview.append(image);
  }

  async function loadReferenceImage(project) {
    const token = ++referenceToken;
    referenceDataUrl = '';
    referencePath = project?.originalImagePath || '';
    renderReferencePreview();
    if (!referencePath) return;
    try {
      const result = await window.layerWorks.readManagedImage(referencePath);
      if (token !== referenceToken) return;
      if (!result?.ok || !result.dataUrl) throw new Error(result?.error || 'Managed reference image is unavailable.');
      referenceDataUrl = result.dataUrl;
      renderReferencePreview();
    } catch (error) {
      if (token !== referenceToken) return;
      $('#paletteMessage').textContent = error.message;
      setStatus(`Palette image load failed: ${error.message}`, 'error');
      const preview = $('#paletteReferencePreview');
      preview.replaceChildren(createTextElement('span', '', 'Reference image unavailable'));
    }
  }

  function rollById(rollId) {
    return state.data?.filaments?.find((roll) => roll.id === rollId) || null;
  }

  function tdLabel(roll) {
    const td = logic.effectiveTd(roll);
    return td.value === null ? td.source : `${td.source}: ${td.value}`;
  }

  function renderExtractedColors() {
    const container = $('#paletteExtractedColors');
    container.replaceChildren();
    if (!extractedColors.length) {
      container.append(createTextElement('p', 'palette-mini-empty', 'Extract colors to see the reference shortlist.'));
      return;
    }
    for (const color of extractedColors) {
      const item = document.createElement('div');
      item.className = 'palette-extracted-swatch';
      const swatch = document.createElement('span');
      swatch.style.background = color.hex;
      const percentage = Number.isFinite(color.weight) ? `${Math.round(color.weight * 100)}% sampled` : 'Saved source color';
      item.append(swatch, createTextElement('strong', '', color.hex.toUpperCase()), createTextElement('small', '', percentage));
      container.append(item);
    }
  }

  function rollOptionLabel(roll) {
    return `${roll.colorName} · ${roll.brand} ${roll.material} · ${roll.rollCode}`;
  }

  function createPaletteRow(selection, index) {
    const row = document.createElement('article');
    row.className = 'palette-row';
    row.dataset.paletteIndex = String(index);

    const order = createTextElement('div', 'palette-order', String(index + 1));

    const source = document.createElement('div');
    source.className = 'palette-source-color';
    const sourceSwatch = document.createElement('span');
    sourceSwatch.style.background = selection.sourceColorHex;
    const sourceText = document.createElement('div');
    sourceText.append(createTextElement('small', '', 'Image color'), createTextElement('strong', '', selection.sourceColorHex.toUpperCase()));
    source.append(sourceSwatch, sourceText);

    const match = document.createElement('div');
    match.className = 'palette-inventory-match';
    const select = document.createElement('select');
    select.dataset.action = 'replace-palette-roll';
    select.dataset.index = String(index);
    const active = activeRolls();
    const current = rollById(selection.filamentId);
    if (current && current.archived) {
      const archived = new Option(`${rollOptionLabel(current)} · archived`, current.id, true, true);
      archived.disabled = true;
      select.append(archived);
    }
    for (const roll of active) select.append(new Option(rollOptionLabel(roll), roll.id));
    if (active.some((roll) => roll.id === selection.filamentId)) select.value = selection.filamentId;
    else if (!current) select.prepend(new Option('Missing inventory roll', '', true, true));

    const metadata = document.createElement('div');
    metadata.className = 'palette-roll-meta';
    if (current) {
      const swatch = document.createElement('span');
      swatch.className = 'palette-roll-swatch';
      swatch.style.background = current.colorHex;
      const details = document.createElement('div');
      details.append(
        createTextElement('strong', '', current.colorName),
        createTextElement('small', '', `${formatGrams(current.currentFilamentWeightG)} remaining · ${tdLabel(current)}`)
      );
      metadata.append(swatch, details);
    } else {
      metadata.append(createTextElement('span', 'palette-missing-roll', 'Inventory roll unavailable'));
    }
    match.append(select, metadata);

    const controls = document.createElement('div');
    controls.className = 'palette-row-actions';
    const up = createButton('Up', 'palette-up');
    const down = createButton('Down', 'palette-down');
    const remove = createButton('Remove', 'palette-remove', 'danger');
    up.dataset.index = String(index);
    down.dataset.index = String(index);
    remove.dataset.index = String(index);
    up.disabled = index === 0;
    down.disabled = index === paletteDraft.length - 1;
    controls.append(up, down, remove);

    row.append(order, source, match, controls);
    return row;
  }

  function renderPaletteRows() {
    const container = $('#paletteRows');
    container.replaceChildren();
    if (!paletteDraft.length) {
      container.append(createTextElement('div', 'palette-empty', 'No chosen palette yet. Extract reference colors to create a shortlist.'));
      return;
    }
    container.append(...paletteDraft.map(createPaletteRow));
  }

  function renderPaletteAssistant() {
    if (!state.data || !$('#paletteAssistant')) return;
    renderProjectSelector();
    const project = selectedProject();
    const rolls = activeRolls();
    $('#paletteProjectStatus').textContent = project ? `${project.status} · ${rolls.length} active rolls` : 'No project selected';
    $('#extractPaletteColors').disabled = !project || !rolls.length;
    $('#reloadSavedPalette').disabled = !project;
    $('#saveProjectPalette').disabled = !project;
    $('#paletteResultCount').textContent = `${paletteDraft.length} ${paletteDraft.length === 1 ? 'color' : 'colors'}`;
    $('#paletteDirtyLabel').textContent = !project
      ? 'Choose a project to begin.'
      : paletteDirty
        ? 'Unsaved palette changes.'
        : paletteDraft.length
          ? 'Saved palette loaded.'
          : 'No saved palette for this project.';
    renderReferencePreview();
    renderExtractedColors();
    renderPaletteRows();
  }

  function loadSavedPalette(project = selectedProject()) {
    paletteDraft = logic.normalizeSelections(project?.paletteSelections, state.data?.filaments || []);
    extractedColors = paletteDraft.map((selection) => ({ hex: selection.sourceColorHex, weight: null }));
    paletteDirty = false;
  }

  function selectPaletteProject(projectId) {
    selectedPaletteProjectId = projectId || null;
    const project = selectedProject();
    loadSavedPalette(project);
    referenceDataUrl = '';
    referencePath = project?.originalImagePath || '';
    $('#paletteMessage').textContent = project
      ? 'Ready to analyze the managed reference image or edit the saved palette.'
      : 'The analysis runs locally from the project’s managed reference image.';
    renderPaletteAssistant();
    if (project) loadReferenceImage(project);
  }

  function reloadSavedPalette() {
    const project = selectedProject();
    if (!project) return;
    loadSavedPalette(project);
    $('#paletteMessage').textContent = paletteDraft.length ? 'Saved project palette reloaded.' : 'This project has no saved palette yet.';
    renderPaletteAssistant();
  }

  function imageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image), { once: true });
      image.addEventListener('error', () => reject(new Error('The reference image could not be decoded.')), { once: true });
      image.src = dataUrl;
    });
  }

  async function sampledPixels(dataUrl) {
    const image = await imageFromDataUrl(dataUrl);
    const maximumSide = 220;
    const scale = Math.min(1, maximumSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('The local color-analysis canvas is unavailable.');
    context.drawImage(image, 0, 0, width, height);
    return context.getImageData(0, 0, width, height).data;
  }

  async function extractPaletteColors() {
    const project = selectedProject();
    const inventory = activeRolls();
    if (!project) return;
    if (!inventory.length) {
      setStatus('No active inventory rolls are available for matching', 'error');
      return;
    }
    try {
      setStatus('Extracting reference colors locally…', 'working');
      $('#paletteMessage').textContent = 'Analyzing the managed reference image on this computer…';
      if (!referenceDataUrl || referencePath !== project.originalImagePath) {
        const result = await window.layerWorks.readManagedImage(project.originalImagePath);
        if (!result?.ok || !result.dataUrl) throw new Error(result?.error || 'Managed reference image is unavailable.');
        referenceDataUrl = result.dataUrl;
        referencePath = project.originalImagePath;
      }
      const pixels = await sampledPixels(referenceDataUrl);
      extractedColors = logic.extractDominantColors(pixels, Math.min(5, inventory.length));
      paletteDraft = logic.matchColorsToInventory(extractedColors, inventory);
      if (!paletteDraft.length) throw new Error('No usable colors could be extracted from this image.');
      paletteDirty = true;
      $('#paletteMessage').textContent = `Extracted ${extractedColors.length} reference colors and matched them to active inventory.`;
      renderPaletteAssistant();
      setStatus('Closest inventory colors generated', 'success');
    } catch (error) {
      console.error(error);
      $('#paletteMessage').textContent = error.message;
      setStatus(`Palette analysis failed: ${error.message}`, 'error');
    }
  }

  function handlePaletteChange(event) {
    const select = event.target.closest('select[data-action="replace-palette-roll"]');
    if (!select) return;
    const index = Number(select.dataset.index);
    paletteDraft = logic.replaceSelection(paletteDraft, index, select.value);
    paletteDirty = true;
    renderPaletteAssistant();
  }

  function handlePaletteAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const index = Number(button.dataset.index);
    if (button.dataset.action === 'palette-up') paletteDraft = logic.moveSelection(paletteDraft, index, 'up');
    if (button.dataset.action === 'palette-down') paletteDraft = logic.moveSelection(paletteDraft, index, 'down');
    if (button.dataset.action === 'palette-remove') paletteDraft.splice(index, 1);
    paletteDirty = true;
    renderPaletteAssistant();
  }

  async function saveProjectPalette() {
    const project = selectedProject();
    if (!project) return;
    const normalized = logic.normalizeSelections(paletteDraft, state.data.filaments);
    if (normalized.length !== paletteDraft.length) {
      setStatus('Replace unavailable palette rolls before saving', 'error');
      return;
    }
    const next = structuredClone(state.data);
    const index = next.projects.findIndex((item) => item.id === project.id);
    next.projects[index].paletteSelections = normalized;
    next.projects[index].updatedAt = new Date().toISOString();
    const saved = await commitData(next, normalized.length ? 'Project palette saved' : 'Project palette cleared');
    if (saved) {
      paletteDraft = normalized;
      extractedColors = normalized.map((selection) => ({ hex: selection.sourceColorHex, weight: null }));
      paletteDirty = false;
      $('#paletteMessage').textContent = normalized.length
        ? 'Chosen palette saved to the unified project record.'
        : 'Saved palette cleared from the project.';
      renderPaletteAssistant();
    }
  }

  const baseRenderAll = renderAll;
  renderAll = function renderAllWithPaletteAssistant() {
    baseRenderAll();
    renderPaletteAssistant();
  };

  installPaletteWorkspace();
  renderPaletteAssistant();
})();
