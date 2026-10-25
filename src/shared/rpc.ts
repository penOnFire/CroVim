import type { Request, RpcResponse } from './messages';
import { RPC_TIMEOUT } from './constants';

export function sendRpc<T = unknown>(type: Request['type'], payload?: unknown, timeout = RPC_TIMEOUT): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined') { reject(new Error('Chrome runtime unavailable')); return; }
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => reject(new Error(`RPC timeout: ${type}`)), timeout);
    chrome.runtime.sendMessage({ requestId, type, payload }, (response: RpcResponse<T> | undefined) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      if (!response) { reject(new Error('Empty RPC response')); return; }
      if (response.ok) resolve(response.value);
      else reject(Object.assign(new Error(response.error.message), { code: response.error.code }));
    });
  });
}
