const STORAGE_KEY = 'crovimMru';
let mru: number[] = [];
let hydrated = false;

const getStorage = () => (typeof chrome !== 'undefined' && chrome.storage) ? (chrome.storage.session ?? chrome.storage.local) : null;

const persist = (): void => {
  const store = getStorage();
  if (store) void store.set({ [STORAGE_KEY]: mru.slice(0, 50) }).catch?.(() => undefined);
};

const touch = (id: number): void => {
  mru = [id, ...mru.filter((candidate) => candidate !== id)].slice(0, 50);
  persist();
};

export function init(): void {
  const store = getStorage();
  if (store) {
    void store.get(STORAGE_KEY).then((value: Record<string, unknown>) => {
      const saved = value?.[STORAGE_KEY];
      mru = Array.isArray(saved) ? saved.filter((id): id is number => typeof id === 'number') : [];
      hydrated = true;
    }).catch?.(() => {
      hydrated = true;
    });
  } else {
    hydrated = true;
  }

  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.onActivated?.addListener?.(({ tabId }) => touch(tabId));
    chrome.tabs.onRemoved?.addListener?.((tabId) => {
      mru = mru.filter((id) => id !== tabId);
      persist();
    });
  }

  if (typeof chrome !== 'undefined' && chrome.windows) {
    chrome.windows.onFocusChanged?.addListener?.(() => {
      void chrome.tabs.query({ active: true, lastFocusedWindow: true }).then((tabs) => {
        if (tabs[0]?.id !== undefined) touch(tabs[0].id);
      }).catch?.(() => undefined);
    });
  }
}

export async function previous(): Promise<chrome.tabs.Tab | null> {
  const store = getStorage();
  if (!hydrated && store) {
    try {
      const value = await store.get(STORAGE_KEY);
      const saved = (value as Record<string, unknown>)?.[STORAGE_KEY];
      mru = Array.isArray(saved) ? saved.filter((id): id is number => typeof id === 'number') : [];
    } catch {
      // Fallback silently if storage read fails
    }
    hydrated = true;
  }
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const valid = new Set(tabs.flatMap((tab) => tab.id === undefined ? [] : [tab.id]));
  mru = mru.filter((id) => valid.has(id));
  persist();
  const current = tabs.find((tab) => tab.active)?.id;
  const target = mru.find((id) => id !== current);
  return target === undefined ? null : chrome.tabs.update(target, { active: true });
}
