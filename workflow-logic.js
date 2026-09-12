(function exposeWorkflowLogic(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WorkflowLogic = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const COMPLETION_STATUSES = Object.freeze(['finished', 'delivered', 'gallery']);

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function isCompletionStatus(status) {
    return COMPLETION_STATUSES.includes(String(status || ''));
  }

  function shouldDeductInventory(project, nextStatus) {
    if (!project || project.inventoryDeductedAt) return false;
    return !isCompletionStatus(project.status) && isCompletionStatus(nextStatus);
  }

  function planInventoryDeduction(project, filaments) {
    const rollMap = new Map((Array.isArray(filaments) ? filaments : []).map((roll) => [roll?.id, roll]));
    const plan = [];
    for (const usage of Array.isArray(project?.filamentUsage) ? project.filamentUsage : []) {
      const grams = Math.max(0, number(usage?.gramsEstimated));
      if (!(grams > 0)) continue;
      const roll = rollMap.get(usage.filamentId);
      if (!roll) {
        plan.push({
          filamentId: usage.filamentId,
          grams,
          rollCode: 'Missing roll',
          colorName: 'Missing roll',
          availableG: 0,
          remainingG: 0,
          missing: true,
          insufficient: true
        });
        continue;
      }
      const availableG = Math.max(0, number(roll.currentFilamentWeightG));
      plan.push({
        filamentId: roll.id,
        grams,
        rollCode: String(roll.rollCode || ''),
        colorName: String(roll.colorName || ''),
        material: String(roll.material || ''),
        availableG,
        remainingG: Math.max(0, availableG - grams),
        missing: false,
        insufficient: grams > availableG
      });
    }
    return plan;
  }

  function deductionProblems(plan) {
    return (Array.isArray(plan) ? plan : []).filter((entry) => entry.missing || entry.insufficient);
  }

  function applyInventoryDeductionInPlace(data, projectId, plan, now = new Date().toISOString()) {
    if (!data || !Array.isArray(data.filaments) || !Array.isArray(data.projects)) {
      throw new Error('Hub data is unavailable for inventory deduction.');
    }
    const problems = deductionProblems(plan);
    if (problems.length) {
      const first = problems[0];
      if (first.missing) throw new Error(`Cannot deduct ${first.grams} g because the selected roll no longer exists.`);
      throw new Error(`Cannot deduct ${first.grams} g from ${first.rollCode}; only ${first.availableG} g remains.`);
    }

    const rollMap = new Map(data.filaments.map((roll) => [roll.id, roll]));
    for (const entry of Array.isArray(plan) ? plan : []) {
      const roll = rollMap.get(entry.filamentId);
      if (!roll) throw new Error(`Cannot deduct from missing roll ${entry.filamentId}.`);
      const availableG = Math.max(0, number(roll.currentFilamentWeightG));
      if (entry.grams > availableG) {
        throw new Error(`Cannot deduct ${entry.grams} g from ${roll.rollCode}; only ${availableG} g remains.`);
      }
      roll.currentFilamentWeightG = availableG - entry.grams;
      roll.updatedAt = now;
    }

    const project = data.projects.find((item) => item.id === projectId);
    if (!project) throw new Error('Project was not found for inventory deduction.');
    if (project.inventoryDeductedAt) throw new Error('Inventory has already been deducted for this project.');
    project.inventoryDeductedAt = now;
    project.inventoryDeductedUsage = (Array.isArray(plan) ? plan : []).map((entry) => ({
      filamentId: entry.filamentId,
      grams: entry.grams
    }));
    project.updatedAt = now;
    return data;
  }

  function deductionSummary(plan) {
    return (Array.isArray(plan) ? plan : []).map((entry) => (
      `${entry.colorName || 'Unknown'} · ${entry.rollCode || entry.filamentId}: ${entry.grams} g`
    ));
  }

  return {
    COMPLETION_STATUSES,
    isCompletionStatus,
    shouldDeductInventory,
    planInventoryDeduction,
    deductionProblems,
    applyInventoryDeductionInPlace,
    deductionSummary
  };
}));
