import { exerciseById, factorOf, parentOf } from '../exercises';
import { DEFAULT_ANSWERS, generateProgram, type Answers } from '../generator';
import { resolveProgram } from '../programs';

const bests = { squat: 200, bench: 130, deadlift: 240 };

function check(a: Answers) {
  const t = generateProgram(a);
  const days = resolveProgram(t, bests);
  expect(days).toHaveLength(t.weeks * t.daysPerWeek);
  for (const d of days) for (const s of d.sets) {
    expect(s.sets).toBeGreaterThanOrEqual(1); expect(s.sets).toBeLessThanOrEqual(8);
    expect(s.reps).toBeGreaterThanOrEqual(1); expect(s.reps).toBeLessThanOrEqual(15);
    expect(exerciseById(s.exercise)).not.toBeNull();
    if (s.weightKg != null) expect(s.weightKg).toBeLessThanOrEqual(bests[parentOf(s.exercise)!] * factorOf(s.exercise));
  }
  return { t, days };
}

describe('questionnaire generator', () => {
  test('every combination builds a valid program', () => {
    for (const mode of ['meet', 'general'] as const)
      for (const level of ['beginner', 'intermediate', 'advanced'] as const)
        for (const days of [2, 3, 4, 5, 6])
          for (const fatigue of ['low', 'medium', 'high'] as const)
            for (const block of ['volume', 'strength', 'peak'] as const)
              check({ ...DEFAULT_ANSWERS, mode, level, days, fatigue, block, weeks: mode === 'meet' ? 8 : 6 });
  });

  test('general mode makes a single block; meet mode ends on meet day', () => {
    const g = check({ ...DEFAULT_ANSWERS, mode: 'general', block: 'volume', weeks: 6 });
    expect(g.days[g.days.length - 1].name).not.toBe('Meet day');
    expect(g.t.name).toMatch(/volume block/);
    const m = check({ ...DEFAULT_ANSWERS, mode: 'meet', weeks: 8 });
    expect(m.days[m.days.length - 1].name).toBe('Meet day');
  });

  test('low fatigue tolerance means fewer back-off sets than high', () => {
    const lo = generateProgram({ ...DEFAULT_ANSWERS, fatigue: 'low' }).week(2);
    const hi = generateProgram({ ...DEFAULT_ANSWERS, fatigue: 'high' }).week(2);
    const count = (w: typeof lo) => w.flatMap(d => d.sets).filter(s => s.pct != null).reduce((n, s) => n + s.sets, 0);
    expect(count(lo)).toBeLessThan(count(hi));
  });

  test('bench focus adds a bench exposure on a day that had none', () => {
    const plain = generateProgram({ ...DEFAULT_ANSWERS, days: 4, focus: 'balanced' }).week(1);
    const bench = generateProgram({ ...DEFAULT_ANSWERS, days: 4, focus: 'bench' }).week(1);
    const benchDays = (w: typeof plain) => w.filter(d => d.sets.some(s => parentOf(s.exercise) === 'bench')).length;
    expect(benchDays(bench)).toBeGreaterThan(benchDays(plain));
  });

  test('a knee limitation swaps pause squats for box squats and keeps the competition squat', () => {
    const w = generateProgram({ ...DEFAULT_ANSWERS, days: 4, limitations: ['knee'] }).week(1);
    const ids = new Set(w.flatMap(d => d.sets.map(s => s.exercise)));
    expect(ids.has('box-squat')).toBe(true);
    expect(ids.has('pause-squat')).toBe(false);
    expect(ids.has('squat')).toBe(true);
  });

  test('45-minute sessions keep at most one accessory', () => {
    const w = generateProgram({ ...DEFAULT_ANSWERS, days: 4, sessionMinutes: 45 }).week(1);
    for (const d of w) expect(d.sets.filter(s => s.pct == null).length).toBeLessThanOrEqual(1);
  });

  test('beginners use higher reps and lower % than advanced on the same week', () => {
    const b = generateProgram({ ...DEFAULT_ANSWERS, level: 'beginner' }).week(1)[0].sets[0];
    const a = generateProgram({ ...DEFAULT_ANSWERS, level: 'advanced' }).week(1)[0].sets[0];
    expect(b.reps).toBeGreaterThan(a.reps);
    expect(b.pct!).toBeLessThan(a.pct!);
  });
});
