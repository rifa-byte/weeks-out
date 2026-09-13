/**
 * Weeks Out — well-known programs.
 *
 * Classic, freely published training templates that lifters already run from spreadsheets,
 * rebuilt here as Weeks Out templates so they load from your bests and log in one tap.
 * These are the authors' public methods; the loading is our translation to percentages of
 * estimated 1RM (the app rounds down to 2.5 kg). Credit stays with the authors.
 */
import type { PlannedDay, PlannedSet, Template } from './programs';

const S = 'squat', B = 'bench', D = 'deadlift';
const set = (exercise: string, sets: number, reps: number, pct?: number, extra: Partial<PlannedSet> = {}): PlannedSet => ({ exercise, sets, reps, ...(pct != null ? { pct } : {}), ...extra });

export interface FamousMeta { author: string; source: string; level: 'beginner' | 'intermediate' | 'advanced'; goal: 'strength' | 'hypertrophy'; blurb: string }

/* ---------- Texas Method (Rippetoe & Baker) — 3 days, 6 weeks ---------- */
const texasMethod: Template & { meta: FamousMeta } = {
  id: 'famous:texas-method',
  name: 'Texas Method',
  weeks: 6, daysPerWeek: 3,
  who: 'Intermediates who have run out of linear progress and can handle a heavy Friday.',
  shape: 'Monday volume (5×5 at 90% of Friday), Wednesday light, Friday a new 5-rep max. Adds about 2.5 kg to the Friday top set each week.',
  meta: { author: 'Mark Rippetoe & Glenn Pendlay', source: 'Practical Programming', level: 'intermediate', goal: 'strength', blurb: 'The classic weekly wave: volume Monday, recovery Wednesday, new 5RM Friday. Squat and bench every week, deadlift heavy on Monday.' },
  week(w): PlannedDay[] {
    const top = 0.855 + (w - 1) * 0.012;                // Friday 5RM ≈ 85.5% of e1RM, +1.2% a week
    const vol = Math.round(top * 0.9 * 1000) / 1000;    // Monday = 90% of Friday
    return [
      { name: 'Monday · volume', sets: [set(S, 5, 5, vol, { rpe: 8 }), set(B, 5, 5, vol, { rpe: 8 }), set(D, 1, 5, top, { rpe: 8.5 }), set('back-extension', 3, 10)] },
      { name: 'Wednesday · light', sets: [set(S, 2, 5, Math.round(vol * 0.8 * 1000) / 1000, { rpe: 6 }), set('overhead-press', 3, 5, undefined, { rpe: 7 }), set('pull-up', 3, 8), set('back-extension', 3, 10)] },
      { name: 'Friday · intensity', sets: [set(S, 1, 5, top, { rpe: 9, note: 'new 5RM' }), set(B, 1, 5, top, { rpe: 9, note: 'new 5RM' }), set('barbell-row', 3, 5, undefined, { rpe: 8 })] },
    ];
  },
};

/* ---------- Madcow 5×5 — 3 days, 8 weeks ---------- */
const madcow: Template & { meta: FamousMeta } = {
  id: 'famous:madcow-5x5',
  name: 'Madcow 5×5',
  weeks: 8, daysPerWeek: 3,
  who: 'Early intermediates. Simple, brutal, effective.',
  shape: 'Ramping sets of 5 to a top set on Monday, lighter Wednesday, Friday a triple above Monday plus a back-off 8. Top sets climb 2.5% a week.',
  meta: { author: 'Bill Starr / “Madcow”', source: 'Community template', level: 'intermediate', goal: 'strength', blurb: 'Ramped 5×5 three times a week with a weekly 2.5% climb. Squat every session; bench and rows Monday and Friday; deadlift and incline Wednesday.' },
  week(w): PlannedDay[] {
    const top = 0.80 + (w - 1) * 0.025;                 // Monday top-5 starts ~80% of e1RM (week 1 easy on purpose)
    const ramp = (ex: string, t: number, n = 5): PlannedSet[] => [set(ex, 1, 5, t * 0.5), set(ex, 1, 5, t * 0.625), set(ex, 1, 5, t * 0.75), set(ex, 1, 5, t * 0.875), set(ex, 1, n, t, { rpe: 8.5, note: 'top set' })].map(s => ({ ...s, pct: Math.round((s.pct ?? 0) * 1000) / 1000 }));
    return [
      { name: 'Monday · ramp', sets: [...ramp(S, top), ...ramp(B, top), set('barbell-row', 5, 5, undefined, { rpe: 8, note: 'ramp' })] },
      { name: 'Wednesday · light', sets: [set(S, 4, 5, Math.round(top * 0.75 * 1000) / 1000, { rpe: 6.5 }), set('incline-bench', 4, 5, undefined, { rpe: 7.5 }), set(D, 4, 5, Math.round(top * 0.85 * 1000) / 1000, { rpe: 7.5, note: 'ramp' })] },
      { name: 'Friday · triple', sets: [...ramp(S, top * 1.025, 3), set(S, 1, 8, Math.round(top * 0.75 * 1000) / 1000, { note: 'back-off' }), ...ramp(B, top * 1.025, 3), set(B, 1, 8, Math.round(top * 0.75 * 1000) / 1000, { note: 'back-off' }), set('barbell-row', 4, 5, undefined, { rpe: 8 })] },
    ];
  },
};

/* ---------- 5/3/1 Boring But Big (Wendler) — 4 days, 4-week cycle ---------- */
const wave = [
  { pcts: [0.65, 0.75, 0.85], reps: [5, 5, 5], plus: true },
  { pcts: [0.70, 0.80, 0.90], reps: [3, 3, 3], plus: true },
  { pcts: [0.75, 0.85, 0.95], reps: [5, 3, 1], plus: true },
  { pcts: [0.40, 0.50, 0.60], reps: [5, 5, 5], plus: false },
];
const TM = 0.9;   // training max = 90% of 1RM
const bbb: Template & { meta: FamousMeta } = {
  id: 'famous:531-bbb',
  name: '5/3/1 Boring But Big',
  weeks: 4, daysPerWeek: 4,
  who: 'Anyone who wants slow, sure progress and a lot of muscle.',
  shape: 'Each lift once a week: three working sets off a 90% training max (5s, 3s, 5/3/1, deload), the last set for as many reps as you have, then 5×10 at 50%.',
  meta: { author: 'Jim Wendler', source: '5/3/1 (Boring But Big template)', level: 'beginner', goal: 'hypertrophy', blurb: 'Wendler’s four-week wave — 5s week, 3s week, 5/3/1 week, deload — with the “Boring But Big” 5×10 after each main lift. Run it again with +2.5 kg upper / +5 kg lower on the training max.' },
  week(w): PlannedDay[] {
    const v = wave[(w - 1) % 4];
    const main = (ex: string): PlannedSet[] => v.pcts.map((p, i) => set(ex, 1, v.reps[i], Math.round(p * TM * 1000) / 1000, i === 2 && v.plus ? { note: 'as many reps as you have (AMRAP)', rpe: 9 } : {}));
    const big = (ex: string) => set(ex, 5, 10, Math.round(0.5 * TM * 1000) / 1000, { note: 'BBB' });
    return [
      { name: 'Squat', sets: [...main(S), big(S), set('leg-curl', 5, 10)] },
      { name: 'Bench', sets: [...main(B), big(B), set('barbell-row', 5, 10)] },
      { name: 'Deadlift', sets: [...main(D), big(D), set('hanging-leg-raise', 5, 10)] },
      { name: 'Press', sets: [set('overhead-press', 3, v.reps[0], undefined, { rpe: 8, note: '5/3/1 wave on your press' }), set('overhead-press', 5, 10, undefined, { note: 'BBB' }), set('pull-up', 5, 10)] },
    ];
  },
};

/* ---------- GZCLP (Cody Lefever) — 3 days, 4 weeks (four workouts rotating) ---------- */
const gzclp: Template & { meta: FamousMeta } = {
  id: 'famous:gzclp',
  name: 'GZCLP',
  weeks: 4, daysPerWeek: 3,
  who: 'Beginners and returning lifters. Three tiers, every session.',
  shape: 'T1 heavy 5×3 (last set as many reps as you have), T2 3×10, T3 3×15. Four workouts rotate across three days a week; add 2.5 kg to a lift each time it comes round.',
  meta: { author: 'Cody Lefever', source: 'GZCL method (linear progression)', level: 'beginner', goal: 'strength', blurb: 'The tiered linear progression: one heavy lift, one medium, one light every session. Squat / bench / deadlift / press rotate through the tiers.' },
  week(w): PlannedDay[] {
    const days = ['A1', 'B1', 'A2', 'B2'];
    const t1 = (ex: string, bump: number) => set(ex, 5, 3, Math.round((0.85 + bump * 0.0125) * 1000) / 1000, { rpe: 8.5, note: 'T1 · last set AMRAP' });
    const t2 = (ex: string, bump: number) => set(ex, 3, 10, Math.round((0.65 + bump * 0.0125) * 1000) / 1000, { rpe: 7.5, note: 'T2' });
    const t3 = (ex: string) => set(ex, 3, 15, undefined, { note: 'T3 · last set AMRAP' });
    const workouts = (bump: number): Record<string, PlannedDay> => ({
      A1: { name: 'A1 · squat', sets: [t1(S, bump), t2(B, bump), t3('lat-pulldown')] },
      B1: { name: 'B1 · press', sets: [set('overhead-press', 5, 3, undefined, { rpe: 8.5, note: 'T1 · last set AMRAP' }), t2(D, bump), t3('db-row')] },
      A2: { name: 'A2 · bench', sets: [t1(B, bump), t2(S, bump), t3('lat-pulldown')] },
      B2: { name: 'B2 · deadlift', sets: [t1(D, bump), set('overhead-press', 3, 10, undefined, { rpe: 7.5, note: 'T2' }), t3('db-row')] },
    });
    const out: PlannedDay[] = [];
    for (let i = 0; i < 3; i++) {
      const idx = (w - 1) * 3 + i;                       // 0-based workout number
      const bump = Math.floor(idx / 4);                  // each full rotation adds a step
      out.push(workouts(bump)[days[idx % 4]]);
    }
    return out;
  },
};

export const FAMOUS: (Template & { meta: FamousMeta })[] = [texasMethod, madcow, bbb, gzclp];

export function famousById(id: string): Template | null {
  return FAMOUS.find(f => f.id === id) ?? null;
}
