import type { TabInfo } from '../shared/types';

export const toTabInfo = (tab: chrome.tabs.Tab): TabInfo => {
  const result: TabInfo = { id: tab.id ?? -1, active: !!tab.active, windowId: tab.windowId, index: tab.index };
  if (tab.title !== undefined) result.title = tab.title;
  if (tab.url !== undefined) result.url = tab.url;
  if (tab.pinned !== undefined) result.pinned = tab.pinned;
  if (tab.mutedInfo?.muted !== undefined) result.muted = tab.mutedInfo.muted;
  return result;
};
export async function current(): Promise<TabInfo | null> {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0] ? toTabInfo(tabs[0]) : null;
}
export async function list(): Promise<TabInfo[]> {
  return (await chrome.tabs.query({ currentWindow: true })).sort((a, b) => a.index - b.index).map(toTabInfo);
}
export async function move(delta: number): Promise<TabInfo | null> {
  const active = await current(); const tabs = await list();
  if (!active || !tabs.length) return null;
  const target = tabs[(active.index + delta + tabs.length) % tabs.length];
  return target ? toTabInfo(await chrome.tabs.update(target.id, { active: true })) : null;
}
export async function first(): Promise<TabInfo | null> {
  const tabs = await list(); return tabs[0] ? toTabInfo(await chrome.tabs.update(tabs[0].id, { active: true })) : null;
}
export async function last(): Promise<TabInfo | null> {
  const tabs = await list(); const tab = tabs.at(-1);
  return tab ? toTabInfo(await chrome.tabs.update(tab.id, { active: true })) : null;
}
export async function moveOrder(delta: number): Promise<TabInfo | null> {
  const active = await current(); if (!active) return null;
  const tabs = await list(); const index = Math.max(0, Math.min(tabs.length - 1, active.index + delta));
  const moved = await chrome.tabs.move(active.id, { index });
  return toTabInfo(Array.isArray(moved) ? moved[0]! : moved);
}
export async function moveToIndex(index: number, tabId?: number): Promise<TabInfo> {
  const target = tabId ?? (await current())?.id; if (target === undefined) throw new Error('No active tab');
  const moved = await chrome.tabs.move(target, { index });
  return toTabInfo(Array.isArray(moved) ? moved[0]! : moved);
}
export async function togglePin(tabId?: number, value?: boolean): Promise<TabInfo> {
  const target = tabId ?? (await current())?.id; if (target === undefined) throw new Error('No active tab');
  const tab = await chrome.tabs.get(target);
  return toTabInfo(await chrome.tabs.update(target, { pinned: value ?? !tab.pinned }));
}
export async function toggleMute(tabId?: number, value?: boolean): Promise<TabInfo> {
  const target = tabId ?? (await current())?.id; if (target === undefined) throw new Error('No active tab');
  const tab = await chrome.tabs.get(target);
  return toTabInfo(await chrome.tabs.update(target, { muted: value ?? !tab.mutedInfo?.muted }));
}
export async function create(url = 'chrome://newtab/', active = true): Promise<TabInfo> {
  return toTabInfo(await chrome.tabs.create({ url, active }));
}
export async function close(tabId?: number): Promise<void> {
  const target = tabId ?? (await current())?.id;
  if (target === undefined || target < 0) throw new Error('No active tab');
  await chrome.tabs.remove(target);
}
export async function duplicate(tabId?: number): Promise<TabInfo> {
  const target = tabId ?? (await current())?.id;
  if (target === undefined) throw new Error('No active tab');
  const duplicated = await chrome.tabs.duplicate(target);
  if (!duplicated) throw new Error('Tab could not be duplicated');
  return toTabInfo(duplicated);
}
export async function restore(): Promise<TabInfo | null> {
  const restored = await chrome.sessions.restore();
  const tab = restored.tab;
  return tab ? toTabInfo(tab) : null;
}
