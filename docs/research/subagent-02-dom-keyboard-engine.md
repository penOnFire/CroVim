# CroVim Content-Script DOM & Keyboard Interaction Engine — Technical Specification

## 1. Key Event Pipeline & Mode State Machine
- Registered on `window` in capture phase (`{ capture: true, passive: false }`) for `keydown`, `keypress`, `keyup`, `focus`, `blur`.
- IME Composition guard (`event.isComposing || event.keyCode === 229`).
- Key normalization (`<c-[>`, `<c-f>`, `<c-b>`, `<a-p>`, `<escape>`, `<enter>`, `<backspace>`, `<space>`, `<tab>`, printable chars).
- Suppress `keypress` and `keyup` for keys consumed on `keydown`.
- Mode State Machine: `Normal`, `Insert`, `PassThrough`, `LinkHints` (`f`/`F`/`yf`), `Find` (`/`), `Visual` (`v`/`V`), `Vomnibar` (`o`/`O`/`t`/`T`/`b`/`B`/`ge`/`gE`), `HelpDialog` (`?`), `Marks` (`m`/`` ` ``/`'`).

## 2. Multi-Key Sequence Trie & Numeric Count Prefix Buffer
- Supports numeric counts (`5j`, `3x`, `2gt`) and multi-key sequences (`gg`, `gi`, `gu`, `gU`, `gt`, `gT`, `g0`, `g$`, `ge`, `gE`, `yy`, `yf`, `yt`, `<<`, `>>`, `zH`, `zL`, `[[`, `]]`).
- Deep `activeElement` traversal across `shadowRoot` and editable element detection (`input`, `textarea`, `select`, `isContentEditable`, ARIA `textbox`/`searchbox`/`combobox`).

## 3. Link Hints Engine (`f`, `F`, `yf`)
- Discovers clickable/focusable elements across DOM and open Shadow roots (`a[href]`, `button`, `summary`, `details`, `area[href]`, `input`, `select`, `textarea`, `label`, ARIA interactive roles, `[onclick]`, `[tabindex]`, `cursor: pointer` deduplicated heuristic).
- Viewport bounding box, computed style (`visibility`, `display`, `opacity`, `pointerEvents`), and occlusion (`document.elementFromPoint`) filtering.
- Prefix-free hint label generation using home-row alphabet `sadfjklewcmpgh`.
- Rendered inside isolated `#crovim-ui-root` Shadow DOM at `z-index: 2147483647`.
- Realistic synthetic pointer/mouse event activation sequence (`pointerover`, `mouseover`, `pointerdown`, `mousedown`, `focus`, `pointerup`, `mouseup`, `click`).

## 4. Smooth Scrolling Engine
- Active scrollable container detection (walking up from deep activeElement, `document.scrollingElement`, or largest visible scrollable pane).
- 60fps `requestAnimationFrame` exponential decay smooth scroller with velocity accumulation, plus instant scrolling when `smoothScroll: false` or `prefers-reduced-motion: reduce`.

## 5. Find Mode, Visual/Caret Mode, Marks, HUD & Help Dialog
- Find Mode (`/`, `n`, `N`): TreeWalker + `CSS.highlights` API (or selection fallback) with SmartCase and regex support, live HUD counter `[idx/total]`.
- Visual & Caret Mode (`v`, `V`): `Selection.prototype.modify` (`h`, `j`, `k`, `l`, `w`, `b`, `e`, `0`, `$`, `o`, `c`, `y` to yank).
- Marks Engine (`m`, `` ` ``, `'`): Local marks (`a-z`) in `sessionStorage` + last jump `''`/`` `` ``, and Global marks (`A-Z`, `0-9`) in `chrome.storage.local` via background service worker.
- HUD & Help Dialog (`?`): Rendered inside `#crovim-ui-root` Shadow DOM.
