export function canStartRefresh(target: EventTarget | null, container: HTMLElement) {
  if (!(target instanceof HTMLElement) || window.scrollY > 0) return false;
  if (target.closest('input, textarea, select, button, a, [contenteditable=true], [role=dialog]')) return false;
  let element: HTMLElement | null = target;
  while (element && element !== container) {
    const { overflowY, overflowX } = getComputedStyle(element);
    if ((/auto|scroll/.test(overflowY) && element.scrollHeight > element.clientHeight) || (/auto|scroll/.test(overflowX) && element.scrollWidth > element.clientWidth)) return false;
    element = element.parentElement;
  }
  return true;
}
