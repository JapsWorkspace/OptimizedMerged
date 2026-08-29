import {
  MAX_INVENTORY_REFERENCE_LENGTH,
  MAX_TEMPLATE_NAME_LENGTH,
  shouldSuppressLockedInventoryEditToast,
  sanitizeInventoryCompactText,
  sanitizeInventoryNoteText,
  validateInventoryNoteCharacters,
  sanitizeInventoryReferenceText,
  sanitizeInventorySearchText,
  sanitizeTemplateDescription,
  sanitizeTemplateName,
  validateInventoryIdentityText,
} from "./inventoryTextUtils";

describe("inventoryTextUtils", () => {
  test("trims long unbroken compact text tokens", () => {
    expect(
      sanitizeInventoryCompactText(
        "Notocallldasdasdasdasdasdsadsasdasdasdasdasdasdasdsaasd"
      )
    ).toBe("Notocallldasdasdasdasdasdsad");
  });

  test("keeps note text readable while removing unsupported characters", () => {
    expect(
      sanitizeInventoryNoteText("Donation from jp $$$$\nReference...ðŸš«ðŸš«")
    ).toBe("Donation from jp $$\nReference..");
  });

  test("normalizes reference numbers and caps their length", () => {
    const value = sanitizeInventoryReferenceText(" abc-1234 / test ref @@@ ");
    expect(value).toBe("1234");
    expect(sanitizeInventoryReferenceText("9".repeat(100))).toHaveLength(
      MAX_INVENTORY_REFERENCE_LENGTH
    );
  });

  test("sanitizes search text and removes noisy symbols", () => {
    expect(sanitizeInventorySearchText("donor ### name %% alert ðŸš«")).toBe(
      "donor ## name alert "
    );
    expect(sanitizeInventorySearchText("donor name ")).toBe("donor name ");
  });

  test("tightens template name and description limits", () => {
    expect(
      sanitizeTemplateName(
        "Food pack alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi"
      )
    ).toHaveLength(MAX_TEMPLATE_NAME_LENGTH);
    expect(
      sanitizeTemplateDescription("Rice, sardines, and noodles for evacuees!!! ###")
    ).toBe("Rice, sardines, and noodles for evacuees!! ##");
  });

  test("rejects digits and unsupported symbols in identity text", () => {
    expect(validateInventoryIdentityText("ONIO N##&", "Name")).toBe(
      "Name must use letters only and may include spaces, periods, apostrophes, or hyphens."
    );
    expect(validateInventoryIdentityText("LGU 12424", "Provider name")).toBe(
      "Provider name must use letters only and may include spaces, periods, apostrophes, or hyphens."
    );
  });

  test("accepts clean identity text", () => {
    expect(validateInventoryIdentityText("Juan Dela Cruz", "Name")).toBe("");
    expect(validateInventoryIdentityText("St. Mary's Outreach", "Provider name")).toBe("");
  });

  test("rejects template names with digits or unsupported symbols", () => {
    expect(validateInventoryIdentityText("2#&(()", "Template name")).toBe(
      "Template name must use letters only and may include spaces, periods, apostrophes, or hyphens."
    );
    expect(validateInventoryIdentityText("Food Pack Alpha", "Template name")).toBe(
      ""
    );
  });

  test("rejects unsupported note characters while allowing readable punctuation", () => {
    expect(validateInventoryNoteCharacters("notes [] {}", "Description")).toBe(
      "Description contains unsupported characters."
    );
    expect(
      validateInventoryNoteCharacters("Delivered to evac site - urgent!", "Description")
    ).toBe("");
  });

  test("suppresses locked inventory edit toast errors when the form already explains the lock", () => {
    expect(
      shouldSuppressLockedInventoryEditToast({
        lockedFields: ["type", "category", "unit", "sourceType"],
      })
    ).toBe(true);

    expect(
      shouldSuppressLockedInventoryEditToast({
        message:
          "Type, category, unit, and provider cannot be changed after this item has been used in a relief release.",
      })
    ).toBe(true);

    expect(
      shouldSuppressLockedInventoryEditToast({
        message: "Reference number already exists for another monetary donation.",
      })
    ).toBe(false);
  });
});
