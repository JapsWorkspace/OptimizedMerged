export const MAX_INVENTORY_NAME_LENGTH = 48;
export const MAX_INVENTORY_SOURCE_NAME_LENGTH = 72;
export const MAX_INVENTORY_DESCRIPTION_LENGTH = 240;
export const MAX_INVENTORY_UNIT_LENGTH = 16;
export const MAX_INVENTORY_CATEGORY_LENGTH = 28;
export const MAX_INVENTORY_REFERENCE_LENGTH = 40;
export const MAX_INVENTORY_USAGE_DURATION_LENGTH = 48;
export const MAX_INVENTORY_SEARCH_LENGTH = 80;
export const MAX_TEMPLATE_NAME_LENGTH = 48;
export const MAX_TEMPLATE_DESCRIPTION_LENGTH = 180;

const normalizeText = (value = "") => String(value || "").normalize("NFKC");

const collapseSpaces = (value = "", { allowLineBreaks = false } = {}) => {
  const normalized = normalizeText(value).replace(/\r/g, "");
  if (allowLineBreaks) {
    return normalized
      .replace(/[^\S\n]+/g, " ")
      .replace(/[ ]*\n[ ]*/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
  }

  return normalized.replace(/\s+/g, " ");
};

const trimLongTokens = (value = "", maxTokenLength = 28) =>
  String(value || "")
    .split(/(\s+)/)
    .map((token) => (/\s+/.test(token) ? token : token.slice(0, maxTokenLength)))
    .join("");

const clampRepeatedPunctuation = (value = "") =>
  String(value || "").replace(/([!?.,:;'"#&/%()+$-])\1{2,}/g, "$1$1");

const sanitizeWithPattern = (
  value = "",
  maxLength,
  pattern,
  { allowLineBreaks = false, lowercase = false, maxTokenLength = 28 } = {}
) => {
  const cleaned = collapseSpaces(value, { allowLineBreaks })
    .replace(pattern, "")
    .replace(/[ ]{2,}/g, " ");

  const normalized = clampRepeatedPunctuation(
    trimLongTokens(cleaned, maxTokenLength)
  )
    .trimStart()
    .slice(0, maxLength);

  return lowercase ? normalized.toLowerCase() : normalized;
};

export const sanitizeInventoryCompactText = (
  value = "",
  maxLength = MAX_INVENTORY_NAME_LENGTH,
  options = {}
) =>
  sanitizeWithPattern(value, maxLength, /[^A-Za-z0-9\s.,()/#&'-]/g, {
    allowLineBreaks: false,
    maxTokenLength: 28,
    ...options,
  });

export const sanitizeInventoryNoteText = (
  value = "",
  maxLength = MAX_INVENTORY_DESCRIPTION_LENGTH,
  options = {}
) =>
  sanitizeWithPattern(
    value,
    maxLength,
    /[^A-Za-z0-9\s.,()/#&:;!?'"%+$\n-]/g,
    {
      allowLineBreaks: true,
      maxTokenLength: 42,
      ...options,
    }
  );

export const sanitizeInventoryReferenceText = (value = "") =>
  String(value || "")
    .normalize("NFKC")
    .replace(/\D/g, "")
    .slice(0, MAX_INVENTORY_REFERENCE_LENGTH);

export const sanitizeInventorySearchText = (value = "") =>
  sanitizeWithPattern(
    value,
    MAX_INVENTORY_SEARCH_LENGTH,
    /[^A-Za-z0-9\s.,()/#&'-]/g,
    {
      allowLineBreaks: false,
      maxTokenLength: 32,
    }
  );

export const sanitizeTemplateName = (value = "") =>
  sanitizeInventoryCompactText(value, MAX_TEMPLATE_NAME_LENGTH, {
    maxTokenLength: 24,
  });

export const sanitizeTemplateDescription = (value = "") =>
  sanitizeInventoryNoteText(value, MAX_TEMPLATE_DESCRIPTION_LENGTH, {
    maxTokenLength: 36,
  });

const INVENTORY_IDENTITY_PATTERN = /^[A-Za-z]+(?:[A-Za-z\s.'-]*[A-Za-z])?$/;
const INVENTORY_NOTE_ALLOWED_PATTERN = /^[A-Za-z0-9\s.,()/#&:;!?'"%+$\n-]*$/;

export const validateInventoryIdentityText = (
  value = "",
  fieldLabel = "Name"
) => {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return "";
  }

  if (!INVENTORY_IDENTITY_PATTERN.test(normalized)) {
    return `${fieldLabel} must use letters only and may include spaces, periods, apostrophes, or hyphens.`;
  }

  return "";
};

export const validateInventoryNoteCharacters = (
  value = "",
  fieldLabel = "Description"
) => {
  const normalized = String(value || "").normalize("NFKC");

  if (!normalized.trim()) {
    return "";
  }

  if (!INVENTORY_NOTE_ALLOWED_PATTERN.test(normalized)) {
    return `${fieldLabel} contains unsupported characters.`;
  }

  return "";
};

export const shouldSuppressLockedInventoryEditToast = (error = {}) => {
  const lockedFields = Array.isArray(error?.lockedFields) ? error.lockedFields : [];
  const message = String(error?.message || "").trim();

  if (lockedFields.length > 0) {
    return true;
  }

  return /cannot be changed after this item has been used in a relief release/i.test(
    message
  );
};
