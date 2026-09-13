import { classesIn, nameMatches, normalizeName, ordinal, percentile, placeLabel, rankOf, shardKeys, type LadderCombo, type LadderMeet } from '../opl';

describe('name normalisation (must match scripts/opl-build.mjs)', () => {
  test('strips accents, case, punctuation and the #2 disambiguator', () => {
    expect(normalizeName('Jesús Olivares')).toBe('jesus olivares');
    expect(normalizeName("Adam O'Brien")).toBe('adam o brien');
    expect(normalizeName('Rif Tan #2')).toBe('rif tan');
  });
  test('shard keys: first two letters of each word, padded with _', () => {
    expect(shardKeys('taylor atwood')).toEqual(['ta', 'at']);
    expect(shardKeys('adam o brien')).toEqual(['ad', 'o_', 'br']);
    expect(shardKeys('li li')).toEqual(['li']);
  });
  test('every query word must start a word of the name', () => {
    expect(nameMatches('taylor atwood', 'atw')).toBe(true);
    expect(nameMatches('taylor atwood', 'tay atw')).toBe(true);
    expect(nameMatches('taylor atwood', 'Atwood, Taylor')).toBe(true);
    expect(nameMatches('taylor atwood', 'ylor')).toBe(false);
    expect(nameMatches('jesus olivares', 'jesús')).toBe(true);
  });
});

const combo: LadderCombo = { n: 10, min: 500, step: 2.5, counts: [1, 0, 2, 3, 0, 0, 0, 3, 0, 1], top: [] };
// bins: 500,502.5,505,507.5,...  counts sum = 10

describe('ladder maths', () => {
  test('percentile counts lifters strictly below your bin', () => {
    expect(percentile(combo, 499)).toBe(0);
    expect(percentile(combo, 507.5)).toBe(30);   // bins 500 (1) + 505 (2) below → 3 of 10
    expect(percentile(combo, 600)).toBe(100);
  });
  test('rank counts lifters strictly above', () => {
    expect(rankOf(combo, 600)).toBe(1);
    expect(rankOf(combo, 507.5)).toBe(5);        // 3 (507.5 bin excluded) … lifters above: bins 517.5 (3) + 522.5 (1) = 4 → rank 5
    expect(rankOf(combo, 0)).toBe(11);
  });
  test('place at a meet from its podium', () => {
    const m: LadderMeet = { meet: 'Nationals', date: '2026-03-01', fed: 'PS', n: 12, podium: [700, 650, 600] };
    expect(placeLabel(m, 710)).toBe('1st');
    expect(placeLabel(m, 660)).toBe('2nd');
    expect(placeLabel(m, 610)).toBe('3rd');
    expect(placeLabel(m, 590)).toBe('4th or lower');
    const small: LadderMeet = { ...m, n: 3 };
    expect(placeLabel(small, 590)).toBe('4th');
  });
  test('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
  });
  test('classes sorted with the open class last', () => {
    const l = { 'M-raw-120+': combo, 'M-raw-83': combo, 'M-raw-59': combo, 'F-raw-52': combo, 'M-wraps-93': combo };
    expect(classesIn(l, 'M', 'raw')).toEqual(['59', '83', '120+']);
    expect(classesIn(l, 'F', 'raw')).toEqual(['52']);
  });
});
