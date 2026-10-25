import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandTrie } from '../../src/content/command-trie';
import { blurEditable } from '../../src/content/editable-target';
import { KeyEventPipeline } from '../../src/content/key-event-pipeline';
import { ModeManager } from '../../src/content/mode-manager';

describe('key event pipeline', () => {
  let pipeline: KeyEventPipeline | undefined;
  beforeEach(() => { document.body.innerHTML = ''; blurEditable(); });
  afterEach(() => { pipeline?.destroy(); pipeline = undefined; });

  it('maps Shift+F directly to enterHints and ignores lowercase f', () => {
    const dispatch = vi.fn();
    pipeline = new KeyEventPipeline(new ModeManager(), new CommandTrie({ F: 'enterHints' }), dispatch);
    const lowerEvent = new KeyboardEvent('keydown', { key: 'f', bubbles: true, cancelable: true });
    window.dispatchEvent(lowerEvent);
    expect(dispatch).not.toHaveBeenCalled();
    expect(lowerEvent.defaultPrevented).toBe(false);

    const event = new KeyboardEvent('keydown', { key: 'F', shiftKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'F', bubbles: true, cancelable: true }));
    expect(dispatch).toHaveBeenCalledWith('enterHints', 1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('allows holding down j/k/h/l to repeat scroll commands without blocking', () => {
    const dispatch = vi.fn();
    pipeline = new KeyEventPipeline(new ModeManager(), new CommandTrie({
      j: 'scrollDown', k: 'scrollUp', h: 'scrollLeft', l: 'scrollRight',
    }), dispatch);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', repeat: false, bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', repeat: true, bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', repeat: true, bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'j', bubbles: true, cancelable: true }));
    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(dispatch).toHaveBeenNthCalledWith(1, 'scrollDown', 1);
    expect(dispatch).toHaveBeenNthCalledWith(2, 'scrollDown', 1);
    expect(dispatch).toHaveBeenNthCalledWith(3, 'scrollDown', 1);
  });

  it('escapes from a focused text input', () => {
    const modes = new ModeManager();
    pipeline = new KeyEventPipeline(modes, new CommandTrie({ F: 'enterHints' }), vi.fn());
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    expect(document.activeElement).not.toBe(input);
    expect(event.defaultPrevented).toBe(true);
    expect(modes.mode).toBe('normal');
  });

  it('never intercepts Chrome shortcuts like Ctrl+1..9, Ctrl+T, Ctrl+R, Ctrl+X, Alt+1..9, or Meta+1..9', () => {
    const dispatch = vi.fn();
    pipeline = new KeyEventPipeline(new ModeManager(), new CommandTrie({
      j: 'scrollDown', t: 'newTab', r: 'reload', x: 'closeTab', d: 'halfPageDown', F: 'enterHints',
    }), dispatch);

    for (let digit = 0; digit <= 9; digit++) {
      const ctrlDigit = new KeyboardEvent('keydown', { key: String(digit), ctrlKey: true, bubbles: true, cancelable: true });
      window.dispatchEvent(ctrlDigit);
      expect(ctrlDigit.defaultPrevented).toBe(false);

      const altDigit = new KeyboardEvent('keydown', { key: String(digit), altKey: true, bubbles: true, cancelable: true });
      window.dispatchEvent(altDigit);
      expect(altDigit.defaultPrevented).toBe(false);

      const metaDigit = new KeyboardEvent('keydown', { key: String(digit), metaKey: true, bubbles: true, cancelable: true });
      window.dispatchEvent(metaDigit);
      expect(metaDigit.defaultPrevented).toBe(false);
    }

    for (const key of ['t', 'r', 'x', 'd', 'j', 'F']) {
      const ctrlKey = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true });
      window.dispatchEvent(ctrlKey);
      expect(ctrlKey.defaultPrevented).toBe(false);
    }
    expect(dispatch).not.toHaveBeenCalled();

    // Verify Ctrl+9 did not pollute the count prefix when pressing j next
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true }));
    expect(dispatch).toHaveBeenCalledWith('scrollDown', 1);
  });
});
