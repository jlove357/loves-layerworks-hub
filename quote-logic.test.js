const assert = require('node:assert/strict');
const { calculateQuote, filamentCostPerGram } = require('./quote-logic');

const settings = {
  electricityCostPerKwh: 0.16,
  machineWearCostPerHour: 0.20,
  avgPrinterWattage: 350,
  failureRatePercent: 0.15,
  targetMarginPercent: 0.35,
  boxCost: 2.50,
  packingLaborMinutes: 20,
  packingLaborRatePerHour: 20,
  defaultFrameCost: 10,
  defaultDesignFee: 0
};
const roll = {
  id: '11111111-1111-4111-8111-111111111111',
  purchaseCost: 12.50,
  startingFilamentWeightG: 1000,
  currentFilamentWeightG: 1000
};
const baseProject = {
  isCustom: false,
  estimatedTimeMinutes: 600,
  filamentUsage: [{ filamentId: roll.id, gramsEstimated: 100 }],
  sellPrice: null
};

assert.equal(filamentCostPerGram(roll), 0.0125);
const standard = calculateQuote({ project: baseProject, settings, filaments: [roll] });
assert.ok(Math.abs(standard.estimatedFilamentCost - 1.25) < 1e-9);
assert.ok(Math.abs(standard.machineCost - 2.56) < 1e-9);
assert.ok(Math.abs(standard.floorPrice - 36.38310708898944) < 1e-9);
assert.equal(Number(standard.floorPrice.toFixed(2)), 36.38);

const custom = calculateQuote({
  project: { ...baseProject, isCustom: true },
  settings: { ...settings, defaultDesignFee: 15 },
  filaments: [roll]
});
assert.equal(Number(custom.floorPrice.toFixed(2)), 59.46);

const lowList = calculateQuote({ project: { ...baseProject, sellPrice: 40 }, settings, filaments: [roll] });
assert.equal(lowList.listPriceWarning, true);
const safeList = calculateQuote({ project: { ...baseProject, sellPrice: 60 }, settings, filaments: [roll] });
assert.equal(safeList.listPriceWarning, false);
const higherCostRoll = { ...roll, purchaseCost: 15 };
const higherCost = calculateQuote({ project: baseProject, settings, filaments: [higherCostRoll] });
assert.ok(higherCost.floorPrice > standard.floorPrice);

const shortRoll = { ...roll, currentFilamentWeightG: 50 };
const short = calculateQuote({ project: baseProject, settings, filaments: [shortRoll] });
assert.equal(short.orderNeeded, true);
assert.equal(short.usage[0].shortageG, 50);

console.log('M3A quote logic tests passed.');
