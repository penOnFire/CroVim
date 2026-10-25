# Chrome MV3 and Build Tooling Research

**Project:** CroVim, a Vimium-like keyboard navigation extension  
**Research date:** 2026-10-25  
**Scope:** Manifest V3 architecture, service-worker messaging, `tabs`/`bookmarks`/`history`/`sessions`/`storage`, and Vite/esbuild multi-entry builds.

## Local environment snapshot

The repository currently contains no application files or package manifest. The installed tools are:

| Tool | Version |
| --- | --- |
| Node.js | `v24.21.0` |
| npm | `11.19.0` |
| Chromium | `155.0.8059.79` (Debian GNU/Linux 13) |

These versions are suitable for current MV3 development. They are an environment snapshot, not a proposed minimum browser version for distribution.

## Recommended CroVim architecture

CroVim should be split into isolated extension contexts with explicit responsibilities:

```text
web page
  └─ content script: keyboard handling, hints, scrolling, DOM overlays
       └─ runtime/tabs messages
service worker: commands, tab/window operations, bookmarks/history/sessions,
                persistence, action/context-menu events
extension pages: options, popup, help/new-tab UI (if needed)
storage: settings and durable state
```

The content script is the latency-sensitive part of a Vimium-like product. It owns page DOM interaction and should not expect access to privileged APIs. The service worker is the privileged, event-driven coordinator. Extension pages are short-lived UI clients and should communicate with the service worker rather than duplicate browser API logic.

This separation also limits permissions and makes failures explicit: a content script can request “open this URL” or “search history,” while only the service worker decides whether and how to call the corresponding Chrome API.

## Manifest V3 architecture

Every extension has a root `manifest.json`; Manifest V3 is the supported manifest version. A minimal CroVim manifest will likely contain:

```json
{
  "manifest_version": 3,
  "name": "CroVim",
  "version": "0.1.0",
  "description": "Vim-like keyboard navigation for Chrome",
  "background": {
    "service_worker": "service-worker.js",
    "type": "module"
  },
  "action": {
    "default_title": "CroVim"
  },
  "permissions": ["storage"],
  "content_scripts": [
    {
      "matches": ["https://*/*", "http://*/*"],
      "js": ["content-script.js"],
      "css": ["content-script.css"],
      "run_at": "document_idle"
    }
  ]
}
```

The final permission and match-pattern set should be narrower if CroVim can support `activeTab` or optional host permissions. `content_scripts.matches` declares automatic injection hosts; `host_permissions` grants host access to APIs such as sensitive tab fields, programmatic injection, and extension-origin `fetch()`. `activeTab` is a useful lower-warning alternative for user-invoked operations on the current page, but it does not provide always-on content-script injection.

Useful manifest surfaces:

- `background.service_worker`: the event handler for extension events.
- `background.type: "module"`: permits ES module imports in the service worker.
- `content_scripts`: static page injection; scripts run in an isolated world by default.
- `action`: toolbar entry point, optional popup, title, icon, and badge.
- `commands`: declarative keyboard shortcuts for commands Chrome can own.
- `options_page` or `options_ui`: persistent settings UI.
- `host_permissions` / `optional_host_permissions`: host access, preferably least-privilege or user-granted at runtime.
- `minimum_chrome_version`: set this only when CroVim depends on a specific API or lifecycle behavior.

Chrome’s permission guidance recommends optional permissions where functionality permits. `bookmarks`, `history`, and `sessions` are user-sensitive and should not be requested merely for a future feature. Consider requesting them only when the related CroVim command is enabled or first used.

### Content scripts

Content scripts can read and modify the page DOM and directly use only a limited extension surface, including `storage`, `runtime.sendMessage()`, `runtime.connect()`, and runtime metadata. They cannot directly call `tabs`, `bookmarks`, `history`, or `sessions`; they must message another extension context.

Static content scripts require `matches` plus `js` and/or `css`. The default `run_at` is `document_idle`, and the default execution world is `ISOLATED`, which prevents JavaScript global collisions with the page. Use `all_frames` only when frame navigation is deliberately supported. `MAIN` world execution should be avoided unless page-world interop is essential because it loses the isolation boundary.

Chrome will not inject into restricted pages such as Chrome Web Store pages and some `chrome://` pages. CroVim should treat injection failure as a normal unsupported-page state, not as a fatal extension error.

## Service-worker lifecycle and design rules

An extension service worker is not a persistent background page. Chrome can terminate it after about 30 seconds of inactivity, after a single event/API request exceeds five minutes, or when a `fetch()` response takes more than 30 seconds. An incoming event can start it again.

Installation ordering is:

1. service-worker `install`
2. `runtime.onInstalled`
3. service-worker `activate`

Use `runtime.onInstalled` for one-time initialization, migrations, and context-menu creation. `runtime.onStartup` fires when the profile starts, but does not itself invoke standard service-worker lifecycle events.

Implications for CroVim:

- Never rely on module globals as durable state. They disappear on worker shutdown.
- Persist settings and migration versions in `chrome.storage`.
- Register event listeners at module top level, synchronously and unconditionally, so Chrome can dispatch events after waking the worker.
- Treat every event handler as independently restartable and idempotent.
- Keep event work bounded; query APIs, update storage, and return.
- Do not use a worker-held in-memory cache as the source of truth. A cache may optimize reads but must tolerate a cold start.
- Avoid an always-open port or timer whose only purpose is keeping the worker alive.

## Message passing

Chrome provides one-time requests and long-lived ports:

- `chrome.runtime.sendMessage()` / `runtime.onMessage`: messages to the extension, commonly content script or extension page to service worker.
- `chrome.tabs.sendMessage(tabId, message)`: service worker or extension page to a content script in a tab.
- `chrome.runtime.connect()` / `runtime.onConnect`: long-lived content-script-to-extension port.
- `chrome.tabs.connect(tabId)`: long-lived extension-to-content-script port.

Messages use JSON serialization in Chrome. Send plain JSON data only: strings, numbers, booleans, arrays, and objects. Do not send DOM nodes, functions, class instances, `Map`, `Set`, or other values that do not have the intended JSON representation.

For asynchronous responses using the callback form, the listener must return the literal `true` before calling `sendResponse()` later. Current Chrome documentation also describes promise-returning listeners, with gradual rollout caveats; `return true` remains the compatibility-safe pattern for code that supports a broad Chrome range. CroVim should standardize one typed request/response envelope and one error shape, for example:

```ts
type Request =
  | { type: "tabs.getCurrent" }
  | { type: "tabs.open"; url: string; activate?: boolean }
  | { type: "history.search"; text: string; maxResults?: number };

type Response =
  | { ok: true; value: unknown }
  | { ok: false; error: { code: string; message: string } };
```

Recommended routing rules:

1. Validate `message.type` and payload fields at the service-worker boundary.
2. Check `sender.tab?.id` when a request is expected to originate from a tab.
3. Reply exactly once; only the first responding listener affects a sender.
4. Catch expected Chrome API failures and return an explicit error response.
5. Use ports for high-frequency hint/scroll state only if one-time messages become measurably expensive; disconnect handlers must clean up per-tab state.

Content-script command flow should be local-first: handle scrolling, focus, hint rendering, and DOM selection locally; message only privileged operations such as tab navigation, bookmark actions, history search, session restore, and cross-tab commands.

## Chrome APIs relevant to CroVim

All API calls below use the `chrome.*` namespace in Chrome. Promise-based forms are available in current Chrome versions; callback-compatible code may be required if supporting older versions.

### `chrome.tabs`

The Tabs API creates, updates, removes, queries, and rearranges tabs and can send messages to content scripts. Creating, navigating, reloading, and removing tabs generally do not require the `"tabs"` permission.

The `"tabs"` permission is narrower than its name suggests: it grants access to sensitive `Tab` properties such as `url`, `pendingUrl`, `title`, and `favIconUrl` when querying tabs. Matching host permissions can also unlock those properties for matching pages and enable direct interaction such as programmatic script injection. `activeTab` grants temporary access to the current tab after a user invocation without an install warning.

Likely CroVim operations:

- `tabs.query({active: true, lastFocusedWindow: true})` for the current tab.
- `tabs.update(tabId, {url, active})` for navigation.
- `tabs.create({url, active})` for opening a target in a new tab.
- `tabs.remove(tabId)` for `x`-style close commands.
- `tabs.move()` / `tabs.highlight()` for tab management.
- `tabs.sendMessage()` for a command or state update to a content script.
- `tabs.onActivated`, `tabs.onUpdated`, and `tabs.onRemoved` for per-tab lifecycle cleanup.

Do not assume a queried tab has a usable URL or a live content script. New tabs, restricted pages, prerendered pages, and navigation races can produce missing fields or rejected sends.

### `chrome.bookmarks`

The Bookmarks API reads, creates, moves, updates, and removes bookmark tree nodes. It requires the `"bookmarks"` permission. The data model is a tree: a node is either a bookmark (usually with a URL) or a folder.

Useful CroVim commands:

- bookmark the current tab with `bookmarks.create()`;
- search bookmark titles/URLs with `bookmarks.search()`;
- navigate the tree with `bookmarks.getTree()`, `getChildren()`, or `getSubTree()`;
- maintain a bookmark chooser in an extension page;
- react to changes with `onCreated`, `onRemoved`, `onChanged`, and `onMoved`.

Bookmark access exposes substantial user data. Keep it optional if bookmarking is not a core feature, and never mirror the whole tree into `storage` without a clear reason.

### `chrome.history`

The History API searches, adds, and deletes browser history and requires `"history"`. `history.search()` returns one result per matching page with fields such as URL, title, last visit time, typed count, and visit count. `history.getVisits()` returns individual visits and transition types.

For a CroVim omnibar/history command, query with a bounded `text`, `startTime`/`endTime` where appropriate, and a small `maxResults`; render only the fields needed by the UI. Deletion methods are destructive and should require an explicit command or confirmation. History is particularly sensitive: do not persist result URLs or full query logs in extension storage unless the user has opted in.

### `chrome.sessions`

The Sessions API queries and restores recently closed tabs and windows. It requires `"sessions"`. `sessions.getRecentlyClosed({maxResults})` returns up to the API limit (currently `MAX_SESSION_RESULTS` is 25), and `sessions.restore(sessionId)` reopens a selected tab/window; omitting the ID restores the most recently closed session. `sessions.getDevices()` returns synced sessions from other devices. `sessions.onChanged` signals local recently-closed changes, not synced-session changes.

This maps directly to a Vimium-like “reopen closed tab/window” command. Prefer displaying a bounded list and call `restore()` only after the user chooses an item. Session IDs are transient; query them again rather than persisting them as durable identifiers.

### `chrome.storage`

The Storage API is asynchronous, JSON-based, available to extension contexts (including service workers and content scripts), and persists independently of the browser’s normal web-cache clearing. It requires `"storage"`.

| Area | CroVim use | Important limits/behavior |
| --- | --- | --- |
| `storage.local` | settings, key mappings, per-user preferences | persistent until extension removal; 10 MB in current Chrome; request `unlimitedStorage` only for a justified larger dataset |
| `storage.sync` | small settings that should follow the signed-in user | approximately 100 KB total and 8 KB per item; sync is quota/throttle constrained |
| `storage.session` | ephemeral worker/session state and caches | in memory; cleared on disable/reload/update/browser restart; 10 MB in current Chrome |
| `storage.managed` | enterprise policy defaults | read-only and administrator-controlled |

Use `storage.sync` for small user preferences, `storage.local` for larger local settings, and `storage.session` for disposable state. Listen to `chrome.storage.onChanged` so open options pages and content scripts can react to changes. `storage.local` and `storage.sync` are exposed to content scripts by default; use `setAccessLevel()` to reduce exposure when only the service worker needs access.

Service workers cannot use `window.localStorage`. Content scripts’ web storage is the host page’s storage, not CroVim’s extension storage, so `chrome.storage` is the correct cross-context store.

## Vite and esbuild multi-entry bundling

### Vite’s role

Vite serves development HTML entries and builds production bundles. Current Vite documentation configures production bundling through Rolldown; the older `build.rollupOptions` name is deprecated in favor of `build.rolldownOptions`. Vite’s multi-page pattern uses multiple HTML inputs, while library mode accepts a string, array, or object of JavaScript entries.

CroVim is not a conventional website MPA: its service worker and content script are JavaScript entries referenced by a manifest, and its options/popup pages are HTML entries. A practical layout is:

```text
src/
  background/service-worker.ts
  content/content-script.ts
  content/content-script.css
  options/index.html
  popup/index.html
public/
  manifest.json
  icons/
vite.config.ts
```

Use Vite’s top-level multi-input configuration for extension HTML pages and a dedicated extension build configuration/plugin for non-HTML entries. The essential requirements are:

- emit stable, manifest-addressable names for `service-worker.js` and `content-script.js`;
- copy `manifest.json` and icons into the output root;
- set `base: "./"` so generated extension-page asset URLs are relative;
- avoid dev-server-only URLs or HMR code in the packed extension;
- ensure every script listed in the manifest exists in the final directory;
- inspect the output after every build, especially after changing chunking;
- keep content-script CSS as a declared file or intentionally inject it from the bundled script;
- prefer a self-contained service-worker entry unless verified chunk output is compatible with the target Chrome range.

Illustrative current-Vite configuration:

```ts
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        options: resolve(import.meta.dirname, "src/options/index.html"),
        popup: resolve(import.meta.dirname, "src/popup/index.html"),
        serviceWorker: resolve(
          import.meta.dirname,
          "src/background/service-worker.ts",
        ),
        contentScript: resolve(
          import.meta.dirname,
          "src/content/content-script.ts",
        ),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "serviceWorker") return "service-worker.js";
          if (chunk.name === "contentScript") return "content-script.js";
          return "assets/[name]-[hash].js";
        },
      },
    },
  },
});
```

The exact output-hook behavior can vary with the installed Vite/Rolldown version and plugins. Treat this as a starting shape, not a copy-paste guarantee. Verify that HTML entries, shared chunks, CSS, and manifest paths all resolve from `dist`. If the bundler emits shared chunks for a content script, either package those chunks and verify runtime loading or configure that entry to be bundled into one file. The same applies to a service worker: static module imports are supported with `"type": "module"`, but an accidentally missing relative chunk makes the worker fail at startup.

Vite’s current default browser target is based on Baseline Widely Available and is not automatically the same as CroVim’s chosen Chrome minimum. Set `build.target` explicitly when CroVim chooses a minimum Chrome version. Vite handles syntax transformation, not general polyfill injection.

### esbuild’s role

esbuild directly supports multiple `entryPoints` with bundling, an output directory, code splitting, watch mode, and incremental build contexts:

```ts
import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: {
    "service-worker": "src/background/service-worker.ts",
    "content-script": "src/content/content-script.ts",
  },
  bundle: true,
  outdir: "dist",
  format: "esm",
  platform: "browser",
  target: ["chrome120"],
  sourcemap: true,
});
```

In esbuild’s JavaScript API, `entryPoints` can be an array or an object whose keys become output names. `bundle: true` follows imports. Code splitting is available for multiple entries with ESM output, but it introduces shared chunk files and therefore more manifest/package/runtime validation. For CroVim’s two manifest-referenced scripts, a no-code-splitting, stable-name build is the safer default; use splitting only after testing reloads, worker startup, content-script injection, and Chrome’s extension CSP.

Vite uses fast transformation/pre-bundling machinery and, in current releases, Rolldown for the production bundle. esbuild is still useful as a direct lightweight builder for extension entries or as a specialized transform/minifier, but it should not be assumed to be the production bundler behind every current Vite build. Keep one ownership model: either let Vite build all entries or use a deliberate hybrid with documented output contracts.

## Proposed initial implementation choices

1. Start with Vite and TypeScript, using separate source entries for the service worker, content script, options page, and popup/help page.
2. Use `chrome.storage.sync` for compact user preferences and `chrome.storage.local` for larger local configuration; use `storage.session` for disposable per-worker state.
3. Keep `bookmarks`, `history`, and `sessions` out of the initial required permission set unless their commands ship. Add them as optional permissions if the UX can request them at first use.
4. Keep the content script privileged-API-free and define a small typed message protocol.
5. Build stable, independently testable `service-worker.js` and `content-script.js` files. Avoid shared chunks in these entries initially.
6. Add a packed-extension smoke test: load `dist` unpacked, inspect the service worker console, open ordinary HTTPS pages, exercise keyboard commands, reload the worker, and test restricted pages.
7. Choose and document a minimum Chrome version before relying on newer promise-listener behavior or service-worker lifetime improvements. The local Chromium 155 install should be treated as a development runtime, not the compatibility contract.

## Sources

All sources were consulted on 2026-10-25:

- Chrome Extensions — [Manifest file format](https://developer.chrome.com/docs/extensions/reference/manifest)
- Chrome Extensions — [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- Chrome Extensions — [Manifest `content_scripts`](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)
- Chrome Extensions — [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- Chrome Extensions — [Service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- Chrome Extensions — [Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- Chrome Extensions — [`chrome.tabs`](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- Chrome Extensions — [`chrome.bookmarks`](https://developer.chrome.com/docs/extensions/reference/api/bookmarks)
- Chrome Extensions — [`chrome.history`](https://developer.chrome.com/docs/extensions/reference/api/history)
- Chrome Extensions — [`chrome.sessions`](https://developer.chrome.com/docs/extensions/reference/api/sessions)
- Chrome Extensions — [`chrome.storage`](https://developer.chrome.com/docs/extensions/reference/api/storage)
- Chrome Extensions — [`chrome.action`](https://developer.chrome.com/docs/extensions/reference/api/action)
- Vite — [Building for production](https://vite.dev/guide/build.html)
- Vite — [Build options](https://vite.dev/config/build-options.html)
- esbuild — [API: build and entry points](https://esbuild.github.io/api/#entry-points)
