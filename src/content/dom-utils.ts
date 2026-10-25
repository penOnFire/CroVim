export function visible(el: Element): boolean {
  const r = el.getBoundingClientRect(), s = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && r.bottom >= 0 && r.right >= 0 && r.top <= innerHeight && r.left <= innerWidth && s.visibility !== 'hidden' && s.display !== 'none';
}

export function walkOpen(root: Document | ShadowRoot, fn: (e: Element) => void): void {
  for (const e of Array.from(root.querySelectorAll('*'))) {
    if (e.id === 'crovim-ui-root') continue;
    fn(e);
    if (e.shadowRoot) walkOpen(e.shadowRoot, fn);
  }
}
