const STORAGE_KEY = 'crovimMru';
let mru: number[] = [];
let hydrated = false;
const persist = (): void => { void chrome.storage.session.set({ [STORAGE_KEY]: mru.slice(0, 50) }); };
const touch = (id: number): void => { mru = [id, ...mru.filter((candidate) => candidate !== id)].slice(0, 50); persist(); };

export function init(): void {
  void chrome.storage.session.get(STORAGE_KEY).then((value) => {
    const saved = value[STORAGE_KEY];
    mru = Array.isArray(saved) ? saved.filter((id): id is number => typeof id === 'number') : [];
    hydrated = true;
  });
  chrome.tabs.onActivated.addListener(({ tabId }) => touch(tabId));
  chrome.tabs.onRemoved.addListener((tabId) => { mru = mru.filter((id) => id !== tabId); persist(); });
  chrome.windows.onFocusChanged.addListener(() => { void chrome.tabs.query({ active: true, lastFocusedWindow: true }).then((tabs) => { if (tabs[0]?.id !== undefined) touch(tabs[0].id); }); });
}

export async function previous(): Promise<chrome.tabs.Tab | null> {
  if (!hydrated) {
    const value = await chrome.storage.session.get(STORAGE_KEY);
    const saved = value[STORAGE_KEY]; mru = Array.isArray(saved) ? saved.filter((id): id is number => typeof id === 'number') : []; hydrated = true;
  }
  const tabs = await chrome.tabs.query({ currentWindow: true }); const valid = new Set(tabs.flatMap((tab) => tab.id === undefined ? [] : [tab.id]));
  mru = mru.filter((id) => valid.has(id)); persist();
  const current = tabs.find((tab) => tab.active)?.id; const target = mru.find((id) => id !== current);
  return target === undefined ? null : chrome.tabs.update(target, { active: true });
}
