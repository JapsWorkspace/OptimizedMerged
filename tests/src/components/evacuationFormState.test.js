import {
  getLiveEvacuationNumericErrors,
  toEditableNumericFieldValue,
} from "./evacuationFormState";

describe("evacuationFormState", () => {
  it("preserves zero values when preparing numeric edit fields", () => {
    expect(toEditableNumericFieldValue(0)).toBe("0");
    expect(toEditableNumericFieldValue("0")).toBe("0");
  });

  it("keeps nullish edit values blank", () => {
    expect(toEditableNumericFieldValue(null)).toBe("");
    expect(toEditableNumericFieldValue(undefined)).toBe("");
    expect(toEditableNumericFieldValue("")).toBe("");
  });

  it("returns inline errors when capacity fields are set to zero", () => {
    expect(
      getLiveEvacuationNumericErrors({
        capacityIndividual: "0",
        capacityFamily: "0",
        bedCapacity: "0",
        floorArea: "",
      })
    ).toEqual({
      capacityIndividual: "Individual capacity must be between 10 and 10,000.",
      capacityFamily: "Family capacity must be between 10 and 10,000.",
      bedCapacity: "Bed capacity must be between 10 and 10,000.",
    });
  });

  it("returns a floor area error when floor area is zero", () => {
    expect(
      getLiveEvacuationNumericErrors({
        capacityIndividual: "",
        capacityFamily: "",
        bedCapacity: "",
        floorArea: "0",
      })
    ).toEqual({
      floorArea: "Floor area must be between 1 and 1,000,000.",
    });
  });
});
