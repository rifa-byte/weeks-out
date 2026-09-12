import { factorOf, parentOf } from '../exercises';
import { TEMPLATES, liftsNeeded, resolveProgram, templateById } from '../programs';

const bests = { squat: 200, bench: 130, deadlift: 240 };

describe('templates', () => {
  test('every template yields the declared number of weeks and days', () => {
    for (const t of TEMPLATES) {
      const days = resolveProgram(t, bests);
      expect(days).toHaveLength(t.weeks * t.daysPerWeek);
      for (let w = 1; w <= t.weeks; w++) expect(t.week(w)).toHaveLength(t.daysPerWeek);
    }
  });

  test('all weights are multiples of 2.5 kg, ≥ bar, and never above the e1RM', () => {
    for (const t of TEMPLATES) {
      for (const d of resolveProgram(t, bests)) {
        for (const s of d.sets) {
          if (s.weightKg == null) { expect(s.pct).toBeUndefined(); continue; }
          expect(s.weightKg % 2.5).toBe(0);
          expect(s.weightKg).toBeGreaterThanOrEqual(20);
          const best = bests[parentOf(s.exercise) as keyof typeof bests];
          expect(s.weightKg).toBeLessThanOrEqual(best * factorOf(s.exercise));
        }
      }
    }
  });

  test('sets and reps are positive integers', () => {
    for (const t of TEMPLATES) for (const d of resolveProgram(t, bests)) for (const s of d.sets) {
      expect(Number.isInteger(s.sets) && s.sets > 0).toBe(true);
      expect(Number.isInteger(s.reps) && s.reps > 0).toBe(true);
    }
  });

  test('meet prep: week 5 squat single is the opener (91% floored)', () => {
    const t = templateById('meet-prep-8')!;
    const day = resolveProgram(t, bests).find(d => d.week === 5 && d.day === 1)!;
    expect(day.sets[0].exercise).toBe('squat');
    expect(day.sets[0].weightKg).toBe(180); // floor(200 × 0.91 = 182) → 180
    expect(day.sets[0].note).toBe('opener');
  });

  test('meet prep: last day is meet day with no prescribed weights', () => {
    const t = templateById('meet-prep-8')!;
    const days = resolveProgram(t, bests);
    const last = days[days.length - 1];
    expect(last.week).toBe(8);
    expect(last.name).toBe('Meet day');
    expect(last.sets.every(s => s.weightKg == null)).toBe(true);
  });

  test('missing e1RM leaves weights null instead of crashing', () => {
    const t = templateById('full-body-3')!;
    const days = resolveProgram(t, { squat: 200 });
    const benchSets = days.flatMap(d => d.sets).filter(s => parentOf(s.exercise) === 'bench');
    expect(benchSets.length).toBeGreaterThan(0);
    expect(benchSets.every(s => s.weightKg == null)).toBe(true);
  });

  test('liftsNeeded lists the three competition lifts for every template', () => {
    for (const t of TEMPLATES) expect(liftsNeeded(t).sort()).toEqual(['bench', 'deadlift', 'squat']);
  });
});
