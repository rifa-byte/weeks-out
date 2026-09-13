import { askACoach, buildMap, fixFor, headline, type FailEvent } from '../failmap';

const ev = (lift: FailEvent['lift'], pos: FailEvent['pos'], missed = false, date = '2026-09-01'): FailEvent =>
  ({ lift, pos, missed, date, exercise: lift, weightKg: 100, reps: 1, rpe: 10 });

describe('fail map', () => {
  test('aggregates per lift and finds the worst position', () => {
    const m = buildMap([ev('bench', 'top'), ev('bench', 'top', true), ev('bench', 'bottom'), ev('squat', 'bottom'), ev('bench', 'top', false, '2026-09-05')]);
    expect(m.bench.events).toBe(4);
    expect(m.bench.misses).toBe(1);
    expect(m.bench.worst).toBe('top');
    expect(m.bench.share).toBe(0.75);
    expect(m.bench.lastDate).toBe('2026-09-05');
    expect(m.squat.worst).toBe('bottom');
    expect(m.deadlift.events).toBe(0);
    expect(m.deadlift.worst).toBeNull();
  });
  test('ties go to the lower position', () => {
    const m = buildMap([ev('deadlift', 'top'), ev('deadlift', 'bottom')]);
    expect(m.deadlift.worst).toBe('bottom');
  });
  test('every fix resolves to real library exercises', () => {
    for (const lift of ['squat', 'bench', 'deadlift'] as const) for (const pos of ['bottom', 'mid', 'top'] as const) {
      const f = fixFor(lift, pos);
      expect(f.exercises.length).toBeGreaterThanOrEqual(3);
      expect(f.accessories.length).toBeGreaterThanOrEqual(3);
      expect(f.cues.length).toBeGreaterThanOrEqual(2);
      expect(f.why.length).toBeGreaterThan(20);
      for (const e of f.exercises) expect(e.parent).toBe(lift);
    }
  });
  test('headline is honest about sample size', () => {
    const one = buildMap([ev('squat', 'mid')]).squat;
    expect(headline(one, 8)).toMatch(/One set stuck halfway up/);
    const many = buildMap(Array.from({ length: 5 }, () => ev('squat', 'mid')).concat([ev('squat', 'top')])).squat;
    expect(headline(many, 8)).toMatch(/83% of them halfway up\. That is your sticking point/);
    const none = buildMap([]).bench;
    expect(headline(none, 8)).toMatch(/No sticking points/);
  });
  test('suggests a coach only when a pattern is clear or misses pile up', () => {
    expect(askACoach(buildMap([ev('squat', 'mid')]).squat)).toBe(false);
    expect(askACoach(buildMap(Array.from({ length: 6 }, () => ev('squat', 'mid'))).squat)).toBe(true);
    expect(askACoach(buildMap(Array.from({ length: 3 }, () => ev('bench', 'top', true))).bench)).toBe(true);
  });
});
