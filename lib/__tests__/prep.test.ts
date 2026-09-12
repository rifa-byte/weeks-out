import { PREP_ITEMS, prepFor } from '../prep';

describe('prep', () => {
  test('ids unique, every item has a dose and a reason', () => {
    const ids = PREP_ITEMS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of PREP_ITEMS) { expect(i.dose.length).toBeGreaterThan(0); expect(i.why.length).toBeGreaterThan(0); }
  });
  test('squat day: general first, bar work last, nothing bench-only', () => {
    const list = prepFor(['squat']);
    expect(list[0].when).toBe('first');
    expect(list[list.length - 1].id).toBe('empty-bar-squat');
    expect(list.some(i => i.id === 'band-pull-apart')).toBe(false);
    expect(list.some(i => i.id === 'goblet-hold')).toBe(true);
  });
  test('full SBD day includes all three bar drills, in SBD order', () => {
    const list = prepFor(['squat', 'bench', 'deadlift']);
    const bars = list.filter(i => i.when === 'last').map(i => i.id);
    expect(bars).toEqual(['empty-bar-squat', 'empty-bar-bench', 'empty-bar-pulls']);
  });
  test('accessory-only session gets the general block', () => {
    const list = prepFor([]);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every(i => i.lifts === 'all')).toBe(true);
  });
});
