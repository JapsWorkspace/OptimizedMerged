# Landing Page Editor Inline Validation Design

## Goal

Add consistent inline validation to the landing page editor so editors get immediate, field-level feedback before saving. The work covers the `Updates` editor card, the `Preparedness` editor card beside it, and the footer editing areas for `Emergency Contacts` and `Office Information`.

The design keeps the current landing page layout and editing flow intact. It adds validation behavior only; it does not redesign the editor or change the saved content model.

## Scope

This design applies to:

- `tests/src/components/entry/Dashboard.js`
- Existing landing page editor fields rendered in inline edit mode
- Shared validation helpers needed for landing page editor fields
- Existing landing page editor styling in `tests/src/components/css/Dashboard.css`

This design does not include:

- Hero section validation changes beyond current trimming behavior
- Image upload validation changes
- Backend schema redesign for public site content
- Public visitor-side rendering changes

## Validation Approach

Use a hybrid validation model:

- Required-field errors appear after a field has been touched or after the user clicks `Save Changes`
- Format-specific errors update live as the user types
- Saving is blocked while any inline validation error exists

This keeps the editor responsive without showing required-field errors too aggressively on untouched fields.

## Affected Editor Areas

### Updates card

Each editable update item continues to support:

- `tag`
- `title`
- `body`

Validation rules:

- `tag` is required
- `title` is required
- `body` is required
- Whitespace-only values count as empty
- Existing character limits remain enforced by the current input caps

### Preparedness card

Each preparedness tip continues to support:

- `text`

Validation rules:

- `text` is required
- Whitespace-only values count as empty
- Existing character limits remain enforced by the current input cap

### Emergency Contacts

Each contact continues to support:

- `label`
- `type`
- `number` field, which is the shared contact-detail value for all contact types

Validation rules:

- `label` is required
- `number` is required
- Whitespace-only values count as empty
- `type=call` and `type=sms`
  - Allow digits, spaces, `+`, `-`, `(`, and `)`
  - Reject letters and other symbols
  - This explicitly allows hotline formats such as `0999-000-0000` and `+63 44 123-4567`
- `type=email`
  - Require a valid email format
- `type=link`
  - Require a valid URL format

Changing the contact `type` immediately revalidates the current contact-detail value so an existing value can become valid or invalid as soon as the type changes.

### Office Information

The footer office fields continue to support:

- `office.name`
- `office.address`
- `office.hours`
- `office.email`
- `office.facebook`

Validation rules:

- `office.name` is required
- `office.address` is required
- `office.hours` is required
- `office.email` is required and must be a valid email format
- `office.facebook` is required and must be a valid URL format

## Error Messaging

Inline validation messages should be direct and consistent with other recent form fixes in the project.

Examples:

- `Tag is required.`
- `Update title is required.`
- `Update details are required.`
- `Preparedness reminder is required.`
- `Contact label is required.`
- `Contact detail is required.`
- `Enter a valid phone number.`
- `Enter a valid email address.`
- `Enter a valid link.`
- `Office name is required.`
- `Office address is required.`
- `Office hours are required.`
- `Office email is required.`
- `Enter a valid office email address.`
- `Facebook page link is required.`
- `Enter a valid Facebook page link.`

## State Model

Add a lightweight editor-validation state alongside the existing `draftContent` state.

Recommended structure:

- `fieldErrors`
  - keyed by stable field path
- `touchedFields`
  - keyed by stable field path
- `saveAttempted`
  - boolean used to reveal all required-field errors on save

Examples of stable field paths:

- `announcements.0.tag`
- `announcements.0.title`
- `announcements.0.body`
- `tips.1.text`
- `hotlines.2.label`
- `hotlines.2.number`
- `office.email`

The validation layer should use index-based keys because the existing editor updates array items by index and already treats those lists as ordered editable collections.

## Validation Flow

### On field change

- Update the draft value as today
- Mark the field as touched
- Re-run validation for that field
- If the field belongs to a contact row and the contact `type` changes, re-run validation for that contact row’s `number` field too

### On save

- Mark `saveAttempted=true`
- Validate all fields covered by this design
- If any errors exist, keep the editor open and do not submit the API request
- If no errors exist, submit the current save flow

### On reset

- Reset `draftContent` back to the saved page content
- Clear `fieldErrors`
- Clear `touchedFields`
- Clear `saveAttempted`

### On close editor

- Reset validation state together with the draft reset behavior already in place

## UI Behavior

Keep the existing inline editor layout, then add:

- Error styling on invalid inline inputs
- A short inline error message directly under each invalid field
- No toast for field validation failures

This is important because the user requested inline validation specifically, and the editor should not depend on generic save-failure messaging for content-entry mistakes.

## Shared Validation Helpers

Introduce a focused helper module for landing page editor validation rather than embedding all rules directly in `Dashboard.js`.

The helper should cover:

- required trimmed text checks
- phone-format checks for `call` and `sms`
- email-format checks
- URL-format checks
- section-specific wrappers for:
  - updates items
  - preparedness tips
  - hotline rows
  - office fields

This keeps the rules testable and prevents `Dashboard.js` from becoming harder to maintain.

## Backend Interaction

No backend contract changes are required.

The current backend sanitization in `MyApp/server/controllers/publicSiteController.js` remains as a final cleanup layer, but it should no longer be the first place where editors learn that their content is malformed or blank. The frontend validation should stop invalid payloads before submit.

## Testing

Add focused tests for the landing page validation helper and for the editor save behavior.

Minimum coverage:

- required validation for update fields
- required validation for preparedness tips
- hotline validation for `call` and `sms`
  - accepts digits and dash-separated formats
  - rejects letters
- email validation for contact type `email`
- URL validation for contact type `link`
- required and format validation for office fields
- save is blocked when validation errors exist
- reset clears validation state
- changing contact type revalidates the contact-detail field

## Risks and Mitigations

### Risk: noisy validation during typing

Mitigation:

- Use touched-state plus save-attempt gating for required errors
- Keep live validation focused on the field being edited

### Risk: over-restricting real-world hotline formats

Mitigation:

- Allow digits, spaces, `+`, `-`, `(`, and `)` for `call` and `sms`
- Reject only letters and clearly invalid symbols

### Risk: editor arrays showing stale index-based errors after item deletion

Mitigation:

- Recompute or remap validation state after removing an item
- Prefer rebuilding errors from current draft content after delete operations instead of trying to preserve stale keys

## Implementation Notes

- Preserve the current editor visuals and interaction flow
- Do not introduce backend-only validation messages into the inline editor
- Keep validation rules localized to the requested sections first
- Follow the project’s existing inline-error style used in other forms where possible

## Success Criteria

This work is complete when:

- `Updates` fields show inline required errors
- `Preparedness` fields show inline required errors
- `Emergency Contacts` fields validate required and type-specific formats inline
- `Call` and `SMS` contact values allow dash-formatted hotlines
- `Office Information` fields validate required and format rules inline
- Invalid content cannot be saved
- `Reset` and editor close both clear draft validation state
- The existing landing page design remains visually consistent
