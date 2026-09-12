function openSubtractDialog(id) {
  const roll = state.data.filaments.find((item) => item.id === id);
  if (!roll || roll.archived) return;
  state.subtractingId = id;
  $('#subtractRollName').textContent = `${roll.colorName} · ${roll.rollCode} has ${formatGrams(roll.currentFilamentWeightG)} remaining.`;
  $('#subtractAmount').value = '';
  $('#subtractAmount').max = String(roll.currentFilamentWeightG);
  $('#subtractRemaining').textContent = `New remaining weight: ${formatGrams(roll.currentFilamentWeightG)}`;
  $('#subtractError').hidden = true;
  $('#subtractDialog').showModal();
  $('#subtractAmount').focus();
}

function closeSubtractDialog() {
  state.subtractingId = null;
  $('#subtractDialog').close();
}

function updateSubtractPreview() {
  const roll = state.data?.filaments.find((item) => item.id === state.subtractingId);
  if (!roll) return;
  const amount = Number($('#subtractAmount').value || 0);
  const remaining = Number(roll.currentFilamentWeightG) - amount;
  $('#subtractRemaining').textContent = amount > Number(roll.currentFilamentWeightG)
    ? `This exceeds the ${formatGrams(roll.currentFilamentWeightG)} remaining.`
    : `New remaining weight: ${formatGrams(remaining)}`;
}

async function subtractWeight(event) {
  event.preventDefault();
  const roll = state.data.filaments.find((item) => item.id === state.subtractingId);
  const amount = Number($('#subtractAmount').value);
  const error = $('#subtractError');
  if (!roll) return;
  if (!(amount > 0) || amount > Number(roll.currentFilamentWeightG)) {
    error.textContent = amount > Number(roll.currentFilamentWeightG)
      ? `Cannot subtract ${formatGrams(amount)}; only ${formatGrams(roll.currentFilamentWeightG)} remains.`
      : 'Enter a positive number of grams.';
    error.hidden = false;
    return;
  }

  const next = structuredClone(state.data);
  const target = next.filaments.find((item) => item.id === roll.id);
  target.currentFilamentWeightG = Number((target.currentFilamentWeightG - amount).toFixed(3));
  target.updatedAt = new Date().toISOString();
  if (await commitData(next, `${formatGrams(amount)} subtracted`)) closeSubtractDialog();
}

async function handleCardAction(event) {
  const button = event.target.closest('button[data-action]');
  const card = event.target.closest('.roll-card');
  if (!button || !card) return;
  const id = card.dataset.id;
  const roll = state.data.filaments.find((item) => item.id === id);
  if (!roll) return;

  if (button.dataset.action === 'edit') openRollDialog(id);
  if (button.dataset.action === 'subtract') openSubtractDialog(id);

  if (button.dataset.action === 'archive') {
    const verb = roll.archived ? 'Restore' : 'Archive';
    if (!confirm(`${verb} ${roll.colorName}?`)) return;
    const next = structuredClone(state.data);
    const target = next.filaments.find((item) => item.id === id);
    target.archived = !target.archived;
    target.updatedAt = new Date().toISOString();
    await commitData(next, target.archived ? 'Roll archived' : 'Roll restored');
  }

  if (button.dataset.action === 'delete') {
    if (rollIsReferenced(id)) {
      alert('This roll is referenced by a project and must be archived instead of deleted.');
      return;
    }
    if (!confirm(`Permanently delete ${roll.colorName} (${roll.rollCode})?`)) return;
    const next = structuredClone(state.data);
    next.filaments = next.filaments.filter((item) => item.id !== id);
    const saved = await commitData(next, 'Roll permanently deleted');
    if (saved && roll.swatchPhotoPath) {
      await window.layerWorks.deleteManagedImage(roll.swatchPhotoPath).catch(() => {});
    }
  }
}
