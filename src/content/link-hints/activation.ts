export function activate(el: Element, mode: 'currTab' | 'newTab' | 'yank' = 'currTab'): void {
  if (mode === 'yank') {
    const url = el instanceof HTMLAnchorElement ? el.href : el.getAttribute('data-href') ?? '';
    if (url) void navigator.clipboard?.writeText(url);
    return;
  }
  if (mode === 'newTab' && el instanceof HTMLAnchorElement) {
    window.open(el.href, '_blank', 'noopener');
    return;
  }

  const clickable = el.closest('a,button,[role="button"],[role="link"],input,select,textarea,summary,label,[onclick],[jsaction],[data-dismiss],[data-bs-dismiss]') ?? el;
  let target: Element = clickable;

  if (target instanceof HTMLLabelElement) {
    const controlled = target.control ?? (target.htmlFor ? document.getElementById(target.htmlFor) : null);
    if (controlled) target = controlled;
  }

  if (target instanceof HTMLElement || target instanceof SVGElement) {
    try { (target as HTMLElement).focus({ preventScroll: true }); } catch { /* ignore */ }
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    try { target.setSelectionRange(target.value.length, target.value.length); } catch { /* non-selectable input type */ }
  } else if ((target as HTMLElement).isContentEditable) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(target); range.collapse(false);
    selection?.removeAllRanges(); selection?.addRange(range);
  }

  const rect = target.getBoundingClientRect();
  const hasValidRect = rect.width > 0 && rect.height > 0;
  const clientX = Math.round(hasValidRect ? rect.left + rect.width / 2 : (typeof window !== 'undefined' ? window.innerWidth / 2 : 0));
  const clientY = Math.round(hasValidRect ? rect.top + rect.height / 2 : (typeof window !== 'undefined' ? window.innerHeight / 2 : 0));
  const screenX = (typeof window !== 'undefined' ? window.screenX ?? 0 : 0) + clientX;
  const screenY = (typeof window !== 'undefined' ? window.screenY ?? 0 : 0) + clientY;

  const mouseInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    detail: 1,
    clientX,
    clientY,
    screenX,
    screenY,
    button: 0,
  };

  const hasPointer = typeof PointerEvent === 'function';

  for (const type of ['pointerdown', 'mousedown']) {
    if (type.startsWith('pointer') && !hasPointer) continue;
    const event = type.startsWith('pointer')
      ? new PointerEvent(type, { ...mouseInit, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true, pressure: 0.5 })
      : new MouseEvent(type, { ...mouseInit, buttons: 1 });
    target.dispatchEvent(event);
  }

  for (const type of ['pointerup', 'mouseup']) {
    if (type.startsWith('pointer') && !hasPointer) continue;
    const event = type.startsWith('pointer')
      ? new PointerEvent(type, { ...mouseInit, buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true, pressure: 0 })
      : new MouseEvent(type, { ...mouseInit, buttons: 0 });
    target.dispatchEvent(event);
  }

  const clickEvent = new MouseEvent('click', { ...mouseInit, buttons: 0 });
  target.dispatchEvent(clickEvent);

  if (!clickEvent.defaultPrevented && typeof (target as HTMLElement).click === 'function') {
    (target as HTMLElement).click();
  } else if (!clickEvent.defaultPrevented && target !== el && typeof (el as HTMLElement).click === 'function') {
    (el as HTMLElement).click();
  }
}
