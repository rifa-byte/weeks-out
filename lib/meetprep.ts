/**
 * Weeks Out — meet-prep generator.
 *
 * Any number of weeks out, 2–6 sessions a week. The macrocycle is classic block
 * periodization as run by elite programs (Sheiko's numbered cycles, Calgary Barbell's
 * 16-week, JTS/RTS-style blocks): accumulate → intensify → peak → taper, with the
 * phase lengths scaled to the time available and the last week ending on the platform.
 *
 * Intensity is prescribed as % of e1RM (the app turns it into kilograms from the
 * lifter's bests); RPE targets are shown alongside as a sanity check.
 */
import type { PlannedDay, PlannedSet, Template } from './programs';

export type Phase = 'accumulate' | 'intensify' | 'peak' | 'taper';
export const PHASE_LABEL: Record<Phase, string> = { accumulate: 'Build', intensify: 'Strength', peak: 'Peak', taper: 'Taper' };

export interface PhasePlan { phase: Phase; weeks: number }

/** Split `weeks` into phases. The last week is always the taper that ends on meet day. */
export function allocatePhases(weeks: number): PhasePlan[] {
  const W = Math.max(1, Math.min(24, Math.round(weeks)));
  if (W === 1) return [{ phase: 'taper', weeks: 1 }];
  if (W <= 3) return [{ phase: 'peak', weeks: W - 1 }, { phase: 'taper', weeks: 1 }];
  const R = W - 1;
  const peak = Math.min(3, Math.max(1, Math.round(R * 0.3)));
  const intens = Math.min(6, Math.max(1, Math.round(R * 0.35)));
  const accum = Math.max(0, R - peak - intens);
  const out: PhasePlan[] = [];
  if (accum > 0) out.push({ phase: 'accumulate', weeks: accum });
  out.push({ phase: 'intensify', weeks: intens }, { phase: 'peak', weeks: peak }, { phase: 'taper', weeks: 1 });
  return out;
}

export function phaseSummary(weeks: number): string {
  return allocatePhases(weeks).map(p => `${p.weeks} wk ${PHASE_LABEL[p.phase].toLowerCase()}`).join(' · ');
}

// ---------- what a week asks of each lift ----------
export interface WeekRx {
  phase: Phase;
  i: number; n: number;           // index within phase, phase length
  deload: boolean;
  top: { pct: number; reps: number; rpe: number; note?: string };   // the heavy exposure
  back: { pct: number; sets: number; reps: number; rpe: number };   // back-off sets after the top set
  vol: { pct: number; sets: number; reps: number; rpe: number };    // second exposure (volume)
  vari: { pct: number; sets: number; reps: number; rpe: number };   // variation exposure
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function weekRx(phase: Phase, i: number, n: number, deload: boolean): WeekRx {
  const t = n <= 1 ? 1 : i / (n - 1); // 0 → 1 across the phase
  if (deload) {
    return { phase, i, n, deload, top: { pct: 0.65, reps: 5, rpe: 6, note: 'deload' }, back: { pct: 0.6, sets: 2, reps: 5, rpe: 5.5 }, vol: { pct: 0.55, sets: 2, reps: 6, rpe: 5.5 }, vari: { pct: 0.55, sets: 2, reps: 5, rpe: 5.5 } };
  }
  if (phase === 'accumulate') {
    const pct = lerp(0.70, 0.80, t), reps = t < 0.34 ? 6 : t < 0.67 ? 5 : 4;
    return { phase, i, n, deload, top: { pct, reps, rpe: 7.5, note: 'top set' }, back: { pct: pct - 0.08, sets: 4, reps: reps + 1, rpe: 7 }, vol: { pct: pct - 0.12, sets: 4, reps: 6, rpe: 7 }, vari: { pct: pct - 0.05, sets: 3, reps: 5, rpe: 7 } };
  }
  if (phase === 'intensify') {
    const pct = lerp(0.82, 0.90, t), reps = t < 0.5 ? 3 : 2;
    return { phase, i, n, deload, top: { pct, reps, rpe: 8.5, note: 'top set' }, back: { pct: pct - 0.08, sets: 3, reps: reps + 1, rpe: 7.5 }, vol: { pct: pct - 0.14, sets: 3, reps: 4, rpe: 7 }, vari: { pct: pct - 0.08, sets: 3, reps: 3, rpe: 7.5 } };
  }
  if (phase === 'peak') {
    // Singles that climb to a heavy second attempt, then don't chase more.
    const seq = n === 1 ? [0.93] : n === 2 ? [0.91, 0.95] : [0.90, 0.94, 0.97];
    const pct = seq[Math.min(i, seq.length - 1)];
    const note = pct <= 0.91 ? 'opener' : pct <= 0.95 ? 'second attempt' : 'near third';
    return { phase, i, n, deload, top: { pct, reps: 1, rpe: pct > 0.95 ? 9.5 : pct > 0.92 ? 9 : 8, note }, back: { pct: 0.82 - i * 0.02, sets: 2, reps: 2, rpe: 7 }, vol: { pct: 0.72, sets: 2, reps: 3, rpe: 6.5 }, vari: { pct: 0.70, sets: 2, reps: 2, rpe: 6.5 } };
  }
  // taper — handled specially in buildDays
  return { phase, i, n, deload, top: { pct: 0.85, reps: 1, rpe: 7 }, back: { pct: 0.6, sets: 3, reps: 2, rpe: 5 }, vol: { pct: 0.6, sets: 2, reps: 2, rpe: 5 }, vari: { pct: 0.6, sets: 2, reps: 2, rpe: 5 } };
}

// ---------- day splits ----------
export type Role = 'heavy' | 'volume' | 'variation';
export interface Slot { ex: string; role: Role }
export interface DayShape { name: string; slots: Slot[]; acc: { ex: string; sets: number; reps: number }[] }

const S = 'squat', B = 'bench', D = 'deadlift';
const acc = (ex: string, sets: number, reps: number) => ({ ex, sets, reps });

export function split(days: number): DayShape[] {
  switch (Math.max(2, Math.min(6, days))) {
    case 2: return [
      { name: 'Squat + bench', slots: [{ ex: S, role: 'heavy' }, { ex: B, role: 'heavy' }], acc: [acc('barbell-row', 3, 8)] },
      { name: 'Deadlift + bench', slots: [{ ex: D, role: 'heavy' }, { ex: 'pause-bench', role: 'variation' }, { ex: S, role: 'volume' }], acc: [acc('leg-curl', 2, 10)] },
    ];
    case 3: return [
      { name: 'Squat + bench', slots: [{ ex: S, role: 'heavy' }, { ex: B, role: 'heavy' }], acc: [acc('leg-curl', 2, 10)] },
      { name: 'Deadlift', slots: [{ ex: D, role: 'heavy' }, { ex: 'pause-bench', role: 'variation' }], acc: [acc('back-extension', 2, 12)] },
      { name: 'Squat light + bench', slots: [{ ex: 'pause-squat', role: 'variation' }, { ex: B, role: 'volume' }], acc: [acc('barbell-row', 3, 10), acc('face-pull', 2, 15)] },
    ];
    case 4: return [
      { name: 'Squat', slots: [{ ex: S, role: 'heavy' }, { ex: B, role: 'volume' }], acc: [acc('leg-curl', 3, 10)] },
      { name: 'Bench', slots: [{ ex: B, role: 'heavy' }], acc: [acc('overhead-press', 3, 8), acc('tricep-pushdown', 3, 12)] },
      { name: 'Deadlift', slots: [{ ex: D, role: 'heavy' }, { ex: S, role: 'volume' }], acc: [acc('back-extension', 3, 12)] },
      { name: 'Variations', slots: [{ ex: 'pause-bench', role: 'variation' }, { ex: 'pause-squat', role: 'variation' }], acc: [acc('barbell-row', 3, 10), acc('face-pull', 3, 15)] },
    ];
    case 5: return [
      { name: 'Squat', slots: [{ ex: S, role: 'heavy' }, { ex: B, role: 'volume' }], acc: [acc('leg-curl', 3, 10)] },
      { name: 'Bench', slots: [{ ex: B, role: 'heavy' }, { ex: 'paused-deadlift', role: 'variation' }], acc: [acc('barbell-row', 3, 8)] },
      { name: 'Variations', slots: [{ ex: 'pause-squat', role: 'variation' }, { ex: 'close-grip-bench', role: 'variation' }], acc: [acc('face-pull', 3, 15)] },
      { name: 'Deadlift', slots: [{ ex: D, role: 'heavy' }, { ex: B, role: 'volume' }], acc: [acc('back-extension', 3, 12)] },
      { name: 'Bench + upper', slots: [{ ex: 'pause-bench', role: 'variation' }], acc: [acc('overhead-press', 3, 8), acc('dip', 3, 10), acc('biceps-curl', 2, 12)] },
    ];
    default: return [
      { name: 'Squat', slots: [{ ex: S, role: 'heavy' }, { ex: B, role: 'volume' }], acc: [acc('leg-curl', 3, 10)] },
      { name: 'Deadlift', slots: [{ ex: D, role: 'heavy' }, { ex: 'pause-bench', role: 'variation' }], acc: [acc('back-extension', 3, 12)] },
      { name: 'Bench', slots: [{ ex: B, role: 'heavy' }, { ex: 'pause-squat', role: 'variation' }], acc: [acc('tricep-pushdown', 3, 12)] },
      { name: 'Squat volume', slots: [{ ex: S, role: 'volume' }, { ex: 'close-grip-bench', role: 'variation' }], acc: [acc('walking-lunge', 3, 10)] },
      { name: 'Pull variation', slots: [{ ex: 'paused-deadlift', role: 'variation' }, { ex: B, role: 'volume' }], acc: [acc('barbell-row', 3, 8)] },
      { name: 'Upper + accessories', slots: [], acc: [acc('overhead-press', 3, 8), acc('dip', 3, 10), acc('face-pull', 3, 15), acc('biceps-curl', 3, 12), acc('hanging-leg-raise', 3, 10)] },
    ];
  }
}

export function setsFor(slot: Slot, rx: WeekRx): PlannedSet[] {
  const isDead = slot.ex === D;
  if (slot.role === 'heavy') {
    const top: PlannedSet = { exercise: slot.ex, sets: 1, reps: rx.top.reps, pct: rx.top.pct, rpe: rx.top.rpe, note: rx.top.note };
    // deadlift back-offs are fewer — it costs more to recover from
    const back: PlannedSet = { exercise: slot.ex, sets: isDead ? Math.max(1, rx.back.sets - 1) : rx.back.sets, reps: rx.back.reps, pct: rx.back.pct, rpe: rx.back.rpe };
    return rx.phase === 'peak' && rx.i === rx.n - 1 && isDead ? [top] : [top, back];
  }
  if (slot.role === 'volume') return [{ exercise: slot.ex, sets: rx.vol.sets, reps: rx.vol.reps, pct: rx.vol.pct, rpe: rx.vol.rpe }];
  return [{ exercise: slot.ex, sets: rx.vari.sets, reps: rx.vari.reps, pct: rx.vari.pct, rpe: rx.vari.rpe }];
}

export function taperWeek(days: number): PlannedDay[] {
  const openers: PlannedDay = { name: 'Openers, light', sets: [
    { exercise: S, sets: 1, reps: 1, pct: 0.85, rpe: 7, note: 'last heavy-ish rep' },
    { exercise: B, sets: 1, reps: 1, pct: 0.85, rpe: 7 },
    { exercise: D, sets: 1, reps: 1, pct: 0.80, rpe: 6.5 },
  ] };
  const speed: PlannedDay = { name: 'Bar speed', sets: [
    { exercise: S, sets: 3, reps: 2, pct: 0.6, rpe: 5, note: 'fast' },
    { exercise: B, sets: 3, reps: 2, pct: 0.6, rpe: 5, note: 'fast' },
  ] };
  const meet: PlannedDay = { name: 'Meet day', sets: [
    { exercise: S, sets: 3, reps: 1, note: 'attempts — see Meet tab' },
    { exercise: B, sets: 3, reps: 1, note: 'attempts' },
    { exercise: D, sets: 3, reps: 1, note: 'attempts' },
  ] };
  const rest: PlannedDay = { name: 'Rest', sets: [] };
  const out: PlannedDay[] = days === 2 ? [openers] : [openers, speed];
  while (out.length < days - 1) out.push(rest);
  out.push(meet);
  return out;
}

export interface MeetPrepOptions { weeks: number; days: number }

/** Build the whole prep as a Template the app can start, share, and customise. */
export function meetPrep({ weeks, days }: MeetPrepOptions): Template {
  const W = Math.max(1, Math.min(24, Math.round(weeks)));
  const Dn = Math.max(2, Math.min(6, Math.round(days)));
  const phases = allocatePhases(W);
  const shape = split(Dn);

  // week → rx
  const rxs: WeekRx[] = [];
  for (const p of phases) {
    for (let i = 0; i < p.weeks; i++) {
      const deload = p.phase === 'accumulate' && p.weeks >= 4 && i === p.weeks - 1;
      rxs.push(weekRx(p.phase, i, p.weeks, deload));
    }
  }

  return {
    id: `meet-prep:${W}:${Dn}`,
    name: `${W}-week meet prep · ${Dn} days`,
    weeks: W,
    daysPerWeek: Dn,
    who: 'Anyone with a date on the calendar.',
    shape: `${phaseSummary(W)}. Ends on the platform.`,
    week(w) {
      const rx = rxs[w - 1];
      if (!rx || rx.phase === 'taper') return taperWeek(Dn);
      return shape.map(d => ({
        name: d.name,
        sets: [
          ...d.slots.flatMap(s => setsFor(s, rx)),
          // accessories thin out as the meet approaches
          ...(rx.phase === 'peak' ? d.acc.slice(0, 1).map(a => ({ exercise: a.ex, sets: Math.max(1, a.sets - 1), reps: a.reps })) : d.acc.map(a => ({ exercise: a.ex, sets: a.sets, reps: a.reps }))),
        ],
      }));
    },
  };
}

/** Phase of a given week (1-based) for labelling. */
export function phaseOfWeek(weeks: number, w: number): Phase {
  let acc = 0;
  for (const p of allocatePhases(weeks)) { acc += p.weeks; if (w <= acc) return p.phase; }
  return 'taper';
}
