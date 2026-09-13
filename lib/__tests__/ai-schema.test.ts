import { expandAiProgram, type AiProgram } from '../ai-schema';
import { DEFAULT_ANSWERS } from '../generator';
import { resolveProgram } from '../programs';

const bests = { squat: 200, bench: 130, deadlift: 240 };

const sample: AiProgram = {
  name: 'Test block', about: 'x', why: 'y',
  phases: [
    { phase: 'accumulate', weeks: 3, pctPerWeek: 0.025, repsDropEveryWeeks: 2, days: [
      { name: 'A', sets: [{ exercise: 'squat', sets: 1, reps: 5, pct: 0.72, rpe: 7.5 }, { exercise: 'Pause bench', sets: 3, reps: 5, pct: 0.7 }, { exercise: 'Zercher yoke carry', sets: 3, reps: 10 }] },
      { name: 'B', sets: [{ exercise: 'deadlift', sets: 1, reps: 4, pct: 1.2, rpe: 11 }] },
    ] },
  ],
};

describe('AI program expansion', () => {
  test('cleans ids, clamps numbers, pads days, progresses weekly', () => {
    const t = expandAiProgram(sample, { ...DEFAULT_ANSWERS, mode: 'general', weeks: 3, days: 3 });
    expect(t.weeks).toBe(3);
    expect(t.daysPerWeek).toBe(3);
    const w1 = t.week(1), w3 = t.week(3);
    expect(w1[0].sets[1].exercise).toBe('pause-bench');          // name → id
    expect(w1[0].sets[2].exercise.startsWith('custom:')).toBe(true); // unknown → custom
    expect(w1[1].sets[0].pct).toBe(0.97);                         // 1.2 clamped
    expect(w1[1].sets[0].rpe).toBe(10);
    expect(w1[2].name).toBe('Rest');                              // padded
    expect(w3[0].sets[0].pct).toBeCloseTo(0.77, 5);               // +0.025 × 2
    expect(w3[0].sets[0].reps).toBe(4);                           // dropped once at week 3
    for (const d of resolveProgram(t, bests)) for (const s of d.sets) if (s.weightKg != null) expect(s.weightKg).toBeLessThanOrEqual(240);
  });
  test('meet mode forces the total weeks and a final taper', () => {
    const t = expandAiProgram(sample, { ...DEFAULT_ANSWERS, mode: 'meet', weeks: 8, days: 3 });
    expect(t.weeks).toBe(8);
    const days = resolveProgram(t, bests);
    expect(days[days.length - 1].name).toBe('Meet day');
  });
  test('rejects an empty answer', () => {
    expect(() => expandAiProgram({ name: '', about: '', why: '', phases: [] }, DEFAULT_ANSWERS)).toThrow();
  });
});
