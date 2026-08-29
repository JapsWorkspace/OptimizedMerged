export const getOccupancyCapacityLimit = (value) => {
  const numericValue = Number(value || 0);
  return numericValue > 0 ? numericValue : 0;
};

export const clampOccupantsToCapacity = (peopleValue, capacityValue) => {
  const currentPeople = Math.max(0, Number(peopleValue || 0));
  const individualCapacity = getOccupancyCapacityLimit(capacityValue);
  return individualCapacity > 0
    ? Math.min(currentPeople, individualCapacity)
    : 0;
};

export const clampFamiliesToCapacity = (familiesValue, peopleValue, familyCapacityValue) => {
  const currentFamilies = Math.max(0, Number(familiesValue || 0));
  const currentPeople = Math.max(0, Number(peopleValue || 0));
  const familyCapacity = getOccupancyCapacityLimit(familyCapacityValue);
  if (familyCapacity <= 0 || currentPeople <= 0) return 0;
  return Math.min(currentFamilies, familyCapacity, currentPeople);
};

export const clampBedsToCapacity = (bedsValue, peopleValue, bedCapacityValue) => {
  const baseBedValue =
    bedsValue === null || bedsValue === undefined ? peopleValue : bedsValue;
  const requestedBeds = Math.max(0, Number(baseBedValue || 0));
  const currentPeople = Math.max(0, Number(peopleValue || 0));
  const bedCapacity = getOccupancyCapacityLimit(bedCapacityValue);
  if (bedCapacity <= 0 || currentPeople <= 0) return 0;
  return Math.min(requestedBeds, currentPeople, bedCapacity);
};

export const canIncrementOccupants = (currentPeople, capacityValue) =>
  clampOccupantsToCapacity(currentPeople, capacityValue) <
  getOccupancyCapacityLimit(capacityValue);

export const canIncrementFamilies = (currentFamilies, currentPeople, familyCapacityValue) =>
  clampFamiliesToCapacity(currentFamilies, currentPeople, familyCapacityValue) <
  Math.min(
    Math.max(0, Number(currentPeople || 0)),
    getOccupancyCapacityLimit(familyCapacityValue)
  );
