/**
 * Weeks Out — program templates.
 * A template describes each week's days as sets with a percentage of e1RM (or no
 * percentage for accessories). `resolveProgram` turns a template plus the lifter's
 * e1RMs into concrete weights, rounded down to 2.5 kg, so a program is stable once
 * started even if the log changes later.
 */
import { factorOf, parentOf } from './exercises';
import { floorTo, type Lift } from './math';

export interface PlannedSet {
  exercise: string;   // 'squat' | 'bench' | 'deadlift' | free text
  sets: number;
  reps: number;
  pct?: number;       // fraction of e1RM, e.g. 0.8; omitted for accessories
  rpe?: number;       // target RPE shown to the lifter
  note?: string;
}

export interface PlannedDay { name: string; sets: PlannedSet[] }

export interface Template {
  id: string;
  name: string;
  weeks: number;
  daysPerWeek: number;
  who: string;
  shape: string;
  /** Days for a 1-based week number. */
  week(w: number): PlannedDay[];
}

const S = 'squat', B = 'bench', D = 'deadlift';

// ---------- 3-day full body (4 weeks) ----------
const fullBodyWave = [
  { pct: 0.75, sets: 5, reps: 5, rpe: 7 },
  { pct: 0.80, sets: 4, reps: 4, rpe: 8 },
  { pct: 0.85, sets: 3, reps: 3, rpe: 8.5 },
  { pct: 0.70, sets: 3, reps: 5, rpe: 6, note: 'deload' },
];

const fullBody: Template = {
  id: 'full-body-3',
  name: '3-day full body',
  weeks: 4,
  daysPerWeek: 3,
  who: 'Newer lifters, or anyone short on time.',
  shape: 'Squat, bench and deadlift each week at rising intensity, then a deload. Four-week waves — run it twice between meets.',
  week(w) {
    const m = fullBodyWave[(w - 1) % 4];
    const light = { ...m, pct: m.pct - 0.1, rpe: Math.max(5, (m.rpe ?? 7) - 1.5) };
    return [
      { name: 'Day 1', sets: [{ exercise: S, ...m }, { exercise: B, ...m }, { exercise: 'barbell-row', sets: 3, reps: 8 }] },
      { name: 'Day 2', sets: [{ exercise: D, ...m }, { exercise: 'pause-bench', ...m }, { exercise: 'pull-up', sets: 3, reps: 8 }] },
      { name: 'Day 3', sets: [{ exercise: S, ...light }, { exercise: B, ...m }, { exercise: 'dip', sets: 3, reps: 10 }] },
    ];
  },
};

// ---------- 4-day SBD split (4 weeks) ----------
const splitTop = [
  { pct: 0.825, reps: 3, rpe: 8 },
  { pct: 0.875, reps: 2, rpe: 8.5 },
  { pct: 0.90, reps: 1, rpe: 9 },
  { pct: 0.75, reps: 3, rpe: 6, note: 'deload' },
];

const sbdSplit: Template = {
  id: 'sbd-split-4',
  name: '4-day SBD split',
  weeks: 4,
  daysPerWeek: 4,
  who: 'Intermediates building volume between meets.',
  shape: 'One heavy top set per lift each week with back-offs, plus volume days. Two squat days, two bench days, one heavy pull.',
  week(w) {
    const t = splitTop[(w - 1) % 4];
    const top = (ex: string) => ({ exercise: ex, sets: 1, ...t, note: t.note ?? 'top set' });
    const back = (ex: string, reps: number, sets: number) => ({ exercise: ex, sets, reps, pct: t.pct - 0.1, rpe: 7 });
    return [
      { name: 'Squat', sets: [top(S), back(S, 5, 3), { exercise: B, sets: 4, reps: 6, pct: 0.7, rpe: 7 }] },
      { name: 'Bench', sets: [top(B), back(B, 5, 3), { exercise: 'overhead-press', sets: 3, reps: 8 }] },
      { name: 'Deadlift', sets: [top(D), back(D, 3, 3), { exercise: S, sets: 3, reps: 6, pct: 0.7, rpe: 7 }] },
      { name: 'Volume', sets: [{ exercise: B, sets: 4, reps: 8, pct: 0.65, rpe: 7 }, { exercise: 'pause-squat', sets: 3, reps: 3, pct: 0.75, rpe: 7 }, { exercise: 'barbell-row', sets: 3, reps: 10 }] },
    ];
  },
};

// ---------- 8-week meet prep ----------
const meetPrep: Template = {
  id: 'meet-prep-8',
  name: '8-week meet prep',
  weeks: 8,
  daysPerWeek: 3,
  who: 'Anyone with a date on the calendar.',
  shape: 'Four weeks of heavy volume, three weeks of singles at openers and above, one taper. Week 8 ends on the platform.',
  week(w) {
    if (w <= 4) {
      const top = [{ pct: 0.80, reps: 4 }, { pct: 0.825, reps: 3 }, { pct: 0.85, reps: 3 }, { pct: 0.875, reps: 2 }][w - 1];
      const main = (ex: string) => ({ exercise: ex, sets: 1, ...top, rpe: 8, note: 'top set' });
      const back = (ex: string) => ({ exercise: ex, sets: 3, reps: top.reps + 2, pct: top.pct - 0.1, rpe: 7 });
      return [
        { name: 'Squat + bench', sets: [main(S), back(S), main(B), back(B)] },
        { name: 'Deadlift', sets: [main(D), back(D), { exercise: 'pause-bench', sets: 3, reps: 5, pct: 0.72, rpe: 6 }] },
        { name: 'Squat light + bench', sets: [{ exercise: 'pause-squat', sets: 3, reps: 4, pct: 0.78, rpe: 6.5 }, main(B), back(B), { exercise: 'barbell-row', sets: 3, reps: 10 }] },
      ];
    }
    if (w <= 7) {
      // Singles: opener (91%), second (96%), then opener again to stay sharp.
      const single = [{ pct: 0.91, note: 'opener' }, { pct: 0.96, note: 'second attempt' }, { pct: 0.91, note: 'opener, then rest' }][w - 5];
      const backoff = [{ pct: 0.80, sets: 3, reps: 3 }, { pct: 0.85, sets: 2, reps: 2 }, { pct: 0.75, sets: 2, reps: 2 }][w - 5];
      const one = (ex: string) => ({ exercise: ex, sets: 1, reps: 1, pct: single.pct, rpe: single.pct > 0.95 ? 9 : 8, note: single.note });
      const back = (ex: string) => ({ exercise: ex, ...backoff, rpe: 7 });
      return [
        { name: 'Squat + bench singles', sets: [one(S), back(S), one(B), back(B)] },
        { name: 'Deadlift single', sets: [one(D), back(D), { exercise: 'pause-bench', sets: 3, reps: 3, pct: 0.78, rpe: 6.5 }] },
        { name: 'Bench + light squat', sets: [one(B), back(B), { exercise: S, sets: 2, reps: 2, pct: 0.75, rpe: 6.5 }] },
      ];
    }
    // Week 8: taper.
    return [
      { name: 'Openers, light', sets: [{ exercise: S, sets: 1, reps: 1, pct: 0.85, rpe: 7, note: 'last heavy-ish rep' }, { exercise: B, sets: 1, reps: 1, pct: 0.85, rpe: 7 }, { exercise: D, sets: 1, reps: 1, pct: 0.80, rpe: 6.5 }] },
      { name: 'Bar speed', sets: [{ exercise: S, sets: 3, reps: 2, pct: 0.6, rpe: 5, note: 'fast' }, { exercise: B, sets: 3, reps: 2, pct: 0.6, rpe: 5, note: 'fast' }] },
      { name: 'Meet day', sets: [{ exercise: S, sets: 3, reps: 1, note: 'attempts — see Meet tab' }, { exercise: B, sets: 3, reps: 1, note: 'attempts' }, { exercise: D, sets: 3, reps: 1, note: 'attempts' }] },
    ];
  },
};

export const TEMPLATES: Template[] = [fullBody, sbdSplit, meetPrep];
export const templateById = (id: string) => TEMPLATES.find(t => t.id === id) ?? null;

// ---------- resolving ----------
export interface ResolvedSet extends PlannedSet { weightKg: number | null }
export interface ResolvedDay { week: number; day: number; name: string; sets: ResolvedSet[] }

export type Bests = Partial<Record<Lift, number | null>>;

/** Concrete weights for every day of a template, from e1RMs in kg. Accessories get null. */
export function resolveProgram(template: Template, bests: Bests, step = 2.5): ResolvedDay[] {
  const out: ResolvedDay[] = [];
  for (let w = 1; w <= template.weeks; w++) {
    template.week(w).forEach((d, i) => {
      out.push({ week: w, day: i + 1, name: d.name, sets: d.sets.map(s => resolveSet(s, bests, step)) });
    });
  }
  return out;
}

/**
 * Weight for one planned set: parent-lift e1RM × pct × the variation's strength factor,
 * floored to the plate step. Accessories (no parent, or no pct) get null.
 */
export function resolveSet(s: PlannedSet, bests: Bests, step = 2.5): ResolvedSet {
  const parent = parentOf(s.exercise);
  const best = parent ? bests[parent] : null;
  const weightKg = s.pct != null && best ? Math.max(20, floorTo(best * s.pct * factorOf(s.exercise), step)) : null;
  return { ...s, weightKg };
}

/** Swap the movement of a planned set, keeping sets/reps/RPE and re-deriving the weight. */
export function swapExercise(s: PlannedSet, newExerciseId: string, bests: Bests, step = 2.5): ResolvedSet {
  const next: PlannedSet = { ...s, exercise: newExerciseId };
  // If the new movement has no parent lift, a percentage means nothing — drop it.
  if (!parentOf(newExerciseId)) delete next.pct;
  return resolveSet(next, bests, step);
}

/** Which lifts a template needs an e1RM for. */
export function liftsNeeded(template: Template): Lift[] {
  const need = new Set<Lift>();
  for (let w = 1; w <= template.weeks; w++) {
    for (const d of template.week(w)) for (const s of d.sets) { const p = parentOf(s.exercise); if (s.pct != null && p) need.add(p); }
  }
  return [...need];
}
