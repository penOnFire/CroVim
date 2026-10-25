# Vimium DOM internals and Chrome MV3 end-to-end testing

Research date: 2026-10-25

Primary implementation reviewed: [philc/vimium](https://github.com/philc/vimium), revision [`5aa29614bf1dce05e0d316f8c38722e17f9b38c3`](https://github.com/philc/vimium/tree/5aa29614bf1dce05e0d316f8c38722e17f9b38c3). The repository is Manifest V3. The descriptions below refer to that revision, not to an abstract Vim clone.

## DOM link hints

### Discovery of clickable elements

`content_scripts/link_hints.js` separates discovery (`LocalHints.getLocalHints`) from marker rendering and activation. It walks every element under `document.documentElement` with `querySelectorAll("*")`, recursively entering every *open* `element.shadowRoot`. For each element, `getLocalHintsForElement` decides whether it is hintable and computes one or more viewport rectangles.

The clickability heuristic is intentionally broad:

- Native controls: `a`, editable `textarea`, non-hidden/non-disabled `input`, `button`, `select`, `object`, and `embed`.
- Explicit behavior: `onclick`, Angular `ng-click` variants, Google-style `jsaction`, ARIA roles such as `button`, `tab`, `link`, `checkbox`, `menuitem`, `radio`, and `textbox`, and `contenteditable`.
- Useful browser affordances: `label` associated with an enabled control, `details` (captioned `Open.`), images with `cursor: zoom-in`/`zoom-out`, and positive `tabindex`.
- Scroll targets: the body and some `div`/`ol`/`ul` elements when they have scrollable overflow (captioned `Scroll.`).
- Heuristic fallbacks: class names containing `button` or `btn`. These are marked as possible false positives and are removed when a nearby clickable descendant is a better candidate.
- Image maps: an image with `usemap` produces one hint per visible `<area>`.

Disabled ARIA elements (`aria-disabled=""` or `"true"`) are excluded. Vimium deliberately does not rely on discovering arbitrary `addEventListener("click", ...)` registrations; the source notes that this is disabled because the browser does not expose a reliable general listener query.

The resulting `LocalHint` stores the target element, a display rectangle, whether it is only a second-class `tabindex` candidate, false-positive metadata, and an optional reason. Link text is generated later for filtered hint mode.

### Visibility and viewport filtering

`DomUtils.getVisibleClientRect(element, true)` is the central visibility test:

1. Read `getClientRects()`.
2. For zero-sized parents, optionally inspect floated, absolutely positioned, or fixed children. This handles inline wrappers and image-like elements whose own box is empty.
3. Crop the rectangle to the viewport with `cropRectToVisible`.
4. Reject rectangles that are outside the viewport, have width or height below three CSS pixels, or whose computed `visibility` is not `visible`.

The crop uses `innerWidth`/`innerHeight` and permits a four-pixel edge tolerance. It does not require the whole element to be visible: a partially visible element receives a rectangle clipped to the visible portion. After discovery, Vimium checks overlap with `elementFromPoint`/`elementsFromPoint` at the center and then the four corners. A candidate survives only if the hit-tested element contains the candidate or is contained by it; this filters elements fully covered by another layer while preserving partially exposed controls. `getElementFromPoint` recursively descends through open shadow roots.

Candidates are collected in DOM order, reversed for overlap/ancestor preference, filtered for nearby false positives, and then positioned relative to the page viewport. A frame contributes descriptors to a coordinator, so every frame can display the same logical hint set; a marker owned by another frame has no local element in the current frame.

### Prefix-free hint strings

Default alphabet mode is implemented by `AlphabetHints.hintStrings(linkCount)`. It starts with `[""]` and repeatedly expands a queue in breadth-first order by prepending each configured hint character. It keeps the newly generated suffix range needed for the requested number of hints. Because the configured alphabet must contain at least two characters, the emitted set is prefix-free: short strings are not prefixes of longer strings in the selected set.

The resulting strings are sorted and reversed before assignment. This is not randomization; it scatters short strings and common first characters across the page instead of assigning all short or same-prefix hints to adjacent DOM nodes. Each marker renders every character in its own `<span>`, allowing already typed characters to receive a matching style.

Filtered mode uses a different scheme. It scores link text against typed words, sorts candidates by score and stable DOM order, then renumbers only the survivors using a configurable digit-like alphabet. The user can type link text first and then a displayed number; spaces are accepted as separators, and a failed text character is removed rather than leaving the mode with no candidates.

### Shadow DOM and overlay isolation

There are two separate Shadow DOM concerns:

1. **Finding and hit-testing page controls.** Vimium traverses open shadow roots during discovery and recursively descends into them during `elementsFromPoint`/`elementFromPoint`. Closed roots cannot be traversed by page JavaScript and are therefore not discoverable by this mechanism.
2. **Keeping Vimium UI independent of page CSS.** The hint marker container is appended to `document.documentElement`, not inside the clickable element (some controls cannot contain children). It uses the `vimium-reset` class and top-level marker children. Other Vimium UI components, including the Vomnibar iframe wrapper, use an open shadow root containing their stylesheet and iframe. This prevents host-page CSS from changing the UI and prevents UI markup from changing page selection/content.

The hint container uses the HTML popover API with `popover="manual"` where available, and is positioned as a full-page, overflow-visible absolute layer. Vimium retains a fallback for browsers without popover support.

## Smooth scrolling and scroll-target detection

`content_scripts/scroller.js` has two related responsibilities: selecting the element to scroll and animating the scroll.

The active element is learned from `DOMActivate` in Chrome (or `click` in Firefox). The handler records the deepest event target when an event path is available, including targets inside Shadow DOM. For a scroll command, Vimium finds a scrollable ancestor in the requested direction; if there is no activated element it falls back to the document scrolling element and the first suitable scrollable element. The same scrollability predicate is used by link-hint discovery for scrollable body/containers.

When `smoothScroll` is disabled, Vimium calls the immediate scroll operation and checks visibility. When enabled, `CoreScroller` uses `requestAnimationFrame`:

- A distinct key press starts its own animator, so two quick taps behave like two separate scrolls.
- Keyboard-repeat events do not start new animators; the most recent animator continues while the key remains down.
- Keydown, keyup, window blur, and a monotonically increasing `time` token cancel stale animation.
- Duration is based on amount (`max(100, 20 * log(amount))`), with a calibration factor adjusted after roughly 75 ms toward a target boundary for continuous scrolling.
- A keyup stops continuous extension and clamps the final delta to the requested amount.

Thus “smooth scrolling detection” is not a browser feature probe. It is event-state detection: Vimium tracks repeat status, key-down lifetime, active element, and cancellation events to decide whether to start, continue, or terminate an animation.

## Key mapping trie/state machine

`background_scripts/commands.js` parses default and user mappings and builds a nested object in `installKeyStateMapping`. A mapping such as `gg` becomes `{ g: { g: { command: ... }}}`; nodes may themselves contain a command, so a prefix can be both a command and the start of a longer command.

`content_scripts/mode_key_handler.js` consumes that structure. `keyState` is an array of currently possible mapping nodes, initially containing the root. For each key:

1. Check whether the key exists in any current node, accounting for pass-through keys.
2. Advance to each matching child and add the root again, allowing a fresh command to begin immediately.
3. If the first resulting node has a command, reset state, apply the numeric count prefix, and dispatch the command.
4. An unmapped key resets the state and bubbles to the page. Escape resets an incomplete sequence first, and exits only when already at the root.

The structure is trie-like but the runtime state is a list of nodes, which supports prefix ambiguity and mappings installed at multiple depths. Numeric prefixes are accumulated before a command; pass keys are only passed through when no continuation is possible and no count/partial command is active.

## Vomnibar UI

The host-side `content_scripts/vomnibar.js` is a thin launcher. It selects a completer (`omni`, `tabs`, `bookmarks`, or `commands`), initial query, first-selection behavior, and whether the result opens in a new tab. `UIComponent` injects `pages/vomnibar_page.html` in an iframe inside a Shadow DOM wrapper.

The iframe is intentional: it preserves page selection (important for bookmarklets), isolates styles, and simplifies keyboard handling. `pages/vomnibar_page.js` owns the actual `VomnibarUI`: input state, completion requests, selected row, user search-engine keywords, URL/search interpretation, new-tab modifiers, and hide/show sequencing. It communicates through a messenger rather than directly manipulating the host page. Hiding waits for a host acknowledgement before executing deferred navigation, avoiding a stale iframe/flicker race when opening a new tab.

For tests, the useful boundary is the user-facing input and completion list, not the internal completer implementation. Exercise activation, typing, ArrowUp/ArrowDown, Enter, Escape, and the resulting tab/navigation behavior.

## Find mode

`content_scripts/mode_find.js` presents a HUD-owned input and keeps a persistent query/history. It saves the initial selection and optionally the initial scroll position, then performs the search from the same range as the query changes. `FindMode.execute` supports forward/backward search, case sensitivity, and regex matching; regex matches are found across text nodes and highlighted with a `Range`.

The selected range is made visible by an immediate scroll (matching native browser Find rather than Vimium’s smooth scrolling). The body gets `vimium-find-mode` while the result is active so the selection can be styled. Enter saves the query and keeps the result; Escape removes the class, restores normal selection coloring, and focuses a found link or selects a found input when appropriate. A post-find mode suppresses printable events when the result landed in an editable element, preventing accidental page edits while retaining the expected Escape-to-insert behavior. `n`/`N` reuse the stored query and move forward/backward.

## Visual mode

`content_scripts/mode_visual.js` builds on the browser Selection API. `Movement` implements character, word, Vim-word, line, sentence, and line-boundary extension by calling `Selection.modify("extend", direction, granularity)`, with special handling for reversing, collapsing, and the `o` direction swap. `VisualMode` is a `KeyHandlerMode`, so its movement keys use the same nested mapping machinery.

On entry, existing visible text selections are retained. If there is no usable selection, Vimium can enter caret mode and heuristically create an initial caret near the first non-whitespace textual content. Movement keeps the focus/caret visible; an offscreen starting selection is cleared rather than silently operating on hidden content. Commands can yank selected text, search from the selection, or open a selected URL in the current/new tab. Exiting preserves a deliberate range selection; caret mode has its own collapse/selection rules.

## Marks

Marks have local and global registers:

- `m` followed by a printable character enters create-mark mode.
- `'` followed by a character enters goto-mark mode.
- Local marks are stored in page `localStorage` under `vimiumMark|<URL-without-fragment>|<key>` and contain `scrollX`, `scrollY`, and the hash.
- Shifted marks are global (with a configurable swap option), stored by the background service worker in `chrome.storage.local`.

Global mark records include the URL without its fragment, scroll coordinates, the originating tab ID, and a session secret. On goto, Vimium prefers the original tab, otherwise a matching tab, otherwise opens a new tab and restores the position after the content script registers. It records previous positions in the special `` ` `` and `'` local registers. Local hash-only positions use `location.hash`; otherwise Vimium calls `scrollTo`.

## End-to-end testing a Chrome MV3 extension with Playwright

Playwright’s documented Chrome-extension setup uses a **persistent Chromium context**. This is the appropriate fixture for MV3 because the extension background is a service worker and the test needs a real profile. Use Playwright’s bundled Chromium (`channel: "chromium"`), not a normal `BrowserContext`, and load the unpacked extension with command-line flags:

```ts
import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use, testInfo) => {
    const extensionPath = path.resolve(testInfo.project.testDir, "../dist");
    const userDataDir = testInfo.outputPath("chromium-profile");
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker");
    }
    await use(new URL(serviceWorker.url()).host);
  },
});
```

The service-worker URL has the form `chrome-extension://<id>/...`; deriving the ID at runtime avoids hard-coding it. The ID can then address extension pages such as `chrome-extension://${extensionId}/options.html`, while normal `page.goto()` calls exercise content scripts on a local HTTP fixture.

Recommended E2E structure:

1. Build the unpacked MV3 extension into a deterministic directory before tests.
2. Start a local HTTP server with fixture pages containing ordinary links, disabled controls, offscreen/covered elements, scroll containers, a custom element with an open shadow root, nested iframes, findable text, and mark destinations.
3. Launch one isolated persistent profile per test or worker. Do not reuse a profile between tests that modify `chrome.storage` or page `localStorage`.
4. Wait for the service worker before deriving the ID. For content-script assertions, wait for the page’s observable UI (hint container, HUD, or Vomnibar input), not an arbitrary timeout.
5. Assert user outcomes: hint count/labels and click destination; scroll position; command sequences such as `g` then `g`; Vomnibar rows and resulting URL/tab; Find selection and `n`/`N`; Visual selection text; local/global mark restoration.
6. Cover service-worker lifecycle boundaries separately. MV3 workers may be suspended after inactivity, so tests should tolerate worker restart and re-acquire `context.serviceWorkers()` when a test explicitly exercises suspension. Avoid keeping a long operation in flight across suspension.
7. Close the context in `finally`/fixture teardown so the profile and extension process cannot leak into later tests.

Playwright’s official reference is [Chrome extensions](https://playwright.dev/docs/chrome-extensions). Vimium’s own unit/DOM tests are also useful complements: `tests/unit_tests/link_hints_test.js`, `tests/unit_tests/marks_test.js`, `tests/unit_tests/vomnibar_page_test.js`, and `tests/dom_tests/dom_tests.js` isolate algorithms and DOM edge cases; Playwright should cover the installed-extension boundary and real Chromium event/focus behavior.

## Implementation takeaways

For a Vim-like extension, the high-value design choices are: discover broadly but reject hidden/covered rectangles; recurse through open Shadow DOM both during enumeration and hit-testing; keep overlays outside target elements and style-isolated; generate a prefix-free hint set rather than assigning arbitrary strings; model mappings as a nested trie with explicit partial-command state; put complex UI in an isolated iframe; and test through a persistent MV3 Chromium profile with real pages and service-worker-aware fixtures.
