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

  return HOTLINE_PATTERN.test(number) && number.replace(/\D/g, "").length >= 7
    ? ""
    : "Enter a valid phone number.";
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
