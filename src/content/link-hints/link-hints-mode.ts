import { discover, type Candidate } from './hint-discovery';
import { hintLabels } from './hint-labels';
import { HintOverlay } from './hint-overlay';
import { activate } from './activation';

export class LinkHintsMode {
  private static readonly eventTypes: Array<keyof WindowEventMap> = ['keydown', 'keypress', 'keyup'];
  private readonly candidates: Candidate[]; private readonly labels: string[]; private typed = ''; private readonly overlay: HintOverlay;
  private readonly mode: 'currTab' | 'newTab' | 'yank' | 'hover';
  private readonly onSelect?: ((element: Element) => void) | undefined;
  private readonly onKey = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key)) return;
    const consume = (): void => { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); };
    if (event.type !== 'keydown') {
      if (event.key.length === 1 || ['Escape', 'Backspace'].includes(event.key)) consume();
      return;
    }
    if (event.key === 'Escape') { consume(); this.close(); return; }
    if (event.key === 'Backspace') { consume(); this.typed = this.typed.slice(0, -1); this.render(); return; }
    if (event.key.length !== 1) return;
    consume();
    this.typed += event.key.toLowerCase(); const index = this.labels.findIndex((label) => label === this.typed);
    if (index >= 0) {
      const target = this.candidates[index]!.element;
      window.addEventListener('keyup', (upEvent) => {
        upEvent.preventDefault(); upEvent.stopPropagation(); upEvent.stopImmediatePropagation();
      }, { capture: true, once: true });
      this.close();
      if (this.onSelect) {
        this.onSelect(target);
      } else {
        try { activate(target, this.mode); } catch { /* ignore activation errors */ }
      }
    } else if (this.labels.some((label) => label.startsWith(this.typed))) {
      this.render();
    } else {
      this.close();
    }
  };
  private closed = false;
  constructor(
    private readonly shadow: ShadowRoot,
    alphabet = 'asdf',
    mode: 'currTab' | 'newTab' | 'yank' | 'hover' = 'currTab',
    private readonly onExit: () => void = () => {},
    customCandidates?: Candidate[],
    onSelect?: (element: Element) => void,
  ) {
    this.mode = mode;
    this.onSelect = onSelect;
    this.candidates = customCandidates ?? discover();
    this.labels = hintLabels(this.candidates.length, alphabet).map((label) => label.toLowerCase());
    this.overlay = new HintOverlay(shadow);
    this.render();
    for (const type of LinkHintsMode.eventTypes) window.addEventListener(type, this.onKey, { capture: true, passive: false });
  }
  private render(): void { this.overlay.render(this.candidates.map((candidate, index) => ({ label: this.labels[index]!, rect: candidate.rect, prefix: this.typed }))); }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.overlay.clear();
    for (const type of LinkHintsMode.eventTypes) window.removeEventListener(type, this.onKey, true);
    this.onExit();
  }
}
