import { defaults, migrateSettings, normalizeSettings } from './settings-schema';
import { assertValidSettings } from './validation';
import type { Settings } from './types';

const key = 'settings';

export async function loadSettings(): Promise<Settings> {
  if (typeof chrome === 'undefined') return defaults();
  const [managed, sync, local] = await Promise.all([
    chrome.storage.managed.get(key).catch(() => ({})),
    chrome.storage.sync.get(key),
    chrome.storage.local.get(key),
  ]);
  const source = (managed as Record<string, unknown>)[key] ?? (sync as Record<string, unknown>)[key] ?? (local as Record<string, unknown>)[key];
  return migrateSettings(source);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = normalizeSettings({ ...(await loadSettings()), ...patch });
  assertValidSettings(next);
  await chrome.storage.sync.set({ [key]: next });
  return next;
}

export async function resetSettings(): Promise<Settings> {
  const next = defaults();
  await chrome.storage.sync.set({ [key]: next });
  return next;
}

export function splitStorage(settings: Settings): { sync: Partial<Settings>; local: Partial<Settings> } {
  const { keyMappings, excludedPatterns, searchEngines, ...small } = settings;
  return { sync: small, local: { keyMappings, excludedPatterns, searchEngines } };
}
