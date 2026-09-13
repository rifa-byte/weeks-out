/**
 * Weeks Out — OpenPowerlifting inside the app.
 *
 * The data is the public-domain OpenPowerlifting bulk CSV, pre-chopped by scripts/opl-build.mjs
 * into small static JSON files (see that file for the layout). The app fetches a shard when you
 * search a name and a ladder file when you ask where you stand — no scraping, no server code.
 *
 * Attribution shown in the app: "Data from the OpenPowerlifting project, https://www.openpowerlifting.org".
 */

export const OPL_URL = (process.env.EXPO_PUBLIC_OPL_URL || 'https://raw.githubusercontent.com/rifa-byte/weeks-out/main/public/opl').replace(/\/$/, '');
export const OPL_ATTRIBUTION = 'Data from the OpenPowerlifting project, openpowerlifting.org';

export type Equip = 'raw' | 'wraps' | 'single' | 'multi';
export const EQUIP_LABEL: Record<Equip, string> = { raw: 'Raw', wraps: 'Wraps', single: 'Single-ply', multi: 'Multi-ply' };

export interface LifterEntry {
  eq: Equip; total: number; dots: number | null; gl: number | null;
  squat: number | null; bench: number | null; deadlift: number | null;
  bw: number | null; cls: string; date: string; meet: string; fed: string;
}
export interface Lifter { name: string; sex: 'M' | 'F'; country: string; meets: number; last: string; entries: LifterEntry[] }

export interface LadderTop { name: string; total: number; dots: number | null; gl: number | null; bw: number | null; date: string; meet: string }
export interface LadderMeet { meet: string; date: string; fed: string; n: number; podium: number[] }
export interface LadderCombo { n: number; min: number; step: number; counts: number[]; top: LadderTop[]; meets?: LadderMeet[] }
export type Ladder = Record<string, LadderCombo>;
export interface OplMeta { built: string; source: string; since: string; window: string; lifters: number; countries: number }

// ---------- name matching (must match scripts/opl-build.mjs) ----------

export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/#\d+$/, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
export function shardKeys(normalized: string): string[] {
  const keys = new Set<string>();
  for (const w of normalized.split(' ')) if (w.length) keys.add((w + '_').slice(0, 2).replace(/[^a-z0-9]/g, '_'));
  return [...keys];
}
/** Every query word must appear at the start of some word of the name ("tay atw" matches "Taylor Atwood"). */
export function nameMatches(normalizedName: string, query: string): boolean {
  const words = normalizedName.split(' ');
  return normalizeName(query).split(' ').filter(Boolean).every(q => words.some(w => w.startsWith(q)));
}

export function comboKey(sex: 'M' | 'F', eq: Equip, cls: string) { return `${sex}-${eq}-${cls}`; }

// ---------- ladder maths (pure) ----------

/** Share of lifters (0–100) in the ladder whose best total is at or below `total`. */
export function percentile(c: LadderCombo, total: number): number {
  if (c.n === 0) return 0;
  let below = 0;
  for (let i = 0; i < c.counts.length; i++) {
    const binTop = c.min + (i + 1) * c.step;      // exclusive upper edge
    if (binTop <= total + 1e-9) below += c.counts[i];
    else break;
  }
  return Math.round((100 * below) / c.n);
}
/** Where `total` would rank (1 = best) among the ladder's lifters. */
export function rankOf(c: LadderCombo, total: number): number {
  let above = 0;
  for (let i = 0; i < c.counts.length; i++) {
    const binLow = c.min + i * c.step;
    if (binLow > total + 1e-9) above += c.counts[i];
  }
  return above + 1;
}
/** Place `total` would have taken at a meet, from its podium totals and entry count: "1st", "2nd", "3rd", "4th+" when past the recorded podium. */
export function placeLabel(m: LadderMeet, total: number): string {
  const beaten = m.podium.filter(t => t > total).length;
  if (beaten < m.podium.length) return ordinal(beaten + 1);
  return m.n > m.podium.length ? `${ordinal(m.podium.length + 1)} or lower` : ordinal(beaten + 1);
}
export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/** Weight classes available for a sex+equipment in a ladder, sorted numerically (120+ last). */
export function classesIn(ladder: Ladder, sex: 'M' | 'F', eq: Equip): string[] {
  const prefix = `${sex}-${eq}-`;
  return Object.keys(ladder).filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length))
    .sort((a, b) => parseFloat(a) - parseFloat(b) || (a.endsWith('+') ? 1 : -1));
}

// ---------- fetching ----------

const cache = new Map<string, Promise<unknown>>();

async function getJsonUrl<T>(path: string): Promise<T> {
  const url = `${OPL_URL}/${path}`;
  if (!cache.has(url)) {
    cache.set(url, (async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`OpenPowerlifting index: ${res.status}`);
        return await res.json();
      } finally { clearTimeout(timer); }
    })().catch(e => { cache.delete(url); throw e; }));
  }
  return cache.get(url) as Promise<T>;
}

type RawEntry = [Equip, number, number | null, number | null, number | null, number | null, number | null, number | null, string, string, string, string];
type RawLifter = [string, 'M' | 'F', string, number, string, RawEntry[]];

function toLifter(r: RawLifter): Lifter {
  return {
    name: r[0], sex: r[1], country: r[2], meets: r[3], last: r[4],
    entries: r[5].map(e => ({ eq: e[0], total: e[1], dots: e[2], gl: e[3], squat: e[4], bench: e[5], deadlift: e[6], bw: e[7], cls: e[8], date: e[9], meet: e[10], fed: e[11] })),
  };
}

export async function fetchMeta(): Promise<OplMeta | null> { return getJsonUrl<OplMeta | null>('meta.json'); }

/** Search lifters by name. Fetches one shard per query word, unions, ranks by how recently they competed. */
export async function searchLifters(query: string, limit = 25): Promise<Lifter[]> {
  const norm = normalizeName(query);
  if (norm.length < 2) return [];
  const keys = shardKeys(norm);
  const shards = await Promise.all(keys.map(k => getJsonUrl<RawLifter[] | null>(`lifters/${k}.json`)));
  const seen = new Map<string, RawLifter>();
  for (const s of shards) for (const r of s ?? []) if (!seen.has(r[0]) && nameMatches(normalizeName(r[0]), norm)) seen.set(r[0], r);
  return [...seen.values()].sort((a, b) => (a[4] < b[4] ? 1 : -1)).slice(0, limit).map(toLifter);
}

export async function fetchLadder(scope: string): Promise<Ladder | null> {
  const file = scope === 'world' ? 'world' : scope.replace(/[^A-Za-z0-9 _-]/g, '');
  return getJsonUrl<Ladder | null>(`ladders/${file}.json`).then(l => l && fixLadder(l));
}
export async function fetchCountries(): Promise<{ name: string; file: string }[]> {
  return (await getJsonUrl<{ name: string; file: string }[] | null>('ladders/index.json')) ?? [];
}

type RawTop = [string, number, number | null, number | null, number | null, string, string];
type RawMeet = [string, string, string, number, number[]];
function fixLadder(l: Record<string, unknown>): Ladder {
  const out: Ladder = {};
  for (const [k, v] of Object.entries(l)) {
    const c = v as { n: number; min: number; step: number; counts: number[]; top: RawTop[]; meets?: RawMeet[] };
    out[k] = {
      n: c.n, min: c.min, step: c.step, counts: c.counts,
      top: c.top.map(t => ({ name: t[0], total: t[1], dots: t[2], gl: t[3], bw: t[4], date: t[5], meet: t[6] })),
      meets: c.meets?.map(m => ({ meet: m[0], date: m[1], fed: m[2], n: m[3], podium: m[4] })),
    };
  }
  return out;
}

/** For tests. */
export function _resetCache() { cache.clear(); }
