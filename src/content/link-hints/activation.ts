export function activate(el: Element, mode: 'currTab' | 'newTab' | 'yank' | 'hover' = 'currTab'): void {
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

  // If inside a toolbar (e.g. Facebook reaction dock), do not jump outside the toolbar to a parent button
  const toolbar = el.closest('[role="toolbar"],[aria-label*="reaction" i]');
  if (toolbar && !toolbar.contains(target)) {
    target = el;
  }

  if (target instanceof HTMLLabelElement) {
    const controlled = target.control ?? (target.htmlFor ? document.getElementById(target.htmlFor) : null);
    if (controlled) target = controlled;
  }

  // Focus only editable form controls to prevent blurring flyout/reaction triggers
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    try {
      target.focus({ preventScroll: true });
      target.setSelectionRange(target.value.length, target.value.length);
    } catch { /* non-selectable input type */ }
  } else if ((target as HTMLElement).isContentEditable) {
    try { (target as HTMLElement).focus({ preventScroll: true }); } catch { /* ignore */ }
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

  // Find exact leaf element at coordinates so React synthetic events attach to the correct fiber
  const hitTarget = hasValidRect && typeof document.elementFromPoint === 'function' ? document.elementFromPoint(clientX, clientY) : null;
  const dispatchTarget = (hitTarget && target.contains(hitTarget)) ? hitTarget : target;

  // 1. Move/Enter sequence so React/Facebook and complex web apps register pointer presence
  for (const type of ['pointerover', 'mouseover', 'pointerenter', 'mouseenter', 'pointermove']) {
    if (type.startsWith('pointer') && !hasPointer) continue;
    const event = type.startsWith('pointer')
      ? new PointerEvent(type, { ...mouseInit, detail: 0, buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true })
      : new MouseEvent(type, { ...mouseInit, detail: 0, buttons: 0 });
    dispatchTarget.dispatchEvent(event);
  }

  if (mode === 'hover') return;

  // 2. Pointer & Mouse Down (buttons: 1)
  for (const type of ['pointerdown', 'mousedown']) {
    if (type.startsWith('pointer') && !hasPointer) continue;
    const event = type.startsWith('pointer')
      ? new PointerEvent(type, { ...mouseInit, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true, pressure: 0.5 })
      : new MouseEvent(type, { ...mouseInit, buttons: 1 });
    dispatchTarget.dispatchEvent(event);
  }

  // 3. Pointer & Mouse Up (buttons: 0)
  for (const type of ['pointerup', 'mouseup']) {
    if (type.startsWith('pointer') && !hasPointer) continue;
    const event = type.startsWith('pointer')
      ? new PointerEvent(type, { ...mouseInit, buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true, pressure: 0 })
      : new MouseEvent(type, { ...mouseInit, buttons: 0 });
    dispatchTarget.dispatchEvent(event);
  }

  // 4. Click event with coordinates (single realistic click dispatch)
  const clickEvent = new MouseEvent('click', { ...mouseInit, buttons: 0 });
  dispatchTarget.dispatchEvent(clickEvent);
}
