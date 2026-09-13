/**
 * Weeks Out — program share codes.
 *
 * A program travels as text: "WO1." + base64url(JSON). Only the shape goes (movement, sets,
 * reps, % of e1RM, RPE, note) so the receiver loads it from their own bests — except fixed
 * weights (a coach's spreadsheet), which travel as-is. Keys are shortened to keep codes pasteable.
 */
import { exerciseById } from './exercises';
import type { PlannedDay, PlannedSet, Template } from './programs';

export interface SharedTags { level?: string; goal?: string; focus?: string }

export interface SharedProgram {
  name: string;
  author?: string;
  about?: string;
  tags?: SharedTags;
  weeks: number;
  daysPerWeek: number;
  /** days in order: week 1 day 1, week 1 day 2, … */
  days: { name: string; sets: PlannedSet[] }[];
}

const PREFIX = 'WO1.';

// ---------- base64url without Buffer (works in Hermes) ----------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function utf8Encode(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    let c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return out;
}

function utf8Decode(bytes: number[]): string {
  let s = '';
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i++];
    let c: number;
    if (b < 0x80) c = b;
    else if (b < 0xe0) c = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
    else if (b < 0xf0) c = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    else c = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    s += String.fromCodePoint(c);
  }
  return s;
}

export function b64urlEncode(s: string): string {
  const bytes = utf8Encode(s);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '';
    out += i + 2 < bytes.length ? B64[n & 63] : '';
  }
  return out;
}

export function b64urlDecode(s: string): string | null {
  const bytes: number[] = [];
  let buf = 0, bits = 0;
  for (const ch of s.replace(/=+$/, '')) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((buf >> bits) & 0xff); }
  }
  try { return utf8Decode(bytes); } catch { return null; }
}

// ---------- compact JSON ----------
type CSet = { e: string; s: number; r: number; p?: number; k?: number; q?: number; n?: string };
type CDay = { n: string; s: CSet[] };
type CProgram = { v: 1; n: string; a?: string; b?: string; t?: SharedTags; w: number; d: number; days: CDay[] };

function compact(p: SharedProgram): CProgram {
  return {
    v: 1, n: p.name, a: p.author || undefined, b: p.about || undefined, t: p.tags, w: p.weeks, d: p.daysPerWeek,
    days: p.days.map(d => ({
      n: d.name,
      s: d.sets.map(s => {
        const c: CSet = { e: s.exercise, s: s.sets, r: s.reps };
        if (s.pct != null) c.p = Math.round(s.pct * 1000) / 1000;
        if (s.fixedKg != null) c.k = Math.round(s.fixedKg * 100) / 100;
        if (s.rpe != null) c.q = s.rpe;
        if (s.note) c.n = s.note;
        return c;
      }),
    })),
  };
}

function expand(c: CProgram): SharedProgram {
  return {
    name: c.n, author: c.a, about: c.b, tags: c.t, weeks: c.w, daysPerWeek: c.d,
    days: c.days.map(d => ({
      name: d.n,
      sets: d.s.map(s => ({ exercise: s.e, sets: s.s, reps: s.r, pct: s.p, fixedKg: s.k, rpe: s.q, note: s.n })),
    })),
  };
}

export function encodeProgram(p: SharedProgram): string {
  return PREFIX + b64urlEncode(JSON.stringify(compact(p)));
}

/** Parse a code (tolerates surrounding text / whitespace). Returns null if it isn't a valid program. */
export function decodeProgram(text: string): SharedProgram | null {
  const m = /WO1\.([A-Za-z0-9\-_]+)/.exec(text);
  if (!m) return null;
  const json = b64urlDecode(m[1]);
  if (!json) return null;
  try {
    const c = JSON.parse(json) as CProgram;
    if (c.v !== 1 || typeof c.n !== 'string' || !Array.isArray(c.days)) return null;
    const p = expand(c);
    if (!(p.weeks >= 1 && p.weeks <= 52 && p.daysPerWeek >= 1 && p.daysPerWeek <= 7)) return null;
    if (p.days.length !== p.weeks * p.daysPerWeek) return null;
    for (const d of p.days) for (const s of d.sets) {
      if (typeof s.exercise !== 'string' || !(s.sets >= 1) || !(s.reps >= 1)) return null;
      if (s.pct != null && !(s.pct > 0 && s.pct <= 1.5)) return null;
      if (s.fixedKg != null && !(s.fixedKg > 0 && s.fixedKg < 1000)) return null;
    }
    return p;
  } catch { return null; }
}

/** Turn a shared program into a Template the normal start flow understands. */
export function toTemplate(p: SharedProgram, id = `shared:${Date.now()}`): Template {
  return {
    id,
    name: p.name,
    weeks: p.weeks,
    daysPerWeek: p.daysPerWeek,
    who: p.author ? `By ${p.author}` : 'Shared program',
    shape: p.about ?? '',
    week: (w: number): PlannedDay[] => p.days.slice((w - 1) * p.daysPerWeek, w * p.daysPerWeek).map(d => ({ name: d.name, sets: d.sets })),
  };
}

/** An empty program the user fills in day by day. */
export function blankProgram(name: string, weeks: number, daysPerWeek: number): SharedProgram {
  const days: SharedProgram['days'] = [];
  for (let w = 1; w <= weeks; w++) for (let d = 1; d <= daysPerWeek; d++) days.push({ name: `Day ${d}`, sets: [] });
  return { name, weeks, daysPerWeek, days };
}

/** Names of movements in a shared program that this app doesn't know (custom ids still display fine). */
export function unknownExercises(p: SharedProgram): string[] {
  const out = new Set<string>();
  for (const d of p.days) for (const s of d.sets) if (!exerciseById(s.exercise) && !s.exercise.startsWith('custom:')) out.add(s.exercise);
  return [...out];
}
