# Landing Page Editor Delete Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the landing-page editor delete buttons work reliably for Updates, Preparedness, and Emergency Contacts without changing the existing UI or splitting the shared delete flow.

**Architecture:** Keep the current centralized `removeItem` flow in `Dashboard.js`, but make it resilient by passing both `id` and rendered row `index`. The remover should delete by `id` when the current draft array still contains that item, fall back to the clicked row index when the `id` is missing or stale, and clear validation state only after a successful removal so index-based errors do not drift onto the wrong row.

**Tech Stack:** React, Jest, React Testing Library, Create React App test runner

---

### Task 1: Add regression coverage for all affected landing-page editor sections

**Files:**
- Modify: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\tests\src\components\entry\Dashboard.inlineValidation.test.js`
- Test: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\tests\src\components\entry\Dashboard.inlineValidation.test.js`

- [ ] **Step 1: Write the failing tests for delete behavior**

Add these tests near the existing inline-editor coverage:

```js
test("removes the selected update row from the landing page editor", async () => {
  renderDashboard();

  await openInlineEditor();
  fireEvent.click(screen.getByRole("button", { name: /Add Update/i }));

  const titleInputs = screen.getAllByPlaceholderText(/Announcement title/i);
  fireEvent.change(titleInputs[0], { target: { value: "Keep me" } });
  fireEvent.change(titleInputs[1], { target: { value: "Remove me" } });

  const deleteButtons = screen.getAllByRole("button", { name: /Delete item/i });
  fireEvent.click(deleteButtons[1]);

  await waitFor(() => {
    expect(screen.queryByDisplayValue("Remove me")).not.toBeInTheDocument();
  });
  expect(screen.getByDisplayValue("Keep me")).toBeInTheDocument();
});

test("removes the selected preparedness reminder from the landing page editor", async () => {
  renderDashboard();

  await openInlineEditor();
  fireEvent.click(screen.getByRole("button", { name: /Add Reminder/i }));

  const reminderInputs = screen.getAllByPlaceholderText(/Preparedness reminder/i);
  fireEvent.change(reminderInputs[0], { target: { value: "Keep this reminder" } });
  fireEvent.change(reminderInputs[1], { target: { value: "Delete this reminder" } });

  const deleteButtons = screen.getAllByRole("button", { name: /Delete reminder/i });
  fireEvent.click(deleteButtons[1]);

  await waitFor(() => {
    expect(
      screen.queryByDisplayValue("Delete this reminder")
    ).not.toBeInTheDocument();
  });
  expect(screen.getByDisplayValue("Keep this reminder")).toBeInTheDocument();
});

test("removes the selected emergency contact row from the landing page editor", async () => {
  renderDashboard();

  await openInlineEditor();
  fireEvent.click(screen.getByRole("button", { name: /Add Contact/i }));

  const contactInputs = screen.getAllByLabelText(/Contact Detail/i);
  fireEvent.change(contactInputs[0], { target: { value: "0999-000-0000" } });
  fireEvent.change(contactInputs[1], { target: { value: "0998-111-2222" } });

  const deleteButtons = screen.getAllByRole("button", { name: /Delete contact/i });
  fireEvent.click(deleteButtons[1]);

  await waitFor(() => {
    expect(screen.queryByDisplayValue("0998-111-2222")).not.toBeInTheDocument();
  });
  expect(screen.getByDisplayValue("0999-000-0000")).toBeInTheDocument();
});

test("keeps validation errors from sticking to the wrong reminder after delete", async () => {
  renderDashboard();

  await openInlineEditor();
  fireEvent.click(screen.getByRole("button", { name: /Add Reminder/i }));

  const reminderInputs = screen.getAllByPlaceholderText(/Preparedness reminder/i);
  fireEvent.change(reminderInputs[0], { target: { value: "" } });
  fireEvent.change(reminderInputs[1], { target: { value: "Valid second reminder" } });
  fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

  expect(
    await screen.findByText("Preparedness reminder is required.")
  ).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole("button", { name: /Delete reminder/i })[0]);

  await waitFor(() => {
    expect(
      screen.queryByText("Preparedness reminder is required.")
    ).not.toBeInTheDocument();
  });
  expect(screen.getByDisplayValue("Valid second reminder")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the targeted test file to confirm the new delete specs fail first**

Run:

```bash
cd C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\tests
npm test -- --runInBand --watch=false --runTestsByPath src/components/entry/Dashboard.inlineValidation.test.js
```

Expected:

```text
FAIL src/components/entry/Dashboard.inlineValidation.test.js
```

The failure should show that the clicked row still exists after delete, proving the current shared remover is not removing the selected item reliably.

- [ ] **Step 3: Commit the red test state only if your workflow requires it**

Do not commit a broken tree unless your execution mode explicitly wants red-green commits. If you keep working in one pass, skip this commit and move straight to the implementation task.

### Task 2: Make the shared landing-page remover resilient

**Files:**
- Modify: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\tests\src\components\entry\Dashboard.js`
- Test: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\tests\src\components\entry\Dashboard.inlineValidation.test.js`

- [ ] **Step 1: Update the shared remover signature and fallback logic**

Replace the existing shared remover with this shape:

```js
function removeItem(section, id, index) {
  const currentItems = draftContent[section] || [];

  if (currentItems.length <= 1) return;

  const resolvedIndex = currentItems.findIndex((item) => item.id === id);
  const hasMatchingId = Boolean(id) && resolvedIndex >= 0;
  const hasValidIndex =
    Number.isInteger(index) && index >= 0 && index < currentItems.length;

  if (!hasMatchingId && !hasValidIndex) return;

  clearLandingValidationState();
  setDraftContent((prev) => {
    const items = prev[section] || [];

    if (hasMatchingId) {
      return {
        ...prev,
        [section]: items.filter((item) => item.id !== id),
      };
    }

    return {
      ...prev,
      [section]: items.filter((_, itemIndex) => itemIndex !== index),
    };
  });
}
```

Then update all three delete button call sites so they pass both the `id` and the currently rendered row index:

```js
removeItem("announcements", draftContent.announcements[index]?.id, index)
removeItem("tips", draftContent.tips[index]?.id, index)
removeItem("hotlines", draftContent.hotlines[index]?.id, index)
```

- [ ] **Step 2: Tighten the implementation so validation only clears after a real delete target exists**

If the first patch computes `hasMatchingId` and `hasValidIndex` outside the setter, keep the early return exactly as above so validation is not cleared when the delete action has no real target. Preserve the existing “cannot delete the last item” rule unchanged.

- [ ] **Step 3: Run the targeted delete regression test file**

Run:

```bash
cd C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\tests
npm test -- --runInBand --watch=false --runTestsByPath src/components/entry/Dashboard.inlineValidation.test.js
```

Expected:

```text
PASS src/components/entry/Dashboard.inlineValidation.test.js
```

The four delete regressions and the existing inline-validation tests should all pass.

- [ ] **Step 4: Run the helper validation tests to catch collateral damage**

Run:

```bash
cd C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\tests
npm test -- --runInBand --watch=false --runTestsByPath src/components/entry/landingPageValidation.test.js
```

Expected:

```text
PASS src/components/entry/landingPageValidation.test.js
```

- [ ] **Step 5: Create a focused commit for the delete-button fix**

Run:

```bash
cd C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged
git add -- tests/src/components/entry/Dashboard.js tests/src/components/entry/Dashboard.inlineValidation.test.js
git commit -m "fix: restore landing page editor delete actions"
```

Expected:

```text
[finalmerged <hash>] fix: restore landing page editor delete actions
```

### Task 3: Final verification for the editor workflow

**Files:**
- Modify: none
- Test: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\tests\src\components\entry\Dashboard.inlineValidation.test.js`

- [ ] **Step 1: Run the two landing-page test files together as a final regression sweep**

Run:

```bash
cd C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\tests
npm test -- --runInBand --watch=false --runTestsByPath src/components/entry/Dashboard.inlineValidation.test.js src/components/entry/landingPageValidation.test.js
```

Expected:

```text
Test Suites: 2 passed, 2 total
Tests:       all passed
```

- [ ] **Step 2: Record manual QA expectations for the browser check**

Manual QA checklist:

```text
1. Open Landing Page editor.
2. Delete one Update row and confirm the correct row disappears.
3. Delete one Preparedness row and confirm the correct row disappears.
4. Delete one Emergency Contact row and confirm the correct row disappears.
5. Try deleting when only one row remains in each section and confirm the button stays disabled.
6. Trigger a validation error, delete the invalid row, and confirm the error message does not stay pinned to the next row.
```

- [ ] **Step 3: Do not touch unrelated dirty files in the worktree**

Leave these existing unrelated edits alone unless the current task truly requires them:

```text
tests/src/App.test.js
tests/src/components/css/Dashboard.css
tests/src/components/css/DonationValidationQueue.css
tests/src/components/css/Inventory.css
tests/src/components/css/sidebar.css
tests/src/components/layout/DashboardShell.js
```

Only the landing-page delete-button files should be staged for this bugfix commit.

## Self-Review

- Spec coverage: The plan covers the shared remover change, all three delete-button surfaces, last-item protection, and validation cleanup after removal.
- Placeholder scan: No `TODO`, `TBD`, or vague “add validation” steps remain; each code and test step includes concrete content and commands.
- Type consistency: The plan uses one shared function signature, `removeItem(section, id, index)`, and the same field names and test targets throughout.
