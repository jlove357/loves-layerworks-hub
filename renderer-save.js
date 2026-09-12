async function commitData(nextData, successMessage) {
  if (state.saving) return false;
  state.saving = true;
  setStatus('Saving, verifying, and rotating backups…', 'working');
  try {
    const response = await window.layerWorks.saveData(nextData);
    if (!response?.ok || !response.data) throw new Error('The save was not confirmed.');
    state.data = response.data;
    state.dataPath = response.path || state.dataPath;
    state.backups = response.backups || [];
    renderAll();
    setStatus(`${successMessage} · ${new Date(response.savedAt).toLocaleTimeString()}`, 'success');
    return true;
  } catch (error) {
    console.error(error);
    setStatus(`Save failed: ${error.message}`, 'error');
    return false;
  } finally {
    state.saving = false;
  }
}

async function saveRoll(event) {
  event.preventDefault();
  let newManagedPath = null;
  try {
    const roll = buildRoll();
    const existing = state.editingId ? state.data.filaments.find((item) => item.id === state.editingId) : null;
    const oldManagedPath = existing?.swatchPhotoPath || null;

    if (state.selectedSwatch) {
      setStatus('Copying swatch into managed storage…', 'working');
      const copied = await window.layerWorks.copySwatchImage({
        sourcePath: state.selectedSwatch.sourcePath,
        rollId: roll.id
      });
      if (!copied?.ok || !copied.relativePath) throw new Error('The managed swatch copy was not confirmed.');
      newManagedPath = copied.relativePath;
      roll.swatchPhotoPath = copied.relativePath;
    }

    const next = structuredClone(state.data);
    const index = next.filaments.findIndex((item) => item.id === roll.id);
    if (index < 0) next.filaments.push(roll);
    else next.filaments[index] = roll;

    const saved = await commitData(next, index < 0 ? 'Roll added' : 'Roll updated');
    if (!saved) {
      if (newManagedPath) await window.layerWorks.deleteManagedImage(newManagedPath).catch(() => {});
      return;
    }

    if (oldManagedPath && oldManagedPath !== roll.swatchPhotoPath) {
      await window.layerWorks.deleteManagedImage(oldManagedPath).catch(() => {});
    }
    closeRollDialog();
  } catch (error) {
    showFormError(error.message);
  }
}

async function chooseSwatch() {
  try {
    const result = await window.layerWorks.selectSwatchImage();
    if (result?.canceled) return;
    state.selectedSwatch = result;
    state.removeExistingSwatch = false;
    renderSwatchField();
  } catch (error) {
    showFormError(error.message);
  }
}

function removeSwatch() {
  state.selectedSwatch = null;
  state.removeExistingSwatch = true;
  renderSwatchField();
}
