# Landing Page Editor Delete Button Design

## Goal

Fix the landing page editor delete buttons so item removal works reliably in all three affected inline-edit sections:

- `Updates`
- `Preparedness`
- `Emergency Contacts`

The fix should preserve the current editor UI and keep the delete behavior centralized in the shared remover logic instead of creating separate removal code per section.

## Scope

This design applies to:

- `tests/src/components/entry/Dashboard.js`
- Landing page editor inline delete buttons that currently call `removeItem(section, id)`
- Tests covering delete behavior for editor list sections

This design does not include:

- Broad refactoring of the landing-page editor state model
- Replacing index-based validation across the whole editor
- UI redesign of delete buttons
- Backend changes

## Problem Summary

The editor currently routes delete actions for `Updates`, `Preparedness`, and `Emergency Contacts` through the shared function:

- `removeItem(section, id)`

That is the correct architecture, but it is also the single failure point. If the clicked row’s `id` is missing, stale, or not present in the current `draftContent[section]` array, the filter removes nothing and the delete button appears broken to the user.

Because all three sections use the same shared delete flow, this should be fixed once in the shared remover logic rather than patched individually in each section.

## Recommended Approach

Keep the shared delete flow and make it resilient.

The delete handler should:

1. Continue using the section name to identify the correct landing-page array
2. Prefer deleting by stable item `id` when that `id` exists in the current draft array
3. Fall back to deleting by the currently rendered row position when the `id` is missing or stale
4. Preserve the current rule that the editor cannot delete the last remaining item in a section
5. Reset or rebuild validation state after a successful delete so field errors do not stick to the wrong row

## Behavioral Rules

### Shared delete flow

The remover should continue to be the single code path for:

- `announcements`
- `tips`
- `hotlines`

Do not add separate delete functions unless the current shared path proves impossible to keep clear.

### Primary delete mode

When a clicked item has a valid `id` that exists in the current `draftContent[section]` array:

- remove the matching item by `id`

### Fallback delete mode

When the clicked item’s `id` is:

- missing
- undefined
- stale
- not found in the current `draftContent[section]`

the delete flow should still remove the intended row by using the rendered item position from the click context.

This keeps the delete button working even when the current row’s `id` value does not map cleanly to the current array contents.

### Last-item protection

The current editor behavior disables deletion when only one item remains in a section.

That rule stays in place for this fix. The delete-button bug should be solved without changing the minimum-item policy.

### Validation-state handling

Deleting an item changes array indices, so the editor must not keep stale validation metadata attached to old index paths.

After a successful delete:

- clear landing-page validation state, or
- rebuild it from the new current draft content

For this bugfix, clearing the validation state is acceptable if it keeps the code smaller and avoids stale index-path problems.

## Proposed Code Shape

Update the shared remover so it accepts enough context to delete reliably even when `id` lookup fails.

Recommended signature:

- `removeItem(section, id, index)`

Behavior:

- use `id` when it resolves to a current array item
- otherwise use `index`
- if neither is valid, do nothing

The inline delete buttons for announcements, tips, and hotlines should pass the row index along with the item id.

## Testing

Add regression coverage for all three sections.

Minimum test coverage:

- deleting an `Update` removes the expected announcement row
- deleting a `Preparedness` item removes the expected tip row
- deleting an `Emergency Contact` removes the expected hotline row
- delete still does nothing when only one item remains in the section
- validation state does not remain attached to the wrong row after deletion

Tests should verify user-visible behavior, not just the internal function call.

## Risks and Mitigations

### Risk: deleting the wrong row

Mitigation:

- prefer `id` when present and valid
- use index only as a fallback when the current `id` no longer matches the active draft array

### Risk: stale validation after delete

Mitigation:

- clear or rebuild validation state immediately after successful removal

### Risk: overbuilding

Mitigation:

- do not refactor the full editor state model
- do not redesign list rendering
- keep the change inside the shared delete path plus tests

## Success Criteria

This work is complete when:

- the `Updates` delete button removes the selected row
- the `Preparedness` delete button removes the selected row
- the `Emergency Contacts` delete button removes the selected row
- the shared delete path remains the single implementation
- the editor still protects against deleting the last remaining item
- validation state does not get stuck on the wrong row after deletion
