import { blurEditable, getDeepActiveElement, isEditable } from './editable-target';
import { CommandTrie } from './command-trie';
import { ModeManager } from './mode-manager';

const bareModifiers = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'OS']);
const repeatableCommands = new Set([
  'scrollDown', 'scrollUp', 'scrollLeft', 'scrollRight',
  'halfPageDown', 'halfPageUp', 'findNext', 'findPrevious',
]);

export class KeyEventPipeline {
  private seq: string[] = [];
  private count = '';
  private suppressKeyUp = false;
  private suppressRepeat = false;
  private passKeySet: Set<string>;
  private readonly options: AddEventListenerOptions = { capture: true, passive: false };

  private readonly onBlur = (): void => {
    this.seq = [];
    this.count = '';
    this.suppressKeyUp = false;
    this.suppressRepeat = false;
  };

  constructor(
    private modes: ModeManager,
    private trie: CommandTrie,
    private dispatch: (c: string, count: number) => void,
    private bus: EventTarget = document,
    passKeys: Iterable<string> = [],
  ) {
    this.passKeySet = new Set(passKeys);
    window.addEventListener('keydown', this.onKeyDown, this.options);
    window.addEventListener('keypress', this.onKeyPress, this.options);
    window.addEventListener('keyup', this.onKeyUp, this.options);
    window.addEventListener('blur', this.onBlur);
  }

  setTrie(trie: CommandTrie): void {
    this.trie = trie;
    this.seq = [];
    this.count = '';
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown, this.options);
    window.removeEventListener('keypress', this.onKeyPress, this.options);
    window.removeEventListener('keyup', this.onKeyUp, this.options);
    window.removeEventListener('blur', this.onBlur);
  }

  private isOrphaned(): boolean {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && !chrome.runtime.id) {
        this.destroy();
        return true;
      }
    } catch {
      this.destroy();
      return true;
    }
    return false;
  }

  private consume(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  private hasBrowserModifier(event: KeyboardEvent): boolean {
    return event.ctrlKey || event.altKey || event.metaKey;
  }

  private readonly onKeyPress = (event: KeyboardEvent): void => {
    if (this.isOrphaned() || this.hasBrowserModifier(event)) return;
    if (this.suppressKeyUp) this.consume(event);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (this.isOrphaned()) return;
    if (this.hasBrowserModifier(event)) {
      this.suppressKeyUp = false;
      this.suppressRepeat = false;
      return;
    }
    if (this.suppressKeyUp) this.consume(event);
    this.suppressKeyUp = false;
    this.suppressRepeat = false;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.isOrphaned()) return;
    if (event.isComposing || event.keyCode === 229 || bareModifiers.has(event.key)) return;
    if (this.hasBrowserModifier(event) || this.passKeySet.has(event.key)) {
      this.seq = [];
      this.count = '';
      this.suppressKeyUp = false;
      this.suppressRepeat = false;
      return;
    }
    if (event.repeat && this.suppressRepeat) { this.consume(event); return; }
    const key = event.key;
    const activeEditable = isEditable(event.target) || isEditable(getDeepActiveElement());
    if (key === 'Escape') {
      this.seq = []; this.count = '';
      if (activeEditable || this.modes.mode === 'insert') {
        blurEditable();
        this.modes.exit();
        this.consume(event);
        this.bus.dispatchEvent(new CustomEvent('crovim:toast', { detail: 'Normal mode' }));
      } else if (this.modes.mode !== 'normal') {
        this.modes.exit();
        this.consume(event);
      }
      return;
    }
    if (this.modes.mode !== 'normal' || activeEditable) return;
    if ((/^[1-9]$/u.test(key) || (this.count.length > 0 && /^\d$/u.test(key))) && !this.seq.length) {
      this.count += key;
      this.consume(event);
      return;
    }
    this.seq.push(key);
    const match = this.trie.match(this.seq);
    if (match.command) {
      const count = Number(this.count) || 1;
      this.seq = []; this.count = '';
      this.suppressKeyUp = true;
      this.suppressRepeat = !repeatableCommands.has(match.command);
      this.consume(event);
      this.dispatch(match.command, count);
    } else if (!match.prefix) {
      this.seq = []; this.count = '';
    }
  };
}
