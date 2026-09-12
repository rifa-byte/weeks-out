import { exerciseName } from './exercises';

export function labelFor(exercise: string) {
  return exerciseName(exercise);
}

export function mmss(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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
