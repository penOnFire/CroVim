import { describe, expect, it, beforeEach, vi } from 'vitest';
import { discover, discoverScrollable } from '../../src/content/link-hints/hint-discovery';
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

  it('discovers social reaction dock buttons inside [role="toolbar"]', () => {
    document.body.innerHTML = `
      <div role="toolbar" aria-label="Reactions">
        <div role="button" aria-label="Like" id="rx-like"><span>Like</span></div>
        <div role="button" aria-label="Love" id="rx-love"><span>Love</span></div>
        <div role="button" aria-label="Care" id="rx-care"><span>Care</span></div>
      </div>`;
    const buttons = document.querySelectorAll('[role="button"]');
    buttons.forEach((btn, idx) => visibleBox(btn, 100, idx * 50, 40, 40));
    vi.spyOn(document, 'elementFromPoint').mockImplementation((x, y) => {
      for (const btn of Array.from(buttons)) {
        const r = btn.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return btn.firstElementChild ?? btn;
      }
      return null;
    });

    const candidates = discover();
    expect(candidates).toHaveLength(3);
    expect(candidates.map((c) => c.element.id)).toEqual(['rx-like', 'rx-love', 'rx-care']);
  });

  it('activates Facebook reactions with realistic pointer sequence and exactly one click', () => {
    document.body.innerHTML = `
      <div role="toolbar" aria-label="Reactions">
        <div role="button" aria-label="Love" id="rx-love"><span id="rx-love-icon">❤️</span></div>
      </div>`;
    const loveBtn = document.getElementById('rx-love')!;
    const loveIcon = document.getElementById('rx-love-icon')!;
    visibleBox(loveBtn, 100, 100, 40, 40);
    visibleBox(loveIcon, 100, 100, 40, 40);

    vi.spyOn(document, 'elementFromPoint').mockReturnValue(loveIcon);

    const eventsFired: string[] = [];
    for (const evtName of ['pointerover', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      loveBtn.addEventListener(evtName, () => { eventsFired.push(evtName); });
    }

    activate(loveBtn);

    expect(eventsFired).toContain('mouseover');
    expect(eventsFired).toContain('mousedown');
    expect(eventsFired).toContain('mouseup');
    expect(eventsFired.filter((e) => e === 'click')).toHaveLength(1);
  });

  it('dispatches hover sequence without clicking when mode is hover', () => {
    document.body.innerHTML = `<button id="like-trigger">Like</button>`;
    const btn = document.getElementById('like-trigger')!;
    visibleBox(btn, 50, 50, 80, 30);

    let hovered = false;
    let clicked = false;
    btn.addEventListener('mouseover', () => { hovered = true; });
    btn.addEventListener('click', () => { clicked = true; });

    activate(btn, 'hover');

    expect(hovered).toBe(true);
    expect(clicked).toBe(false);
  });

  it('discovers scrollable containers and main window with discoverScrollable', () => {
    document.body.innerHTML = `
      <div id="sidebar" style="overflow-y: auto;">
        <div style="height: 1000px;">Sidebar Content</div>
      </div>
      <section id="feed" style="overflow-y: scroll;">
        <div style="height: 2000px;">Feed Content</div>
      </section>
      <div id="static-box" style="overflow: hidden;">Static</div>
    `;

    const sidebar = document.getElementById('sidebar')!;
    const feed = document.getElementById('feed')!;
    const staticBox = document.getElementById('static-box')!;

    visibleBox(sidebar, 0, 0, 200, 600);
    visibleBox(feed, 0, 210, 500, 600);
    visibleBox(staticBox, 0, 720, 200, 200);

    Object.defineProperty(sidebar, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(sidebar, 'clientHeight', { value: 600, configurable: true });
    Object.defineProperty(feed, 'scrollHeight', { value: 2000, configurable: true });
    Object.defineProperty(feed, 'clientHeight', { value: 600, configurable: true });

    window.getComputedStyle = vi.fn().mockImplementation((el: Element) => {
      if (el === sidebar) return { overflowY: 'auto', overflowX: 'hidden', display: 'block', visibility: 'visible' } as unknown as CSSStyleDeclaration;
      if (el === feed) return { overflowY: 'scroll', overflowX: 'hidden', display: 'block', visibility: 'visible' } as unknown as CSSStyleDeclaration;
      return { overflowY: 'hidden', overflowX: 'hidden', display: 'block', visibility: 'visible' } as unknown as CSSStyleDeclaration;
    });

    const scrollables = discoverScrollable();
    const ids = scrollables.map((s) => s.element.id);
    expect(ids).toContain('sidebar');
    expect(ids).toContain('feed');
    expect(ids).not.toContain('static-box');
  });

  it('supports custom candidates and onSelect callback in LinkHintsMode', () => {
    const customDiv = document.createElement('div');
    customDiv.id = 'target-panel';
    visibleBox(customDiv, 10, 10, 200, 200);

    const candidates = [{
      element: customDiv,
      rect: new DOMRect(10, 10, 200, 200),
      text: 'Scroll: Panel',
      reason: 'scrollable',
    }];

    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    document.body.append(host);

    const onExit = vi.fn();
    const onSelect = vi.fn();

    new LinkHintsMode(shadow, 'asdf', 'currTab', onExit, candidates, onSelect);
    expect(shadow.querySelectorAll('.hint-label')).toHaveLength(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    expect(onSelect).toHaveBeenCalledWith(customDiv);
    expect(onExit).toHaveBeenCalled();
  });
});
