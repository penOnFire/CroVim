export class HintOverlay {
  private readonly root: HTMLDivElement;
  constructor(shadow: ShadowRoot) {
    shadow.querySelectorAll('.hints').forEach((el) => el.remove());
    this.root = document.createElement('div');
    this.root.className = 'hints';
    shadow.append(this.root);
  }
  render(items: { label: string; rect: DOMRect; prefix?: string }[]): void {
    const visibleItems = items.filter(({ label, prefix = '' }) => !prefix || label.startsWith(prefix));
    this.root.replaceChildren(...visibleItems.map(({ label, rect, prefix = '' }) => {
      const element = document.createElement('span');
      element.className = 'hint-label';
      element.style.left = `${rect.left}px`;
      element.style.top = `${rect.top}px`;
      [...label].forEach((character, index) => {
        const span = document.createElement('b');
        span.textContent = character;
        if (index < prefix.length) span.className = 'matched';
        element.append(span);
      });
      return element;
    }));
  }
  clear(): void {
    this.root.replaceChildren();
    this.root.remove();
  }
}
