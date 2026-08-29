import {
  MIN_CAPACITY_VALUE,
  MAX_CAPACITY_VALUE,
  getCapacityFieldError,
  getEvacuationLocationErrors,
} from "./evacuationFormValidation";

describe("evacuationFormValidation", () => {
  test("requires individual capacity when left blank", () => {
    expect(getCapacityFieldError("capacityIndividual", "")).toBe(
      "Individual capacity is required."
    );
  });

  test("requires family capacity when left blank or whitespace-only", () => {
    expect(getCapacityFieldError("capacityFamily", "   ")).toBe(
      "Family capacity is required."
    );
  });

  test("returns the inline individual capacity error when the value is outside the allowed range", () => {
    expect(getCapacityFieldError("capacityIndividual", "9")).toBe(
      `Individual capacity must be between ${MIN_CAPACITY_VALUE.toLocaleString()} and ${MAX_CAPACITY_VALUE.toLocaleString()}.`
    );
  });

  test("returns the inline bed capacity error when the value is outside the allowed range", () => {
    expect(getCapacityFieldError("bedCapacity", "10001")).toBe(
      `Bed capacity must be between ${MIN_CAPACITY_VALUE.toLocaleString()} and ${MAX_CAPACITY_VALUE.toLocaleString()}.`
    );
  });

  test("clears the inline bed capacity error when the value is valid", () => {
    expect(getCapacityFieldError("bedCapacity", "25")).toBe("");
  });

  test("requires barangay plus both coordinates when a new area is missing them", () => {
    expect(
      getEvacuationLocationErrors({
        barangayId: "",
        barangayName: "   ",
        latitude: null,
        longitude: "",
      })
    ).toEqual({
      barangay: "Barangay is required.",
      latitude: "Latitude and longitude are required.",
      longitude: "Latitude and longitude are required.",
    });
  });
});
