async function exportInventory() {
  setStatus('Preparing inventory export…', 'working');
  try {
    const result = await window.layerWorks.exportInventory();
    if (result?.canceled) {
      setStatus('Inventory export canceled', 'neutral');
      return;
    }
    setStatus(`Exported ${result.rollCount} rolls`, 'success');
  } catch (error) {
    setStatus(`Export failed: ${error.message}`, 'error');
  }
}

async function importInventory() {
  if (!confirm('Importing will replace the complete filament collection while preserving settings and projects. Continue?')) return;
  setStatus('Validating inventory import…', 'working');
  try {
    const result = await window.layerWorks.importInventory();
    if (result?.canceled) {
      setStatus('Inventory import canceled', 'neutral');
      return;
    }
    state.data = result.data;
    state.dataPath = result.path || state.dataPath;
    state.backups = result.backups || [];
    renderAll();
    setStatus(`Imported ${result.rollCount} rolls`, 'success');
  } catch (error) {
    setStatus(`Import rejected: ${error.message}`, 'error');
  }
}

async function restoreBackup() {
  const fileName = $('#backupSelect').value;
  if (!fileName) return;
  if (!confirm('Restore this backup? The current data file will be preserved before restoration.')) return;
  setStatus('Validating and restoring backup…', 'working');
  try {
    const result = await window.layerWorks.restoreBackup(fileName);
    if (!result?.ok || !result.data) throw new Error('The restoration was not confirmed.');
    state.data = result.data;
    state.dataPath = result.path || state.dataPath;
    state.backups = result.backups || [];
    state.loadFailed = false;
    setInventoryDisabled(false);
    $('#exportFullBackup').disabled = false;
    renderAll();
    setStatus('Backup restored and verified', 'success');
  } catch (error) {
    setStatus(`Restore failed: ${error.message}`, 'error');
  }
}

async function exportFullBackup() {
  setStatus('Copying and verifying full backup…', 'working');
  try {
    const result = await window.layerWorks.exportFullBackup();
    if (result?.canceled) {
      setStatus('Full backup export canceled', 'neutral');
      return;
    }
    setStatus(`Full backup verified: ${result.path}`, 'success');
  } catch (error) {
    setStatus(`Full backup failed: ${error.message}`, 'error');
  }
}

async function load() {
  try {
    const [result, paths] = await Promise.all([
      window.layerWorks.loadData(),
      window.layerWorks.dataStatus()
    ]);
    state.dataPath = result?.path || paths?.dataFile || '';
    state.backupPath = paths?.backupDir || '';
    state.backups = result?.backups || paths?.backups || [];

    if (!result?.ok || !result.data) {
      state.loadFailed = true;
      renderBackups();
      $('#dataPath').textContent = state.dataPath || 'Unavailable';
      $('#backupPath').textContent = state.backupPath || 'Unavailable';
      setInventoryDisabled(true, result?.error || 'The local Hub data could not be loaded.');
      $('#exportFullBackup').disabled = true;
      setStatus('Local data error — choose a valid backup to restore', 'error');
      return;
    }

    state.data = result.data;
    renderAll();
    setInventoryDisabled(false);
    setStatus(result.created ? 'Local inventory file created' : 'Local inventory and backups loaded', 'success');
  } catch (error) {
    console.error(error);
    state.loadFailed = true;
    setInventoryDisabled(true, error.message);
    setStatus('Inventory could not be loaded', 'error');
  }
}

for (const [index, tabButton] of tabs.entries()) {
  tabButton.addEventListener('click', () => activateTab(tabButton.dataset.tab));
  tabButton.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let next = index;
    if (event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    activateTab(tabs[next].dataset.tab, true);
  });
}

['#addRoll', '#addRollHero', '#addFirstRoll'].forEach((selector) => {
  $(selector).addEventListener('click', () => openRollDialog());
});
$('#closeRollDialog').addEventListener('click', closeRollDialog);
$('#cancelRoll').addEventListener('click', closeRollDialog);
$('#rollForm').addEventListener('submit', saveRoll);
$('#chooseSwatch').addEventListener('click', chooseSwatch);
$('#removeSwatch').addEventListener('click', removeSwatch);
$('#rollDialog').addEventListener('click', (event) => {
  if (event.target === $('#rollDialog')) closeRollDialog();
});

$('#closeSubtractDialog').addEventListener('click', closeSubtractDialog);
$('#cancelSubtract').addEventListener('click', closeSubtractDialog);
$('#subtractForm').addEventListener('submit', subtractWeight);
$('#subtractAmount').addEventListener('input', updateSubtractPreview);
$('#subtractDialog').addEventListener('click', (event) => {
  if (event.target === $('#subtractDialog')) closeSubtractDialog();
});

$('#inventoryList').addEventListener('click', handleCardAction);
$('#searchRolls').addEventListener('input', renderInventory);
$('#statusFilter').addEventListener('change', renderInventory);
$('#lowStockOnly').addEventListener('change', renderInventory);
$('#exportInventory').addEventListener('click', exportInventory);
$('#importInventory').addEventListener('click', importInventory);
$('#restoreBackup').addEventListener('click', restoreBackup);
$('#exportFullBackup').addEventListener('click', exportFullBackup);

$('#appName').textContent = window.layerWorks?.appName || "Love's LayerWorks Hub";
$('#milestone').textContent = window.layerWorks?.milestone || 'M1B';
activateTab('inventory');
load();

function loadM2TDLab() {
  const logicScript = document.createElement('script');
  logicScript.src = 'td-logic.js';
  logicScript.addEventListener('load', () => {
    const tdScript = document.createElement('script');
    tdScript.src = 'renderer-td.js';
    tdScript.addEventListener('error', () => setStatus('TD Lab failed to load', 'error'));
    document.body.append(tdScript);
  });
  logicScript.addEventListener('error', () => setStatus('TD Lab logic failed to load', 'error'));
  document.body.append(logicScript);
}

loadM2TDLab();
