export function canStartRefresh(target: EventTarget | null, container: HTMLElement) {
  if (!(target instanceof Element) || window.scrollY > 0 || (document.scrollingElement?.scrollTop ?? 0) > 0) return false;
  if (target.closest('input, textarea, select, [contenteditable=true], [role=dialog], [data-no-pull-refresh]')) return false;
  let element: Element | null = target;
  while (element && element !== container) {
    const { overflowY, overflowX } = getComputedStyle(element);
    if ((/auto|scroll/.test(overflowY) && element.scrollHeight > element.clientHeight) || (/auto|scroll/.test(overflowX) && element.scrollWidth > element.clientWidth)) return false;
    element = element.parentElement;
  }
  return true;
}
