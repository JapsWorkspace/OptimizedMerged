export const MIN_CAPACITY_VALUE = 10;
export const MAX_CAPACITY_VALUE = 10000;

const CAPACITY_LABELS = {
  capacityIndividual: "Individual capacity",
  capacityFamily: "Family capacity",
  bedCapacity: "Bed capacity",
};

const formatNumber = (value) => new Intl.NumberFormat().format(Number(value || 0));

const hasText = (value) => String(value ?? "").trim().length > 0;
const hasCoordinateValue = (value) =>
  value !== null && value !== undefined && String(value).trim() !== "";

export const getCapacityFieldError = (name, value) => {
  if (!Object.prototype.hasOwnProperty.call(CAPACITY_LABELS, name)) {
    return "";
  }

  if (String(value ?? "").trim() === "") {
    return `${CAPACITY_LABELS[name]} is required.`;
  }

  const numericValue = Number(value || 0);
  if (numericValue < MIN_CAPACITY_VALUE || numericValue > MAX_CAPACITY_VALUE) {
    return `${CAPACITY_LABELS[name]} must be between ${formatNumber(
      MIN_CAPACITY_VALUE
    )} and ${formatNumber(
      MAX_CAPACITY_VALUE
    )}.`;
  }

  return "";
};

export const getEvacuationLocationErrors = ({
  barangayId,
  barangayName,
  latitude,
  longitude,
}) => {
  const nextErrors = {};

  if (!hasText(barangayId) && !hasText(barangayName)) {
    nextErrors.barangay = "Barangay is required.";
  }

  if (!hasCoordinateValue(latitude) || !hasCoordinateValue(longitude)) {
    nextErrors.latitude = "Latitude and longitude are required.";
    nextErrors.longitude = "Latitude and longitude are required.";
    return nextErrors;
  }

  const latitudeNumber = Number(latitude);
  const longitudeNumber = Number(longitude);

  if (latitudeNumber < -90 || latitudeNumber > 90) {
    nextErrors.latitude = "Latitude must be between -90 and 90.";
  }

  if (longitudeNumber < -180 || longitudeNumber > 180) {
    nextErrors.longitude = "Longitude must be between -180 and 180.";
  }

  return nextErrors;
};
