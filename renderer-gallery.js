(() => {
  const logic = window.GalleryLogic;
  if (!logic) throw new Error('Gallery Catalog logic failed to load.');

  let selectedProjectId = null;
  let selectedFinishedPhoto = null;
  let removeExistingFinishedPhoto = false;

  function installGalleryWorkspace() {
    const panel = $('#gallery-panel');
    panel.innerHTML = `
      <article class="gallery-hero">
        <div><small>PROJECT-BASED PORTFOLIO</small><h2>Turn finished project records into a searchable catalog.</h2><p>Gallery Studio reads the unified project records, keeps original and finished photos together, and filters completed work without creating duplicate gallery data.</p></div>
        <button id="prepareGalleryHero" class="primary large" type="button">Prepare a project</button>
      </article>

      <div class="gallery-stats" aria-label="Gallery summary">
        <article><small>Eligible projects</small><strong id="galleryEligibleCount">0</strong><span>Finished, delivered, or gallery</span></article>
        <article><small>Finished photos</small><strong id="galleryPhotoCount">0</strong><span>Managed catalog images</span></article>
        <article><small>Delivered</small><strong id="galleryDeliveredCount">0</strong><span>Completed customer handoffs</span></article>
        <article><small>Portfolio ready</small><strong id="galleryReadyCount">0</strong><span>Status set to gallery</span></article>
      </div>

      <article class="workspace-card gallery-workspace">
        <div class="workspace-head"><div><small>GALLERY CATALOG</small><h2>Finished projects</h2></div><button id="clearGalleryFilters" type="button">Clear filters</button></div>
        <div class="gallery-filters">
          <label class="gallery-search"><span>Search projects</span><input id="gallerySearch" type="search" placeholder="Customer, notes, color, brand, or roll code"></label>
          <label><span>Status</span><select id="galleryStatusFilter"><option value="all">All eligible statuses</option><option value="finished">Finished</option><option value="delivered">Delivered</option><option value="gallery">Gallery</option></select></label>
          <label><span>Size</span><select id="gallerySizeFilter"><option value="all">All sizes</option><option value="small">Up to 150 mm</option><option value="medium">151–250 mm</option><option value="large">Over 250 mm</option><option value="unknown">Size not entered</option></select></label>
          <label><span>Filament</span><select id="galleryFilamentFilter"><option value="all">All used filaments</option></select></label>
          <label><span>From date</span><input id="galleryDateFrom" type="date"></label>
          <label><span>Through date</span><input id="galleryDateThrough" type="date"></label>
        </div>
        <div id="galleryList" class="gallery-grid" aria-live="polite"></div>
        <div id="galleryEmpty" class="empty-state" hidden><b>No gallery projects match</b><p>Change the filters or prepare a project below.</p></div>
      </article>

      <details id="galleryPreparation" class="workspace-card gallery-preparation" open>
        <summary><span><small>PROJECT PREPARATION</small><strong>Status and finished photo</strong></span><span>Uses the unified project record</span></summary>
        <div class="gallery-prep-body">
          <div class="gallery-prep-fields">
            <label><span>Project</span><select id="galleryProjectSelect"><option value="">Choose a project</option></select></label>
            <label><span>Project status</span><select id="galleryProjectStatus"></select></label>
            <p class="gallery-prep-note">Catalog eligibility begins at <b>finished</b>. Status changes are saved through the same verified <code>hub-data.json</code> transaction as every other project update.</p>
            <div class="gallery-prep-actions">
              <button id="chooseFinishedPhoto" type="button">Choose finished photo</button>
              <button id="removeFinishedPhoto" type="button">Remove finished photo</button>
              <button id="openPreparedDetail" type="button">Open details</button>
              <button id="saveGalleryPreparation" class="primary" type="button">Save project gallery details</button>
            </div>
            <p id="galleryPrepMessage" class="gallery-prep-message">Choose a project to begin.</p>
          </div>
          <div id="galleryFinishedPreview" class="gallery-finished-preview"><span>No project selected</span></div>
        </div>
      </details>`;

    const dialog = document.createElement('dialog');
    dialog.id = 'galleryDetailDialog';
    dialog.className = 'modal gallery-detail-modal';
    dialog.innerHTML = `
      <div class="gallery-detail-shell">
        <div class="modal-head"><div><small>PROJECT DETAIL</small><h2 id="galleryDetailTitle">Gallery project</h2></div><button id="closeGalleryDetail" class="icon-button" type="button" aria-label="Close">×</button></div>
        <div id="galleryDetailContent"></div>
        <div class="modal-actions"><button id="prepareFromDetail" type="button">Prepare this project</button><button id="doneGalleryDetail" class="primary" type="button">Done</button></div>
      </div>`;
    document.body.append(dialog);

    const statusSelect = $('#galleryProjectStatus');
    for (const status of logic.ALL_STATUSES) {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status[0].toUpperCase() + status.slice(1);
      statusSelect.append(option);
    }

    ['#gallerySearch', '#galleryStatusFilter', '#gallerySizeFilter', '#galleryFilamentFilter', '#galleryDateFrom', '#galleryDateThrough']
      .forEach((selector) => $(selector).addEventListener(selector === '#gallerySearch' ? 'input' : 'change', renderGalleryCatalog));
    $('#clearGalleryFilters').addEventListener('click', clearGalleryFilters);
    $('#galleryList').addEventListener('click', handleGalleryCardAction);
    $('#galleryProjectSelect').addEventListener('change', () => selectPreparationProject($('#galleryProjectSelect').value));
    $('#chooseFinishedPhoto').addEventListener('click', chooseFinishedPhoto);
    $('#removeFinishedPhoto').addEventListener('click', removeFinishedPhoto);
    $('#saveGalleryPreparation').addEventListener('click', saveGalleryPreparation);
    $('#openPreparedDetail').addEventListener('click', () => selectedProjectId && openGalleryDetail(selectedProjectId));
    $('#prepareGalleryHero').addEventListener('click', () => {
      $('#galleryPreparation').open = true;
      $('#galleryPreparation').scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('#galleryProjectSelect').focus();
    });
    $('#closeGalleryDetail').addEventListener('click', closeGalleryDetail);
    $('#doneGalleryDetail').addEventListener('click', closeGalleryDetail);
    $('#prepareFromDetail').addEventListener('click', () => {
      const projectId = $('#galleryDetailDialog').dataset.projectId;
      closeGalleryDetail();
      selectPreparationProject(projectId);
      $('#galleryPreparation').open = true;
      $('#galleryPreparation').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    dialog.addEventListener('click', (event) => { if (event.target === dialog) closeGalleryDetail(); });

    const badge = document.querySelector('.badge');
    badge.querySelector('b').textContent = 'M4A';
    const badgeText = [...badge.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (badgeText) badgeText.textContent = ' Gallery Catalog';
    const footerLead = document.querySelector('footer span:first-child');
    footerLead.replaceChildren(createTextElement('b', '', 'Milestone 4A:'), document.createTextNode(' Gallery Catalog'));
  }

  function projectById(projectId) {
    return state.data?.projects?.find((project) => project.id === projectId) || null;
  }

  function rollById(rollId) {
    return state.data?.filaments?.find((roll) => roll.id === rollId) || null;
  }

  function displayDate(project) {
    const value = logic.projectDate(project);
    return value ? new Date(value).toLocaleDateString() : 'No completion date';
  }

  function minutesLabel(minutes) {
    const value = Number(minutes);
    if (!Number.isFinite(value) || value < 0) return 'Not entered';
    const hours = Math.floor(value / 60);
    const remainder = Math.round(value % 60);
    if (!hours) return `${remainder} min`;
    return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
  }

  async function loadGalleryImage(img, relativePath, emptyLabel = 'No image') {
    if (!relativePath) {
      img.replaceWith(createTextElement('div', 'gallery-image-empty', emptyLabel));
      return;
    }
    try {
      const result = await window.layerWorks.readManagedImage(relativePath);
      if (!result?.ok || !result.dataUrl) throw new Error(result?.error || 'Image unavailable.');
      img.src = result.dataUrl;
    } catch {
      img.replaceWith(createTextElement('div', 'gallery-image-empty', 'Image unavailable'));
    }
  }

  function createImageTile(label, path, alt, className = '') {
    const tile = document.createElement('figure');
    tile.className = `gallery-image-tile ${className}`.trim();
    const media = document.createElement('div');
    media.className = 'gallery-image-media';
    if (path) {
      const image = document.createElement('img');
      image.alt = alt;
      media.append(image);
      loadGalleryImage(image, path).catch(() => {});
    } else {
      media.append(createTextElement('div', 'gallery-image-empty', `No ${label.toLocaleLowerCase()}`));
    }
    tile.append(media, createTextElement('figcaption', '', label));
    return tile;
  }

  function usedFilamentIds() {
    const ids = new Set();
    for (const project of state.data?.projects || []) {
      if (!logic.isEligible(project)) continue;
      for (const id of logic.projectFilamentIds(project)) ids.add(id);
    }
    return ids;
  }

  function renderFilamentFilter() {
    const select = $('#galleryFilamentFilter');
    const current = select.value;
    select.replaceChildren(new Option('All used filaments', 'all'));
    const rolls = [...usedFilamentIds()]
      .map(rollById)
      .filter(Boolean)
      .sort((a, b) => a.colorName.localeCompare(b.colorName, undefined, { sensitivity: 'base' }));
    for (const roll of rolls) select.append(new Option(`${roll.colorName} · ${roll.rollCode}`, roll.id));
    select.value = [...select.options].some((option) => option.value === current) ? current : 'all';
  }

  function currentFilters() {
    return {
      query: $('#gallerySearch').value,
      status: $('#galleryStatusFilter').value,
      size: $('#gallerySizeFilter').value,
      filamentId: $('#galleryFilamentFilter').value,
      from: $('#galleryDateFrom').value,
      through: $('#galleryDateThrough').value
    };
  }

  function makeGalleryCard(project) {
    const card = document.createElement('article');
    card.className = 'gallery-card';
    card.dataset.galleryProjectId = project.id;

    const media = document.createElement('div');
    media.className = 'gallery-card-media';
    media.append(
      createImageTile('Original', project.originalImagePath, `${logic.displayName(project)} original`),
      createImageTile('Finished', project.finishedImagePath, `${logic.displayName(project)} finished`, 'finished')
    );

    const body = document.createElement('div');
    body.className = 'gallery-card-body';
    const heading = document.createElement('div');
    heading.className = 'gallery-card-heading';
    const identity = document.createElement('div');
    identity.append(
      createTextElement('h3', '', logic.displayName(project)),
      createTextElement('p', '', `${project.widthMm ?? '—'} × ${project.heightMm ?? '—'} mm · ${displayDate(project)}`)
    );
    heading.append(identity, createTextElement('span', `project-status ${project.status}`, project.status));

    const chips = document.createElement('div');
    chips.className = 'gallery-filament-chips';
    for (const usage of project.filamentUsage || []) {
      const roll = rollById(usage.filamentId);
      const chip = createTextElement('span', '', roll ? `${roll.colorName} · ${roll.rollCode}` : 'Missing roll');
      if (roll?.colorHex) chip.style.setProperty('--chip-color', roll.colorHex);
      chips.append(chip);
    }
    if (!chips.childElementCount) chips.append(createTextElement('span', '', 'No filament assigned'));

    const specs = document.createElement('div');
    specs.className = 'gallery-card-specs';
    specs.append(
      createTextElement('span', '', `Estimated: ${minutesLabel(project.estimatedTimeMinutes)}`),
      createTextElement('span', '', `Actual: ${project.actualTimeMinutes === null ? 'Not entered' : minutesLabel(project.actualTimeMinutes)}`)
    );

    const actions = document.createElement('div');
    actions.className = 'gallery-card-actions';
    const detail = createButton('Open details', 'gallery-detail');
    const prepare = createButton(project.finishedImagePath ? 'Replace finished photo' : 'Add finished photo', 'gallery-prepare');
    actions.append(detail, prepare);

    body.append(heading, chips, specs, actions);
    card.append(media, body);
    return card;
  }

  function renderGalleryCatalog() {
    if (!state.data || !$('#galleryList')) return;
    renderFilamentFilter();
    const eligible = state.data.projects.filter(logic.isEligible);
    $('#galleryEligibleCount').textContent = String(eligible.length);
    $('#galleryPhotoCount').textContent = String(eligible.filter((project) => project.finishedImagePath).length);
    $('#galleryDeliveredCount').textContent = String(eligible.filter((project) => ['delivered', 'gallery'].includes(project.status)).length);
    $('#galleryReadyCount').textContent = String(eligible.filter((project) => project.status === 'gallery').length);

    const projects = logic.filterProjects(state.data.projects, state.data.filaments, currentFilters());
    $('#galleryList').replaceChildren(...projects.map(makeGalleryCard));
    $('#galleryEmpty').hidden = projects.length > 0;
  }

  function renderProjectSelector() {
    const select = $('#galleryProjectSelect');
    const projects = [...(state.data?.projects || [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    select.replaceChildren(new Option('Choose a project', ''));
    for (const project of projects) {
      select.append(new Option(`${logic.displayName(project)} · ${project.status}`, project.id));
    }
    if (selectedProjectId && projects.some((project) => project.id === selectedProjectId)) select.value = selectedProjectId;
    else if (selectedProjectId) selectedProjectId = null;
  }

  function renderFinishedPreview() {
    const preview = $('#galleryFinishedPreview');
    preview.replaceChildren();
    const project = projectById(selectedProjectId);
    if (!project) {
      preview.append(createTextElement('span', '', 'No project selected'));
      return;
    }
    if (selectedFinishedPhoto?.dataUrl) {
      const image = document.createElement('img');
      image.src = selectedFinishedPhoto.dataUrl;
      image.alt = 'Selected finished-print preview';
      preview.append(image, createTextElement('p', '', selectedFinishedPhoto.fileName));
      return;
    }
    if (!removeExistingFinishedPhoto && project.finishedImagePath) {
      const image = document.createElement('img');
      image.alt = `${logic.displayName(project)} finished print`;
      preview.append(image, createTextElement('p', '', 'Managed finished photo attached'));
      loadGalleryImage(image, project.finishedImagePath).catch(() => {});
      return;
    }
    preview.append(createTextElement('span', '', 'No finished photo attached'));
  }

  function renderPreparation() {
    if (!state.data || !$('#galleryProjectSelect')) return;
    renderProjectSelector();
    const project = projectById(selectedProjectId);
    $('#galleryProjectStatus').disabled = !project;
    $('#chooseFinishedPhoto').disabled = !project;
    $('#removeFinishedPhoto').disabled = !project || (!project.finishedImagePath && !selectedFinishedPhoto);
    $('#openPreparedDetail').disabled = !project;
    $('#saveGalleryPreparation').disabled = !project;
    if (project) {
      $('#galleryProjectStatus').value = project.status;
      const eligibility = logic.isEligible(project) ? 'Eligible for the catalog.' : 'Not yet eligible for the catalog.';
      $('#galleryPrepMessage').textContent = `${logic.displayName(project)} · ${eligibility}`;
    } else {
      $('#galleryPrepMessage').textContent = 'Choose a project to begin.';
    }
    renderFinishedPreview();
  }

  function renderGallery() {
    renderGalleryCatalog();
    renderPreparation();
  }

  function clearGalleryFilters() {
    $('#gallerySearch').value = '';
    $('#galleryStatusFilter').value = 'all';
    $('#gallerySizeFilter').value = 'all';
    $('#galleryFilamentFilter').value = 'all';
    $('#galleryDateFrom').value = '';
    $('#galleryDateThrough').value = '';
    renderGalleryCatalog();
  }

  function selectPreparationProject(projectId) {
    selectedProjectId = projectId || null;
    selectedFinishedPhoto = null;
    removeExistingFinishedPhoto = false;
    renderPreparation();
  }

  async function chooseFinishedPhoto() {
    if (!selectedProjectId) return;
    try {
      const result = await window.layerWorks.selectFinishedImage();
      if (result?.canceled) return;
      selectedFinishedPhoto = result;
      removeExistingFinishedPhoto = false;
      $('#galleryPrepMessage').textContent = 'Finished photo selected. Save the project gallery details to copy it into managed storage.';
      renderFinishedPreview();
    } catch (error) {
      setStatus(`Finished photo selection failed: ${error.message}`, 'error');
    }
  }

  function removeFinishedPhoto() {
    if (!selectedProjectId) return;
    selectedFinishedPhoto = null;
    removeExistingFinishedPhoto = true;
    $('#galleryPrepMessage').textContent = 'Finished photo will be removed when you save.';
    renderFinishedPreview();
  }

  async function saveGalleryPreparation() {
    const project = projectById(selectedProjectId);
    if (!project) return;
    let newManagedPath = null;
    const oldManagedPath = project.finishedImagePath || null;
    try {
      let finishedImagePath = removeExistingFinishedPhoto ? null : oldManagedPath;
      if (selectedFinishedPhoto) {
        setStatus('Copying finished photo into managed storage…', 'working');
        const copied = await window.layerWorks.copyFinishedImage({
          sourcePath: selectedFinishedPhoto.sourcePath,
          projectId: project.id
        });
        if (!copied?.ok || !copied.relativePath) throw new Error('The managed finished-photo copy was not confirmed.');
        newManagedPath = copied.relativePath;
        finishedImagePath = copied.relativePath;
      }

      const now = new Date().toISOString();
      const updated = logic.applyStatusDates(project, $('#galleryProjectStatus').value, now);
      updated.finishedImagePath = finishedImagePath;
      const next = structuredClone(state.data);
      const index = next.projects.findIndex((item) => item.id === project.id);
      next.projects[index] = updated;
      const saved = await commitData(next, 'Project gallery details updated');
      if (!saved) {
        if (newManagedPath) await window.layerWorks.deleteManagedImage(newManagedPath).catch(() => {});
        return;
      }
      if (oldManagedPath && oldManagedPath !== finishedImagePath) {
        await window.layerWorks.deleteManagedImage(oldManagedPath).catch(() => {});
      }
      selectedFinishedPhoto = null;
      removeExistingFinishedPhoto = false;
      $('#galleryPrepMessage').textContent = logic.isEligible(updated)
        ? 'Saved. This project is eligible for the Gallery Catalog.'
        : 'Saved. Change the status to finished, delivered, or gallery to include it in the catalog.';
      renderGallery();
    } catch (error) {
      if (newManagedPath) await window.layerWorks.deleteManagedImage(newManagedPath).catch(() => {});
      setStatus(`Gallery update failed: ${error.message}`, 'error');
      $('#galleryPrepMessage').textContent = error.message;
    }
  }

  function handleGalleryCardAction(event) {
    const button = event.target.closest('button[data-action]');
    const card = event.target.closest('[data-gallery-project-id]');
    if (!button || !card) return;
    const projectId = card.dataset.galleryProjectId;
    if (button.dataset.action === 'gallery-detail') openGalleryDetail(projectId);
    if (button.dataset.action === 'gallery-prepare') {
      selectPreparationProject(projectId);
      $('#galleryPreparation').open = true;
      $('#galleryPreparation').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function detailLine(label, value) {
    const wrapper = document.createElement('div');
    wrapper.append(createTextElement('dt', '', label), createTextElement('dd', '', value));
    return wrapper;
  }

  function openGalleryDetail(projectId) {
    const project = projectById(projectId);
    if (!project) return;
    const dialog = $('#galleryDetailDialog');
    dialog.dataset.projectId = projectId;
    $('#galleryDetailTitle').textContent = logic.displayName(project);
    const content = $('#galleryDetailContent');
    content.replaceChildren();

    const images = document.createElement('div');
    images.className = 'gallery-detail-images';
    images.append(
      createImageTile('Original reference', project.originalImagePath, `${logic.displayName(project)} original`),
      createImageTile('Finished print', project.finishedImagePath, `${logic.displayName(project)} finished`, 'finished')
    );

    const specs = document.createElement('dl');
    specs.className = 'gallery-detail-specs';
    specs.append(
      detailLine('Status', project.status),
      detailLine('Project type', project.isCustom ? 'Custom' : 'Stock / personal'),
      detailLine('Customer', project.customerName || 'Not entered'),
      detailLine('Size', `${project.widthMm ?? '—'} × ${project.heightMm ?? '—'} mm`),
      detailLine('Estimated print time', minutesLabel(project.estimatedTimeMinutes)),
      detailLine('Actual print time', project.actualTimeMinutes === null ? 'Not entered' : minutesLabel(project.actualTimeMinutes)),
      detailLine('Floor Price', formatCurrency(project.floorPrice)),
      detailLine('List Price', project.sellPrice === null ? 'Not entered' : formatCurrency(project.sellPrice)),
      detailLine('Created', new Date(project.dateCreated).toLocaleString()),
      detailLine('Printed', project.datePrinted ? new Date(project.datePrinted).toLocaleString() : 'Not recorded'),
      detailLine('Delivered', project.dateDelivered ? new Date(project.dateDelivered).toLocaleString() : 'Not recorded')
    );

    const filamentSection = document.createElement('section');
    filamentSection.className = 'gallery-detail-filaments';
    filamentSection.append(createTextElement('h3', '', 'Selected filament rolls'));
    const table = document.createElement('div');
    table.className = 'gallery-filament-table';
    for (const usage of project.filamentUsage || []) {
      const roll = rollById(usage.filamentId);
      const row = document.createElement('div');
      const swatch = document.createElement('span');
      swatch.className = 'gallery-detail-swatch';
      swatch.style.background = roll?.colorHex || '#4a4352';
      const identity = document.createElement('div');
      identity.append(
        createTextElement('strong', '', roll ? `${roll.colorName} · ${roll.rollCode}` : 'Missing roll'),
        createTextElement('small', '', roll ? `${roll.brand} · ${roll.material}` : usage.filamentId)
      );
      const amounts = document.createElement('div');
      amounts.append(
        createTextElement('span', '', `Estimated ${formatGrams(usage.gramsEstimated)}`),
        createTextElement('span', '', `Actual ${usage.gramsActual === null ? 'not entered' : formatGrams(usage.gramsActual)}`)
      );
      row.append(swatch, identity, amounts);
      table.append(row);
    }
    if (!table.childElementCount) table.append(createTextElement('p', 'mini-empty', 'No filament rolls are assigned.'));
    filamentSection.append(table);

    const notes = document.createElement('section');
    notes.className = 'gallery-detail-notes';
    notes.append(createTextElement('h3', '', 'Project notes'), createTextElement('p', '', project.notes || 'No notes entered.'));

    content.append(images, specs, filamentSection, notes);
    dialog.showModal();
  }

  function closeGalleryDetail() {
    $('#galleryDetailDialog').close();
  }

  const baseRenderAll = renderAll;
  renderAll = function renderAllWithGallery() {
    baseRenderAll();
    renderGallery();
  };

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'gallery.css';
  document.head.append(link);
  installGalleryWorkspace();
  renderGallery();
})();
