(function exposeQuoteLogic(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QuoteLogic = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function numberOrZero(value) {
    const number = numberOrNull(value);
    return number === null ? 0 : number;
  }

  function filamentCostPerGram(roll) {
    const purchaseCost = numberOrZero(roll?.purchaseCost);
    const startingWeight = numberOrZero(roll?.startingFilamentWeightG);
    if (!(startingWeight > 0)) return 0;
    return purchaseCost / startingWeight;
  }

  function calculateQuote({ project, settings, filaments }) {
    const failureRate = numberOrZero(settings?.failureRatePercent);
    const targetMargin = numberOrZero(settings?.targetMarginPercent);
    if (failureRate < 0 || failureRate >= 1) throw new Error('Failure-rate decimal must be at least 0 and less than 1.');
    if (targetMargin < 0 || targetMargin >= 1) throw new Error('Target-margin decimal must be at least 0 and less than 1.');

    const rollMap = new Map((filaments || []).map((roll) => [roll.id, roll]));
    const usage = (project?.filamentUsage || []).map((entry) => {
      const roll = rollMap.get(entry.filamentId) || null;
      const gramsEstimated = Math.max(0, numberOrZero(entry.gramsEstimated));
      const costPerGram = roll ? filamentCostPerGram(roll) : 0;
      const estimatedCost = gramsEstimated * costPerGram;
      const availableG = roll ? Math.max(0, numberOrZero(roll.currentFilamentWeightG)) : 0;
      const shortageG = Math.max(0, gramsEstimated - availableG);
      return {
        filamentId: entry.filamentId,
        roll,
        gramsEstimated,
        costPerGram,
        estimatedCost,
        availableG,
        shortageG,
        orderNeeded: !roll || shortageG > 0
      };
    });

    const estimatedFilamentCost = usage.reduce((sum, entry) => sum + entry.estimatedCost, 0);
    const hours = Math.max(0, numberOrZero(project?.estimatedTimeMinutes)) / 60;
    const effectiveMachineRatePerHour = (
      numberOrZero(settings?.avgPrinterWattage) / 1000 * numberOrZero(settings?.electricityCostPerKwh)
    ) + numberOrZero(settings?.machineWearCostPerHour);
    const machineCost = hours * effectiveMachineRatePerHour;
    const consumablesCost = estimatedFilamentCost + machineCost;
    const attemptAdjustedCost = consumablesCost / (1 - failureRate);
    const packingLaborCost = (
      numberOrZero(settings?.packingLaborMinutes) / 60
    ) * numberOrZero(settings?.packingLaborRatePerHour);
    const designFee = project?.isCustom ? numberOrZero(settings?.defaultDesignFee) : 0;
    const floorCost = attemptAdjustedCost
      + numberOrZero(settings?.boxCost)
      + packingLaborCost
      + numberOrZero(settings?.defaultFrameCost)
      + designFee;
    const floorPrice = floorCost / (1 - targetMargin);
    const sellPrice = numberOrNull(project?.sellPrice);
    const warningThreshold = floorPrice * 1.5;
    const listPriceWarning = sellPrice !== null && sellPrice < warningThreshold;

    return {
      usage,
      hours,
      estimatedFilamentCost,
      effectiveMachineRatePerHour,
      machineCost,
      consumablesCost,
      attemptAdjustedCost,
      packingLaborCost,
      designFee,
      floorCost,
      floorPrice,
      sellPrice,
      warningThreshold,
      listPriceWarning,
      orderNeeded: usage.some((entry) => entry.orderNeeded)
    };
  }

  function money(value) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numberOrZero(value));
  }

  return { numberOrNull, numberOrZero, filamentCostPerGram, calculateQuote, money };
}));
