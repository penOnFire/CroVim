export class HudComponent {
  private readonly element: HTMLDivElement;
  private timer?: number;
  private findInput: HTMLInputElement | undefined;
  private findCallbacks: { input: (query: string) => void; commit: () => void; cancel: () => void } | undefined;
  constructor(root: ShadowRoot) {
    this.element = document.createElement('div'); this.element.className = 'hud'; this.element.setAttribute('role', 'status'); this.element.hidden = true; root.append(this.element);
  }
  show(message: string, duration = 1200): void {
    window.clearTimeout(this.timer); this.element.textContent = message; this.element.hidden = false;
    this.timer = window.setTimeout(() => this.hide(), duration);
  }
  hide(): void { this.element.hidden = true; }
  openFind(initial: string, callbacks: { input: (query: string) => void; commit: () => void; cancel: () => void; next?: (backward: boolean) => void }): void {
    window.clearTimeout(this.timer);
    this.closeFind();
    this.findCallbacks = callbacks;
    const bar = document.createElement('div');
    bar.className = 'find-bar';
    const label = document.createElement('span');
    label.textContent = '/';
    const input = document.createElement('input');
    input.value = initial;
    input.setAttribute('aria-label', 'Find in page');
    bar.append(label, input);
    this.element.replaceChildren(bar);
    this.element.hidden = false;
    this.findInput = input;
    input.addEventListener('input', () => {
      callbacks.input(input.value);
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
    });
    input.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key === 'Enter') { event.preventDefault(); callbacks.commit(); }
      if (event.key === 'Escape') { event.preventDefault(); callbacks.cancel(); }
    });
    input.focus();
    input.select();
  }
  updateFindCount(index: number, total: number): void {
    const bar = this.element.querySelector('.find-bar');
    if (!bar) return;
    let count = bar.querySelector('.find-count');
    if (!count) { count = document.createElement('span'); count.className = 'find-count'; bar.append(count); }
    count.textContent = total ? ` ${index}/${total}` : ' 0/0';
  }
  closeFind(): void {
    this.findInput = undefined;
    this.findCallbacks = undefined;
    this.hide();
  }
  get text(): string { return this.element.textContent ?? ''; }
}
