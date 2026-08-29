const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getAffectedPeopleCountForRow,
  getReliefPopulationValidationError,
} = require("./reliefRequestValidation");

test("counts affected people from relief-request row demographics", () => {
  assert.equal(
    getAffectedPeopleCountForRow({
      male: 12,
      female: 8,
      lgbtq: 1,
      pwd: 2,
      pregnant: 1,
      senior: 3,
    }),
    27
  );
});

test("rejects active relief-request rows with zero affected people", () => {
  assert.equal(
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
    ]),
    "Each active evacuation center row must include at least 1 affected person."
  );
});

test("allows inactive zero-population rows when another active row has people", () => {
  assert.equal(
    getReliefPopulationValidationError([
      {
        evacuationCenterName: "Inactive Center",
        male: 0,
        female: 0,
        lgbtq: 0,
        pwd: 0,
        pregnant: 0,
        senior: 0,
        isActiveRow: false,
      },
      {
        evacuationCenterName: "Active Center",
        male: 4,
        female: 5,
        lgbtq: 0,
        pwd: 1,
        pregnant: 0,
        senior: 0,
        isActiveRow: true,
      },
    ]),
    null
  );
});
