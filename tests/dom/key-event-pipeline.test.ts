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
    pipeline = new KeyEventPipeline(new ModeManager(), new CommandTrie({ F: 'enterHints' }), dispatch, document, [], true);
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

  it('maps Shift+Q directly to hoverHint and ignores lowercase q in minimal mode', () => {
    const dispatch = vi.fn();
    pipeline = new KeyEventPipeline(new ModeManager(), new CommandTrie({ Q: 'hoverHint' }), dispatch, document, [], true);
    const lowerEvent = new KeyboardEvent('keydown', { key: 'q', bubbles: true, cancelable: true });
    window.dispatchEvent(lowerEvent);
    expect(dispatch).not.toHaveBeenCalled();
    expect(lowerEvent.defaultPrevented).toBe(false);

    const event = new KeyboardEvent('keydown', { key: 'Q', shiftKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Q', bubbles: true, cancelable: true }));
    expect(dispatch).toHaveBeenCalledWith('hoverHint', 1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('isolates CapsLock so CapsLock ON without Shift does NOT trigger, but CapsLock ON with Shift DOES trigger', () => {
    const dispatch = vi.fn();
    pipeline = new KeyEventPipeline(new ModeManager(), new CommandTrie({ F: 'enterHints', Q: 'hoverHint' }), dispatch, document, [], true);

    const capsF = new KeyboardEvent('keydown', { key: 'F', code: 'KeyF', shiftKey: false, bubbles: true, cancelable: true });
    Object.defineProperty(capsF, 'getModifierState', { value: (mod: string) => mod === 'CapsLock' });
    window.dispatchEvent(capsF);
    expect(dispatch).not.toHaveBeenCalled();
    expect(capsF.defaultPrevented).toBe(false);

    const capsQ = new KeyboardEvent('keydown', { key: 'Q', code: 'KeyQ', shiftKey: false, bubbles: true, cancelable: true });
    Object.defineProperty(capsQ, 'getModifierState', { value: (mod: string) => mod === 'CapsLock' });
    window.dispatchEvent(capsQ);
    expect(dispatch).not.toHaveBeenCalled();
    expect(capsQ.defaultPrevented).toBe(false);

    const shiftCapsF = new KeyboardEvent('keydown', { key: 'F', code: 'KeyF', shiftKey: true, bubbles: true, cancelable: true });
    Object.defineProperty(shiftCapsF, 'getModifierState', { value: (mod: string) => mod === 'CapsLock' || mod === 'Shift' });
    window.dispatchEvent(shiftCapsF);
    expect(dispatch).toHaveBeenCalledWith('enterHints', 1);
    expect(shiftCapsF.defaultPrevented).toBe(true);

    const shiftCapsQ = new KeyboardEvent('keydown', { key: 'Q', code: 'KeyQ', shiftKey: true, bubbles: true, cancelable: true });
    Object.defineProperty(shiftCapsQ, 'getModifierState', { value: (mod: string) => mod === 'CapsLock' || mod === 'Shift' });
    window.dispatchEvent(shiftCapsQ);
    expect(dispatch).toHaveBeenCalledWith('hoverHint', 1);
    expect(shiftCapsQ.defaultPrevented).toBe(true);
  });

  it('passes all website keys and digits through untouched in minimal mode without buffering counts', () => {
    const dispatch = vi.fn();
    pipeline = new KeyEventPipeline(new ModeManager(), new CommandTrie({
      j: 'scrollDown', k: 'scrollUp', h: 'scrollLeft', l: 'scrollRight',
      d: 'halfPageDown', u: 'halfPageUp', s: 'selectScroll', q: 'hoverHint',
      r: 'reload', t: 'newTab', x: 'closeTab',
    }), dispatch, document, [], true);

    const websiteKeys = ['j', 'k', 'h', 'l', 'd', 'u', 's', 'q', 'r', 't', 'x', '1', '2', '5', '9', '/', '?'];
    for (const key of websiteKeys) {
      const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      window.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(false);
    }
    expect(dispatch).not.toHaveBeenCalled();

    const event = new KeyboardEvent('keydown', { key: 'F', shiftKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    expect(dispatch).toHaveBeenCalledWith('enterHints', 1);
  });

  it('allows holding down j/k/h/l to repeat scroll commands without blocking', () => {
    const dispatch = vi.fn();
    pipeline = new KeyEventPipeline(new ModeManager(), new CommandTrie({
      j: 'scrollDown', k: 'scrollUp', h: 'scrollLeft', l: 'scrollRight',
    }), dispatch, document, [], false);
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

  it('normalizes CapsLock in non-minimal mode so uppercase commands are not triggered without Shift', () => {
    const dispatch = vi.fn();
    pipeline = new KeyEventPipeline(new ModeManager(), new CommandTrie({
      j: 'scrollDown', G: 'scrollBottom', F: 'enterHints',
    }), dispatch, document, [], false);

    const capsG = new KeyboardEvent('keydown', { key: 'G', code: 'KeyG', shiftKey: false, bubbles: true, cancelable: true });
    Object.defineProperty(capsG, 'getModifierState', { value: (mod: string) => mod === 'CapsLock' });
    window.dispatchEvent(capsG);
    expect(dispatch).not.toHaveBeenCalledWith('scrollBottom', expect.anything());

    const capsJ = new KeyboardEvent('keydown', { key: 'J', code: 'KeyJ', shiftKey: false, bubbles: true, cancelable: true });
    Object.defineProperty(capsJ, 'getModifierState', { value: (mod: string) => mod === 'CapsLock' });
    window.dispatchEvent(capsJ);
    expect(dispatch).toHaveBeenCalledWith('scrollDown', 1);
  });

  it('never intercepts Chrome shortcuts like Ctrl+1..9, Ctrl+T, Ctrl+R, Ctrl+X, Alt+1..9, or Meta+1..9', () => {
    const dispatch = vi.fn();
    pipeline = new KeyEventPipeline(new ModeManager(), new CommandTrie({
      j: 'scrollDown', t: 'newTab', r: 'reload', x: 'closeTab', d: 'halfPageDown', F: 'enterHints',
    }), dispatch, document, [], false);

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
