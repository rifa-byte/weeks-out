import { CATEGORY_LABEL, EXERCISES, TAG_LABEL, customId, exerciseById, exerciseName, factorOf, parentOf, searchExercises } from '../exercises';
import { swapExercise, resolveSet } from '../programs';

describe('exercise library', () => {
  test('ids are unique and slug-shaped', () => {
    const ids = EXERCISES.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
  test('every tag and category has a label', () => {
    for (const e of EXERCISES) {
      expect(CATEGORY_LABEL[e.category]).toBeTruthy();
      for (const t of e.tags) expect(TAG_LABEL[t]).toBeTruthy();
    }
  });
  test('variations have a parent and a sane factor; accessories have neither', () => {
    for (const e of EXERCISES) {
      if (e.category === 'main') { expect(e.parent).toBe(e.id); expect(e.factor).toBe(1); }
      if (e.category === 'variation') { expect(e.parent).not.toBeNull(); expect(e.factor).toBeGreaterThan(0.3); expect(e.factor).toBeLessThanOrEqual(1.1); }
      if (e.category === 'secondary' || e.category === 'accessory') expect(e.parent).toBeNull();
    }
  });
  test('names resolve for library, custom and legacy ids', () => {
    expect(exerciseName('pause-squat')).toBe('Pause squat');
    expect(exerciseName(customId('  Pause Deadlift '))).toBe('Pause deadlift');
    expect(exerciseName('row')).toBe('Row');
    expect(exerciseById('nope')).toBeNull();
    expect(parentOf('block-pull')).toBe('deadlift');
    expect(factorOf('unknown')).toBe(1);
  });
  test('search filters by parent, tag and text', () => {
    const squatVars = searchExercises({ parent: 'squat' });
    expect(squatVars.every(e => e.parent === 'squat')).toBe(true);
    expect(squatVars.some(e => e.id === 'squat')).toBe(true);
    const lowBack = searchExercises({ tag: 'low-back-friendly' });
    expect(lowBack.length).toBeGreaterThan(3);
    expect(lowBack.every(e => e.tags.includes('low-back-friendly'))).toBe(true);
    expect(searchExercises({ query: 'spoto' }).map(e => e.id)).toEqual(['spoto-press']);
    expect(searchExercises({ query: 'lockout', parent: 'bench' }).every(e => e.tags.includes('lockout'))).toBe(true);
  });
});

describe('swapping movements in a program', () => {
  const bests = { squat: 200, bench: 130, deadlift: 240 };
  test('a variation re-derives its weight from the parent and factor', () => {
    const base = resolveSet({ exercise: 'squat', sets: 3, reps: 5, pct: 0.8, rpe: 7 }, bests);
    expect(base.weightKg).toBe(160);
    const paused = swapExercise(base, 'pause-squat', bests);
    expect(paused.exercise).toBe('pause-squat');
    expect(paused.weightKg).toBe(142.5); // floor(200 × 0.8 × 0.9 = 144) → 142.5
    expect(paused.reps).toBe(5);
    expect(paused.rpe).toBe(7);
  });
  test('swapping to an accessory drops the percentage and weight', () => {
    const base = resolveSet({ exercise: 'bench', sets: 3, reps: 8, pct: 0.65, rpe: 7 }, bests);
    const fly = swapExercise(base, 'db-fly', bests);
    expect(fly.pct).toBeUndefined();
    expect(fly.weightKg).toBeNull();
  });
});
