import {
  ACCOUNT_EDITOR_STACK_BREAKPOINT,
  getEditSidebarStyle,
  shouldSyncEditSidebarHeight
} from "./accountLayoutUtils";

describe("accountLayoutUtils", () => {
  test("does not sync fixed sidebar heights on stacked mobile layouts", () => {
    expect(shouldSyncEditSidebarHeight(ACCOUNT_EDITOR_STACK_BREAKPOINT)).toBe(false);
    expect(shouldSyncEditSidebarHeight(560)).toBe(false);
    expect(getEditSidebarStyle(820, 560)).toBeUndefined();
  });

  test("returns a fixed height only for desktop edit layouts", () => {
    expect(shouldSyncEditSidebarHeight(1180)).toBe(true);
    expect(getEditSidebarStyle(820, 1180)).toEqual({ height: "820px" });
  });

  test("ignores invalid measured heights", () => {
    expect(getEditSidebarStyle(null, 1180)).toBeUndefined();
    expect(getEditSidebarStyle(0, 1180)).toBeUndefined();
    expect(getEditSidebarStyle(Number.NaN, 1180)).toBeUndefined();
  });
});
