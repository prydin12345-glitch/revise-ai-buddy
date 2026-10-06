import { useEffect } from 'react';

export function useKeyboardViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    let fullHeight = window.innerHeight;
    let width = window.innerWidth;
    const update = () => {
      const editable = document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]), textarea, [contenteditable=true]');
      if (!editable || Math.abs(window.innerWidth - width) > 50) { fullHeight = window.innerHeight; width = window.innerWidth; }
      const keyboard = !!editable && !!viewport && Math.max(fullHeight, window.innerHeight, document.documentElement.clientHeight) - viewport.height > 120 && viewport.scale === 1;
      document.documentElement.dataset.keyboardOpen = String(keyboard);
      document.documentElement.style.setProperty('--visible-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      document.documentElement.style.setProperty('--visible-viewport-top', `${viewport?.offsetTop ?? 0}px`);
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      viewport?.removeEventListener('resize', update); viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', update); document.removeEventListener('focusout', update);
      delete document.documentElement.dataset.keyboardOpen;
    };
  }, []);
}
