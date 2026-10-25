import { describe, expect, it, beforeEach, vi } from 'vitest';
import { discover } from '../../src/content/link-hints/hint-discovery';
import { LinkHintsMode } from '../../src/content/link-hints/link-hints-mode';

function visibleBox(element: Element, top = 0, left = 0): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    top, left, right: left + 80, bottom: top + 24, width: 80, height: 24,
    x: left, y: top, toJSON: () => ({}),
  });
}

beforeEach(() => {
  document.body.innerHTML = '';
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: vi.fn().mockReturnValue(null),
  });
});

describe('link hint discovery', () => {
  it('discovers links, buttons, and ARIA candidates while excluding disabled elements', () => {
    document.body.innerHTML = `
      <a href="/one">One</a><button>Two</button><div role="button">Three</div>
      <button disabled>Disabled</button><div role="link" aria-disabled="true">Also disabled</div>`;
    [...document.querySelectorAll('a,button,[role]')].forEach((element, index) => visibleBox(element, index * 30));
    expect(discover().map((candidate) => candidate.text)).toEqual(['One', 'Two', 'Three']);
  });

  it('traverses open Shadow DOM roots', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button>Shadow action</button>';
    document.body.append(host);
    const button = shadow.querySelector('button')!;
    visibleBox(button);
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(button);
    expect(discover()).toHaveLength(1);
    expect(discover()[0]?.text).toBe('Shadow action');
  });

  it('filters multi-character hints on prefix and closes hints when combination finishes', () => {
    document.body.innerHTML = `<button id="b1">B1</button><button id="b2">B2</button><input id="cb" type="checkbox">`;
    [...document.querySelectorAll('button,input')].forEach((el, i) => visibleBox(el, i * 30, 10));
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    document.body.append(host);
    const onExit = vi.fn();
    // With alphabet 'as' and 3 items, labels are 2-char: 'aa', 'as', 'sa'
    new LinkHintsMode(shadow, 'as', 'currTab', onExit);
    expect(shadow.querySelectorAll('.hint-label')).toHaveLength(3);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true }));
    expect(shadow.querySelectorAll('.hint-label')).toHaveLength(1);

    const ctrlOne = new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(ctrlOne);
    expect(ctrlOne.defaultPrevented).toBe(false);

    const ctrlA = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(ctrlA);
    expect(ctrlA.defaultPrevented).toBe(false);
    expect(shadow.querySelectorAll('.hint-label')).toHaveLength(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    expect(shadow.querySelectorAll('.hint-label')).toHaveLength(0);
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
