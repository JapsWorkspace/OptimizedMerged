import {
  getAffectedPeopleCountForRow,
  getReliefPopulationValidationError,
} from "./reliefRequestValidation";

describe("reliefRequestValidation", () => {
  test("counts affected people from the evacuation-row population fields", () => {
    expect(
      getAffectedPeopleCountForRow({
        male: 10,
        female: 11,
        lgbtq: 1,
        pwd: 2,
        pregnant: 1,
        senior: 3,
      })
    ).toBe(28);
  });

  test("rejects active rows with zero affected people", () => {
    expect(
      getReliefPopulationValidationError([
        {
          evacuationCenterName: "Test Center",
          male: 0,
          female: 0,
          lgbtq: 0,
          pwd: 0,
          pregnant: 0,
          senior: 0,
          isActiveRow: true,
        },
      ])
    ).toBe(
      "Each active evacuation center row must include at least 1 affected person."
    );
  });

  test("accepts active rows that include at least one affected person", () => {
    expect(
      getReliefPopulationValidationError([
        {
          evacuationCenterName: "Test Center",
          male: 4,
          female: 3,
          lgbtq: 0,
          pwd: 0,
          pregnant: 0,
          senior: 0,
          isActiveRow: true,
        },
      ])
    ).toBe("");
  });
});
