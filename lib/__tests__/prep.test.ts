import { PREP_ITEMS, prepFor } from '../prep';

describe('prep', () => {
  test('ids unique, every item has a dose and a reason', () => {
    const ids = PREP_ITEMS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of PREP_ITEMS) { expect(i.dose.length).toBeGreaterThan(0); expect(i.why.length).toBeGreaterThan(0); }
  });
  test('squat day short list: general, band, hold, bar — nothing bench-only', () => {
    const list = prepFor(['squat']);
    expect(list.length).toBeLessThanOrEqual(4);
    expect(list[list.length - 1].id).toBe('empty-bar-squat');
    expect(list.some(i => i.id === 'band-pull-apart')).toBe(false);
    expect(list.some(i => i.id === 'goblet-hold')).toBe(true);
  });
  test('the full list is longer and starts with the general warm-up', () => {
    const short = prepFor(['squat']);
    const full = prepFor(['squat'], true);
    expect(full.length).toBeGreaterThan(short.length);
    expect(full[0].when).toBe('first');
  });
  test('full SBD day includes all three bar drills, in SBD order', () => {
    const list = prepFor(['squat', 'bench', 'deadlift']);
    const bars = list.filter(i => i.when === 'last').map(i => i.id);
    expect(bars).toEqual(['empty-bar-squat', 'empty-bar-bench', 'empty-bar-pulls']);
    expect(list.length).toBeLessThanOrEqual(10);
  });
  test('accessory-only session gets the general block', () => {
    const list = prepFor([]);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every(i => i.lifts === 'all')).toBe(true);
  });
});
