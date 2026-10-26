import type { Request, RpcResponse } from './messages';
import { RPC_TIMEOUT } from './constants';

export function sendRpc<T = unknown>(type: Request['type'], payload?: unknown, timeout = RPC_TIMEOUT): Promise<T> {
  return new Promise((resolve, reject) => {
    const api = typeof chrome !== 'undefined' && chrome.runtime ? chrome : (typeof (globalThis as any).browser !== 'undefined' ? (globalThis as any).browser : undefined);
    if (!api?.runtime?.sendMessage) { reject(new Error('Extension runtime unavailable')); return; }
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => reject(new Error(`RPC timeout: ${type}`)), timeout);
    api.runtime.sendMessage({ requestId, type, payload }, (response: RpcResponse<T> | undefined) => {
      clearTimeout(timer);
      const lastError = api.runtime?.lastError;
      if (lastError) { reject(new Error(lastError.message)); return; }
      if (!response) { reject(new Error('Empty RPC response')); return; }
      if (response.ok) resolve(response.value);
      else reject(Object.assign(new Error(response.error.message), { code: response.error.code }));
    });
  });
}
