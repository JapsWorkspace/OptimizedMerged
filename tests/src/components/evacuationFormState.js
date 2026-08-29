import { getCapacityFieldError } from "./evacuationFormValidation";

export const MAX_FLOOR_AREA_VALUE = 1000000;

export const toEditableNumericFieldValue = (value) =>
  value === null || value === undefined || value === "" ? "" : String(value);

export const getLiveEvacuationNumericErrors = (formData) => {
  const nextErrors = {};

  ["capacityIndividual", "capacityFamily", "bedCapacity"].forEach((fieldName) => {
    const fieldValue = String(formData?.[fieldName] ?? "");
    if (fieldValue === "") return;

    const error = getCapacityFieldError(fieldName, fieldValue);
    if (error) {
      nextErrors[fieldName] = error;
    }
  });

  const floorAreaValue = String(formData?.floorArea ?? "");
  if (floorAreaValue !== "") {
    const floorArea = Number(floorAreaValue || 0);
    if (floorArea <= 0 || floorArea > MAX_FLOOR_AREA_VALUE) {
      nextErrors.floorArea = `Floor area must be between 1 and ${new Intl.NumberFormat().format(
        MAX_FLOOR_AREA_VALUE
      )}.`;
    }
  }

  return nextErrors;
};
