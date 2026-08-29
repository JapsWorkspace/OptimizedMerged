const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getActiveReliefRows = (rows = []) =>
  (Array.isArray(rows) ? rows : []).filter((row) => row && row.isActiveRow !== false);

const getAffectedPeopleCountForRow = (row = {}) =>
  toNumber(row.male) +
  toNumber(row.female) +
  toNumber(row.lgbtq) +
  toNumber(row.pwd) +
  toNumber(row.pregnant) +
  toNumber(row.senior);

const getReliefPopulationValidationError = (rows = []) => {
  const activeRows = getActiveReliefRows(rows);

  if (!activeRows.length) {
    return "At least one active evacuation center row is required.";
  }

  const hasZeroPopulationRow = activeRows.some(
    (row) => getAffectedPeopleCountForRow(row) <= 0
  );

  if (hasZeroPopulationRow) {
    return "Each active evacuation center row must include at least 1 affected person.";
  }

  return null;
};

module.exports = {
  getActiveReliefRows,
  getAffectedPeopleCountForRow,
  getReliefPopulationValidationError,
};
