import type { MarkRecord, Settings, TabInfo } from './types';

export type Request =
  | { requestId: string; type: 'settings.get' | 'settings.reset'; payload?: undefined }
  | { requestId: string; type: 'settings.update'; payload: Partial<Settings> }
  | { requestId: string; type: 'tabs.getCurrent' | 'tabs.list' | 'tabs.next' | 'tabs.previous' | 'tabs.first' | 'tabs.last' | 'tabs.visitPrevious' | 'tabs.restore' | 'tabs.pin' | 'tabs.mute'; payload?: { tabId?: number; value?: boolean } }
  | { requestId: string; type: 'tabs.create' | 'tabs.duplicate' | 'tabs.close' | 'tabs.moveOrder' | 'tabs.move'; payload?: { url?: string; active?: boolean; tabId?: number; delta?: number; index?: number } }
  | { requestId: string; type: 'url.open'; payload: { url: string; active?: boolean } }
  | { requestId: string; type: 'url.goUp' | 'url.goRoot' | 'url.reload' | 'url.moveToWindow'; payload?: { hard?: boolean; windowId?: number } }
  | { requestId: string; type: 'omnibar.complete'; payload: { query: string; completer?: 'omni' | 'tab' | 'history' | 'bookmark' } }
  | { requestId: string; type: 'omnibar.open'; payload?: { query?: string } }
  | { requestId: string; type: 'marks.get' | 'marks.goto'; payload?: { key?: string } }
  | { requestId: string; type: 'marks.set'; payload: { key: string; record: MarkRecord } }
  | { requestId: string; type: 'content.registerFrame' | 'content.restoreMarkPosition'; payload?: { key?: string; x?: number; y?: number } }
  | { requestId: string; type: 'clipboard.write'; payload: { text: string } };

export type RpcResponse<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; retryable?: boolean } };

export type RpcValues = {
  settings: Settings; tabs: TabInfo[]; tab: TabInfo | null;
  marks: Record<string, MarkRecord>; results: unknown[]; void: void;
};
