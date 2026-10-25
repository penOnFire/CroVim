# CroVim Technical Specification: Chrome Manifest V3 Architecture & Background Service Worker

## 1. Chrome Manifest V3 Architecture

### 1.1 `manifest.json` Structure & Permissions Matrix

A keyboard navigation extension like Vimium requires broad host access and specific browser APIs to intercept keystrokes early, manipulate tabs/windows/sessions, query browsing data for the Vomnibar, and interact with the system clipboard.

```json
{
  "manifest_version": 3,
  "name": "CroVim",
  "version": "1.0.0",
  "description": "The Hacker's Browser — Vim-style keyboard navigation and control for Chrome.",
  "minimum_chrome_version": "116",
  "permissions": [
    "tabs",
    "storage",
    "bookmarks",
    "history",
    "search",
    "sessions",
    "scripting",
    "offscreen",
    "clipboardRead",
    "clipboardWrite"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "dist/background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["dist/content.js"],
      "css": ["dist/content.css"],
      "run_at": "document_start",
      "all_frames": true,
      "match_about_blank": true,
      "match_origin_as_fallback": true
    }
  ],
  "action": {
    "default_popup": "pages/popup.html",
    "default_title": "CroVim"
  },
  "options_ui": {
    "page": "pages/options.html",
    "open_in_tab": true
  },
  "web_accessible_resources": [
    {
      "resources": [
        "pages/vomnibar.html",
        "pages/help_dialog.html",
        "dist/*.css"
      ],
      "matches": ["<all_urls>"]
    }
  ],
  "commands": {
    "createTab": {
      "description": "Create a new tab (usable on restricted chrome:// pages)"
    },
    "nextTab": {
      "description": "Go one tab right"
    },
    "previousTab": {
      "description": "Go one tab left"
    }
  }
}
```

### 1.2 Service Worker Lifecycle & Two-Tier State Architecture
- Top-level event listener registration in `background/index.ts`.
- Hybrid in-memory + `chrome.storage.session` (MRU tabs, marks, find query, frame registry) + `chrome.storage.sync`/`local` (user settings, custom keymappings, exclusion rules, search engines).
- Hybrid `chrome.runtime.sendMessage` RPC + `chrome.runtime.connect` ports.

### 1.3 Background Commands
- Tab operations: `nextTab` (`J`/`gt`), `previousTab` (`K`/`gT`), `firstTab` (`g0`), `lastTab` (`g$`), `createTab` (`t`), `removeTab` (`x`), `restoreTab` (`X`), `duplicateTab` (`yt`), `togglePinTab` (`Alt+p`), `toggleMuteTab` (`Alt+m`), `moveTabLeft` (`<<`), `moveTabRight` (`>>`), `visitPreviousTab` (`^`).
- URL & Window operations: `openUrlInCurrentTab`, `openUrlInNewTab`, `moveTabToNewWindow` (`W`), `goUpUrl` (`gu`), `goToRootUrl` (`gU`), `reloadTab` (`r`), `reloadTabHard` (`R`).
- Vomnibar Engine: Queries Open Tabs, Bookmarks, History, and Custom Search Engines with multi-token smart-case fuzzy/word-boundary matching, highlight span computation, frecency scoring, and URL deduplication.
