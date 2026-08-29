const getLocalDateParts = (date = new Date()) => ({
  year: date.getFullYear(),
  month: String(date.getMonth() + 1).padStart(2, "0"),
  day: String(date.getDate()).padStart(2, "0"),
});

const { year: INVENTORY_HISTORY_YEAR, month: INVENTORY_HISTORY_MONTH, day: INVENTORY_HISTORY_DAY } =
  getLocalDateParts();
const INVENTORY_HISTORY_YEAR_START = `${INVENTORY_HISTORY_YEAR}-01-01`;
const INVENTORY_HISTORY_MAX_DATE = `${INVENTORY_HISTORY_YEAR}-${INVENTORY_HISTORY_MONTH}-${INVENTORY_HISTORY_DAY}`;
const INVENTORY_HISTORY_MAX_MONTH = INVENTORY_HISTORY_MAX_DATE.slice(0, 7);

const normalizeDateOnly = (value) => String(value || "").slice(0, 10);

const normalizeLower = (value) => String(value || "").trim().toLowerCase();

const isValidDateOnly = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const normalizeHistoryEventDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.toISOString().slice(0, 10);
  }

  const normalizedString = String(value || "").trim();
  const normalizedDate = normalizeDateOnly(value);
  if (isValidDateOnly(normalizedDate)) {
    return normalizedDate;
  }

  if (!/[tT ]/.test(normalizedString)) {
    return "";
  }

  const parsedDate = new Date(normalizedString);
  return Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.toISOString().slice(0, 10);
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getMonthEndDate = (rawMonth) => {
  const normalizedMonth = String(rawMonth || "").slice(0, 7);

  if (!normalizedMonth) {
    return "";
  }

  const [yearText, monthText] = normalizedMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return "";
  }

  const endOfMonth = new Date(Date.UTC(year, month, 0));
  return endOfMonth.toISOString().slice(0, 10);
};

const normalizeInventoryHistoryDateInput = (rawDate, rawMonth = "") => {
  const normalizedMonth = String(rawMonth || "").slice(0, 7);
  const hasExplicitRawDate = rawDate !== undefined && rawDate !== null && String(rawDate).trim() !== "";
  const normalizedRawDate = rawDate ? normalizeHistoryEventDate(rawDate) : "";

  if (hasExplicitRawDate && !normalizedRawDate) {
    throw new Error(`Inventory history is limited to the ${INVENTORY_HISTORY_YEAR} calendar year.`);
  }

  const asOfDate = normalizedRawDate
    ? normalizedRawDate
    : normalizedMonth === INVENTORY_HISTORY_MAX_MONTH || !normalizedMonth
      ? INVENTORY_HISTORY_MAX_DATE
      : getMonthEndDate(normalizedMonth);

  if (!asOfDate || asOfDate < INVENTORY_HISTORY_YEAR_START) {
    throw new Error(`Inventory history is limited to the ${INVENTORY_HISTORY_YEAR} calendar year.`);
  }

  if (asOfDate > INVENTORY_HISTORY_MAX_DATE) {
    throw new Error("Future inventory history dates are not allowed.");
  }

  return {
    asOfDate,
    historyMode: rawDate ? "as_of_date" : normalizedMonth ? "month" : "live",
  };
};

const buildInventoryHistoryMonths = () =>
  Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    const value = `${INVENTORY_HISTORY_YEAR}-${month}`;

    return {
      value,
      label: new Date(Date.UTC(INVENTORY_HISTORY_YEAR, index, 1)).toLocaleString("en-US", {
        month: "short",
        timeZone: "UTC",
      }),
      disabled: value > INVENTORY_HISTORY_MAX_MONTH,
      resolvedAsOfDate: value === INVENTORY_HISTORY_MAX_MONTH ? INVENTORY_HISTORY_MAX_DATE : null,
    };
  });

const cloneInventoryItem = (item) => {
  const itemType = normalizeLower(item?.type);

  return {
    ...item,
    quantity: itemType === "goods" || itemType === "appliance" ? toNumber(item.quantity) : undefined,
    amount: itemType === "monetary" ? toNumber(item.amount) : undefined,
  };
};

const applyInventoryLogToItem = (item, log) => {
  const action = normalizeLower(log?.action);
  const itemType = normalizeLower(item?.type);

  if (action === "update") {
    if (itemType === "monetary") {
      item.amount = toNumber(log?.amount);
      return item;
    }

    item.quantity = toNumber(log?.quantity);
    return item;
  }

  if (action === "release") {
    if (itemType === "monetary") {
      item.amount = Math.max(0, toNumber(item.amount) - toNumber(log?.amount));
      return item;
    }

    item.quantity = Math.max(0, toNumber(item.quantity) - toNumber(log?.quantity));
    return item;
  }

  if (action === "rollback") {
    if (itemType === "monetary") {
      item.amount = toNumber(item.amount) + toNumber(log?.amount);
      return item;
    }

    item.quantity = toNumber(item.quantity) + toNumber(log?.quantity);
    return item;
  }

  if (action === "archive") {
    item.isArchive = true;
  }

  return item;
};

const addItemToSummary = (summary, item) => {
  const itemType = normalizeLower(item?.type);

  if (itemType === "goods") {
    summary.totalGoodsQuantity += toNumber(item.quantity);
    summary.goodsCount += 1;
    return;
  }

  if (itemType === "appliance") {
    summary.totalApplianceQuantity += toNumber(item.quantity);
    summary.applianceCount += 1;
    return;
  }

  if (itemType === "monetary") {
    summary.totalMonetaryAmount += toNumber(item.amount);
    summary.monetaryCount += 1;
  }
};

const reconstructInventoryStateAsOf = ({ items = [], logs = [], asOfDate = "" }) => {
  const normalizedAsOfDate = normalizeDateOnly(asOfDate);
  const summary = {
    totalGoodsQuantity: 0,
    totalApplianceQuantity: 0,
    totalMonetaryAmount: 0,
    goodsCount: 0,
    applianceCount: 0,
    monetaryCount: 0,
  };
  const groupedItems = {
    goods: [],
    monetary: [],
    appliance: [],
  };
  const itemMap = new Map();

  items.forEach((item) => {
    if (!item?._id) {
      return;
    }

    const createdAt = normalizeHistoryEventDate(item.createdAt);
    if (!createdAt || (normalizedAsOfDate && createdAt > normalizedAsOfDate)) {
      return;
    }

    itemMap.set(String(item._id), cloneInventoryItem(item));
  });

  logs
    .filter((log) => {
      const createdAt = normalizeHistoryEventDate(log?.createdAt);
      return Boolean(log?.inventoryItem) && Boolean(createdAt) && (!normalizedAsOfDate || createdAt <= normalizedAsOfDate);
    })
    .sort((left, right) =>
      normalizeHistoryEventDate(left?.createdAt).localeCompare(
        normalizeHistoryEventDate(right?.createdAt)
      )
    )
    .forEach((log) => {
      const key = String(log.inventoryItem);
      const existingItem = itemMap.get(key);

      if (!existingItem) {
        return;
      }

      itemMap.set(key, applyInventoryLogToItem(existingItem, log));
    });

  itemMap.forEach((item) => {
    if (item.isArchive) {
      return;
    }

    const itemType = normalizeLower(item.type);
    if (!groupedItems[itemType]) {
      return;
    }

    groupedItems[itemType].push(item);
    addItemToSummary(summary, item);
  });

  return {
    historyReliability: "exact",
    summary,
    items: groupedItems,
  };
};

module.exports = {
  INVENTORY_HISTORY_YEAR,
  INVENTORY_HISTORY_YEAR_START,
  INVENTORY_HISTORY_MAX_DATE,
  buildInventoryHistoryMonths,
  normalizeInventoryHistoryDateInput,
  reconstructInventoryStateAsOf,
};
