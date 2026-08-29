# Landing Page Editor Inline Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline validation to the landing page editor for `Updates`, `Preparedness`, `Emergency Contacts`, and `Office Information`, blocking invalid saves while preserving the current editor UI and content model.

**Architecture:** Add a focused landing-page validation helper module with small pure functions, then connect it to `Dashboard.js` through lightweight `fieldErrors`, `touchedFields`, and `saveAttempted` state. Keep the existing editor layout, add inline error rendering plus invalid input styling, and cover the new behavior with helper tests and Dashboard interaction tests.

**Tech Stack:** React, Jest, React Testing Library, existing CSS in `Dashboard.css`

---

## File Structure

### Existing files to modify

- `tests/src/components/entry/Dashboard.js`
  - Current landing-page editor UI, draft state, and save flow
  - Will gain validation state, validation calls, save blocking, and inline error rendering
- `tests/src/components/css/Dashboard.css`
  - Existing landing-page editor styling
  - Will gain invalid-field and inline-error styles for the editor

### New files to create

- `tests/src/components/entry/landingPageValidation.js`
  - Pure helper functions for required text, hotline, email, URL, and section-specific field validation
- `tests/src/components/entry/landingPageValidation.test.js`
  - Unit tests for all validation rules and error messages
- `tests/src/components/entry/Dashboard.inlineValidation.test.js`
  - Interaction tests for save blocking, type-based revalidation, and reset/close clearing behavior

## Task 1: Add the landing-page validation helper

**Files:**
- Create: `tests/src/components/entry/landingPageValidation.js`
- Test: `tests/src/components/entry/landingPageValidation.test.js`

- [ ] **Step 1: Write the failing helper tests**

```javascript
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
  });

  test("requires and validates office fields", () => {
    expect(validateLandingOfficeField("name", "  ")).toBe("Office name is required.");
    expect(validateLandingOfficeField("email", "wrong")).toBe("Enter a valid office email address.");
    expect(validateLandingOfficeField("facebook", "wrong")).toBe("Enter a valid Facebook page link.");
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- --runInBand --watch=false src/components/entry/landingPageValidation.test.js`

Expected: FAIL with module-not-found or missing-export errors for `landingPageValidation`

- [ ] **Step 3: Write the minimal helper implementation**

```javascript
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const HOTLINE_PATTERN = /^[\d\s()+-]+$/;

function trimText(value) {
  return String(value || "").trim();
}

export function validateLandingAnnouncementField(field, value) {
  const text = trimText(value);

  if (field === "tag" && !text) return "Tag is required.";
  if (field === "title" && !text) return "Update title is required.";
  if (field === "body" && !text) return "Update details are required.";
  return "";
}

export function validateLandingTipField(value) {
  return trimText(value) ? "" : "Preparedness reminder is required.";
}

export function validateLandingHotlineField(item, field) {
  const label = trimText(item?.label);
  const type = trimText(item?.type).toLowerCase() || "call";
  const number = trimText(item?.number);

  if (field === "label") {
    return label ? "" : "Contact label is required.";
  }

  if (field !== "number") return "";
  if (!number) return "Contact detail is required.";

  if (type === "email") {
    return EMAIL_PATTERN.test(number) ? "" : "Enter a valid email address.";
  }

  if (type === "link") {
    return URL_PATTERN.test(number) ? "" : "Enter a valid link.";
  }

  return HOTLINE_PATTERN.test(number) ? "" : "Enter a valid phone number.";
}

export function validateLandingOfficeField(field, value) {
  const text = trimText(value);

  if (field === "name") return text ? "" : "Office name is required.";
  if (field === "address") return text ? "" : "Office address is required.";
  if (field === "hours") return text ? "" : "Office hours are required.";
  if (field === "email") {
    if (!text) return "Office email is required.";
    return EMAIL_PATTERN.test(text) ? "" : "Enter a valid office email address.";
  }
  if (field === "facebook") {
    if (!text) return "Facebook page link is required.";
    return URL_PATTERN.test(text) ? "" : "Enter a valid Facebook page link.";
  }

  return "";
}

export function validateLandingDraftContent(draftContent = {}) {
  const errors = {};

  (draftContent.announcements || []).forEach((item, index) => {
    ["tag", "title", "body"].forEach((field) => {
      const error = validateLandingAnnouncementField(field, item?.[field]);
      if (error) errors[`announcements.${index}.${field}`] = error;
    });
  });

  (draftContent.tips || []).forEach((item, index) => {
    const error = validateLandingTipField(item?.text);
    if (error) errors[`tips.${index}.text`] = error;
  });

  (draftContent.hotlines || []).forEach((item, index) => {
    ["label", "number"].forEach((field) => {
      const error = validateLandingHotlineField(item, field);
      if (error) errors[`hotlines.${index}.${field}`] = error;
    });
  });

  ["name", "address", "hours", "email", "facebook"].forEach((field) => {
    const error = validateLandingOfficeField(field, draftContent?.office?.[field]);
    if (error) errors[`office.${field}`] = error;
  });

  return errors;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- --runInBand --watch=false src/components/entry/landingPageValidation.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/src/components/entry/landingPageValidation.js tests/src/components/entry/landingPageValidation.test.js
git commit -m "feat: add landing page validation helpers"
```

## Task 2: Wire validation state into the landing-page editor save flow

**Files:**
- Modify: `tests/src/components/entry/Dashboard.js`
- Test: `tests/src/components/entry/Dashboard.inlineValidation.test.js`

- [ ] **Step 1: Write the failing Dashboard interaction tests**

```javascript
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Dashboard from "./Dashboard";

jest.mock("../layout/DashboardShell", () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn((url, options) => {
    if (!options) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: null }),
      });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({ data: JSON.parse(options.body) }),
    });
  });
});

test("blocks save and shows inline errors for blank preparedness and update fields", async () => {
  render(<Dashboard />);

  fireEvent.click(await screen.findByRole("button", { name: /Editor Mode/i }));
  fireEvent.change(screen.getAllByPlaceholderText(/Preparedness reminder/i)[0], {
    target: { value: "   " },
  });
  fireEvent.change(screen.getAllByPlaceholderText(/Announcement title/i)[0], {
    target: { value: "" },
  });

  fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

  expect(await screen.findByText("Preparedness reminder is required.")).toBeInTheDocument();
  expect(screen.getByText("Update title is required.")).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalledWith(
    expect.stringContaining("/api/public-site"),
    expect.objectContaining({ method: "PUT" })
  );
});

test("revalidates hotline detail when the contact type changes", async () => {
  render(<Dashboard />);

  fireEvent.click(await screen.findByRole("button", { name: /Editor Mode/i }));
  fireEvent.change(screen.getAllByLabelText(/Contact Detail/i)[0], {
    target: { value: "0999-000-0000" },
  });
  fireEvent.change(screen.getAllByLabelText(/Type/i)[0], {
    target: { value: "email" },
  });

  expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
});

test("clears validation state when reset is used", async () => {
  render(<Dashboard />);

  fireEvent.click(await screen.findByRole("button", { name: /Editor Mode/i }));
  fireEvent.change(screen.getAllByPlaceholderText(/Preparedness reminder/i)[0], {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
  expect(await screen.findByText("Preparedness reminder is required.")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Reset/i }));

  await waitFor(() => {
    expect(screen.queryByText("Preparedness reminder is required.")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- --runInBand --watch=false src/components/entry/Dashboard.inlineValidation.test.js`

Expected: FAIL because the editor currently saves without inline validation state and does not render these error messages

- [ ] **Step 3: Add validation state and helper wiring in `Dashboard.js`**

```javascript
const [fieldErrors, setFieldErrors] = useState({});
const [touchedFields, setTouchedFields] = useState({});
const [saveAttempted, setSaveAttempted] = useState(false);

function markFieldTouched(path) {
  setTouchedFields((prev) => ({ ...prev, [path]: true }));
}

function setFieldError(path, error) {
  setFieldErrors((prev) => {
    if (!error && !prev[path]) return prev;
    const next = { ...prev };
    if (error) next[path] = error;
    else delete next[path];
    return next;
  });
}

function clearLandingValidationState() {
  setFieldErrors({});
  setTouchedFields({});
  setSaveAttempted(false);
}

function validateSingleField(path, nextDraft = draftContent) {
  let error = "";

  if (path.startsWith("announcements.")) {
    const [, index, field] = path.split(".");
    error = validateLandingAnnouncementField(
      field,
      nextDraft.announcements?.[Number(index)]?.[field]
    );
  } else if (path.startsWith("tips.")) {
    const [, index] = path.split(".");
    error = validateLandingTipField(nextDraft.tips?.[Number(index)]?.text);
  } else if (path.startsWith("hotlines.")) {
    const [, index, field] = path.split(".");
    error = validateLandingHotlineField(nextDraft.hotlines?.[Number(index)], field);
  } else if (path.startsWith("office.")) {
    const [, field] = path.split(".");
    error = validateLandingOfficeField(field, nextDraft.office?.[field]);
  }

  setFieldError(path, error);
  return error;
}

function validateBeforeSave(nextDraft = draftContent) {
  const nextErrors = validateLandingDraftContent(nextDraft);
  setFieldErrors(nextErrors);
  setSaveAttempted(true);
  return nextErrors;
}
```

- [ ] **Step 4: Update the editor change handlers to mark touched fields and revalidate**

```javascript
function updateDraft(path, value) {
  setDraftContent((prev) => {
    const next = typeof structuredClone === "function"
      ? structuredClone(prev)
      : JSON.parse(JSON.stringify(prev));

    const keys = path.split(".");
    let ref = next;

    for (let i = 0; i < keys.length - 1; i += 1) {
      if (!ref[keys[i]]) ref[keys[i]] = {};
      ref = ref[keys[i]];
    }

    ref[keys[keys.length - 1]] = value;

    queueMicrotask(() => {
      markFieldTouched(path);
      validateSingleField(path, next);
    });

    return next;
  });
}

function updateArrayItem(section, index, field, value) {
  setDraftContent((prev) => {
    const nextItems = [...(prev[section] || [])];
    nextItems[index] = {
      ...nextItems[index],
      [field]: value,
    };

    const nextDraft = {
      ...prev,
      [section]: nextItems,
    };

    const path = `${section}.${index}.${field}`;
    queueMicrotask(() => {
      markFieldTouched(path);
      validateSingleField(path, nextDraft);
      if (section === "hotlines" && field === "type") {
        validateSingleField(`${section}.${index}.number`, nextDraft);
      }
    });

    return nextDraft;
  });
}
```

- [ ] **Step 5: Block save when errors exist and clear validation on reset/close**

```javascript
function startInlineEditing() {
  setDraftContent(siteContent);
  setSaveMessage("");
  clearLandingValidationState();
  setIsEditorOpen(true);
}

function closeInlineEditing() {
  setDraftContent(siteContent);
  setSaveMessage("");
  clearLandingValidationState();
  setIsEditorOpen(false);
}

function resetDraftContent() {
  setDraftContent(siteContent);
  clearLandingValidationState();
  setSaveMessage("Draft reset to current saved content.");
}

async function saveSiteContent() {
  if (!canEdit) return;

  const trimmedPayload = normalizeSitePayload({ ...draftContent, ... });
  const nextErrors = validateBeforeSave(trimmedPayload);
  if (Object.keys(nextErrors).length > 0) {
    setSaveMessage("");
    return;
  }

  setIsSaving(true);
  setSaveMessage("");

  try {
    // existing fetch PUT flow
    clearLandingValidationState();
    setIsEditorOpen(false);
  } catch (err) {
    // existing fallback flow
    clearLandingValidationState();
    setIsEditorOpen(false);
  } finally {
    setIsSaving(false);
  }
}
```

- [ ] **Step 6: Run the interaction tests to verify they pass**

Run: `npm.cmd test -- --runInBand --watch=false src/components/entry/Dashboard.inlineValidation.test.js`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add tests/src/components/entry/Dashboard.js tests/src/components/entry/Dashboard.inlineValidation.test.js
git commit -m "feat: block invalid landing page editor saves"
```

## Task 3: Render inline errors and invalid-field styling in the editor

**Files:**
- Modify: `tests/src/components/entry/Dashboard.js`
- Modify: `tests/src/components/css/Dashboard.css`
- Test: `tests/src/components/entry/Dashboard.inlineValidation.test.js`

- [ ] **Step 1: Write the failing style/render expectation into the Dashboard test**

```javascript
test("renders invalid styling on office email fields with bad input", async () => {
  render(<Dashboard />);

  fireEvent.click(await screen.findByRole("button", { name: /Editor Mode/i }));
  fireEvent.change(screen.getByDisplayValue(/jaenmdrrmo@example.com/i), {
    target: { value: "bad-email" },
  });

  expect(await screen.findByText("Enter a valid office email address.")).toBeInTheDocument();
  expect(screen.getByDisplayValue("bad-email")).toHaveClass("landing-inline-input-error");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- --runInBand --watch=false src/components/entry/Dashboard.inlineValidation.test.js`

Expected: FAIL because the editor currently has no invalid input class or inline error rendering

- [ ] **Step 3: Add reusable inline error helpers in `Dashboard.js`**

```javascript
function shouldShowFieldError(path) {
  return Boolean(fieldErrors[path]) && (saveAttempted || touchedFields[path]);
}

function renderFieldError(path) {
  if (!shouldShowFieldError(path)) return null;
  return <span className="landing-inline-error">{fieldErrors[path]}</span>;
}

function getFieldInputClass(path, baseClassName = "landing-inline-input") {
  return shouldShowFieldError(path)
    ? `${baseClassName} landing-inline-input-error`
    : baseClassName;
}
```

- [ ] **Step 4: Apply the helpers to the requested editor fields**

```javascript
<input
  type="text"
  className={getFieldInputClass(`tips.${index}.text`)}
  value={draftContent.tips[index]?.text || ""}
  onChange={(e) => updateArrayItem("tips", index, "text", e.target.value)}
  placeholder="Preparedness reminder"
/>
{renderFieldError(`tips.${index}.text`)}

<input
  type="text"
  className={getFieldInputClass(`hotlines.${index}.number`)}
  value={draftContent.hotlines[index]?.number || ""}
  onChange={(e) => updateArrayItem("hotlines", index, "number", e.target.value)}
  placeholder="Phone, SMS, email, or link"
/>
{renderFieldError(`hotlines.${index}.number`)}

<input
  type="text"
  className={getFieldInputClass("office.email")}
  value={draftContent.office.email}
  onChange={(e) => updateDraft("office.email", e.target.value)}
  placeholder="Office email"
/>
{renderFieldError("office.email")}
```

- [ ] **Step 5: Add the matching CSS**

```css
.landing-inline-input-error {
  border-color: #d92d20;
  box-shadow: 0 0 0 3px rgba(217, 45, 32, 0.12);
}

.landing-inline-error {
  display: block;
  margin-top: 6px;
  color: #b42318;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.35;
}

.footer-inline-field .landing-inline-error,
.preparedness-inline-edit .landing-inline-error,
.inline-edit-row .landing-inline-error {
  grid-column: 1 / -1;
}
```

- [ ] **Step 6: Run the Dashboard validation test file again**

Run: `npm.cmd test -- --runInBand --watch=false src/components/entry/Dashboard.inlineValidation.test.js`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add tests/src/components/entry/Dashboard.js tests/src/components/css/Dashboard.css tests/src/components/entry/Dashboard.inlineValidation.test.js
git commit -m "feat: show inline landing page editor validation errors"
```

## Task 4: Run the full verification pass

**Files:**
- Verify: `tests/src/components/entry/landingPageValidation.js`
- Verify: `tests/src/components/entry/Dashboard.js`
- Verify: `tests/src/components/css/Dashboard.css`
- Verify: `tests/src/components/entry/landingPageValidation.test.js`
- Verify: `tests/src/components/entry/Dashboard.inlineValidation.test.js`

- [ ] **Step 1: Run the targeted helper tests**

Run: `npm.cmd test -- --runInBand --watch=false src/components/entry/landingPageValidation.test.js`

Expected: PASS

- [ ] **Step 2: Run the targeted Dashboard interaction tests**

Run: `npm.cmd test -- --runInBand --watch=false src/components/entry/Dashboard.inlineValidation.test.js`

Expected: PASS

- [ ] **Step 3: Run the existing inventory and account validation smoke tests to catch unintended regressions**

Run: `npm.cmd test -- --runInBand --watch=false src/components/Donations/InventoryAdd.test.js src/components/auth/Register.test.js src/components/evacuationFormValidation.test.js`

Expected: PASS

- [ ] **Step 4: Run the frontend build**

Run: `npm.cmd run build`

Expected: Build succeeds. Existing unrelated warnings are acceptable only if no new landing-page validation warnings are introduced.

- [ ] **Step 5: Commit the verification checkpoint if needed**

```bash
git add tests/src/components/entry/landingPageValidation.js tests/src/components/entry/landingPageValidation.test.js tests/src/components/entry/Dashboard.js tests/src/components/entry/Dashboard.inlineValidation.test.js tests/src/components/css/Dashboard.css
git commit -m "test: verify landing page editor inline validation flow"
```
