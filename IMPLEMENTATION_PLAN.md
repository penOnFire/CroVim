# CroVim Implementation Plan

## 0. Delivery goals and architectural decisions

CroVim will be implemented as a Chrome Manifest V3 extension with three isolated runtime surfaces:

1. **Content script**: owns keyboard capture, modes, DOM discovery, scrolling, selection, and page overlays. It must remain responsive without waiting on the service worker.
2. **Background service worker**: owns privileged Chrome APIs, tab/window operations, browser-data search, global marks, settings synchronization, and typed RPC routing. It must tolerate suspension and restart.
3. **Extension pages**: popup, options, and the Vomnibar iframe provide isolated UI and use the same RPC protocol.

The first release targets current Chromium with an explicit `minimum_chrome_version` chosen before implementation begins (recommended baseline: Chrome 120). Use `chrome.*` APIs, JSON-compatible messages, explicit error responses, and no durable state in service-worker globals. Keep MV3 content-script and worker entries self-contained with stable output names; avoid shared chunks until a packaging test proves them safe.

## 1. Repository layout

Create the following structure:

```text
CroVim/
├── manifest.json
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── eslint.config.js
├── scripts/
│   ├── build-entries.mjs
│   ├── clean-dist.mjs
│   └── validate-dist.mjs
├── public/
│   └── icons/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png
├── src/
│   ├── shared/
│   │   ├── constants.ts
│   │   ├── errors.ts
│   │   ├── messages.ts
│   │   ├── rpc.ts
│   │   ├── settings-schema.ts
│   │   ├── settings-store.ts
│   │   ├── types.ts
│   │   └── validation.ts
│   ├── background/
│   │   ├── service-worker.ts
│   │   ├── rpc-router.ts
│   │   ├── tab-commands.ts
│   │   ├── url-commands.ts
│   │   ├── mru-tab-tracker.ts
│   │   ├── vomnibar-search.ts
│   │   ├── search-engines.ts
│   │   ├── global-marks.ts
│   │   ├── storage-sync.ts
│   │   └── lifecycle.ts
│   ├── content/
│   │   ├── content-script.ts
│   │   ├── key-event-pipeline.ts
│   │   ├── mode-manager.ts
│   │   ├── command-trie.ts
│   │   ├── command-dispatcher.ts
│   │   ├── editable-target.ts
│   │   ├── dom-utils.ts
│   │   ├── ui-root.ts
│   │   ├── hud-component.ts
│   │   ├── help-dialog.ts
│   │   ├── smooth-scroller.ts
│   │   ├── link-hints/
│   │   │   ├── link-hints-mode.ts
│   │   │   ├── hint-discovery.ts
│   │   │   ├── hint-labels.ts
│   │   │   ├── hint-overlay.ts
│   │   │   └── activation.ts
│   │   ├── find/
│   │   │   ├── find-mode.ts
│   │   │   ├── text-index.ts
│   │   │   └── find-highlights.ts
│   │   ├── visual/
│   │   │   ├── visual-mode.ts
│   │   │   └── selection-movement.ts
│   │   ├── marks/
│   │   │   ├── marks-mode.ts
│   │   │   ├── local-marks.ts
│   │   │   └── mark-navigation.ts
│   │   └── vomnibar/
│   │       ├── vomnibar-overlay.ts
│   │       ├── vomnibar-client.ts
│   │       └── vomnibar.css
│   ├── pages/
│   │   ├── popup/
│   │   │   ├── index.html
│   │   │   ├── main.ts
│   │   │   ├── popup.css
│   │   │   └── popup.test.ts
│   │   ├── options/
│   │   │   ├── index.html
│   │   │   ├── main.ts
│   │   │   ├── options.css
│   │   │   ├── settings-form.ts
│   │   │   └── options.test.ts
│   │   └── vomnibar/
│   │       ├── index.html
│   │       ├── main.ts
│   │       ├── vomnibar-ui.ts
│   │       └── vomnibar-ui.test.ts
│   └── styles/
│       ├── content.css
│       └── ui-reset.css
├── tests/
│   ├── unit/
│   ├── dom/
│   ├── fixtures/
│   │   ├── navigation.html
│   │   ├── shadow-dom.html
│   │   ├── frames.html
│   │   └── scroll-find-marks.html
│   ├── e2e/
│   │   ├── extension-fixtures.ts
│   │   ├── hints.spec.ts
│   │   ├── navigation.spec.ts
│   │   ├── modes.spec.ts
│   │   ├── vomnibar.spec.ts
│   │   ├── settings.spec.ts
│   │   └── lifecycle.spec.ts
│   └── server.ts
└── dist/                         # generated unpacked extension; never hand-edit
    ├── manifest.json
    ├── service-worker.js
    ├── content-script.js
    ├── content.css
    ├── pages/vomnibar.html
    ├── pages/help-dialog.html
    ├── pages/popup.html
    ├── pages/options.html
    └── icons/*
```

## 2. TypeScript and Vite/esbuild build pipeline

### 2.1 Package scripts and dependencies

Add TypeScript, Vite, Vitest, `@playwright/test`, `esbuild`, `jsdom`, and a Chrome extension API type package. Use Vite for HTML pages and a small custom esbuild build step for the two manifest entries so their output is deterministic and code-split-free.

Required scripts:

```json
{
  "dev": "vite",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "build": "npm run clean && npm run build:entries && vite build",
  "build:entries": "node scripts/build-entries.mjs",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "npm run build && playwright test",
  "test:all": "npm run typecheck && npm run lint && npm test && npm run test:e2e",
  "clean": "node scripts/clean-dist.mjs",
  "validate:dist": "node scripts/validate-dist.mjs"
}
```

`build:entries` invokes esbuild with `bundle: true`, `format: "iife"` for the content script, `format: "esm"` for the module service worker, `platform: "browser"`, an explicit Chrome target, sourcemaps in development, and no splitting. Vite builds the popup, options, and Vomnibar HTML entries and copies `public/`. The build script then flattens the page entry outputs to the manifest contract (`src/pages/popup/index.html` -> `dist/pages/popup.html`, `src/pages/options/index.html` -> `dist/pages/options.html`, and `src/pages/vomnibar/index.html` -> `dist/pages/vomnibar.html`) and creates the small static `help-dialog.html` shell from its source template. The final build copies the root `manifest.json` to `dist/` and runs `validate-dist`, which verifies every manifest path exists, parses JSON, and confirms the worker starts under Chromium.

`vite.config.ts` must use `base: "./"`, `outDir: "dist"`, `emptyOutDir: false` after the entry step, explicit `build.target`, and stable HTML inputs. Do not use HMR or absolute asset URLs in production. Configure CSS output as `content.css` or keep content CSS imported by the content entry; the manifest must reference the chosen result exactly. The flattening step must rewrite any generated HTML asset references to remain relative after moving the files.

`tsconfig.json` should use strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `moduleResolution: "Bundler"`, DOM and Chrome types, and path aliases only if Vite/Vitest share the same alias configuration. `tsconfig.node.json` covers Vite, Playwright, and build scripts.

## 3. Complete MV3 manifest

The root `manifest.json` is the source of truth and is copied unchanged to `dist/`:

```json
{
  "manifest_version": 3,
  "name": "CroVim",
  "version": "0.1.0",
  "description": "Vim-style keyboard navigation for Chrome.",
  "minimum_chrome_version": "120",
  "permissions": [
    "storage",
    "tabs",
    "bookmarks",
    "history",
    "sessions",
    "search",
    "scripting",
    "clipboardRead",
    "clipboardWrite"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "service-worker.js",
    "type": "module"
  },
  "action": {
    "default_title": "CroVim",
    "default_popup": "pages/popup.html"
  },
  "options_ui": {
    "page": "pages/options.html",
    "open_in_tab": true
  },
  "content_scripts": [
    {
      "matches": ["http://*/*", "https://*/*"],
      "js": ["content-script.js"],
      "css": ["content.css"],
      "run_at": "document_start",
      "all_frames": true,
      "match_about_blank": true,
      "match_origin_as_fallback": true
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["pages/vomnibar.html", "pages/help-dialog.html"],
      "matches": ["http://*/*", "https://*/*"]
    }
  ],
  "commands": {
    "create-tab": {
      "suggested_key": { "default": "Ctrl+Shift+T" },
      "description": "Create a new tab"
    },
    "next-tab": {
      "description": "Activate the next tab"
    },
    "previous-tab": {
      "description": "Activate the previous tab"
    }
  },
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

Before release, reconsider sensitive permissions. `bookmarks`, `history`, and `sessions` may be made optional only if first-use permission UX is implemented. Restricted pages and Chrome Web Store pages are unsupported and must not be treated as injection errors.

## 4. Shared contracts, settings, and storage

### 4.1 RPC envelope

Implement `src/shared/messages.ts` as a discriminated union. Every request has a `requestId`, `type`, and JSON-only payload; every response is exactly one of:

```ts
export type RpcResponse<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; retryable?: boolean } };
```

Define request/response pairs for:

- `settings.get`, `settings.update`, `settings.reset`
- `tabs.getCurrent`, `tabs.list`, `tabs.next`, `tabs.previous`, `tabs.create`, `tabs.close`, `tabs.restore`, `tabs.duplicate`, `tabs.move`, `tabs.pin`, `tabs.mute`, `tabs.visitPrevious`
- `url.open`, `url.goUp`, `url.goRoot`, `url.reload`, `url.moveToWindow`
- `omnibar.complete`, `omnibar.open`
- `marks.get`, `marks.set`, `marks.goto`
- `content.registerFrame`, `content.restoreMarkPosition`
- `clipboard.write`

`src/shared/rpc.ts` provides typed `sendRpc`, timeout handling, sender validation, one-response routing, and conversion of Chrome runtime errors into explicit error codes. `src/shared/validation.ts` validates untrusted message payloads and settings before use.

### 4.2 Settings schema

Use a versioned `Settings` object:

```ts
export interface Settings {
  schemaVersion: 1;
  keyMappings: Record<string, string>;
  passKeys: string[];
  excludedPatterns: string[];
  searchEngines: Array<{ keyword: string; name: string; url: string }>;
  scrollStep: number;
  smoothScroll: boolean;
  hintCharacters: string;
  hintMode: "alphabet" | "filtered";
  findRegex: boolean;
  findSmartCase: boolean;
  theme: "system" | "light" | "dark";
  globalMarksUseUppercase: boolean;
  newTabBackground: boolean;
}
```

Defaults must include a validated, duplicate-free hint alphabet with at least two characters, safe scroll bounds, and canonical mappings for `j`, `k`, `h`, `l`, `d`, `u`, `gg`, `G`, `f`, `F`, `yf`, `/`, `n`, `N`, `v`, `V`, `m`, `` ` ``, `'`, `o`, `O`, `t`, `T`, `b`, `B`, `?`, `r`, `R`, `x`, `X`, `gt`, `gT`, `g0`, `g$`, `gu`, `gU`, `yy`, `p`, `P`, `<<`, `>>`, `J`, `K`, and `^`.

`settings-schema.ts` owns defaults, migrations, normalization, and validation. `settings-store.ts` reads managed policy, sync settings, and local settings with clear precedence: managed policy > sync user preferences > local fallback > defaults. Store compact preferences in `storage.sync`, larger/custom configuration in `storage.local`, and ephemeral frame/cache state in `storage.session`. `storage.onChanged` pushes a normalized settings snapshot to connected content scripts and extension pages.

## 5. Content script implementation

### 5.1 Bootstrap and event pipeline

`content-script.ts` constructs one `ModeManager`, `KeyEventPipeline`, `CommandTrie`, `HudComponent`, and `UiRoot` per frame. Register capture-phase `keydown`, `keypress`, `keyup`, `focus`, and `blur` listeners with `{capture: true, passive: false}`. Ignore IME composition and key code 229. Normalize control, meta, alt, shifted, named, and printable keys into one internal notation.

`KeyEventPipeline` must:

- distinguish editable targets by traversing active elements through open shadow roots;
- honor exclusion rules before entering a mode;
- prevent default and stop propagation only when a mode consumes the event;
- suppress matching keypress/keyup after a consumed keydown;
- reset partial mappings on timeout, blur, Escape, or an unmapped key;
- preserve page behavior for pass-through keys and unsupported pages.

### 5.2 Mode manager and command trie

`ModeManager` is the single owner of `Normal`, `Insert`, `PassThrough`, `LinkHints`, `Find`, `Visual`, `Vomnibar`, `HelpDialog`, and `Marks` modes. It exposes enter/exit transitions, current mode, numeric count, and cleanup callbacks. Modes must never install competing global listeners; they receive normalized events from the pipeline.

`CommandTrie` parses user mappings into nested nodes. A node may both contain a command and continue to children. Runtime state is a list of active nodes plus count buffer, allowing a fresh command to begin while a longer sequence is pending. Dispatch commands through `command-dispatcher.ts`, keeping DOM-local commands local and sending only privileged operations through RPC.

### 5.3 UI root, HUD, and help

`ui-root.ts` appends `#crovim-ui-root` to `document.documentElement` and attaches an open Shadow Root with reset styles and maximum z-index. `HudComponent` renders transient messages, mode labels, counts, find input, and command errors with ARIA labels and focus-safe behavior. `HelpDialog` renders searchable grouped mappings in an isolated shadow overlay, closes on Escape/click outside, and reflects current settings.

### 5.4 SmoothScroller

`smooth-scroller.ts` finds a scrollable ancestor from the deepest activated target, otherwise the document scrolling element and largest suitable pane. Share its scrollability predicate with hint discovery. Implement immediate mode, reduced-motion fallback, and `requestAnimationFrame` animation with repeat-aware continuation, cancellation on keyup/blur/new token, and final delta clamping. Test nested containers, shadow targets, repeated keys, and cancellation.

### 5.5 LinkHintsMode

Split the implementation into discovery, labels, overlay, and activation:

- `hint-discovery.ts` walks the document and every open shadow root; identifies native controls, links, ARIA interactive roles, contenteditable elements, labels, details, image maps, pointer/zoom affordances, positive tabindex, and scrollable containers; excludes disabled, hidden, zero-sized, and covered candidates.
- Use viewport-clipped client rectangles with a small edge tolerance, center/corner hit testing, and recursive open-shadow hit testing. Deduplicate ancestor/descendant candidates and retain stable DOM order.
- `hint-labels.ts` implements a prefix-free breadth-first generator using the configured alphabet, with deterministic sorting/scattering. Reject alphabets with fewer than two unique characters. Filtered mode scores link text and renumbers survivors.
- `hint-overlay.ts` renders each character in its own span inside the isolated shadow root; style typed prefixes; keep the overlay outside target elements and use popover/manual fallback when available.
- `activation.ts` dispatches the target action through a realistic pointer/mouse sequence, or uses the appropriate keyboard/control behavior when needed, then exits the mode.
- `LinkHintsMode` supports `f`, `F`, `yf`, typed labels, Backspace, Escape, counts, and frame ownership. The frame coordinator must avoid activating a candidate that belongs to another frame.

### 5.6 FindMode

`text-index.ts` builds a text-node index and maps character offsets to DOM ranges. `find-highlights.ts` uses `CSS.highlights` when available and a range/selection fallback otherwise. `FindMode` supports forward/backward search, SmartCase, regex setting, query history, live match counts, `n`/`N`, immediate native-like scrolling, and editable-result post-find behavior. Escape restores normal selection coloring and focus; invalid regexes produce an explicit HUD error.

### 5.7 VisualMode

`selection-movement.ts` wraps `Selection.modify("extend", ...)` with character, word, Vim-word, line, sentence, line-boundary, reversal, collapse, and `o` direction-swap behavior. `VisualMode` retains a usable selection, optionally creates a caret near the first text node, keeps the range visible, supports yank/search/open-selected-URL, and exits without destroying intentional selection. Clipboard writes use the privileged RPC fallback when page clipboard access fails.

### 5.8 MarksMode

`local-marks.ts` stores page-local marks in host-page `localStorage` under a URL-without-fragment key and records scroll coordinates/hash. `global-marks.ts` in the worker stores global records in `storage.local` with URL, coordinates, source tab, and a session secret. `MarksMode` handles `m<char>` and `` `<char> ``/`'<char>`; case policy follows settings. `mark-navigation.ts` prefers the source tab, then an existing matching tab, then a new tab, and restores position only after content registration. Record previous positions in the special back-jump registers.

### 5.9 VomnibarOverlay

`vomnibar-overlay.ts` is a thin host launcher. It creates an iframe from `chrome.runtime.getURL("pages/vomnibar.html")` inside an isolated shadow wrapper, passes completer type/query/open mode, and waits for a hide acknowledgement before navigation. `vomnibar-client.ts` handles activation, frame lifecycle, and RPC. The iframe UI owns input, selection, ArrowUp/ArrowDown, Enter/Escape, keyword search-engine parsing, and new-tab modifiers.

## 6. Background service worker

`service-worker.ts` imports modules and registers all listeners synchronously at top level. `lifecycle.ts` performs idempotent install migrations, context-menu setup if added later, startup hydration, and cleanup. Never depend on module globals for correctness; use `storage.session` or reconstruct state from Chrome APIs.

### 6.1 Tab commands

`tab-commands.ts` implements current/last-focused-window queries and bounds-safe operations: next/previous/first/last tab, create, close, restore recently closed, duplicate, pin, mute, move left/right, and visit previous tab. Handle missing tabs, restricted URLs, rejected sends, and race conditions as explicit RPC errors.

### 6.2 URL hierarchy and open commands

`url-commands.ts` implements current-tab reload/hard reload, open current/new/background tab, move to a new window, `gu` parent URL, `gU` origin root, and URL normalization. Preserve fragments where appropriate, reject unsupported protocols before navigation, and use `tabs.create`/`tabs.update` only in the worker.

### 6.3 MRU tracker

`mru-tab-tracker.ts` listens to `tabs.onActivated`, `tabs.onRemoved`, `tabs.onUpdated`, and window focus changes. Store a bounded MRU list in `storage.session`; repair stale IDs on every read. `visitPrevious` selects the newest valid tab other than the current one. Tests must simulate worker restart and reconstruct the list safely.

### 6.4 Vomnibar fuzzy search

`vomnibar-search.ts` queries tabs, bookmarks, history, and search engines according to completer type. Implement bounded queries, URL/title deduplication, multi-token smart-case matching, word-boundary bonuses, stable frecency scoring, and highlighted match spans. `search-engines.ts` validates keyword templates, expands query terms with `encodeURIComponent`, and provides a default web search engine. Do not persist history results or query logs. Permission/API failures return partial results with explicit metadata rather than silently pretending all sources succeeded.

### 6.5 Global marks and storage sync

`global-marks.ts` validates mark keys and records, handles tab preference/new-tab fallback, sends restore messages after frame registration, and cleans records when requested. `storage-sync.ts` owns quotas, migrations, sync/local split, managed-policy precedence, and `storage.onChanged` fanout. Debounce writes but flush before page unload where applicable; never drop validation errors.

## 7. Popup and Options pages

### Popup

`src/pages/popup` shows current mode/settings summary, links to Options, and provides actions for opening Vomnibar/help and toggling enabled state for the current site. It must close safely after dispatching an action and handle an unavailable active tab.

### Options

Implement a typed form with sections for:

- custom keymappings, including parse/validate/reset and conflict warnings;
- exclusion URL patterns with test-against-current-URL preview;
- search engines with keyword uniqueness and URL-template validation;
- scroll step size, smooth scrolling, and reduced-motion behavior;
- hint characters and alphabet validation;
- theme (`system`, `light`, `dark`) and preview;
- find/mark/new-tab preferences.

`settings-form.ts` loads a snapshot through RPC, edits a local draft, validates on change and submit, displays field-level errors, and writes atomically. Listen for external changes and offer reload/merge behavior rather than overwriting another page silently. Options tests cover migration, invalid input, quota errors, and cross-page updates.

## 8. Automated test plan

### 8.1 Vitest unit and DOM tests

Configure Vitest with TypeScript, `jsdom` for DOM suites, fake timers where animation is tested, and isolated tests for:

- key normalization, editable detection, composition guards, consumed-key suppression;
- trie construction, prefix ambiguity, numeric counts, pass-through, reset behavior;
- prefix-free hint generation for 0, 1, many, and large candidate counts;
- hint discovery visibility, clipping, occlusion, disabled ARIA, ancestor deduplication, open Shadow DOM, image maps, scroll targets;
- label filtering/scoring and stable ordering;
- SmoothScroller target selection, repeat/cancel semantics, reduced motion, and exact step amounts;
- text indexing, SmartCase, regex errors, cross-node ranges, find history;
- Selection movement and visual-mode reversal/caret behavior;
- local/global mark serialization and URL-without-fragment keys;
- URL hierarchy and search-engine template expansion;
- fuzzy scoring, deduplication, highlight spans, and MRU repair;
- settings defaults, migrations, validation, precedence, and RPC envelope validation;
- UI components in shadow roots, HUD lifecycle, help filtering, and Vomnibar selection state.

Use fake Chrome API adapters rather than mocking implementation details. Every adapter should support success, rejected API calls, missing IDs, and service-worker cold starts.

### 8.2 Playwright Chromium persistent-context E2E

`extension-fixtures.ts` must build/load `dist`, start the local fixture server, create an isolated persistent Chromium context with:

```ts
chromium.launchPersistentContext(userDataDir, {
  channel: "chromium",
  args: [
    `--disable-extensions-except=${distPath}`,
    `--load-extension=${distPath}`
  ]
});
```

Wait for the service worker, derive the extension ID from its `chrome-extension://<id>/...` URL, and address options/vomnibar pages through that ID. Use observable UI readiness rather than timeouts, and always close the context in teardown.

Required scenarios:

1. **Hints**: normal links, disabled/covered/offscreen elements, open Shadow DOM, scroll containers, iframes, prefix labels, filtered labels, click/new-tab/yank activation.
2. **Navigation**: counts, `gg`, `G`, `gt`, `gT`, `g0`, `g$`, `gu`, `gU`, reload, close/restore, duplicate, pin/mute, MRU previous tab.
3. **Scrolling**: document and nested panes, repeated keydown, keyup cancellation, reduced motion, exact configured step.
4. **Find/visual**: query entry, SmartCase/regex, `n`/`N`, selection visibility, yank, selected URL open, Escape/focus behavior.
5. **Marks**: local restoration, global restoration in original/matching/new tab, hash and coordinate marks, worker restart.
6. **Vomnibar**: activation, typing, source results, fuzzy highlights, Arrow navigation, Enter/Escape, keyword search, current/new/background tab.
7. **Settings**: options persistence, validation errors, custom mappings, exclusions, hint alphabet/theme changes, popup actions.
8. **Lifecycle**: reload the worker/profile, tolerate worker suspension, re-acquire the worker, verify storage-backed state and idempotent startup.

The fixture pages must include ordinary controls, covered controls, partially visible controls, nested scrollable panes, an open custom-element shadow root, nested frames, findable text, links with fragments, and mark destinations. Keep tests independent by using a fresh profile per test or worker for any test that changes storage/localStorage.

## 9. Implementation order and release gates

1. Create package/build/config files and prove `npm run build` emits a loadable `dist/`.
2. Implement shared contracts/settings and service-worker RPC health check.
3. Implement key pipeline, trie, mode manager, UI root, HUD, and scrolling.
4. Implement link hints and navigation commands.
5. Implement Find, Visual, Marks, Vomnibar, and their worker counterparts.
6. Implement popup/options and storage change fanout.
7. Add Vitest coverage for each algorithm before wiring E2E.
8. Add persistent-context E2E fixtures and lifecycle tests.
9. Run `npm run test:all`, `npm run validate:dist`, manually load `dist` as unpacked, inspect worker errors, and verify restricted-page behavior.

Release is blocked unless typecheck, lint, unit/DOM tests, E2E tests, manifest validation, service-worker startup, and a clean unpacked install all pass. Document any intentionally unsupported Chrome pages or permissions in the user-facing options/help UI.
