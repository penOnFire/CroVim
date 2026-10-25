import { validateSettings } from './settings-schema';
import type { Request } from './messages';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function assertValidSettings(value: unknown): void {
  const errors = validateSettings(value);
  if (errors.length) throw new Error(errors.join('; '));
}

export function validateRequest(value: unknown): Request {
  if (!isRecord(value) || typeof value.requestId !== 'string' || typeof value.type !== 'string') {
    throw new Error('Malformed RPC request');
  }
  return value as unknown as Request;
}

export function validMarkKey(key: unknown): key is string {
  return typeof key === 'string' && /^[A-Za-z0-9`']$/.test(key);
}
