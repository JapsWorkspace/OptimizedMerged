import {
  validateLandingAnnouncementField,
  validateLandingTipField,
  validateLandingHotlineField,
  validateLandingOfficeField,
  validateLandingDraftContent,
} from "./landingPageValidation";

describe("landingPageValidation", () => {
  test("requires update tag, title, and body", () => {
    expect(validateLandingAnnouncementField("tag", "   ")).toBe("Tag is required.");
    expect(validateLandingAnnouncementField("title", "")).toBe("Update title is required.");
    expect(validateLandingAnnouncementField("body", "   ")).toBe("Update details are required.");
  });

  test("requires preparedness reminders", () => {
    expect(validateLandingTipField("   ")).toBe("Preparedness reminder is required.");
  });

  test("accepts hotline formats with digits, spaces, plus, and dashes", () => {
    expect(validateLandingHotlineField({ type: "call", label: "Emergency", number: "0999-000-0000" }, "number")).toBe("");
    expect(validateLandingHotlineField({ type: "sms", label: "SMS", number: "+63 44 123-4567" }, "number")).toBe("");
  });

  test("rejects hotline values containing letters", () => {
    expect(
      validateLandingHotlineField(
        { type: "call", label: "Emergency", number: "0999-000-0000abcd" },
        "number"
      )
    ).toBe("Enter a valid phone number.");
  });

  test("rejects punctuation-only phone details", () => {
    ["---", "()", " + "].forEach((number) => {
      expect(
        validateLandingHotlineField(
          { type: "call", label: "Emergency", number },
          "number"
        )
      ).toBe("Enter a valid phone number.");
    });
  });

  test("rejects phone details with fewer than seven digits", () => {
    [
      { type: "call", number: "1" },
      { type: "sms", number: "9" },
      { type: "call", number: "123-45" },
      { type: "sms", number: "+63 12" },
    ].forEach(({ type, number }) => {
      expect(
        validateLandingHotlineField(
          { type, label: "Emergency", number },
          "number"
        )
      ).toBe("Enter a valid phone number.");
    });
  });

  test("validates email and link contact types", () => {
    expect(
      validateLandingHotlineField(
        { type: "email", label: "Email", number: "invalid-email" },
        "number"
      )
    ).toBe("Enter a valid email address.");

    expect(
      validateLandingHotlineField(
        { type: "link", label: "Facebook", number: "facebook-page" },
        "number"
      )
    ).toBe("Enter a valid link.");

    expect(
      validateLandingHotlineField(
        { type: "email", label: "Email", number: "help@example.com" },
        "number"
      )
    ).toBe("");

    expect(
      validateLandingHotlineField(
        { type: "link", label: "Facebook", number: "https://facebook.com/example" },
        "number"
      )
    ).toBe("");
  });

  test("requires and validates office fields", () => {
    expect(validateLandingOfficeField("name", "  ")).toBe("Office name is required.");
    expect(validateLandingOfficeField("address", "  ")).toBe("Office address is required.");
    expect(validateLandingOfficeField("hours", "  ")).toBe("Office hours are required.");
    expect(validateLandingOfficeField("email", "  ")).toBe("Office email is required.");
    expect(validateLandingOfficeField("facebook", "  ")).toBe("Facebook page link is required.");
    expect(validateLandingOfficeField("email", "wrong")).toBe("Enter a valid office email address.");
    expect(validateLandingOfficeField("facebook", "wrong")).toBe("Enter a valid Facebook page link.");
    expect(validateLandingOfficeField("email", "office@example.com")).toBe("");
    expect(validateLandingOfficeField("facebook", "https://facebook.com/example")).toBe("");
  });

  test("returns a field-error map for invalid draft content", () => {
    expect(
      validateLandingDraftContent({
        announcements: [{ tag: "", title: "", body: "" }],
        tips: [{ text: "" }],
        hotlines: [{ label: "", type: "call", number: "0999-000-0000abc" }],
        office: {
          name: "",
          address: "",
          hours: "",
          email: "bad",
          facebook: "bad",
        },
      })
    ).toMatchObject({
      "announcements.0.tag": "Tag is required.",
      "announcements.0.title": "Update title is required.",
      "announcements.0.body": "Update details are required.",
      "tips.0.text": "Preparedness reminder is required.",
      "hotlines.0.label": "Contact label is required.",
      "hotlines.0.number": "Enter a valid phone number.",
      "office.name": "Office name is required.",
      "office.address": "Office address is required.",
      "office.hours": "Office hours are required.",
      "office.email": "Enter a valid office email address.",
      "office.facebook": "Enter a valid Facebook page link.",
    });
  });
});
