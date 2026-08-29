const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getDistributionSignOffValidationError,
} = require("./reliefDistributionValidation");

test("requires family head printed name", () => {
  assert.equal(
    getDistributionSignOffValidationError({
      familyHeadPrintedName: "   ",
      barangayOfficerPrintedName: "Officer One",
    }),
    "Family head printed name is required."
  );
});

test("requires barangay officer printed name", () => {
  assert.equal(
    getDistributionSignOffValidationError({
      familyHeadPrintedName: "Juan Dela Cruz",
      barangayOfficerPrintedName: "",
    }),
    "Barangay officer printed name is required."
  );
});

test("accepts sign-off names when both are present", () => {
  assert.equal(
    getDistributionSignOffValidationError({
      familyHeadPrintedName: "Juan Dela Cruz",
      barangayOfficerPrintedName: "Maria Santos",
    }),
    null
  );
});
