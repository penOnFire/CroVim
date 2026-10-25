import { loadSettings, resetSettings, saveSettings } from '../shared/settings-store';
import { validateRequest, validMarkKey } from '../shared/validation';
import { current, list, move, first, last, moveOrder, moveToIndex, togglePin, toggleMute, create, close, duplicate, restore } from './tab-commands';
import * as urls from './url-commands';
import * as marks from './global-marks';
import { previous } from './mru-tab-tracker';
import { complete } from './vomnibar-search';

export async function route(raw: unknown): Promise<unknown> {
  const message = validateRequest(raw);
  switch (message.type) {
    case 'settings.get': return loadSettings();
    case 'settings.update': return saveSettings(message.payload);
    case 'settings.reset': return resetSettings();
    case 'tabs.getCurrent': return current();
    case 'tabs.list': return list();
    case 'tabs.next': return move(1);
    case 'tabs.previous': return move(-1);
    case 'tabs.visitPrevious': return previous();
    case 'tabs.create': return create(message.payload?.url, message.payload?.active ?? true);
    case 'tabs.close': return close(message.payload?.tabId);
    case 'tabs.duplicate': return duplicate(message.payload?.tabId);
    case 'tabs.restore': return restore();
    case 'tabs.first': return first();
    case 'tabs.last': return last();
    case 'tabs.moveOrder': return moveOrder(message.payload?.delta ?? 0);
    case 'tabs.move': return moveToIndex(message.payload?.index ?? 0, message.payload?.tabId);
    case 'tabs.pin': return togglePin(message.payload?.tabId, message.payload?.value);
    case 'tabs.mute': return toggleMute(message.payload?.tabId, message.payload?.value);
    case 'url.open': return urls.open(message.payload.url, message.payload.active ?? true);
    case 'url.goUp': return urls.hierarchy(false);
    case 'url.goRoot': return urls.hierarchy(true);
    case 'url.reload': return urls.reload(message.payload?.hard ?? false);
    case 'url.moveToWindow':
      if (message.payload?.windowId === undefined) throw new Error('Window ID is required');
      return urls.moveToWindow(message.payload.windowId);
    case 'omnibar.complete': return complete(message.payload.query);
    case 'omnibar.open': return true;
    case 'marks.get': return marks.get();
    case 'marks.set':
      if (!validMarkKey(message.payload.key)) throw new Error('Invalid mark key');
      return marks.set(message.payload.key, message.payload.record);
    case 'marks.goto':
      if (!validMarkKey(message.payload?.key)) throw new Error('Invalid mark key');
      return (await marks.get())[message.payload.key] ?? null;
    case 'clipboard.write': return true;
    case 'content.registerFrame':
    case 'content.restoreMarkPosition':
      return true;
  }
}
