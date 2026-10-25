async function injectIntoOpenTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  await Promise.all(tabs.flatMap((tab) => tab.id === undefined ? [] : [
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content-script.js'] }).catch(() => undefined),
  ]));
}

export function initLifecycle(): void {
  chrome.runtime.onInstalled.addListener(() => {
    void chrome.storage.local.set({ schemaVersion: 1 });
    void injectIntoOpenTabs();
  });
  chrome.runtime.onStartup.addListener(() => void injectIntoOpenTabs());
}
