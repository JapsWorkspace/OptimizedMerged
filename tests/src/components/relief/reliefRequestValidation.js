export const getAffectedPeopleCountForRow = (row = {}) =>
  Number(row.male || 0) +
  Number(row.female || 0) +
  Number(row.lgbtq || 0) +
  Number(row.pwd || 0) +
  Number(row.pregnant || 0) +
  Number(row.senior || 0);

export const getReliefPopulationValidationError = (rows = []) => {
  const activeRows = (Array.isArray(rows) ? rows : []).filter(
    (row) => row && row.isActiveRow !== false
  );

  if (!activeRows.length) {
    return "At least one active evacuation center row is required.";
  }

  const hasZeroPopulationRow = activeRows.some(
    (row) => getAffectedPeopleCountForRow(row) <= 0
  );

  if (hasZeroPopulationRow) {
    return "Each active evacuation center row must include at least 1 affected person.";
  }

  return "";
};
