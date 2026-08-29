import {
  INVENTORY_HISTORY_YEAR,
  INVENTORY_HISTORY_MAX_DATE,
  buildInventoryHistoryMonths,
  resolveInventoryHistoryRequest,
  isInventoryHistoryActive,
} from "./inventoryHistoryUtils";

test("disables future months after the current inventory history month", () => {
  const months = buildInventoryHistoryMonths();
  const currentMonth = INVENTORY_HISTORY_MAX_DATE.slice(0, 7);
  const currentMonthChip = months.find((month) => month.value === currentMonth);
  const nextMonthDate = new Date(INVENTORY_HISTORY_YEAR, Number(currentMonth.slice(5, 7)), 1);
  const nextMonthValue = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const nextMonthChip = months.find((month) => month.value === nextMonthValue);

  expect(currentMonthChip?.disabled).toBe(false);
  if (nextMonthChip) {
    expect(nextMonthChip.disabled).toBe(true);
  }
});

test("resolves the current month to the current max date", () => {
  expect(resolveInventoryHistoryRequest({ month: INVENTORY_HISTORY_MAX_DATE.slice(0, 7) }).asOf).toBe(
    INVENTORY_HISTORY_MAX_DATE
  );
});

test("detects history mode only when a month or as-of date is selected", () => {
  expect(isInventoryHistoryActive({ month: "", asOf: "" })).toBe(false);
  expect(isInventoryHistoryActive({ month: "2026-07", asOf: "" })).toBe(true);
});
