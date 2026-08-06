(() => {
  const logic = window.QuoteLogic;
  if (!logic) throw new Error('Manual Quote Calculator logic failed to load.');

  let editingProjectId = null;
  let creatingProject = false;
  let usageDraft = [];
  let selectedReference = null;
  let removeExistingReference = false;
  let settingsDirty = false;

  function installProjectWorkspace() {
    const panel = $('#planner-panel');
    panel.innerHTML = `
      <article class="quote-hero">
        <div><small>MANUAL QUOTE CALCULATOR</small><h2>Price work from the rolls actually on your shelf.</h2><p>Create a project, assign physical rolls, check stock, and calculate a cost-floor guardrail from live filament cost and locked shop settings.</p></div>
        <button id="newProjectHero" class="primary large" type="button">Create a project</button>
      </article>

      <div class="quote-stats" aria-label="Project summary">
        <article><small>Projects</small><strong id="projectCount">0</strong><span>Draft and quoted</span></article>
        <article><small>Drafts</small><strong id="draftProjectCount">0</strong><span>Still being estimated</span></article>
        <article><small>Quoted</small><strong id="quotedProjectCount">0</strong><span>List price recorded</span></article>
        <article><small>Order needed</small><strong id="orderNeededCount">0</strong><span>Insufficient selected stock</span></article>
      </div>

      <article class="workspace-card quote-workspace">
        <div class="workspace-head"><div><small>PROJECT DESK</small><h2>Manual quotes</h2></div><button id="newProject" class="primary" type="button">New project</button></div>
        <div class="quote-filters">
          <label><span>Search projects</span><input id="projectSearch" type="search" placeholder="Customer, status, color, brand, or roll code"></label>
          <label><span>Status</span><select id="projectStatusFilter"><option value="all">Draft and quoted</option><option value="draft">Draft</option><option value="quoted">Quoted</option></select></label>
        </div>
        <div id="projectNotice" class="notice" hidden></div>
        <div id="projectList" class="project-grid" aria-live="polite"></div>
        <div id="projectEmpty" class="empty-state"><b>No projects yet</b><p>Create a draft project to begin a manual quote.</p><button id="newFirstProject" type="button">Create first project</button></div>
      </article>

      <details class="workspace-card pricing-settings">
        <summary><span><small>LOCKED PRICING MODEL</small><strong>Shop pricing settings</strong></span><span>Editable defaults</span></summary>
        <form id="pricingSettingsForm" class="pricing-settings-form" novalidate>
          <p class="section-intro">Filament cost is never hardcoded. Every quote uses <code>purchaseCost / startingFilamentWeightG</code> from each selected physical roll.</p>
          <div class="settings-grid">
            <label>Electricity cost per kWh<input id="settingElectricity" type="number" min="0" step="0.01" required></label>
            <label>Machine wear cost per hour<input id="settingWear" type="number" min="0" step="0.01" required></label>
            <label>Average printer wattage<input id="settingWattage" type="number" min="0" step="1" required></label>
            <label>Failure-rate decimal<input id="settingFailure" type="number" min="0" max="0.99" step="0.01" required><small>0.15 = 15%</small></label>
            <label>Target-margin decimal<input id="settingMargin" type="number" min="0" max="0.99" step="0.01" required><small>0.35 = 35%</small></label>
            <label>Box cost<input id="settingBox" type="number" min="0" step="0.01" required></label>
            <label>Packing labor minutes<input id="settingPackingMinutes" type="number" min="0" step="1" required></label>
            <label>Packing labor rate per hour<input id="settingPackingRate" type="number" min="0" step="0.01" required></label>
            <label>Default frame cost<input id="settingFrame" type="number" min="0" step="0.01" required></label>
            <label>Default custom design fee<input id="settingDesign" type="number" min="0" step="0.01" required></label>
          </div>
          <p id="settingsError" class="form-error" role="alert" hidden></p>
          <div class="settings-actions"><span id="settingsDirtyLabel">Saved settings are active.</span><button class="primary" type="submit">Save pricing settings</button></div>
        </form>
      </details>`;

    const dialog = document.createElement('dialog');
    dialog.id = 'projectDialog';
    dialog.className = 'modal project-modal';
    dialog.innerHTML = `
      <form id="projectForm" novalidate>
        <div class="modal-head"><div><small>UNIFIED PROJECT RECORD</small><h2 id="projectDialogTitle">Create project</h2></div><button id="closeProjectDialog" class="icon-button" type="button" aria-label="Close">×</button></div>
        <div class="project-form-layout">
          <section class="project-fields">
            <div class="form-grid">
              <label>Customer name<input id="projectCustomer" type="text" maxlength="120" placeholder="Optional"></label>
              <label>Status<select id="projectStatus"><option value="draft">Draft</option><option value="quoted">Quoted</option></select></label>
              <label>Print width (mm)<input id="projectWidth" type="number" min="0.01" step="0.1" required></label>
              <label>Print height (mm)<input id="projectHeight" type="number" min="0.01" step="0.1" required></label>
              <label>Estimated print time (minutes)<input id="projectMinutes" type="number" min="0" step="1" required></label>
              <label>List Price (sellPrice)<input id="projectSellPrice" type="number" min="0" step="0.01" placeholder="Leave blank for floor only"></label>
              <label class="project-custom wide"><input id="projectCustom" type="checkbox"><span><strong>Custom project</strong><small>Applies the shop-wide defaultDesignFee once to this project.</small></span></label>
            </div>

            <section class="reference-field">
              <div><span>Customer reference image</span><small>Recordkeeping only. M3A performs no image processing.</small></div>
              <div class="reference-controls"><div id="referencePreview" class="reference-preview"><span>No reference attached</span></div><div><button id="chooseReference" type="button">Choose image</button><button id="removeReference" type="button">Remove image</button><p id="referenceFileName">No file selected</p></div></div>
            </section>

            <section class="usage-editor">
              <div class="usage-editor-head"><div><small>PHYSICAL ROLLS</small><h3>Estimated filament usage</h3></div><div class="add-usage"><select id="addUsageSelect"><option value="">Select an active roll</option></select><button id="addUsage" type="button">Add roll</button></div></div>
              <p class="section-intro">Cost per gram is calculated live from each selected roll's purchase cost and starting filament weight.</p>
              <div id="usageRows" class="usage-rows"></div>
              <div id="usageEmpty" class="mini-empty">Add at least one active physical roll.</div>
            </section>

            <label class="project-notes">Notes<textarea id="projectNotes" rows="4" maxlength="2000" placeholder="Request details, frame notes, delivery notes, or quote assumptions"></textarea></label>
          </section>

          <aside class="quote-preview" aria-live="polite">
            <small>LIVE COST GUARDRAIL</small>
            <div id="quotePriceOutput"></div>
            <div id="quoteWarning" class="quote-warning" hidden></div>
            <dl id="quoteBreakdown" class="quote-breakdown"></dl>
            <div id="stockSummary" class="stock-summary"></div>
          </aside>
        </div>
        <p id="projectFormError" class="form-error" role="alert" hidden></p>
        <div class="modal-actions"><button id="cancelProject" type="button">Cancel</button><button class="primary" type="submit">Save project</button></div>
      </form>`;
    document.body.append(dialog);

    $('#newProjectHero').addEventListener('click', () => openProjectDialog());
    $('#newProject').addEventListener('click', () => openProjectDialog());
    $('#newFirstProject').addEventListener('click', () => openProjectDialog());
    $('#projectSearch').addEventListener('input', renderProjects);
    $('#projectStatusFilter').addEventListener('change', renderProjects);
    $('#projectList').addEventListener('click', handleProjectAction);
    $('#closeProjectDialog').addEventListener('click', closeProjectDialog);
    $('#cancelProject').addEventListener('click', closeProjectDialog);
    $('#projectForm').addEventListener('submit', saveProject);
    $('#chooseReference').addEventListener('click', chooseReference);
    $('#removeReference').addEventListener('click', removeReference);
    $('#addUsage').addEventListener('click', addUsage);
    $('#usageRows').addEventListener('input', handleUsageInput);
    $('#usageRows').addEventListener('click', handleUsageRemove);
    ['#projectWidth', '#projectHeight', '#projectMinutes', '#projectSellPrice', '#projectCustom', '#projectStatus']
      .forEach((selector) => $(selector).addEventListener('input', renderQuotePreview));
    dialog.addEventListener('click', (event) => { if (event.target === dialog) closeProjectDialog(); });

    $('#pricingSettingsForm').addEventListener('submit', savePricingSettings);
    $('#pricingSettingsForm').addEventListener('input', () => {
      settingsDirty = true;
      $('#settingsDirtyLabel').textContent = 'Unsaved pricing changes.';
    });

    const badge = document.querySelector('.badge');
    badge.querySelector('b').textContent = 'M3A';
    const badgeText = [...badge.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (badgeText) badgeText.textContent = ' Core Quote';
    const footerLead = document.querySelector('footer span:first-child');
    footerLead.replaceChildren(createTextElement('b', '', 'Milestone 3A:'), document.createTextNode(' Manual Quote Calculator'));
  }

  function currentProject() {
    return state.data?.projects?.find((project) => project.id === editingProjectId) || null;
  }

  function projectLabel(project) {
    return project.customerName || (project.isCustom ? 'Custom project' : 'Stock / personal project');
  }

  function quoteFor(project) {
    return logic.calculateQuote({ project, settings: state.data.settings, filaments: state.data.filaments });
  }

  function filteredProjects() {
    if (!state.data) return [];
    const query = $('#projectSearch').value.trim().toLocaleLowerCase();
    const statusFilter = $('#projectStatusFilter').value;
    const rollMap = new Map(state.data.filaments.map((roll) => [roll.id, roll]));
    return state.data.projects
      .filter((project) => ['draft', 'quoted'].includes(project.status))
      .filter((project) => statusFilter === 'all' || project.status === statusFilter)
      .filter((project) => {
        if (!query) return true;
        const usageText = project.filamentUsage.map((usage) => {
          const roll = rollMap.get(usage.filamentId);
          return roll ? `${roll.colorName} ${roll.brand} ${roll.material} ${roll.rollCode}` : usage.filamentId;
        }).join(' ');
        return `${project.customerName} ${project.status} ${usageText}`.toLocaleLowerCase().includes(query);
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  function makeProjectCard(project) {
    const quote = quoteFor(project);
    const card = document.createElement('article');
    card.className = 'project-card';
    card.dataset.projectId = project.id;

    const top = document.createElement('div');
    top.className = 'project-card-top';
    if (project.originalImagePath) {
      const image = document.createElement('img');
      image.className = 'project-thumb';
      image.alt = `${projectLabel(project)} reference`;
      top.append(image);
      loadManagedImageInto(image, project.originalImagePath).catch(() => {});
    } else {
      top.append(createTextElement('div', 'project-thumb project-thumb-empty', 'No image'));
    }
    const identity = document.createElement('div');
    identity.className = 'project-identity';
    identity.append(
      createTextElement('h3', '', projectLabel(project)),
      createTextElement('p', '', `${project.widthMm ?? '—'} × ${project.heightMm ?? '—'} mm · ${Math.round(project.estimatedTimeMinutes || 0)} min`)
    );
    top.append(identity, createTextElement('span', `project-status ${project.status}`, project.status));

    const rollMap = new Map(state.data.filaments.map((roll) => [roll.id, roll]));
    const rolls = document.createElement('div');
    rolls.className = 'project-rolls';
    for (const usage of project.filamentUsage) {
      const roll = rollMap.get(usage.filamentId);
      rolls.append(createTextElement('span', '', `${roll?.colorName || 'Missing roll'} · ${formatGrams(usage.gramsEstimated)}`));
    }

    const price = document.createElement('div');
    price.className = 'project-price-row';
    const floor = document.createElement('div');
    floor.append(createTextElement('small', '', 'Floor Price (cost guardrail)'), createTextElement('strong', '', logic.money(quote.floorPrice)));
    price.append(floor);
    if (quote.sellPrice !== null) {
      const list = document.createElement('div');
      list.append(createTextElement('small', '', 'List Price (sellPrice)'), createTextElement('strong', '', logic.money(quote.sellPrice)));
      price.append(list);
    } else {
      price.append(createTextElement('p', 'floor-disclaimer', 'Cost floor, not a suggested list price.'));
    }

    const flags = document.createElement('div');
    flags.className = 'project-flags';
    if (quote.orderNeeded) flags.append(createTextElement('span', 'order-needed', 'Order Needed'));
    else flags.append(createTextElement('span', 'stock-ready', 'Inventory Ready'));
    if (quote.listPriceWarning) flags.append(createTextElement('span', 'price-alert', 'List price below 1.5× floor'));
    if (project.isCustom) flags.append(createTextElement('span', '', 'Custom'));

    const actions = document.createElement('div');
    actions.className = 'project-actions';
    actions.append(createButton('Edit project', 'edit-project'), createButton('Delete', 'delete-project', 'danger'));
    card.append(top, rolls, price, flags, actions);
    return card;
  }

  function renderProjects() {
    if (!$('#projectList') || !state.data) return;
    const projects = state.data.projects.filter((project) => ['draft', 'quoted'].includes(project.status));
    const orderNeeded = projects.filter((project) => quoteFor(project).orderNeeded);
    $('#projectCount').textContent = String(projects.length);
    $('#draftProjectCount').textContent = String(projects.filter((project) => project.status === 'draft').length);
    $('#quotedProjectCount').textContent = String(projects.filter((project) => project.status === 'quoted').length);
    $('#orderNeededCount').textContent = String(orderNeeded.length);

    const visible = filteredProjects();
    $('#projectList').replaceChildren(...visible.map(makeProjectCard));
    const hasAny = projects.length > 0;
    $('#projectEmpty').hidden = visible.length > 0;
    $('#projectEmpty b').textContent = hasAny ? 'No projects match these filters' : 'No projects yet';
    $('#projectEmpty p').textContent = hasAny ? 'Clear the search or change the status filter.' : 'Create a draft project to begin a manual quote.';
    $('#newFirstProject').hidden = hasAny;

    if (!settingsDirty) fillSettingsForm();
  }

  function fillSettingsForm() {
    if (!state.data || !$('#settingElectricity')) return;
    const settings = state.data.settings;
    const fields = {
      '#settingElectricity': settings.electricityCostPerKwh,
      '#settingWear': settings.machineWearCostPerHour,
      '#settingWattage': settings.avgPrinterWattage,
      '#settingFailure': settings.failureRatePercent,
      '#settingMargin': settings.targetMarginPercent,
      '#settingBox': settings.boxCost,
      '#settingPackingMinutes': settings.packingLaborMinutes,
      '#settingPackingRate': settings.packingLaborRatePerHour,
      '#settingFrame': settings.defaultFrameCost,
      '#settingDesign': settings.defaultDesignFee
    };
    for (const [selector, value] of Object.entries(fields)) $(selector).value = value;
    $('#settingsDirtyLabel').textContent = 'Saved settings are active.';
  }

  function settingNumber(selector, label, options = {}) {
    const value = Number($(selector).value);
    if (!Number.isFinite(value)) throw new Error(`${label} must be a number.`);
    if (value < (options.minimum ?? 0)) throw new Error(`${label} cannot be negative.`);
    if (options.maximum !== undefined && value > options.maximum) throw new Error(`${label} cannot exceed ${options.maximum}.`);
    return value;
  }

  async function savePricingSettings(event) {
    event.preventDefault();
    const error = $('#settingsError');
    try {
      error.hidden = true;
      const next = structuredClone(state.data);
      Object.assign(next.settings, {
        electricityCostPerKwh: settingNumber('#settingElectricity', 'Electricity cost'),
        machineWearCostPerHour: settingNumber('#settingWear', 'Machine wear cost'),
        avgPrinterWattage: settingNumber('#settingWattage', 'Average printer wattage'),
        failureRatePercent: settingNumber('#settingFailure', 'Failure-rate decimal', { maximum: 0.99 }),
        targetMarginPercent: settingNumber('#settingMargin', 'Target-margin decimal', { maximum: 0.99 }),
        boxCost: settingNumber('#settingBox', 'Box cost'),
        packingLaborMinutes: settingNumber('#settingPackingMinutes', 'Packing labor minutes'),
        packingLaborRatePerHour: settingNumber('#settingPackingRate', 'Packing labor rate'),
        defaultFrameCost: settingNumber('#settingFrame', 'Default frame cost'),
        defaultDesignFee: settingNumber('#settingDesign', 'Default design fee')
      });
      if (await commitData(next, 'Pricing settings updated')) {
        settingsDirty = false;
        fillSettingsForm();
      }
    } catch (saveError) {
      error.textContent = saveError.message;
      error.hidden = false;
    }
  }

  function emptyProject(id) {
    const now = new Date().toISOString();
    return {
      id,
      customerName: '',
      status: 'draft',
      isCustom: false,
      originalImagePath: null,
      finishedImagePath: null,
      widthMm: null,
      heightMm: null,
      filamentUsage: [],
      estimatedTimeMinutes: 0,
      actualTimeMinutes: null,
      estimatedFilamentCost: 0,
      actualFilamentCost: null,
      otherCosts: 0,
      floorPrice: 0,
      sellPrice: null,
      dateCreated: now,
      dateQuoted: null,
      datePrinted: null,
      dateDelivered: null,
      captionDrafts: [],
      notes: '',
      updatedAt: now
    };
  }

  function openProjectDialog(projectId = null) {
    if (!state.data) return;
    const existing = projectId ? state.data.projects.find((project) => project.id === projectId) : null;
    creatingProject = !existing;
    editingProjectId = existing?.id || crypto.randomUUID();
    const project = existing || emptyProject(editingProjectId);
    usageDraft = project.filamentUsage.map((usage) => ({ filamentId: usage.filamentId, gramsEstimated: usage.gramsEstimated }));
    selectedReference = null;
    removeExistingReference = false;

    $('#projectDialogTitle').textContent = existing ? `Edit ${projectLabel(project)}` : 'Create project';
    $('#projectCustomer').value = project.customerName || '';
    $('#projectStatus').value = ['draft', 'quoted'].includes(project.status) ? project.status : 'draft';
    $('#projectWidth').value = project.widthMm ?? '';
    $('#projectHeight').value = project.heightMm ?? '';
    $('#projectMinutes').value = project.estimatedTimeMinutes ?? 0;
    $('#projectSellPrice').value = project.sellPrice ?? '';
    $('#projectCustom').checked = Boolean(project.isCustom);
    $('#projectNotes').value = project.notes || '';
    showProjectError('');
    renderReferenceField();
    renderUsageEditor();
    renderQuotePreview();
    $('#projectDialog').showModal();
    $('#projectCustomer').focus();
  }

  function closeProjectDialog() {
    if ($('#projectDialog').open) $('#projectDialog').close();
    editingProjectId = null;
    creatingProject = false;
    usageDraft = [];
    selectedReference = null;
    removeExistingReference = false;
  }

  function showProjectError(message) {
    $('#projectFormError').textContent = message;
    $('#projectFormError').hidden = !message;
  }

  function renderReferenceField() {
    const preview = $('#referencePreview');
    preview.replaceChildren();
    const project = currentProject();
    if (selectedReference) {
      const image = document.createElement('img');
      image.src = selectedReference.dataUrl;
      image.alt = 'Selected reference preview';
      preview.append(image);
      $('#referenceFileName').textContent = selectedReference.fileName;
    } else if (!removeExistingReference && project?.originalImagePath) {
      const image = document.createElement('img');
      image.alt = `${projectLabel(project)} managed reference`;
      preview.append(image);
      loadManagedImageInto(image, project.originalImagePath).catch(() => {});
      $('#referenceFileName').textContent = 'Managed reference attached';
    } else {
      preview.append(createTextElement('span', '', 'No reference attached'));
      $('#referenceFileName').textContent = 'No file selected';
    }
  }

  async function chooseReference() {
    try {
      const result = await window.layerWorks.selectProjectImage();
      if (result?.canceled) return;
      selectedReference = result;
      removeExistingReference = false;
      renderReferenceField();
    } catch (error) {
      showProjectError(error.message);
    }
  }

  function removeReference() {
    selectedReference = null;
    removeExistingReference = true;
    renderReferenceField();
  }

  function activeAvailableRolls() {
    const selected = new Set(usageDraft.map((usage) => usage.filamentId));
    return state.data.filaments
      .filter((roll) => !roll.archived && !selected.has(roll.id))
      .sort((a, b) => a.colorName.localeCompare(b.colorName));
  }

  function renderUsageEditor() {
    const rollMap = new Map(state.data.filaments.map((roll) => [roll.id, roll]));
    const container = $('#usageRows');
    container.replaceChildren();
    for (const usage of usageDraft) {
      const roll = rollMap.get(usage.filamentId);
      if (!roll) continue;
      const costPerGram = logic.filamentCostPerGram(roll);
      const row = document.createElement('article');
      row.className = 'usage-row';
      row.dataset.filamentId = roll.id;
      const swatch = document.createElement('input');
      swatch.type = 'color';
      swatch.value = roll.colorHex;
      swatch.disabled = true;
      const identity = document.createElement('div');
      identity.className = 'usage-identity';
      identity.append(createTextElement('strong', '', roll.colorName), createTextElement('span', '', `${roll.brand} · ${roll.material} · ${roll.rollCode}${roll.archived ? ' · Archived' : ''}`));
      const gramsLabel = document.createElement('label');
      gramsLabel.append(createTextElement('span', '', 'Estimated grams'));
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0.1';
      input.step = '0.1';
      input.value = usage.gramsEstimated;
      input.dataset.usageGrams = roll.id;
      gramsLabel.append(input);
      const metrics = document.createElement('div');
      metrics.className = 'usage-metrics';
      const shortage = Math.max(0, Number(usage.gramsEstimated || 0) - Number(roll.currentFilamentWeightG || 0));
      metrics.append(
        createTextElement('span', '', `${logic.money(costPerGram)} / g`),
        createTextElement('span', '', `${formatGrams(roll.currentFilamentWeightG)} available`),
        createTextElement('b', shortage > 0 ? 'order-needed' : 'stock-ready', shortage > 0 ? `Order Needed · ${formatGrams(shortage)} short` : 'Inventory Ready')
      );
      const remove = createButton('Remove', 'remove-usage', 'danger');
      remove.dataset.removeUsage = roll.id;
      row.append(swatch, identity, gramsLabel, metrics, remove);
      container.append(row);
    }
    $('#usageEmpty').hidden = usageDraft.length > 0;

    const select = $('#addUsageSelect');
    const current = select.value;
    select.replaceChildren(new Option('Select an active roll', ''));
    for (const roll of activeAvailableRolls()) {
      select.append(new Option(`${roll.colorName} · ${roll.brand} · ${roll.rollCode} · ${formatGrams(roll.currentFilamentWeightG)}`, roll.id));
    }
    if ([...select.options].some((option) => option.value === current)) select.value = current;
    $('#addUsage').disabled = activeAvailableRolls().length === 0;
  }

  function addUsage() {
    const filamentId = $('#addUsageSelect').value;
    if (!filamentId || usageDraft.some((usage) => usage.filamentId === filamentId)) return;
    usageDraft.push({ filamentId, gramsEstimated: 1 });
    renderUsageEditor();
    renderQuotePreview();
  }

  function handleUsageInput(event) {
    const filamentId = event.target.dataset.usageGrams;
    if (!filamentId) return;
    const usage = usageDraft.find((item) => item.filamentId === filamentId);
    if (usage) usage.gramsEstimated = event.target.value;
    renderUsageEditor();
    renderQuotePreview();
    const replacement = $(`[data-usage-grams="${filamentId}"]`);
    replacement?.focus();
  }

  function handleUsageRemove(event) {
    const filamentId = event.target.dataset.removeUsage;
    if (!filamentId) return;
    usageDraft = usageDraft.filter((usage) => usage.filamentId !== filamentId);
    renderUsageEditor();
    renderQuotePreview();
  }

  function projectDraftFromForm() {
    return {
      isCustom: $('#projectCustom').checked,
      estimatedTimeMinutes: Number($('#projectMinutes').value || 0),
      sellPrice: $('#projectSellPrice').value === '' ? null : Number($('#projectSellPrice').value),
      filamentUsage: usageDraft.map((usage) => ({
        filamentId: usage.filamentId,
        gramsEstimated: Number(usage.gramsEstimated || 0)
      }))
    };
  }

  function addBreakdownRow(term, description) {
    const wrapper = document.createElement('div');
    wrapper.append(createTextElement('dt', '', term), createTextElement('dd', '', description));
    $('#quoteBreakdown').append(wrapper);
  }

  function renderQuotePreview() {
    if (!state.data || !$('#quotePriceOutput')) return;
    try {
      const quote = logic.calculateQuote({
        project: projectDraftFromForm(),
        settings: state.data.settings,
        filaments: state.data.filaments
      });
      const output = $('#quotePriceOutput');
      output.replaceChildren();
      const floor = document.createElement('section');
      floor.className = 'price-box floor';
      floor.append(createTextElement('small', '', 'Floor Price (cost guardrail)'), createTextElement('strong', '', logic.money(quote.floorPrice)));
      output.append(floor);
      if (quote.sellPrice !== null) {
        const list = document.createElement('section');
        list.className = 'price-box list';
        list.append(createTextElement('small', '', 'List Price (sellPrice)'), createTextElement('strong', '', logic.money(quote.sellPrice)));
        output.append(list);
      } else {
        output.append(createTextElement('p', 'floor-only-note', 'Cost floor, not a suggested list price.'));
      }

      const warning = $('#quoteWarning');
      warning.hidden = !quote.listPriceWarning;
      warning.textContent = quote.listPriceWarning
        ? `Warning: List Price is below 1.5 × Floor Price (${logic.money(quote.warningThreshold)}).`
        : '';

      $('#quoteBreakdown').replaceChildren();
      addBreakdownRow('Estimated filament', logic.money(quote.estimatedFilamentCost));
      addBreakdownRow('Machine rate', `${logic.money(quote.effectiveMachineRatePerHour)} / hr`);
      addBreakdownRow('Machine cost', logic.money(quote.machineCost));
      addBreakdownRow('Consumables', logic.money(quote.consumablesCost));
      addBreakdownRow('Attempt-adjusted', logic.money(quote.attemptAdjustedCost));
      addBreakdownRow('Box', logic.money(state.data.settings.boxCost));
      addBreakdownRow('Packing labor', logic.money(quote.packingLaborCost));
      addBreakdownRow('Frame', logic.money(state.data.settings.defaultFrameCost));
      addBreakdownRow('Custom design fee', logic.money(quote.designFee));
      addBreakdownRow('Floor cost', logic.money(quote.floorCost));

      const stock = $('#stockSummary');
      stock.replaceChildren();
      if (!quote.usage.length) {
        stock.append(createTextElement('p', '', 'Add a physical roll to calculate filament cost and stock sufficiency.'));
      } else {
        stock.append(createTextElement('strong', quote.orderNeeded ? 'order-needed-text' : 'stock-ready-text', quote.orderNeeded ? 'Order Needed' : 'Selected inventory is sufficient'));
        for (const entry of quote.usage) {
          stock.append(createTextElement('span', '', `${entry.roll?.colorName || 'Missing roll'}: ${formatGrams(entry.gramsEstimated)} estimated · ${logic.money(entry.estimatedCost)}${entry.orderNeeded ? ` · ${formatGrams(entry.shortageG)} short` : ''}`));
        }
      }
    } catch (error) {
      $('#quotePriceOutput').replaceChildren(createTextElement('p', 'quote-calc-error', error.message));
      $('#quoteBreakdown').replaceChildren();
      $('#stockSummary').replaceChildren();
    }
  }

  function buildProject() {
    const existing = currentProject();
    const now = new Date().toISOString();
    const widthMm = Number($('#projectWidth').value);
    const heightMm = Number($('#projectHeight').value);
    const estimatedTimeMinutes = Number($('#projectMinutes').value);
    if (!(widthMm > 0) || !(heightMm > 0)) throw new Error('Enter a print width and height greater than zero.');
    if (!Number.isFinite(estimatedTimeMinutes) || estimatedTimeMinutes < 0) throw new Error('Estimated print time must be zero or greater.');
    if (!usageDraft.length) throw new Error('Select at least one physical filament roll.');
    const filamentUsage = usageDraft.map((usage) => {
      const gramsEstimated = Number(usage.gramsEstimated);
      if (!(gramsEstimated > 0)) throw new Error('Every selected roll needs estimated grams greater than zero.');
      const oldUsage = existing?.filamentUsage?.find((item) => item.filamentId === usage.filamentId);
      return {
        filamentId: usage.filamentId,
        gramsEstimated,
        gramsActual: oldUsage?.gramsActual ?? null,
        printOrder: oldUsage?.printOrder ?? null,
        swapLayer: oldUsage?.swapLayer ?? null
      };
    });
    const status = $('#projectStatus').value;
    const sellPrice = $('#projectSellPrice').value === '' ? null : Number($('#projectSellPrice').value);
    if (sellPrice !== null && (!Number.isFinite(sellPrice) || sellPrice < 0)) throw new Error('List Price must be blank or a non-negative number.');

    const project = {
      ...(existing || emptyProject(editingProjectId)),
      id: editingProjectId,
      customerName: $('#projectCustomer').value.trim(),
      status,
      isCustom: $('#projectCustom').checked,
      widthMm,
      heightMm,
      filamentUsage,
      estimatedTimeMinutes,
      sellPrice,
      notes: $('#projectNotes').value.trim(),
      dateCreated: existing?.dateCreated || now,
      dateQuoted: status === 'quoted' ? (existing?.dateQuoted || now) : null,
      updatedAt: now
    };
    const quote = logic.calculateQuote({ project, settings: state.data.settings, filaments: state.data.filaments });
    project.estimatedFilamentCost = quote.estimatedFilamentCost;
    project.floorPrice = quote.floorPrice;
    return project;
  }

  async function saveProject(event) {
    event.preventDefault();
    let newManagedPath = null;
    try {
      showProjectError('');
      const project = buildProject();
      const existing = currentProject();
      const oldManagedPath = existing?.originalImagePath || null;
      let originalImagePath = removeExistingReference ? null : oldManagedPath;
      if (selectedReference) {
        setStatus('Copying project reference into managed storage…', 'working');
        const copied = await window.layerWorks.copyProjectImage({ sourcePath: selectedReference.sourcePath, projectId: project.id });
        if (!copied?.ok || !copied.relativePath) throw new Error('The managed project image copy was not confirmed.');
        newManagedPath = copied.relativePath;
        originalImagePath = copied.relativePath;
      }
      project.originalImagePath = originalImagePath;

      const next = structuredClone(state.data);
      const index = next.projects.findIndex((item) => item.id === project.id);
      if (index < 0) next.projects.push(project);
      else next.projects[index] = project;
      const saved = await commitData(next, index < 0 ? 'Project created' : 'Project updated');
      if (!saved) {
        if (newManagedPath) await window.layerWorks.deleteManagedImage(newManagedPath).catch(() => {});
        return;
      }
      if (oldManagedPath && oldManagedPath !== originalImagePath) {
        await window.layerWorks.deleteManagedImage(oldManagedPath).catch(() => {});
      }
      closeProjectDialog();
    } catch (error) {
      showProjectError(error.message);
    }
  }

  async function handleProjectAction(event) {
    const button = event.target.closest('button[data-action]');
    const card = event.target.closest('[data-project-id]');
    if (!button || !card) return;
    const project = state.data.projects.find((item) => item.id === card.dataset.projectId);
    if (!project) return;
    if (button.dataset.action === 'edit-project') openProjectDialog(project.id);
    if (button.dataset.action === 'delete-project') {
      if (!['draft', 'quoted'].includes(project.status)) {
        alert('Only draft or quoted projects may be deleted.');
        return;
      }
      if (!confirm(`Permanently delete ${projectLabel(project)}?`)) return;
      const next = structuredClone(state.data);
      next.projects = next.projects.filter((item) => item.id !== project.id);
      if (await commitData(next, 'Project deleted')) {
        if (project.originalImagePath) await window.layerWorks.deleteManagedImage(project.originalImagePath).catch(() => {});
        if (project.finishedImagePath) await window.layerWorks.deleteManagedImage(project.finishedImagePath).catch(() => {});
      }
    }
  }

  const baseRenderAll = renderAll;
  renderAll = function renderAllWithProjects() {
    baseRenderAll();
    renderProjects();
    if ($('#projectDialog')?.open) {
      renderUsageEditor();
      renderQuotePreview();
    }
  };

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'project.css';
  document.head.append(link);
  installProjectWorkspace();
  renderProjects();
})();
