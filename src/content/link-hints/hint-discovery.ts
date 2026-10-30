import { walkOpen, visible } from '../dom-utils';
export interface Candidate { element: Element; rect: DOMRect; text: string; reason: string }
const selector = 'a[href],a[role="link"],button,input:not([type="hidden"]),textarea,select,summary,[role="button"],[role="link"],[role="checkbox"],[role="tab"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="option"],[role="switch"],[role="radio"],[role="textbox"],[role="searchbox"],[role="combobox"],[contenteditable="true"],[contenteditable=""],[contenteditable="plaintext-only"],[tabindex]:not([tabindex="-1"]),[onclick],[jsaction],label,[data-dismiss="modal"],[data-bs-dismiss="modal"],[data-dismiss],[data-bs-dismiss],[aria-label*="close" i],[aria-label*="dismiss" i],[role="toolbar"] [aria-label],[aria-label*="reaction" i],[aria-label*="react" i],[aria-label="Like" i],[aria-label="Love" i],[aria-label="Care" i],[aria-label="Haha" i],[aria-label="Wow" i],[aria-label="Sad" i],[aria-label="Angry" i]';

function topmostAtPoint(x: number, y: number): Element | null {
  let element = document.elementFromPoint(x, y);
  while (element?.shadowRoot) {
    const inner = element.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === element) break;
    element = inner;
  }
  return element;
}

function belongsTo(element: Element, candidate: Element): boolean {
  for (let current: Element | null = element; current; ) {
    if (current === candidate) return true;
    const root = current.getRootNode();
    current = root instanceof ShadowRoot ? root.host : current.parentElement;
  }
  return false;
}

function getVisibleRect(element: Element): DOMRect | null {
  const rects = [...element.getClientRects(), element.getBoundingClientRect()];
  for (const rect of rects) {
    if (rect.width < 2 || rect.height < 2) continue;
    if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) continue;
    return rect;
  }
  return null;
}

function isUnoccluded(element: Element, rect: DOMRect): boolean {
  const samplePoints: Array<[number, number]> = [
    [rect.left + rect.width / 2, rect.top + rect.height / 2],
    [rect.left + Math.min(16, rect.width / 3), rect.top + Math.min(12, rect.height / 2)],
  ];
  for (const [rawX, rawY] of samplePoints) {
    const x = Math.max(0, Math.min(innerWidth - 1, rawX));
    const y = Math.max(0, Math.min(innerHeight - 1, rawY));
    const point = topmostAtPoint(x, y);
    if (!point) return true;
    if (belongsTo(point, element) || belongsTo(element, point)) return true;
    const sharedInteractive = point.closest('a,button,[role="button"],[role="link"],label,[role="toolbar"],[role="dialog"],[aria-label*="reaction" i],ytd-thumbnail,ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer,article,[role="article"]');
    if (sharedInteractive && (sharedInteractive.contains(element) || element.contains(sharedInteractive))) return true;
  }
  return false;
}

export function discover(root: Document | ShadowRoot = document): Candidate[] {
  const seen = new Set<Element>(); const result: Candidate[] = [];
  walkOpen(root, (element) => {
    if (seen.has(element) || !visible(element)) return;
    const matchesSelector = element.matches(selector);
    const hasPointerCursor = !matchesSelector && getComputedStyle(element).cursor === 'pointer' &&
      (!element.parentElement || getComputedStyle(element.parentElement).cursor !== 'pointer');
    if (!matchesSelector && !hasPointerCursor) return;
    if (element.matches(':disabled,[aria-disabled="true"]')) return;
    const rect = getVisibleRect(element);
    if (!rect || !isUnoccluded(element, rect)) return;
    if (result.some((c) => Math.abs(c.rect.left - rect.left) < 4 && Math.abs(c.rect.top - rect.top) < 4 && (belongsTo(element, c.element) || belongsTo(c.element, element)))) return;
    seen.add(element); result.push({ element, rect, text: element.textContent?.trim() ?? '', reason: element.tagName.toLowerCase() });
  });
  return result.sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
}

export function discoverScrollable(root: Document | ShadowRoot = document): Candidate[] {
  const result: Candidate[] = [];
  const seen = new Set<Element>();

  const docEl = document.scrollingElement ?? document.documentElement;
  if (docEl && (docEl.scrollHeight > innerHeight + 10 || docEl.scrollWidth > innerWidth + 10)) {
    result.push({
      element: docEl,
      rect: new DOMRect(24, 24, Math.min(240, innerWidth - 48), 40),
      text: 'Window / Main Page',
      reason: 'window'
    });
    seen.add(docEl);
  }

  walkOpen(root, (element) => {
    if (seen.has(element) || !visible(element) || element.id === 'crovim-ui-root') return;
    const style = getComputedStyle(element);
    const hasScrollY = (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') &&
      element.scrollHeight > element.clientHeight + 10;
    const hasScrollX = (style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'overlay') &&
      element.scrollWidth > element.clientWidth + 10;
    if (!hasScrollY && !hasScrollX) return;

    const rect = element.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return;
    if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return;

    seen.add(element);
    const visibleTop = Math.max(12, Math.min(innerHeight - 40, rect.top + 8));
    const visibleLeft = Math.max(12, Math.min(innerWidth - 120, rect.left + 8));
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const aria = element.getAttribute('aria-label') ? ` (${element.getAttribute('aria-label')})` : '';
    result.push({
      element,
      rect: new DOMRect(visibleLeft, visibleTop, rect.width, rect.height),
      text: `Scroll: ${tag}${id}${aria}`.trim(),
      reason: 'scrollable'
    });
  });

  return result.sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
}
