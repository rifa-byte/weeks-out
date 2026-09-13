/**
 * Weeks Out — read a coach's spreadsheet into a program.
 *
 * Coaches hand out programs as Google Sheets / Excel in a hundred layouts. This reads the
 * common ones without asking the lifter to reformat anything:
 *
 *   1. Vertical: "Week 1" … "Day 1" … then rows of  Exercise | Sets | Reps | Weight | RPE
 *   2. Table:    one header row (Week | Day | Exercise | Sets | Reps | Weight | RPE) and a row per set
 *   3. Weeks across: a block per day, rows of Exercise | Sets | Reps, then one column per week holding the load
 *   4. One sheet per week (tabs named "Week 1", "W2", …)
 *
 * Cells can say "140", "140kg", "315 lb", "80%", "5 @ 8", "3x5", "RPE 8", "140x5@8". The result is
 * the app's own shape: weeks → days → sets with fixed kg (or % of e1RM / RPE), ready to start.
 */
import { EXERCISES, customId, exerciseById } from './exercises';
import type { PlannedDay, PlannedSet } from './programs';

export type Cell = string | number | boolean | null | undefined;
export type Grid = Cell[][];
export interface SheetInput { name: string; grid: Grid }

export interface ParsedProgram {
  name: string;
  weeks: number;
  daysPerWeek: number;
  days: PlannedDay[];              // week-major: w1d1, w1d2, …
  unmatched: string[];             // exercise names we could not match to the library (kept as custom movements)
  notes: string[];                 // what we understood — shown to the lifter so they can sanity-check
  units: 'kg' | 'lb';
}

const KG_PER_LB = 0.45359237;

/* ---------- small parsers ---------- */

const str = (c: Cell) => (c == null ? '' : String(c)).trim();
const low = (c: Cell) => str(c).toLowerCase();

const WEEK_RE = /^(?:week|wk|w)\s*[.#-]?\s*(\d{1,2})\b/i;
const DAY_RE = /^(?:day|d|session|workout)\s*[.#-]?\s*(\d{1,2})\b|^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|^(upper|lower|push|pull|legs|squat day|bench day|deadlift day|full body)\b/i;

export function weekOf(c: Cell): number | null { const m = WEEK_RE.exec(str(c)); return m ? Number(m[1]) : null; }
export function isDayMarker(c: Cell): boolean { const s = str(c); return s.length > 0 && s.length <= 40 && DAY_RE.test(s) && !/\d+\s*[x×]\s*\d+/.test(s); }

/** "3x5", "3 x 5", "4×6", "5 sets of 3", "3*5". Sets are ≤ 12 — "140x5" is a weight × reps, handled by loadOf. */
export function setsReps(s: string): { sets: number; reps: number } | null {
  const m = /(?<![\d.])(\d{1,2})\s*(?:[x×*]|sets?\s*(?:of|x|×)?)\s*(\d{1,3})(?!\s*(?:kg|lb|%))/i.exec(s);
  if (!m) return null;
  const sets = Number(m[1]), reps = Number(m[2]);
  return sets >= 1 && sets <= 12 ? { sets, reps } : null;
}
/** "140x5", "140 x 5", "315lb x 3": a weight and the reps done with it. */
function weightReps(s: string, defaultUnits: 'kg' | 'lb'): { kg: number; reps: number } | null {
  const m = /(\d{2,3}(?:\.\d+)?)\s*(kg|kgs|lb|lbs)?\s*[x×*]\s*(\d{1,3})\b/i.exec(s);
  if (!m) return null;
  const n = Number(m[1]); if (n < 15) return null;
  const unit = m[2] ? (m[2].toLowerCase().startsWith('lb') ? 'lb' : 'kg') : defaultUnits;
  return { kg: unit === 'lb' ? Math.round(n * KG_PER_LB * 2) / 2 : n, reps: Number(m[3]) };
}
/** A load: "140", "140kg", "315 lb", "80%", "@8", "RPE 8", "140x5@8". Returns what it found. */
export function loadOf(s: string, defaultUnits: 'kg' | 'lb'): { kg?: number; pct?: number; rpe?: number; reps?: number; sets?: number } {
  const out: { kg?: number; pct?: number; rpe?: number; reps?: number; sets?: number } = {};
  const t = s.toLowerCase();
  const pct = /(\d{1,3}(?:\.\d+)?)\s*%/.exec(t); if (pct) out.pct = Number(pct[1]) / 100;
  const rpe = /(?:rpe|@)\s*(\d{1,2}(?:\.\d)?)/.exec(t); if (rpe) { const v = Number(rpe[1]); if (v >= 5 && v <= 10) out.rpe = v; }
  const wr = weightReps(t, defaultUnits);
  if (wr) { out.kg = wr.kg; out.reps = wr.reps; return out; }
  const sr = setsReps(t); if (sr) { out.sets = sr.sets; out.reps = sr.reps; }
  const w = /(\d{2,3}(?:\.\d+)?)\s*(kg|kgs|lb|lbs)?(?!\s*%)(?![\d])/.exec(t.replace(/\d+\s*[x×*]\s*\d+/, ' ').replace(/(?:rpe|@)\s*\d+(?:\.\d)?/, ' ').replace(/\d+(?:\.\d+)?\s*%/, ' '));
  if (w) { const n = Number(w[1]); const unit = w[2] ? (w[2].startsWith('lb') ? 'lb' : 'kg') : defaultUnits; if (n >= 15 && n <= 600) out.kg = unit === 'lb' ? Math.round(n * KG_PER_LB * 2) / 2 : n; }
  return out;
}

/* ---------- exercise matching ---------- */

const ALIASES: Record<string, string> = {
  'comp squat': 'squat', 'competition squat': 'squat', 'back squat': 'squat', 'low bar squat': 'squat', 'low-bar squat': 'squat', 'sq': 'squat', 'squats': 'squat',
  'comp bench': 'bench', 'competition bench': 'bench', 'bench press': 'bench', 'bp': 'bench', 'flat bench': 'bench', 'paused bench': 'pause-bench', 'pause bench press': 'pause-bench', 'long pause bench': 'pause-bench',
  'comp deadlift': 'deadlift', 'competition deadlift': 'deadlift', 'dl': 'deadlift', 'conventional deadlift': 'deadlift', 'sumo deadlift': 'deadlift', 'sumo': 'deadlift', 'deads': 'deadlift',
  'high bar squat': 'high-bar-squat', 'high-bar': 'high-bar-squat', 'paused squat': 'pause-squat', 'pin squats': 'pin-squat', 'ssb': 'ssb-squat', 'safety bar squat': 'ssb-squat',
  'cgbp': 'close-grip-bench', 'close grip': 'close-grip-bench', 'close grip bench press': 'close-grip-bench', 'spoto': 'spoto-press', 'larsen': 'larsen-press', 'board press': 'board-press', '2 board press': 'board-press',
  'romanian deadlift': 'rdl', 'rdls': 'rdl', 'stiff leg deadlift': 'sldl', 'deficit dl': 'deficit-deadlift', 'block pulls': 'block-pull', 'rack pull': 'block-pull', 'paused deadlift': 'paused-deadlift', 'pause deadlift': 'paused-deadlift',
  'ohp': 'overhead-press', 'press': 'overhead-press', 'military press': 'overhead-press', 'shoulder press': 'overhead-press',
  'rows': 'barbell-row', 'bent over row': 'barbell-row', 'barbell rows': 'barbell-row', 'pendlay': 'pendlay-row', 'db rows': 'db-row', 'dumbbell row': 'db-row', 'chest supported row': 'db-row',
  'pull ups': 'pull-up', 'pullups': 'pull-up', 'chin ups': 'pull-up', 'chins': 'pull-up', 'lat pull down': 'lat-pulldown', 'pulldown': 'lat-pulldown', 'pulldowns': 'lat-pulldown',
  'dips': 'dip', 'tricep pushdowns': 'tricep-pushdown', 'pushdowns': 'tricep-pushdown', 'skullcrushers': 'skull-crusher', 'skull crushers': 'skull-crusher',
  'leg curls': 'leg-curl', 'hamstring curl': 'leg-curl', 'leg extensions': 'leg-extension', 'back extensions': 'back-extension', 'hyperextension': 'back-extension', 'hypers': 'back-extension',
  'db bench': 'db-bench', 'dumbbell bench': 'db-bench', 'dumbbell bench press': 'db-bench', 'incline': 'incline-bench', 'incline press': 'incline-bench', 'incline bench press': 'incline-bench',
  'face pulls': 'face-pull', 'facepulls': 'face-pull', 'planks': 'plank', 'hip thrusts': 'hip-thrust', 'bss': 'bulgarian-split-squat', 'split squat': 'bulgarian-split-squat', 'lunges': 'walking-lunge',
};

const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Library id for a spreadsheet exercise name, or a custom id when unknown. */
export function matchExercise(raw: string): { id: string; matched: boolean } {
  const n = norm(raw);
  if (!n) return { id: customId(raw || 'movement'), matched: false };
  if (ALIASES[n]) return { id: ALIASES[n], matched: true };
  const direct = exerciseById(n.replace(/ /g, '-'));
  if (direct) return { id: direct.id, matched: true };
  for (const e of EXERCISES) if (norm(e.name) === n) return { id: e.id, matched: true };
  // singular / plural, and "with" prefixes
  const sing = n.replace(/s$/, '');
  for (const e of EXERCISES) if (norm(e.name) === sing || norm(e.name).replace(/s$/, '') === sing) return { id: e.id, matched: true };
  // contained name ("Comp Squat w/ belt" → squat), longest match wins
  let best: { id: string; len: number } | null = null;
  for (const [alias, id] of Object.entries(ALIASES)) if (n.includes(alias) && (!best || alias.length > best.len)) best = { id, len: alias.length };
  for (const e of EXERCISES) { const en = norm(e.name); if (en.length >= 4 && n.includes(en) && (!best || en.length > best.len)) best = { id: e.id, len: en.length }; }
  if (best && best.len >= 4) return { id: best.id, matched: true };
  return { id: customId(raw.trim()), matched: false };
}

/* ---------- the parser ---------- */

interface Cols { exercise: number; sets?: number; reps?: number; weight?: number; rpe?: number; pct?: number; notes?: number; weekCols: Record<number, number>; week?: number; day?: number }

function headerOf(row: Cell[]): Cols | null {
  const cells = row.map(low);
  const find = (...names: string[]) => cells.findIndex(c => names.some(n => c === n || c.startsWith(n + ' ') || c.startsWith(n + '/') || c === n + 's'));
  const exercise = find('exercise', 'movement', 'lift', 'exercises', 'name');
  if (exercise < 0) return null;
  const cols: Cols = { exercise, weekCols: {} };
  const sets = find('sets', 'set'); if (sets >= 0) cols.sets = sets;
  const reps = find('reps', 'rep'); if (reps >= 0) cols.reps = reps;
  const weight = find('weight', 'load', 'kg', 'lbs', 'lb', 'kgs', 'target'); if (weight >= 0) cols.weight = weight;
  const rpe = find('rpe', 'rir', 'effort'); if (rpe >= 0) cols.rpe = rpe;
  const pct = find('%', 'percent', 'percentage', 'intensity', '% 1rm', '%1rm'); if (pct >= 0) cols.pct = pct;
  const notes = find('notes', 'note', 'comments', 'cues'); if (notes >= 0) cols.notes = notes;
  const week = find('week', 'wk'); if (week >= 0 && !weekOf(row[week])) cols.week = week;
  const day = find('day', 'session'); if (day >= 0) cols.day = day;
  cells.forEach((c, i) => { const w = weekOf(c); if (w != null) cols.weekCols[w] = i; });
  // "Week" as a column of numbers vs weeks across: if there are week columns, drop the single-column reading
  if (Object.keys(cols.weekCols).length > 0) delete cols.week;
  return cols;
}

function looksLikeSetsReps(row: Cell[]): boolean {
  return row.some(c => setsReps(str(c)) != null) || row.filter(c => typeof c === 'number' || /^\d+(\.\d+)?$/.test(str(c))).length >= 2;
}

/**
 * Parse one or more sheets into a program. `sheetHint` is the workbook / file name (used for the program name).
 */
export function parseSheets(sheets: SheetInput[], opts: { units?: 'kg' | 'lb'; name?: string } = {}): ParsedProgram | null {
  const defaultUnits = opts.units ?? 'kg';
  let units: 'kg' | 'lb' = defaultUnits;
  const notes: string[] = [];
  const unmatched = new Set<string>();

  // week -> day -> sets
  const plan = new Map<number, Map<number, { name: string; sets: PlannedSet[] }>>();
  const dayOf = (w: number, d: number, name?: string) => {
    let wk = plan.get(w); if (!wk) { wk = new Map(); plan.set(w, wk); }
    let day = wk.get(d); if (!day) { day = { name: name || `Day ${d}`, sets: [] }; wk.set(d, day); }
    else if (name && day.name === `Day ${d}`) day.name = name;
    return day;
  };

  let sheetsUsed = 0;
  for (const sheet of sheets) {
    const grid = sheet.grid.filter(r => r && r.some(c => str(c) !== ''));
    if (grid.length === 0) continue;
    if (grid.flat().some(c => /\blbs?\b/.test(low(c))) && !grid.flat().some(c => /\bkgs?\b/.test(low(c)))) units = 'lb';
    const sheetWeek = weekOf(sheet.name);
    let week = sheetWeek ?? 1;
    let day = 0;                                   // 0 = no day marker seen yet in this week
    let cols: Cols | null = null;
    let sawDayMarker = false;
    let lastRowWasBlank = false;
    let rowsHere = 0;

    for (const row of sheet.grid) {
      const empty = !row || row.every(c => str(c) === '');
      if (empty) { lastRowWasBlank = true; continue; }
      const first = row.findIndex(c => str(c) !== '');
      const firstCell = str(row[first]);
      const nonEmpty = row.filter(c => str(c) !== '');

      // markers
      const w = weekOf(firstCell);
      if (w != null && nonEmpty.length <= 2 && sheetWeek == null) { week = w; day = 0; lastRowWasBlank = false; continue; }
      if (isDayMarker(firstCell) && nonEmpty.length <= 3 && !looksLikeSetsReps(row)) {
        day += 1; sawDayMarker = true; lastRowWasBlank = false;
        dayOf(week, day, firstCell.replace(/\s+/g, ' ').slice(0, 30));
        continue;
      }
      const h = headerOf(row);
      if (h) { cols = h; lastRowWasBlank = false; continue; }

      // an exercise row
      const exCell = cols ? str(row[cols.exercise]) : firstCell;
      if (!exCell || /^(total|notes?|rest|off|warm.?up)$/i.test(exCell)) { lastRowWasBlank = false; continue; }
      if (!cols && !looksLikeSetsReps(row) && !nonEmpty.slice(1).some(c => loadOf(str(c), units).kg != null)) { lastRowWasBlank = false; continue; }

      // table layout: week / day come from columns
      let rowWeek = week, rowDay = day;
      if (cols?.week != null) { const n = Number(str(row[cols.week])); if (n >= 1) rowWeek = n; }
      if (cols?.day != null) { const raw = str(row[cols.day]); const n = Number(raw); rowDay = n >= 1 ? n : rowDay; if (!(n >= 1) && raw) { rowDay = day || 1; } }
      else if (rowDay === 0 || (lastRowWasBlank && !sawDayMarker && dayOf(rowWeek, rowDay).sets.length > 0)) { rowDay = (rowDay || 0) + 1; day = rowDay; }
      lastRowWasBlank = false;

      const { id, matched } = matchExercise(exCell);
      if (!matched) unmatched.add(exCell);

      const base: PlannedSet = { exercise: id, sets: 1, reps: 1 };
      const noteCell = cols?.notes != null ? str(row[cols.notes]) : '';
      if (noteCell) base.note = noteCell.slice(0, 40);
      // sets / reps from their columns, or from any "3x5" in the row
      const sr = cols?.sets != null && cols?.reps != null && str(row[cols.sets]) && str(row[cols.reps]) ? { sets: Number(str(row[cols.sets])), reps: Number(str(row[cols.reps]).replace(/[^\d.].*$/, '')) } : null;
      const inline = row.map(c => setsReps(str(c))).find(Boolean) ?? null;
      const srUse = sr && sr.sets >= 1 && sr.reps >= 1 ? sr : inline;
      if (srUse) { base.sets = srUse.sets; base.reps = srUse.reps; }
      else if (cols?.reps != null && str(row[cols.reps])) { const r = Number(str(row[cols.reps]).replace(/[^\d.].*$/, '')); if (r >= 1) base.reps = r; }
      if (cols?.rpe != null) { const v = Number(str(row[cols.rpe]).replace(/[^\d.]/g, '')); if (v >= 5 && v <= 10) base.rpe = v; }
      if (cols?.pct != null) { const v = Number(str(row[cols.pct]).replace(/[^\d.]/g, '')); if (v > 0) base.pct = v > 1.5 ? v / 100 : v; }

      const weekCols = cols ? Object.entries(cols.weekCols) : [];
      if (weekCols.length > 0) {
        // weeks across: one set-line per week column
        for (const [wk, ci] of weekCols) {
          const cell = str(row[Number(ci)]);
          if (!cell) continue;
          const l = loadOf(cell, units);
          const s: PlannedSet = { ...base };
          if (l.sets) s.sets = l.sets; if (l.reps) s.reps = l.reps;
          if (l.kg != null) s.fixedKg = l.kg; else if (l.pct != null) s.pct = l.pct;
          if (l.rpe != null) s.rpe = l.rpe;
          dayOf(Number(wk), rowDay).sets.push(s);
        }
      } else {
        const loadCells = cols?.weight != null ? [str(row[cols.weight])] : nonEmpty.slice(1).map(str);
        const s: PlannedSet = { ...base };
        for (const c of loadCells) {
          const l = loadOf(c, units);
          if (l.kg != null && s.fixedKg == null) s.fixedKg = l.kg;
          if (l.pct != null && s.pct == null) s.pct = l.pct;
          if (l.rpe != null && s.rpe == null) s.rpe = l.rpe;
        }
        if (s.fixedKg == null && s.pct == null && cols?.weight != null) {
          // plain number in the weight column
          const n = Number(str(row[cols.weight]).replace(/[^\d.]/g, ''));
          if (n >= 15 && n <= 600) s.fixedKg = units === 'lb' ? Math.round(n * KG_PER_LB * 2) / 2 : n;
        }
        dayOf(rowWeek, rowDay).sets.push(s);
      }
      rowsHere++;
    }
    if (rowsHere > 0) sheetsUsed++;
  }

  const weekNums = [...plan.keys()].sort((a, b) => a - b);
  if (weekNums.length === 0) return null;
  // fill week gaps (a coach may number 1,2,3,5) and pad days
  const weeks = weekNums[weekNums.length - 1];
  const daysPerWeek = Math.max(1, ...weekNums.map(w => Math.max(0, ...[...plan.get(w)!.keys()])));
  const days: PlannedDay[] = [];
  let setCount = 0;
  for (let w = 1; w <= weeks; w++) {
    const wk = plan.get(w);
    for (let d = 1; d <= daysPerWeek; d++) {
      const day = wk?.get(d);
      const sets = (day?.sets ?? []).filter(s => s.sets >= 1 && s.reps >= 1);
      setCount += sets.length;
      days.push({ name: day?.name ?? (sets.length ? `Day ${d}` : 'Rest'), sets });
    }
  }
  if (setCount === 0) return null;

  const fixed = days.flatMap(d => d.sets).filter(s => s.fixedKg != null).length;
  const pcts = days.flatMap(d => d.sets).filter(s => s.pct != null && s.fixedKg == null).length;
  notes.push(`${weeks} week${weeks === 1 ? '' : 's'}, ${daysPerWeek} day${daysPerWeek === 1 ? '' : 's'} a week, ${setCount} set lines${sheetsUsed > 1 ? ` across ${sheetsUsed} sheets` : ''}.`);
  if (fixed) notes.push(`${fixed} lines have a weight written in (${units === 'lb' ? 'read as lb, converted to kg' : 'kg'}).`);
  if (pcts) notes.push(`${pcts} lines use a % — worked out from your bests when you start.`);
  if (unmatched.size) notes.push(`Kept as written (not in the library): ${[...unmatched].slice(0, 6).join(', ')}${unmatched.size > 6 ? '…' : ''}.`);

  return { name: (opts.name || sheets[0]?.name || 'Imported program').replace(/\.(xlsx|xls|csv)$/i, '').slice(0, 40), weeks, daysPerWeek, days, unmatched: [...unmatched], notes, units };
}

/** Turn a Google Sheets URL into its xlsx export URL (all tabs). Null if it isn't a Sheets link. */
export function sheetsExportUrl(link: string): string | null {
  const m = /docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(link.trim());
  return m ? `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=xlsx` : null;
}
