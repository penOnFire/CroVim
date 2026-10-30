import { loadSettings } from '../shared/settings-store';
import { CommandTrie } from './command-trie';
import { KeyEventPipeline } from './key-event-pipeline';
import { ModeManager } from './mode-manager';
import { SmoothScroller } from './smooth-scroller';
import { dispatcher } from './command-dispatcher';
import { HudComponent } from './hud-component';
import { UiRoot } from './ui-root';
import { LinkHintsMode } from './link-hints/link-hints-mode';
import { activate } from './link-hints/activation';
import { discoverScrollable } from './link-hints/hint-discovery';
import { FindMode } from './find/find-mode';
import { showHelp } from './help-dialog';
import { openVomnibar } from './vomnibar/vomnibar-overlay';

type CrovimWindow = Window & {
  __CROVIM_INITIALIZED__?: boolean;
  __CROVIM_CLEANUP__?: () => void;
  __CROVIM_GEN__?: number;
};
const win = window as CrovimWindow;
win.__CROVIM_CLEANUP__?.();
if (win.__CROVIM_INITIALIZED__) {
  delete win.__CROVIM_INITIALIZED__;
  location.reload();
} else {
  const gen = (win.__CROVIM_GEN__ = (win.__CROVIM_GEN__ ?? 0) + 1);
  void loadSettings().then((settings) => {
    if (win.__CROVIM_GEN__ !== gen) return;
    win.__CROVIM_CLEANUP__?.();
    if (settings.excludedPatterns.some((p) => {
      try { return new RegExp(p).test(location.href); } catch { return location.href.includes(p); }
    })) return;
    const ac = new AbortController();
    const { signal } = ac;
    const bus = new EventTarget();
    const modes = new ModeManager(); const ui = new UiRoot(); const hud = new HudComponent(ui.shadow);
    const scroller = new SmoothScroller(settings.smoothScroll); const find = new FindMode();
    const run = dispatcher(scroller, bus);
    const pipeline = new KeyEventPipeline(modes, new CommandTrie(settings.keyMappings), (command, count) => {
      void run(command, count).catch((error: unknown) => hud.show(error instanceof Error ? error.message : 'Command failed'));
    }, bus, settings.passKeys);
    win.__CROVIM_CLEANUP__ = () => {
      ac.abort();
      modes.exit();
      pipeline.destroy();
      ui.host.remove();
    };
    bus.addEventListener('crovim:insert', () => {
      modes.enter('insert');
      hud.show('Insert mode');
    }, { signal });
    bus.addEventListener('crovim:hints', (event) => {
      const mode = (event as CustomEvent<{ mode?: 'currTab' | 'newTab' | 'yank' | 'hover' }>).detail?.mode ?? 'currTab';
      if (mode === 'hover') {
        hud.show('Hover mode: select element to hover');
      }
      modes.enter('link-hints');
      const hints = new LinkHintsMode(
        ui.shadow,
        settings.hintCharacters,
        mode,
        () => {
          if (modes.mode === 'link-hints') modes.exit();
        },
        undefined,
        mode === 'hover'
          ? (target) => {
              if (modes.mode === 'link-hints') modes.exit();
              activate(target, 'hover');
              hud.show('Hovered — press Shift+F to select reaction');
            }
          : undefined,
      );
      modes.onCleanup('link-hints', () => hints.close());
    }, { signal });
    bus.addEventListener('crovim:select-scroll', () => {
      const scrollables = discoverScrollable();
      if (scrollables.length === 0) {
        hud.show('No scrollable containers found');
        return;
      }
      modes.enter('link-hints');
      const hints = new LinkHintsMode(
        ui.shadow,
        settings.hintCharacters,
        'currTab',
        () => {
          if (modes.mode === 'link-hints') modes.exit();
        },
        scrollables,
        (selectedEl) => {
          if (modes.mode === 'link-hints') modes.exit();
          const target = (selectedEl === document.documentElement || selectedEl === document.body) ? window : selectedEl;
          scroller.setExplicitTarget(target);
          if (target instanceof HTMLElement) {
            const prevOutline = target.style.outline;
            const prevTransition = target.style.transition;
            target.style.transition = 'outline 0.2s ease';
            target.style.outline = '3px solid #22c55e';
            setTimeout(() => {
              target.style.outline = prevOutline;
              target.style.transition = prevTransition;
            }, 1200);
            const name = target.getAttribute('aria-label')
              || target.id
              || target.className.toString().split(' ')[0]
              || target.tagName.toLowerCase();
            hud.show(`Scroll target: <${name}>`);
          } else {
            hud.show('Scroll target: Window');
          }
        },
      );
      modes.onCleanup('link-hints', () => hints.close());
    }, { signal });
    window.addEventListener('pointermove', (event) => {
      scroller.setLastPointer(event.clientX, event.clientY);
    }, { signal, passive: true });
    bus.addEventListener('crovim:find', () => {
      modes.enter('find');
      modes.onCleanup('find', () => hud.closeFind());
      hud.openFind(find.query, {
        input: (query) => hud.updateFindCount(find.search(query, settings.findRegex, settings.findSmartCase), find.matches.length),
        commit: () => { hud.closeFind(); if (modes.mode === 'find') modes.exit(); },
        cancel: () => { hud.closeFind(); if (modes.mode === 'find') modes.exit(); },
        next: (backward) => {
          const range = find.next(backward);
          if (range) hud.updateFindCount(find.currentIndex(), find.matches.length);
        },
      });
    }, { signal });
    const cycleFind = (backward: boolean): void => {
      const range = find.next(backward);
      if (range) hud.updateFindCount(find.currentIndex(), find.matches.length);
    };
    bus.addEventListener('crovim:find-next', () => cycleFind(false), { signal });
    bus.addEventListener('crovim:find-previous', () => cycleFind(true), { signal });
    bus.addEventListener('crovim:help', () => {
      modes.enter('help'); const dialog = showHelp(ui.shadow, settings.keyMappings);
      modes.onCleanup('help', () => { if (dialog.open) dialog.close(); });
      dialog.addEventListener('close', () => { if (modes.mode === 'help') modes.exit(); }, { once: true });
    }, { signal });
    bus.addEventListener('crovim:toast', (event) => hud.show((event as CustomEvent<string>).detail), { signal });
    bus.addEventListener('crovim:vomnibar', (event) => {
      modes.enter('vomnibar');
      const mode = (event as CustomEvent<{ mode?: 'new' | 'current' }>).detail?.mode ?? 'new';
      const frame = openVomnibar(ui.shadow, mode, bus);
      frame.addEventListener('load', () => frame.contentWindow?.postMessage({ type: 'crovim:open', mode }, '*'));
    }, { signal });
    bus.addEventListener('crovim:vomnibar-close', () => { if (modes.mode === 'vomnibar') modes.exit(); }, { signal });
  });
}
