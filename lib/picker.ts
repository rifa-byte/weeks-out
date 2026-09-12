/**
 * Tiny bridge so a screen can open the exercise picker route and get the chosen id back.
 * Expo Router params are strings only, so callbacks live here keyed by a request id.
 */
import type { Lift } from './math';
import type { Tag } from './exercises';

export interface PickRequest {
  parent?: Lift | null;
  tag?: Tag | null;
  title?: string;
  allowCustom?: boolean;
}

const callbacks = new Map<string, (exerciseId: string) => void>();
const requests = new Map<string, PickRequest>();
let n = 0;

export function registerPick(req: PickRequest, cb: (exerciseId: string) => void): string {
  const key = `pick-${++n}`;
  callbacks.set(key, cb);
  requests.set(key, req);
  return key;
}

export function pickRequest(key: string): PickRequest {
  return requests.get(key) ?? {};
}

export function resolvePick(key: string, exerciseId: string) {
  const cb = callbacks.get(key);
  callbacks.delete(key);
  requests.delete(key);
  cb?.(exerciseId);
}

export function cancelPick(key: string) {
  callbacks.delete(key);
  requests.delete(key);
}
