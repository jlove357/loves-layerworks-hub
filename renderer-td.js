(() => {
  const logic = window.TDLogic;
  if (!logic) throw new Error('TD Lab logic failed to load.');

  let editingRollId = null;
  let selectedSwatch = null;
  let removeExistingSwatch = false;

  function installTDWorkspace() {
    const panel = $('#td-panel');
    panel.innerHTML = `
      <article class="td-hero">
        <div><small>TRANSMISSION DISTANCE WORKSPACE</small><h2>Turn measured swatches into trustworthy roll data.</h2><p>Compare stock and measured TD values, record when a measurement was taken, preserve a managed swatch photo, and see which value the Hub will use.</p></div>
        <button id="openTDHero" class="primary large" type="button">Record a TD measurement</button>
      </article>
      <div class="td-stats" aria-label="TD Lab summary">
        <article><small>Physical rolls</small><strong id="tdRollCount">0</strong><span>Active and archived</span></article>
        <article><small>Measured TD</small><strong id="tdMeasuredCount">0</strong><span>Rolls with your meter result</span></article>
        <article><small>Missing measured TD</small><strong id="tdMissingCount">0</strong><span>Ready for testing</span></article>
        <article><small>Measured coverage</small><strong id="tdCoverage">0%</strong><span>Across all physical rolls</span></article>
      </div>
      <article class="workspace-card td-workspace">
        <div class="workspace-head"><div><small>ROLL MEASUREMENTS</small><h2>TD records</h2></div><button id="openTD" class="primary" type="button">Update TD</button></div>
        <div class="td-quick-entry">
          <label><span>Select a roll</span><select id="tdRollSelect"><option value="">Choose a filament roll</option></select></label>
          <button id="editSelectedTD" type="button">Open selected roll</button>
        </div>
        <div class="td-filters">
          <label><span>Search TD records</span><input id="tdSearch" type="search" placeholder="Color, brand, material, or roll code"></label>
          <label><span>Show</span><select id="tdStatusFilter"><option value="all">Active and archived</option><option value="active">Active rolls</option><option value="archived">Archived rolls</option></select></label>
          <label class="check-filter"><input id="tdMissingOnly" type="checkbox"><span><strong>Missing measured TD only</strong><small>Hide already measured rolls</small></span></label>
        </div>
        <div id="tdNotice" class="notice" hidden></div>
        <div id="tdList" class="td-grid" aria-live="polite"></div>
        <div id="tdEmpty" class="empty-state" hidden><b>No TD records match</b><p>Change the search or filters, or add a physical roll in Inventory.</p></div>
      </article>`;

    const dialog = document.createElement('dialog');
    dialog.id = 'tdDialog';
    dialog.className = 'modal td-modal';
    dialog.innerHTML = `
      <form id="tdForm" novalidate>
        <div class="modal-head"><div><small>TRANSMISSION DISTANCE RECORD</small><h2 id="tdDialogTitle">Update TD</h2></div><button id="closeTDDialog" class="icon-button" type="button" aria-label="Close">×</button></div>
        <div id="tdRollIdentity" class="td-dialog-identity"></div>
        <div class="form-grid">
          <label>Stock TD<input id="tdLabStock" type="number" min="0" step="0.01" placeholder="Optional"><small>Manufacturer, HueForge, Bambu, or another library value in mm</small></label>
          <label>Measured TD<input id="tdLabMeasured" type="number" min="0" step="0.01" placeholder="Optional"><small>Your physical meter result in mm</small></label>
          <label>Measurement date<input id="tdLabDate" type="date"><small>Required whenever measured TD is entered</small></label>
          <section class="td-effective-preview"><small>EFFECTIVE TD</small><strong id="tdEffectivePreview">Missing</strong><span id="tdEffectiveSource">No TD value is available yet.</span></section>
          <section class="swatch-field wide">
            <div><span>Swatch photo</span><small>The image is copied into managed Hub storage and remains available if the original is moved.</small></div>
            <div class="swatch-controls"><div id="tdSwatchPreview" class="swatch-preview"><span>No swatch attached</span></div><div><button id="chooseTDSwatch" type="button">Choose image</button><button id="removeTDSwatch" type="button">Remove image</button><p id="tdSwatchFileName">No file selected</p></div></div>
          </section>
        </div>
        <p id="tdFormError" class="form-error" role="alert" hidden></p>
        <div class="modal-actions"><button id="cancelTD" type="button">Cancel</button><button class="primary" type="submit">Save TD record</button></div>
      </form>`;
    document.body.append(dialog);

    $('#openTDHero').addEventListener('click', () => openTDDialog());
    $('#openTD').addEventListener('click', () => openTDDialog());
    $('#editSelectedTD').addEventListener('click', () => {
      const id = $('#tdRollSelect').value;
      if (id) openTDDialog(id);
    });
    $('#tdRollSelect').addEventListener('change', () => { $('#editSelectedTD').disabled = !$('#tdRollSelect').value; });
    $('#tdSearch').addEventListener('input', renderTDLab);
    $('#tdStatusFilter').addEventListener('change', renderTDLab);
    $('#tdMissingOnly').addEventListener('change', renderTDLab);
    $('#tdList').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-td-action="edit"]');
      const card = event.target.closest('[data-td-roll-id]');
      if (button && card) openTDDialog(card.dataset.tdRollId);
    });
    $('#closeTDDialog').addEventListener('click', closeTDDialog);
    $('#cancelTD').addEventListener('click', closeTDDialog);
    $('#tdForm').addEventListener('submit', saveTDRecord);
    $('#chooseTDSwatch').addEventListener('click', chooseTDSwatch);
    $('#removeTDSwatch').addEventListener('click', removeTDSwatch);
    $('#tdLabStock').addEventListener('input', updateEffectivePreview);
    $('#tdLabMeasured').addEventListener('input', updateEffectivePreview);
    dialog.addEventListener('click', (event) => { if (event.target === dialog) closeTDDialog(); });

    const badge = document.querySelector('.badge');
    const milestone = badge.querySelector('b');
    milestone.textContent = 'M2';
    milestone.id = 'milestone';
    if (milestone.nextSibling) milestone.nextSibling.textContent = ' TD Lab';
    const footerLead = document.querySelector('footer span:first-child');
    footerLead.replaceChildren(createTextElement('b', '', 'Milestone 2:'), document.createTextNode(' TD Lab'));
  }

  function tdFilteredRolls() {
    if (!state.data) return [];
    const query = $('#tdSearch').value.trim().toLocaleLowerCase();
    const statusFilter = $('#tdStatusFilter').value;
    const missingOnly = $('#tdMissingOnly').checked;
    return state.data.filaments.filter((roll) => {
      if (statusFilter === 'active' && roll.archived) return false;
      if (statusFilter === 'archived' && !roll.archived) return false;
      if (missingOnly && logic.numberOrNull(roll.tdMeasured) !== null) return false;
      if (!query) return true;
      return [roll.rollCode, roll.brand, roll.material, roll.colorName]
        .some((value) => String(value || '').toLocaleLowerCase().includes(query));
    }).sort((a, b) => a.colorName.localeCompare(b.colorName, undefined, { sensitivity: 'base' }));
  }

  function makeTDCard(roll) {
    const card = document.createElement('article');
    card.className = 'td-card';
    card.dataset.tdRollId = roll.id;
    const effective = logic.effectiveTD(roll);
    const difference = logic.tdDifference(roll);

    const heading = document.createElement('div');
    heading.className = 'td-card-head';
    if (roll.swatchPhotoPath) {
      const image = document.createElement('img');
      image.className = 'td-photo';
      image.alt = `${roll.colorName} swatch`;
      heading.append(image);
      loadManagedImageInto(image, roll.swatchPhotoPath).catch(() => {});
    } else {
      const swatch = document.createElement('input');
      swatch.type = 'color';
      swatch.value = roll.colorHex;
      swatch.disabled = true;
      swatch.className = 'td-color';
      heading.append(swatch);
    }
    const identity = document.createElement('div');
    identity.append(createTextElement('h3', '', roll.colorName), createTextElement('p', '', `${roll.brand} · ${roll.material} · ${roll.rollCode}`));
    heading.append(identity);
    if (roll.archived) heading.append(createTextElement('span', 'td-archived', 'Archived'));

    const values = document.createElement('div');
    values.className = 'td-values';
    const entries = [
      ['Stock TD', logic.formatTD(roll.tdStock)],
      ['Measured TD', logic.formatTD(roll.tdMeasured)],
      ['Difference', difference === null ? 'Needs both values' : `${difference >= 0 ? '+' : ''}${difference.toFixed(2)} mm`],
      ['Measured on', roll.tdMeasuredDate || 'Not measured']
    ];
    for (const [label, value] of entries) {
      const item = document.createElement('div');
      item.append(createTextElement('small', '', label), createTextElement('strong', '', value));
      values.append(item);
    }

    const effectiveBox = document.createElement('div');
    effectiveBox.className = `td-effective ${effective.source.toLowerCase()}`;
    effectiveBox.append(
      createTextElement('small', '', 'EFFECTIVE TD'),
      createTextElement('strong', '', effective.value === null ? 'Missing' : `${effective.value.toFixed(2)} mm`),
      createTextElement('span', '', effective.value === null ? 'Enter a stock or measured value' : `${effective.source} value is active`)
    );

    const edit = createButton(logic.numberOrNull(roll.tdMeasured) === null ? 'Record measurement' : 'Update TD record', 'edit', 'primary');
    edit.dataset.tdAction = 'edit';
    card.append(heading, values, effectiveBox, edit);
    return card;
  }

  function renderTDLab() {
    if (!$('#tdList')) return;
    const rolls = state.data?.filaments || [];
    const measured = rolls.filter((roll) => logic.numberOrNull(roll.tdMeasured) !== null);
    $('#tdRollCount').textContent = String(rolls.length);
    $('#tdMeasuredCount').textContent = String(measured.length);
    $('#tdMissingCount').textContent = String(rolls.length - measured.length);
    $('#tdCoverage').textContent = rolls.length ? `${Math.round(measured.length / rolls.length * 100)}%` : '0%';

    const select = $('#tdRollSelect');
    const selected = select.value;
    select.replaceChildren(new Option('Choose a filament roll', ''));
    for (const roll of [...rolls].sort((a, b) => a.colorName.localeCompare(b.colorName))) {
      select.append(new Option(`${roll.colorName} · ${roll.rollCode}${roll.archived ? ' · Archived' : ''}`, roll.id));
    }
    if (rolls.some((roll) => roll.id === selected)) select.value = selected;
    $('#editSelectedTD').disabled = !select.value;

    const visible = tdFilteredRolls();
    $('#tdList').replaceChildren(...visible.map(makeTDCard));
    $('#tdEmpty').hidden = visible.length > 0;
    const disabled = state.loadFailed || !state.data;
    for (const selector of ['#openTDHero', '#openTD', '#tdRollSelect', '#editSelectedTD', '#tdSearch', '#tdStatusFilter', '#tdMissingOnly']) {
      $(selector).disabled = disabled
        || ((selector === '#openTDHero' || selector === '#openTD') && rolls.length === 0)
        || (selector === '#editSelectedTD' && !select.value);
    }
    $('#tdNotice').hidden = !disabled && rolls.length > 0;
    $('#tdNotice').textContent = disabled
      ? 'TD Lab is unavailable until the local Hub data is restored.'
      : 'Add a physical roll in Inventory before recording TD data.';
  }

  function resolveRoll(id) {
    return state.data?.filaments.find((roll) => roll.id === id) || null;
  }

  function openTDDialog(id = null) {
    const rollId = id || $('#tdRollSelect').value || state.data?.filaments[0]?.id;
    const roll = resolveRoll(rollId);
    if (!roll) {
      setStatus('Add a filament roll before recording TD', 'error');
      return;
    }
    editingRollId = roll.id;
    selectedSwatch = null;
    removeExistingSwatch = false;
    $('#tdDialogTitle').textContent = `TD · ${roll.colorName}`;
    $('#tdRollIdentity').textContent = `${roll.brand} · ${roll.material} · ${roll.rollCode}`;
    $('#tdLabStock').value = roll.tdStock ?? '';
    $('#tdLabMeasured').value = roll.tdMeasured ?? '';
    $('#tdLabDate').value = roll.tdMeasuredDate ?? '';
    $('#tdFormError').hidden = true;
    renderTDSwatchField(roll);
    updateEffectivePreview();
    $('#tdDialog').showModal();
    $('#tdLabMeasured').focus();
  }

  function closeTDDialog() {
    editingRollId = null;
    selectedSwatch = null;
    removeExistingSwatch = false;
    $('#tdDialog').close();
  }

  function showTDError(message) {
    $('#tdFormError').textContent = message;
    $('#tdFormError').hidden = !message;
  }

  function updateEffectivePreview() {
    const draft = { tdStock: $('#tdLabStock').value, tdMeasured: $('#tdLabMeasured').value };
    const effective = logic.effectiveTD(draft);
    $('#tdEffectivePreview').textContent = effective.value === null ? 'Missing' : `${effective.value.toFixed(2)} mm`;
    $('#tdEffectiveSource').textContent = effective.value === null
      ? 'No TD value is available yet.'
      : `${effective.source} value will be used by the Hub.`;
  }

  function renderTDSwatchField(roll = resolveRoll(editingRollId)) {
    const preview = $('#tdSwatchPreview');
    preview.replaceChildren();
    if (selectedSwatch) {
      const img = document.createElement('img');
      img.src = selectedSwatch.dataUrl;
      img.alt = 'Selected swatch preview';
      preview.append(img);
      $('#tdSwatchFileName').textContent = selectedSwatch.fileName;
    } else if (!removeExistingSwatch && roll?.swatchPhotoPath) {
      const img = document.createElement('img');
      img.alt = `${roll.colorName} managed swatch`;
      preview.append(img);
      loadManagedImageInto(img, roll.swatchPhotoPath).catch(() => {});
      $('#tdSwatchFileName').textContent = 'Managed swatch attached';
    } else {
      preview.append(createTextElement('span', '', 'No swatch attached'));
      $('#tdSwatchFileName').textContent = 'No file selected';
    }
  }

  async function chooseTDSwatch() {
    try {
      const result = await window.layerWorks.selectSwatchImage();
      if (result?.canceled) return;
      selectedSwatch = result;
      removeExistingSwatch = false;
      renderTDSwatchField();
    } catch (error) {
      showTDError(error.message);
    }
  }

  function removeTDSwatch() {
    selectedSwatch = null;
    removeExistingSwatch = true;
    renderTDSwatchField();
  }

  async function saveTDRecord(event) {
    event.preventDefault();
    const roll = resolveRoll(editingRollId);
    if (!roll) return;
    let newManagedPath = null;
    try {
      showTDError('');
      const update = logic.normalizeTDUpdate({
        stock: $('#tdLabStock').value,
        measured: $('#tdLabMeasured').value,
        measuredDate: $('#tdLabDate').value
      });
      const oldManagedPath = roll.swatchPhotoPath || null;
      let swatchPhotoPath = removeExistingSwatch ? null : oldManagedPath;
      if (selectedSwatch) {
        setStatus('Copying TD swatch into managed storage…', 'working');
        const copied = await window.layerWorks.copySwatchImage({ sourcePath: selectedSwatch.sourcePath, rollId: roll.id });
        if (!copied?.ok || !copied.relativePath) throw new Error('The managed swatch copy was not confirmed.');
        newManagedPath = copied.relativePath;
        swatchPhotoPath = copied.relativePath;
      }
      const next = structuredClone(state.data);
      const target = next.filaments.find((item) => item.id === roll.id);
      Object.assign(target, update, { swatchPhotoPath, updatedAt: new Date().toISOString() });
      const saved = await commitData(next, 'TD record updated');
      if (!saved) {
        if (newManagedPath) await window.layerWorks.deleteManagedImage(newManagedPath).catch(() => {});
        return;
      }
      if (oldManagedPath && oldManagedPath !== swatchPhotoPath) {
        await window.layerWorks.deleteManagedImage(oldManagedPath).catch(() => {});
      }
      closeTDDialog();
    } catch (error) {
      showTDError(error.message);
    }
  }

  const baseRenderAll = renderAll;
  renderAll = function renderAllWithTD() {
    baseRenderAll();
    renderTDLab();
  };

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'td.css';
  document.head.append(link);
  installTDWorkspace();
  renderTDLab();
})();
