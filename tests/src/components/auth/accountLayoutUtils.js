export const ACCOUNT_EDITOR_STACK_BREAKPOINT = 920;

export function shouldSyncEditSidebarHeight(viewportWidth) {
  if (!Number.isFinite(viewportWidth)) {
    return true;
  }

  return viewportWidth > ACCOUNT_EDITOR_STACK_BREAKPOINT;
}

export function getEditSidebarStyle(sidebarHeight, viewportWidth) {
  if (!shouldSyncEditSidebarHeight(viewportWidth)) {
    return undefined;
  }

  if (!Number.isFinite(sidebarHeight) || sidebarHeight <= 0) {
    return undefined;
  }

  return { height: `${Math.round(sidebarHeight)}px` };
}
