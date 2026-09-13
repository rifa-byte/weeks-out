import { exerciseById } from '../exercises';
import { FAMOUS } from '../famous';
import { liftsNeeded, resolveProgram, templateById } from '../programs';

const bests = { squat: 200, bench: 140, deadlift: 240 };

describe('well-known programs', () => {
  test('every week has the promised number of days and real exercises', () => {
    for (const t of FAMOUS) {
      for (let w = 1; w <= t.weeks; w++) {
        const days = t.week(w);
        expect(days).toHaveLength(t.daysPerWeek);
        for (const d of days) for (const s of d.sets) {
          expect(exerciseById(s.exercise)).not.toBeNull();
          expect(s.sets).toBeGreaterThan(0);
          expect(s.reps).toBeGreaterThan(0);
          if (s.pct != null) expect(s.pct).toBeGreaterThan(0.3);
          if (s.pct != null) expect(s.pct).toBeLessThanOrEqual(1.05);
        }
      }
    }
  });
  test('resolve to sensible weights and load from all three lifts', () => {
    for (const t of FAMOUS) {
      const days = resolveProgram(t, bests);
      expect(days).toHaveLength(t.weeks * t.daysPerWeek);
      for (const d of days) for (const s of d.sets) if (s.weightKg != null) { expect(s.weightKg % 2.5).toBe(0); expect(s.weightKg).toBeLessThanOrEqual(260); }
      expect(liftsNeeded(t).sort()).toEqual(['bench', 'deadlift', 'squat']);
    }
  });
  test('reachable by id', () => {
    expect(templateById('famous:texas-method')?.name).toBe('Texas Method');
    expect(templateById('famous:nope')).toBeNull();
  });
  test('Texas Method: Monday is 90% of Friday; 5/3/1 week 3 ends in a 95% single', () => {
    const tm = FAMOUS.find(f => f.id === 'famous:texas-method')!;
    const w1 = tm.week(1);
    expect(w1[0].sets[0].pct!).toBeCloseTo(w1[2].sets[0].pct! * 0.9, 2);
    const bbb = FAMOUS.find(f => f.id === 'famous:531-bbb')!;
    const w3 = bbb.week(3)[0].sets;
    expect(w3[2].reps).toBe(1);
    expect(w3[2].pct).toBeCloseTo(0.95 * 0.9, 3);
    expect(bbb.week(4)[0].sets[0].pct).toBeCloseTo(0.4 * 0.9, 3);
  });
  test('GZCLP rotates four workouts over three days and bumps after a full rotation', () => {
    const g = FAMOUS.find(f => f.id === 'famous:gzclp')!;
    expect(g.week(1).map(d => d.name.slice(0, 2))).toEqual(['A1', 'B1', 'A2']);
    expect(g.week(2).map(d => d.name.slice(0, 2))).toEqual(['B2', 'A1', 'B1']);
    expect(g.week(2)[1].sets[0].pct!).toBeGreaterThan(g.week(1)[0].sets[0].pct!);
  });
});
