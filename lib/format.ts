import { LIFT_LABEL } from './math';

export function labelFor(exercise: string) {
  return (LIFT_LABEL as Record<string, string>)[exercise] ?? exercise;
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Parse a user-typed number; accepts comma decimals. Returns null when empty/invalid. */
export function parseNum(s: string): number | null {
  const n = Number(String(s).replace(',', '.').trim());
  return s.trim() === '' || !Number.isFinite(n) ? null : n;
}
