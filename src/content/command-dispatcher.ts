import { sendRpc } from '../shared/rpc';
import { SmoothScroller } from './smooth-scroller';
export function dispatcher(scroll: SmoothScroller, bus: EventTarget = document) {
  return async (command: string, count: number): Promise<void> => {
    switch (command) {
      case 'scrollDown': scroll.scroll(100 * count); break;
      case 'scrollUp': scroll.scroll(-100 * count); break;
      case 'scrollLeft': scroll.scroll(0, -100 * count); break;
      case 'scrollRight': scroll.scroll(0, 100 * count); break;
      case 'halfPageDown': scroll.scroll(innerHeight / 2 * count); break;
      case 'halfPageUp': scroll.scroll(-innerHeight / 2 * count); break;
      case 'scrollTop': scroll.scrollToEdge('top'); break;
      case 'scrollBottom': scroll.scrollToEdge('bottom'); break;
      case 'scrollLeftEdge': scroll.scrollToEdge('left'); break;
      case 'scrollRightEdge': scroll.scrollToEdge('right'); break;
      case 'nextTab': await sendRpc('tabs.next'); break;
      case 'previousTab': await sendRpc('tabs.previous'); break;
      case 'firstTab': await sendRpc('tabs.first'); break;
      case 'lastTab': await sendRpc('tabs.last'); break;
      case 'moveTabLeft': await sendRpc('tabs.moveOrder', { delta: -count }); break;
      case 'moveTabRight': await sendRpc('tabs.moveOrder', { delta: count }); break;
      case 'togglePin': await sendRpc('tabs.pin'); break;
      case 'toggleMute': await sendRpc('tabs.mute'); break;
      case 'newTab': await sendRpc('tabs.create'); break;
      case 'newTabBackground': await sendRpc('tabs.create', { active: false }); break;
      case 'closeTab': await sendRpc('tabs.close'); break;
      case 'restoreTab': await sendRpc('tabs.restore'); break;
      case 'reload': await sendRpc('url.reload'); break;
      case 'hardReload': await sendRpc('url.reload', { hard: true }); break;
      case 'goUp': await sendRpc('url.goUp'); break;
      case 'goRoot': await sendRpc('url.goRoot'); break;
      case 'visitPrevious': await sendRpc('tabs.visitPrevious'); break;
      case 'help': bus.dispatchEvent(new CustomEvent('crovim:help')); break;
      case 'find': bus.dispatchEvent(new CustomEvent('crovim:find')); break;
      case 'findNext': bus.dispatchEvent(new CustomEvent('crovim:find-next')); break;
      case 'findPrevious': bus.dispatchEvent(new CustomEvent('crovim:find-previous')); break;
      case 'selectScroll': bus.dispatchEvent(new CustomEvent('crovim:select-scroll')); break;
      case 'enterHints': bus.dispatchEvent(new CustomEvent('crovim:hints', { detail: { mode: 'currTab' } })); break;
      case 'enterHintsNewTab': bus.dispatchEvent(new CustomEvent('crovim:hints', { detail: { mode: 'newTab' } })); break;
      case 'yankHint': bus.dispatchEvent(new CustomEvent('crovim:hints', { detail: { mode: 'yank' } })); break;
      case 'hoverHint': bus.dispatchEvent(new CustomEvent('crovim:hints', { detail: { mode: 'hover' } })); break;
      case 'visual': bus.dispatchEvent(new CustomEvent('crovim:visual')); break;
      case 'visualLine': bus.dispatchEvent(new CustomEvent('crovim:visual-line')); break;
      case 'insert': bus.dispatchEvent(new CustomEvent('crovim:insert')); break;
      case 'vomnibar': bus.dispatchEvent(new CustomEvent('crovim:vomnibar', { detail: { mode: 'new' } })); break;
      case 'vomnibarCurrent': bus.dispatchEvent(new CustomEvent('crovim:vomnibar', { detail: { mode: 'current' } })); break;
      case 'yankUrl': {
        const url = location.href;
        try { await navigator.clipboard.writeText(url); } catch { await sendRpc('clipboard.write', { text: url }); }
        bus.dispatchEvent(new CustomEvent('crovim:toast', { detail: `Yanked ${url}` }));
        break;
      }
      case 'focusInput': {
        const input = [...document.querySelectorAll<HTMLElement>('input, textarea, [contenteditable="true"]')]
          .find((element) => element.offsetWidth > 0 && element.offsetHeight > 0);
        input?.focus();
        break;
      }
      case 'yankTitle': {
        const text = `${document.title} ${location.href}`;
        try { await navigator.clipboard.writeText(text); } catch { await sendRpc('clipboard.write', { text }); }
        break;
      }
      case 'previousPage': history.back(); break;
      case 'nextPage': history.forward(); break;
    }
  };
}
