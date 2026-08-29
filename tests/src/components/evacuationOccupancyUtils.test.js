import {
  canIncrementFamilies,
  canIncrementOccupants,
  clampBedsToCapacity,
  clampFamiliesToCapacity,
  clampOccupantsToCapacity,
} from "./evacuationOccupancyUtils";

describe("evacuationOccupancyUtils", () => {
  it("forces occupants to zero when individual capacity is zero", () => {
    expect(clampOccupantsToCapacity(41, 0)).toBe(0);
    expect(canIncrementOccupants(0, 0)).toBe(false);
  });

  it("forces families to zero when family capacity is zero", () => {
    expect(clampFamiliesToCapacity(35, 41, 0)).toBe(0);
    expect(canIncrementFamilies(0, 41, 0)).toBe(false);
  });

  it("forces occupied beds to zero when bed capacity is zero", () => {
    expect(clampBedsToCapacity(41, 41, 0)).toBe(0);
  });

  it("still clamps values to positive capacity limits", () => {
    expect(clampOccupantsToCapacity(41, 30)).toBe(30);
    expect(clampFamiliesToCapacity(35, 41, 20)).toBe(20);
    expect(clampBedsToCapacity(41, 41, 15)).toBe(15);
  });
});
