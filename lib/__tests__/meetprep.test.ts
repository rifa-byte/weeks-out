import { factorOf, parentOf } from '../exercises';
import { allocatePhases, meetPrep, phaseOfWeek, phaseSummary } from '../meetprep';
import { resolveProgram } from '../programs';

const bests = { squat: 200, bench: 130, deadlift: 240 };

describe('phase allocation', () => {
  test('always ends with a one-week taper and sums to the total', () => {
    for (let w = 1; w <= 24; w++) {
      const p = allocatePhases(w);
      expect(p[p.length - 1]).toEqual({ phase: 'taper', weeks: 1 });
      expect(p.reduce((s, x) => s + x.weeks, 0)).toBe(w);
      for (const x of p) expect(x.weeks).toBeGreaterThan(0);
    }
  });
  test('short preps skip the build phase; long preps get one', () => {
    expect(allocatePhases(3).map(p => p.phase)).toEqual(['peak', 'taper']);
    expect(allocatePhases(8).map(p => p.phase)).toEqual(['accumulate', 'intensify', 'peak', 'taper']);
    expect(allocatePhases(16).find(p => p.phase === 'accumulate')!.weeks).toBeGreaterThanOrEqual(5);
    expect(phaseSummary(8)).toMatch(/wk build/);
  });
  test('phase order never regresses across weeks', () => {
    const order = ['accumulate', 'intensify', 'peak', 'taper'];
    for (const w of [4, 8, 12, 16]) {
      let last = -1;
      for (let k = 1; k <= w; k++) { const i = order.indexOf(phaseOfWeek(w, k)); expect(i).toBeGreaterThanOrEqual(last); last = i; }
    }
  });
});

describe('generated programs', () => {
  test('every length × frequency builds, resolves, and stays under the e1RM', () => {
    for (let w = 1; w <= 16; w++) for (let d = 2; d <= 6; d++) {
      const t = meetPrep({ weeks: w, days: d });
      expect(t.weeks).toBe(w);
      expect(t.daysPerWeek).toBe(d);
      const days = resolveProgram(t, bests);
      expect(days).toHaveLength(w * d);
      for (const day of days) for (const s of day.sets) {
        expect(Number.isInteger(s.sets) && s.sets >= 1).toBe(true);
        expect(Number.isInteger(s.reps) && s.reps >= 1).toBe(true);
        if (s.weightKg != null) {
          expect(s.weightKg % 2.5).toBe(0);
          const p = parentOf(s.exercise)!;
          expect(s.weightKg).toBeLessThanOrEqual(bests[p] * factorOf(s.exercise));
        }
      }
    }
  });
  test('last day is meet day with no prescribed weights; taper has an openers day', () => {
    for (const d of [2, 3, 4, 5, 6]) {
      const days = resolveProgram(meetPrep({ weeks: 8, days: d }), bests);
      const last = days[days.length - 1];
      expect(last.name).toBe('Meet day');
      expect(last.sets.every(s => s.weightKg == null)).toBe(true);
      expect(days.filter(x => x.week === 8).some(x => x.name === 'Openers, light')).toBe(true);
    }
  });
  test('intensity rises through the prep: peak singles are heavier than build top sets', () => {
    const days = resolveProgram(meetPrep({ weeks: 8, days: 3 }), bests);
    const squatTop = (w: number) => days.find(d => d.week === w && d.sets[0].exercise === 'squat')!.sets[0];
    expect(squatTop(1).reps).toBeGreaterThan(squatTop(5).reps);
    expect(squatTop(6).reps).toBe(1);
    expect(squatTop(6).weightKg!).toBeGreaterThan(squatTop(1).weightKg!);
    expect(squatTop(6).note).toBe('opener');
    expect(squatTop(6).weightKg).toBe(180); // floor(200 × 0.91)
  });
  test('each competition lift is trained heavy at least once a week outside the taper', () => {
    for (const d of [2, 3, 4, 5, 6]) {
      const t = meetPrep({ weeks: 6, days: d });
      for (let w = 1; w < 6; w++) {
        const week = t.week(w);
        for (const lift of ['squat', 'bench', 'deadlift']) {
          expect(week.some(day => day.sets.some(s => s.exercise === lift && s.sets === 1 && s.note))).toBe(true);
        }
      }
    }
  });
  test('a long build phase includes a deload week', () => {
    const t = meetPrep({ weeks: 16, days: 4 });
    const notes = new Set<string>();
    for (let w = 1; w <= 16; w++) for (const d of t.week(w)) for (const s of d.sets) if (s.note) notes.add(s.note);
    expect(notes.has('deload')).toBe(true);
  });
});
