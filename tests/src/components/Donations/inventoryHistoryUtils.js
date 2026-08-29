const getLocalDateParts = (date = new Date()) => ({
  year: date.getFullYear(),
  month: String(date.getMonth() + 1).padStart(2, "0"),
  day: String(date.getDate()).padStart(2, "0"),
});

export const { year: INVENTORY_HISTORY_YEAR, month: INVENTORY_HISTORY_MONTH, day: INVENTORY_HISTORY_DAY } =
  getLocalDateParts();
export const INVENTORY_HISTORY_MIN_DATE = `${INVENTORY_HISTORY_YEAR}-01-01`;
export const INVENTORY_HISTORY_MAX_DATE = `${INVENTORY_HISTORY_YEAR}-${INVENTORY_HISTORY_MONTH}-${INVENTORY_HISTORY_DAY}`;
const INVENTORY_HISTORY_MAX_MONTH = INVENTORY_HISTORY_MAX_DATE.slice(0, 7);

const getMonthEndDate = (month) => {
  const normalizedMonth = String(month || "").slice(0, 7);
  if (!normalizedMonth) return "";

  const [yearText, monthText] = normalizedMonth.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return "";
  }

  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
};

export const buildInventoryHistoryMonths = () =>
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

export const resolveInventoryHistoryRequest = ({ month = "", asOf = "" } = {}) => {
  const normalizedMonth = String(month || "").slice(0, 7);
  const normalizedAsOf = String(asOf || "").slice(0, 10);

  if (normalizedAsOf) {
    return { historyMode: "as_of_date", asOf: normalizedAsOf };
  }

  if (normalizedMonth === INVENTORY_HISTORY_MAX_MONTH) {
    return { historyMode: "month", asOf: INVENTORY_HISTORY_MAX_DATE };
  }

  if (normalizedMonth) {
    return { historyMode: "month", asOf: getMonthEndDate(normalizedMonth) };
  }

  return { historyMode: "live", asOf: "" };
};

export const isInventoryHistoryActive = ({ month = "", asOf = "" } = {}) =>
  Boolean(String(month || "").trim() || String(asOf || "").trim());
