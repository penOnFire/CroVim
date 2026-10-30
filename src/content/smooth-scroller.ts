import { getDeepActiveElement } from './editable-target';

const scrollableOverflow = new Set(['auto', 'scroll', 'overlay']);

export class SmoothScroller {
  private pendingX = 0;
  private pendingY = 0;
  private rafId = 0;
  private lastTime = 0;
  private activeTarget: Element | Window = window;
  private explicitTarget: Element | Window | null = null;
  private lastPointer: { x: number; y: number } | null = null;

  constructor(private smooth = true) {}

  setExplicitTarget(target: Element | Window | null): void {
    this.cancelAnimation();
    this.explicitTarget = target;
    if (target) this.activeTarget = target;
  }

  getExplicitTarget(): Element | Window | null {
    return this.explicitTarget;
  }

  setLastPointer(x: number, y: number): void {
    this.lastPointer = { x, y };
  }

  private canScrollElement(element: Element, dx: number, dy: number): boolean {
    if (element.id === 'crovim-ui-root') return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (dy !== 0) {
      if (!scrollableOverflow.has(style.overflowY)) return false;
      if (element.scrollHeight <= element.clientHeight + 2) return false;
      if (dy > 0 && element.scrollTop + element.clientHeight >= element.scrollHeight - 1) return false;
      if (dy < 0 && element.scrollTop <= 0) return false;
      return true;
    }
    if (dx !== 0) {
      if (!scrollableOverflow.has(style.overflowX)) return false;
      if (element.scrollWidth <= element.clientWidth + 2) return false;
      if (dx > 0 && element.scrollLeft + element.clientWidth >= element.scrollWidth - 1) return false;
      if (dx < 0 && element.scrollLeft <= 0) return false;
      return true;
    }
    return false;
  }

  private canScrollWindow(dx: number, dy: number): boolean {
    const docEl = document.scrollingElement ?? document.documentElement;
    if (!docEl) return false;
    const rootStyle = getComputedStyle(document.documentElement);
    const bodyStyle = document.body ? getComputedStyle(document.body) : null;
    if (dy !== 0) {
      if (rootStyle.overflowY === 'hidden' || bodyStyle?.overflowY === 'hidden') return false;
      if (docEl.scrollHeight <= innerHeight + 2) return false;
      if (dy > 0 && window.scrollY + innerHeight >= docEl.scrollHeight - 1) return false;
      if (dy < 0 && window.scrollY <= 0) return false;
      return true;
    }
    if (dx !== 0) {
      if (rootStyle.overflowX === 'hidden' || bodyStyle?.overflowX === 'hidden') return false;
      if (docEl.scrollWidth <= innerWidth + 2) return false;
      if (dx > 0 && window.scrollX + innerWidth >= docEl.scrollWidth - 1) return false;
      if (dx < 0 && window.scrollX <= 0) return false;
      return true;
    }
    return true;
  }

  private findTarget(dx = 0, dy = 0): Element | Window {
    if (this.explicitTarget) {
      if (this.explicitTarget === window) return window;
      if (this.explicitTarget instanceof Element && this.explicitTarget.isConnected) {
        return this.explicitTarget;
      }
      this.explicitTarget = null;
    }

    const active = getDeepActiveElement();
    const pointerEl = this.lastPointer && typeof document.elementFromPoint === 'function'
      ? document.elementFromPoint(this.lastPointer.x, this.lastPointer.y)
      : null;
    const hovered = typeof document.elementFromPoint === 'function'
      ? document.elementFromPoint(innerWidth / 2, innerHeight / 2)
      : null;
    const starts = [pointerEl, active, hovered].filter(
      (el): el is Element => !!el && el !== document.body && el !== document.documentElement,
    );
    for (const start of starts) {
      for (let el: Element | null = start; el && el !== document.body && el !== document.documentElement; ) {
        if (this.canScrollElement(el, dx, dy)) return el;
        const root = el.getRootNode();
        el = root instanceof ShadowRoot && root.host instanceof Element ? root.host : el.parentElement;
      }
    }
    if (this.canScrollWindow(dx, dy)) return window;

    let largest: Element | undefined;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('div,main,section,article,aside,ul,pre,table'))) {
      if (!this.canScrollElement(el, dx, dy)) continue;
      if (!largest || el.clientWidth * el.clientHeight > largest.clientWidth * largest.clientHeight) largest = el;
    }
    if (largest) return largest;

    const docEl = document.scrollingElement ?? document.documentElement;
    if (docEl && (docEl.scrollHeight > innerHeight + 2 || docEl.scrollWidth > innerWidth + 2)) return window;
    return window;
  }

  private moveBy(target: Element | Window, dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    if (target === window) {
      try {
        window.scrollBy({ left: dx, top: dy, behavior: 'instant' as ScrollBehavior });
      } catch {
        window.scrollBy(dx, dy);
      }
    } else {
      const el = target as Element;
      try {
        el.scrollBy({ left: dx, top: dy, behavior: 'instant' as ScrollBehavior });
      } catch {
        el.scrollLeft += dx;
        el.scrollTop += dy;
      }
    }
  }

  private readonly step = (now: number): void => {
    const dt = Math.min(40, Math.max(8, now - this.lastTime));
    this.lastTime = now;
    const alpha = 1 - Math.exp(-dt / 40);
    const moveX = Math.abs(this.pendingX) < 1 ? this.pendingX : this.pendingX * alpha;
    const moveY = Math.abs(this.pendingY) < 1 ? this.pendingY : this.pendingY * alpha;
    this.pendingX -= moveX;
    this.pendingY -= moveY;
    this.moveBy(this.activeTarget, moveX, moveY);
    if (Math.abs(this.pendingX) >= 0.5 || Math.abs(this.pendingY) >= 0.5) {
      this.rafId = requestAnimationFrame(this.step);
    } else {
      if (this.pendingX !== 0 || this.pendingY !== 0) {
        this.moveBy(this.activeTarget, this.pendingX, this.pendingY);
        this.pendingX = 0;
        this.pendingY = 0;
      }
      this.rafId = 0;
    }
  };

  scroll(delta: number, horizontal = 0, target: Element | Window = window): void {
    const resolved = target === window ? this.findTarget(horizontal, delta) : target;
    if (!this.smooth || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.cancelAnimation();
      this.moveBy(resolved, horizontal, delta);
      return;
    }
    if (this.activeTarget !== resolved) {
      this.pendingX = 0;
      this.pendingY = 0;
      this.activeTarget = resolved;
    }
    this.pendingX += horizontal;
    this.pendingY += delta;
    const immediateX = this.pendingX * 0.25;
    const immediateY = this.pendingY * 0.25;
    this.pendingX -= immediateX;
    this.pendingY -= immediateY;
    this.moveBy(resolved, immediateX, immediateY);
    if (!this.rafId) {
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(this.step);
    }
  }

  scrollToEdge(edge: 'top' | 'bottom' | 'left' | 'right'): void {
    this.cancelAnimation();
    const dx = edge === 'left' ? -1 : edge === 'right' ? 1 : 0;
    const dy = edge === 'top' ? -1 : edge === 'bottom' ? 1 : 0;
    const target = this.findTarget(dx, dy);
    const docEl = document.scrollingElement ?? document.documentElement;
    if (target === window) {
      const top = edge === 'top' ? 0 : edge === 'bottom' ? (docEl?.scrollHeight ?? 0) : window.scrollY;
      const left = edge === 'left' ? 0 : edge === 'right' ? (docEl?.scrollWidth ?? 0) : window.scrollX;
      window.scrollTo({ top, left, behavior: this.smooth ? 'smooth' : 'instant' as ScrollBehavior });
    } else {
      const el = target as Element;
      const top = edge === 'top' ? 0 : edge === 'bottom' ? el.scrollHeight : el.scrollTop;
      const left = edge === 'left' ? 0 : edge === 'right' ? el.scrollWidth : el.scrollLeft;
      el.scrollTo({ top, left, behavior: this.smooth ? 'smooth' : 'instant' as ScrollBehavior });
    }
  }

  cancelAnimation(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.pendingX = 0;
    this.pendingY = 0;
  }
}
