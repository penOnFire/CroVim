export class VisualMode {
  enter(line = false): void {
    document.body.classList.add('crovim-visual');
    const selection = getSelection();
    if (!selection?.rangeCount) {
      const range = document.createRange(); range.selectNodeContents(document.body); range.collapse(true);
      selection?.addRange(range);
    }
    if (line) selection?.modify?.('extend', 'forward', 'line');
  }
  exit(): void { document.body.classList.remove('crovim-visual'); }
  move(direction: 'left' | 'right' | 'forward' | 'backward', granularity: 'character' | 'word' = 'character'): void {
    getSelection()?.modify?.('extend', direction, granularity);
  }
  yank(): string {
    const text = getSelection()?.toString() ?? '';
    if (text) void navigator.clipboard?.writeText(text);
    return text;
  }
}
