import {
  e1rm, rpePercent, weightFor, dots, ipfGL, wilks, wilks2020, ipfClass,
  planAttempts, warmups, loadBar, roundTo, floorTo, kgToLb, lbToKg, weeksOut,
} from '../math';

describe('units', () => {
  test('kg ↔ lb round-trips', () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 2);
    expect(lbToKg(kgToLb(142.5))).toBeCloseTo(142.5, 6);
  });
  test('rounding to 2.5', () => {
    expect(roundTo(151.2)).toBe(150);
    expect(roundTo(151.3)).toBe(152.5);
    expect(floorTo(154.9)).toBe(152.5);
    expect(floorTo(155)).toBe(155);
  });
});

describe('RPE chart and e1RM', () => {
  test('chart anchors', () => {
    expect(rpePercent(1, 10)).toBe(100);
    expect(rpePercent(5, 8)).toBe(81.1);
    expect(rpePercent(11, 8)).toBeNull();
    expect(rpePercent(3, 5)).toBeNull();
  });
  test('1 rep @ RPE 10 is the 1RM', () => {
    expect(e1rm(200, 1, 10)).toBe(200);
  });
  test('5 @ 8 with 160 kg ≈ 197.3', () => {
    expect(e1rm(160, 5, 8)).toBeCloseTo(197.29, 1);
  });
  test('falls back to Epley without RPE', () => {
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1);
  });
  test('weightFor inverts e1rm', () => {
    const w = weightFor(200, 5, 8)!;
    expect(e1rm(w, 5, 8)).toBeCloseTo(200, 6);
  });
});

describe('scoring', () => {
  // Reference rows from OpenPowerlifting (bodyweight shown to 0.1 kg, so allow ±0.6).
  test('DOTS matches OpenPowerlifting listings', () => {
    expect(dots(757.5, 89.1, 'M')).toBeCloseTo(492.16, 0);
    expect(dots(782.5, 95.3, 'M')).toBeCloseTo(492.15, 0);
    expect(dots(370, 68.4, 'F')).toBeCloseTo(379.09, 0);
    expect(dots(472.5, 125.9, 'F')).toBeCloseTo(374.31, 0);
  });
  // Worked examples published with the IPF GL coefficients.
  test('IPF GL worked examples', () => {
    expect(ipfGL(700, 90, 'M')).toBeCloseTo(93.06, 1);
    expect(ipfGL(400, 60, 'F')).toBeCloseTo(90.42, 1);
    expect(ipfGL(605, 74, 'M')).toBeCloseTo(88.82, 1);
  });
  // Wikipedia's worked examples for the original Wilks formula (lb inputs).
  test('Wilks (original) worked examples', () => {
    expect(wilks(lbToKg(1400), lbToKg(320), 'M')).toBeCloseTo(353.0, 0);
    expect(wilks(lbToKg(1000), lbToKg(200), 'M')).toBeCloseTo(288.4, 0);
  });
  test('Wilks 2020 is monotonic in total', () => {
    expect(wilks2020(710, 90, 'M')).toBeGreaterThan(wilks2020(700, 90, 'M'));
  });
  test('IPF classes', () => {
    expect(ipfClass(92.4, 'M')).toBe('93');
    expect(ipfClass(93.0, 'M')).toBe('93');
    expect(ipfClass(93.1, 'M')).toBe('105');
    expect(ipfClass(130, 'M')).toBe('120+');
    expect(ipfClass(46.9, 'F')).toBe('47');
    expect(ipfClass(90, 'F')).toBe('84+');
  });
});

describe('attempts', () => {
  test('plan from a 200 kg best lands on 2.5 kg steps and ascends', () => {
    const p = planAttempts(200);
    expect(p).toEqual({ opener: 180, second: 192.5, third: 202.5 });
    for (const v of Object.values(p)) expect(v % 2.5).toBe(0);
  });
  test('never produces equal or descending attempts', () => {
    for (let best = 60; best <= 400; best += 7.3) {
      const p = planAttempts(best);
      expect(p.second).toBeGreaterThan(p.opener);
      expect(p.third).toBeGreaterThan(p.second);
    }
  });
  test('warm-ups start with the bar and stay below the opener', () => {
    const w = warmups(182.5);
    expect(w[0]).toEqual({ weight: 20, reps: 10 });
    for (let i = 1; i < w.length; i++) {
      expect(w[i].weight).toBeGreaterThan(w[i - 1].weight);
      expect(w[i].weight).toBeLessThan(182.5);
    }
  });
});

describe('plates', () => {
  test('182.5 kg with collars = 25+25+25+2.5+1.25 per side', () => {
    const { perSide, remainder } = loadBar(182.5);
    expect(perSide.map(p => p.kg)).toEqual([25, 25, 25, 2.5, 1.25]);
    expect(remainder).toBe(0);
  });
  test('bar only', () => {
    expect(loadBar(25).perSide).toEqual([]);
  });
  test('reports unloadable remainder', () => {
    expect(loadBar(25.2, { collarsKg: 0 }).remainder).toBeCloseTo(0.2, 6);
  });
});

describe('weeksOut', () => {
  test('12 Sep → 7 Nov 2026 is 56 days, 8 weeks', () => {
    expect(weeksOut(new Date(2026, 10, 7), new Date(2026, 8, 12))).toEqual({ weeks: 8, days: 56 });
  });
  test('never negative after the meet', () => {
    expect(weeksOut(new Date(2026, 10, 7), new Date(2026, 10, 9))).toEqual({ weeks: 0, days: 0 });
  });
});
