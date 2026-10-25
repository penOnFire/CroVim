import type { MarkRecord } from '../shared/types';
import { validMarkKey } from '../shared/validation';
const key = 'crovimMarks';
export async function get(): Promise<Record<string, MarkRecord>> {
  const stored = (await chrome.storage.local.get(key))[key];
  return stored && typeof stored === 'object' ? stored as Record<string, MarkRecord> : {};
}
export async function set(markKey: string, record: MarkRecord): Promise<MarkRecord> {
  if (!validMarkKey(markKey) || !record || !/^https?:/i.test(record.url)) throw new Error('Invalid mark record');
  const all = await get(); all[markKey] = { ...record, secret: record.secret || crypto.randomUUID() };
  await chrome.storage.local.set({ [key]: all }); return all[markKey]!;
}
export async function remove(markKey: string): Promise<void> {
  const all = await get(); delete all[markKey]; await chrome.storage.local.set({ [key]: all });
}
