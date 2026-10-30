import { describe, expect, it, beforeEach, vi } from 'vitest';
import { discover } from '../../src/content/link-hints/hint-discovery';
import { LinkHintsMode } from '../../src/content/link-hints/link-hints-mode';
import { activate } from '../../src/content/link-hints/activation';

function visibleBox(element: Element, top = 0, left = 0, width = 80, height = 24): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    top, left, right: left + width, bottom: top + height, width, height,
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

  it('discovers modal close and dismiss controls', () => {
    document.body.innerHTML = `
      <div role="dialog">
        <span class="btn-close" data-bs-dismiss="modal" aria-label="Close">✕</span>
        <button data-dismiss="modal">Dismiss</button>
      </div>`;
    const span = document.querySelector('span')!;
    const btn = document.querySelector('button')!;
    visibleBox(span, 10, 10);
    visibleBox(btn, 40, 10);
    vi.spyOn(document, 'elementFromPoint').mockImplementation((x, y) => {
      if (y < 35) return span;
      return btn;
    });
    const candidates = discover();
    expect(candidates).toHaveLength(2);
    expect(candidates.map((c) => c.text)).toContain('✕');
    expect(candidates.map((c) => c.text)).toContain('Dismiss');
  });

  it('excludes background elements occluded by a modal backdrop', () => {
    document.body.innerHTML = `
      <a href="/behind" id="behind">Behind modal</a>
      <div id="backdrop" style="position:fixed;inset:0;">
        <div id="modal" role="dialog">
          <button id="modal-btn">Modal action</button>
        </div>
      </div>`;
    const behind = document.getElementById('behind')!;
    const modalBtn = document.getElementById('modal-btn')!;
    const backdrop = document.getElementById('backdrop')!;
    visibleBox(behind, 20, 20);
    visibleBox(modalBtn, 200, 200);
    visibleBox(backdrop, 0, 0, 800, 600);

    vi.spyOn(document, 'elementFromPoint').mockImplementation((x, y) => {
      if (x >= 200 && y >= 200) return modalBtn;
      return backdrop; // Backdrop occludes everything else
    });

    const candidates = discover();
    expect(candidates.map((c) => c.element.id)).toEqual(['modal-btn']);
  });
});

describe('link hint activation', () => {
  it('activates SVG close buttons inside modal dialogs', () => {
    document.body.innerHTML = `
      <div role="dialog">
        <svg id="close-svg" role="button" tabindex="0" viewBox="0 0 24 24"></svg>
      </div>`;
    const svg = document.getElementById('close-svg')!;
    visibleBox(svg, 100, 150, 32, 32);
    let clickReceived = false;
    let clientXReceived = 0;
    svg.addEventListener('click', (e) => {
      clickReceived = true;
      clientXReceived = e.clientX;
    });

    activate(svg);
    expect(clickReceived).toBe(true);
    expect(clientXReceived).toBe(166); // 150 + 32/2
  });

  it('activates parent button when an inner SVG path is targeted', () => {
    document.body.innerHTML = `
      <div role="dialog">
        <button id="modal-close-btn">
          <svg><path id="inner-path" d="M0 0"></path></svg>
        </button>
      </div>`;
    const btn = document.getElementById('modal-close-btn')!;
    const path = document.getElementById('inner-path')!;
    visibleBox(btn, 50, 50, 40, 40);
    visibleBox(path, 50, 50, 40, 40);

    let btnClicked = false;
    btn.addEventListener('click', () => { btnClicked = true; });

    activate(path);
    expect(btnClicked).toBe(true);
  });

  it('dispatches real coordinates on modal backdrop clicks', () => {
    document.body.innerHTML = `<div id="backdrop" style="position:fixed;inset:0;"></div>`;
    const backdrop = document.getElementById('backdrop')!;
    visibleBox(backdrop, 0, 0, 800, 600);

    let coordsOk = false;
    backdrop.addEventListener('click', (e) => {
      if (e.clientX === 400 && e.clientY === 300 && e.cancelable && e.bubbles) {
        coordsOk = true;
      }
    });

    activate(backdrop);
    expect(coordsOk).toBe(true);
  });
});
