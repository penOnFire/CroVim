import { sendRpc } from '../../shared/rpc';
import type { Settings, TabInfo } from '../../shared/types';
import './popup.css';

const text = (selector: string, value: string) => { const element = document.querySelector(selector); if (element) element.textContent = value; };
const open = (path: string) => {
  const url = typeof chrome !== 'undefined' ? chrome.runtime.getURL(path) : path;
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) void chrome.tabs.create({ url });
  else window.open(url, '_blank');
};
void Promise.all([sendRpc<Settings>('settings.get'), sendRpc<TabInfo | null>('tabs.getCurrent')]).then(([settings, tab]) => {
  text('#status', tab?.url ? 'CroVim is active on this tab' : 'No supported page is active');
  text('#tab-title', tab?.title || tab?.url || 'Open a web page to start moving.');
  text('#mode', `${settings.scrollStep}px ${settings.smoothScroll ? 'smooth' : 'direct'}`);
  text('#theme', settings.theme);
}).catch(() => { text('#status', 'CroVim is unavailable'); text('#tab-title', 'Reload the extension and try again.'); });
document.querySelector('#open-options')?.addEventListener('click', () => {
  if (typeof chrome !== 'undefined' && chrome.runtime.openOptionsPage) void chrome.runtime.openOptionsPage();
  else open('options.html');
});
document.querySelector('#open-vomnibar')?.addEventListener('click', () => open('vomnibar.html'));
document.querySelector('#show-help')?.addEventListener('click', () => open('help-dialog.html'));
