import { create, current } from './tab-commands';

export function supportedUrl(url: string): boolean {
  return /^(https?:|file:|chrome:\/\/newtab\/)/i.test(url);
}
export function hierarchyUrl(value: string, root: boolean): string {
  const url = new URL(value); url.hash = ''; url.search = '';
  if (root) url.pathname = '/';
  else {
    const parts = url.pathname.split('/').filter(Boolean);
    parts.pop();
    url.pathname = parts.length ? `/${parts.join('/')}/` : '/';
  }
  return url.toString();
}
export async function open(url: string, active = true): Promise<unknown> {
  if (!supportedUrl(url)) throw new Error('Unsupported URL');
  const tab = await current();
  return active && tab ? chrome.tabs.update(tab.id, { url, active: true }) : create(url, active);
}
export async function reload(hard = false): Promise<void> {
  const tab = await current(); if (!tab) throw new Error('No active tab');
  await chrome.tabs.reload(tab.id, { bypassCache: hard });
}
export async function moveToWindow(windowId: number): Promise<unknown> {
  const tab = await current(); if (!tab) throw new Error('No current tab');
  return chrome.tabs.move(tab.id, { windowId, index: -1 });
}
export async function hierarchy(root: boolean): Promise<unknown> {
  const tab = await current(); if (!tab?.url) throw new Error('No current URL');
  return open(hierarchyUrl(tab.url, root));
}
