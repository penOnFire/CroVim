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
  let target: HTMLElement | null = el instanceof HTMLElement ? el : null;
  if (el instanceof HTMLLabelElement) {
    target = el.control ?? (el.htmlFor ? document.getElementById(el.htmlFor) : null);
  }
  target?.focus();
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    try { target.setSelectionRange(target.value.length, target.value.length); } catch { /* non-selectable input type */ }
  } else if (target?.isContentEditable) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(target); range.collapse(false);
    selection?.removeAllRanges(); selection?.addRange(range);
  }
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    const event = type.startsWith('pointer')
      ? new PointerEvent(type, { bubbles: true, composed: true, pointerId: 1, pointerType: 'mouse', button: 0 })
      : new MouseEvent(type, { bubbles: true, composed: true, button: 0 });
    el.dispatchEvent(event);
  }
  if (el instanceof HTMLLabelElement && target !== el) el.click();
  else (target ?? (el instanceof HTMLElement ? el : null))?.click();
}
