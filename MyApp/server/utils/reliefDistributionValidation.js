const normalizeString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const getDistributionSignOffValidationError = (signOff = {}) => {
  const familyHeadPrintedName = normalizeString(signOff.familyHeadPrintedName);
  const barangayOfficerPrintedName = normalizeString(signOff.barangayOfficerPrintedName);

  if (!familyHeadPrintedName) {
    return "Family head printed name is required.";
  }

  if (!barangayOfficerPrintedName) {
    return "Barangay officer printed name is required.";
  }

  return null;
};

module.exports = {
  getDistributionSignOffValidationError,
};
