(function exposeTDLogic(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TDLogic = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function effectiveTD(roll) {
    const measured = numberOrNull(roll?.tdMeasured);
    if (measured !== null) return { value: measured, source: 'Measured' };
    const stock = numberOrNull(roll?.tdStock);
    if (stock !== null) return { value: stock, source: 'Stock' };
    return { value: null, source: 'Missing' };
  }

  function tdDifference(roll) {
    const measured = numberOrNull(roll?.tdMeasured);
    const stock = numberOrNull(roll?.tdStock);
    return measured === null || stock === null ? null : measured - stock;
  }

  function normalizeTDUpdate({ stock, measured, measuredDate }) {
    const tdStock = numberOrNull(stock);
    const tdMeasured = numberOrNull(measured);
    if (stock !== '' && tdStock === null) throw new Error('Stock TD must be a valid number.');
    if (measured !== '' && tdMeasured === null) throw new Error('Measured TD must be a valid number.');
    if (tdStock !== null && tdStock < 0) throw new Error('Stock TD cannot be negative.');
    if (tdMeasured !== null && tdMeasured < 0) throw new Error('Measured TD cannot be negative.');
    if (tdMeasured !== null && !measuredDate) throw new Error('Enter the measurement date for a measured TD value.');
    return {
      tdStock,
      tdMeasured,
      tdMeasuredDate: tdMeasured === null ? null : measuredDate
    };
  }

  function formatTD(value) {
    const number = numberOrNull(value);
    return number === null ? 'Not entered' : `${number.toFixed(2)} mm`;
  }

  return { numberOrNull, effectiveTD, tdDifference, normalizeTDUpdate, formatTD };
}));
