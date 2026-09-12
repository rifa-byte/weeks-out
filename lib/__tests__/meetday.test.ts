import { bestOf, buildTimeline, emptyAttempts, hhmm, parseHhmm, runningTotal, suggestAttempt, type LiftAttempts } from '../meetday';

describe('time helpers', () => {
  test('hhmm handles negatives (the day before) and wraps', () => {
    expect(hhmm(0)).toBe('00:00');
    expect(hhmm(9 * 60 + 5)).toBe('09:05');
    expect(hhmm(-150)).toBe('21:30');
  });
  test('parseHhmm', () => {
    expect(parseHhmm('7:30')).toBe(450);
    expect(parseHhmm('23:59')).toBe(1439);
    expect(parseHhmm('24:00')).toBeNull();
    expect(parseHhmm('abc')).toBeNull();
  });
});

describe('timeline', () => {
  const base = { weighInMin: 8 * 60, squatFlightMin: 10 * 60, cutting: false, bodyweightKg: 83 };

  test('2-hour weigh-in: sorted, wake before weigh-in, warm-ups before flight', () => {
    const tl = buildTimeline({ ...base, weighIn: '2h' });
    for (let i = 1; i < tl.length; i++) expect(tl[i].min).toBeGreaterThanOrEqual(tl[i - 1].min);
    const wake = tl.find(i => i.title === 'Wake up')!;
    const wi = tl.find(i => i.phase === 'weigh-in')!;
    const wu = tl.find(i => i.title === 'Start squat warm-ups')!;
    expect(wake.min).toBeLessThan(wi.min);
    expect(wu.min).toBe(10 * 60 - 45);
    expect(tl.some(i => i.phase === 'day-before')).toBe(true);
    expect(tl.some(i => i.phase === 'recovery' && i.min > wi.min && i.min < wu.min)).toBe(true);
  });

  test('24-hour weigh-in lands the day before and cutting adds a fluids item', () => {
    const tl = buildTimeline({ ...base, weighIn: '24h', weighInMin: 16 * 60, cutting: true });
    const wi = tl.find(i => i.phase === 'weigh-in')!;
    expect(wi.min).toBe(16 * 60 - 1440);
    expect(tl.some(i => i.title.startsWith('Last fluids'))).toBe(true);
    expect(tl.find(i => i.title === 'Wake up')!.min).toBe(10 * 60 - 180);
  });

  test('bench and deadlift flights default to sensible gaps and can be overridden', () => {
    const tl = buildTimeline({ ...base, weighIn: '2h' });
    expect(tl.find(i => i.title === 'Bench flight')!.min).toBe(10 * 60 + 105);
    expect(tl.find(i => i.title === 'Deadlift flight')!.min).toBe(10 * 60 + 210);
    const tl2 = buildTimeline({ ...base, weighIn: '2h', benchFlightMin: 13 * 60, deadliftFlightMin: 15 * 60 });
    expect(tl2.find(i => i.title === 'Bench flight')!.min).toBe(13 * 60);
    expect(tl2.find(i => i.title === 'Start deadlift warm-ups')!.min).toBe(15 * 60 - 30);
  });
});

describe('attempts', () => {
  const plan: [number, number, number] = [180, 192.5, 202.5];
  test('good lift → planned next (or +2.5 if planned is not higher)', () => {
    const a = emptyAttempts(plan);
    a[0].result = 'good';
    expect(suggestAttempt(plan, a, 1)).toBe(192.5);
    a[1] = { weightKg: 200, result: 'good' };
    expect(suggestAttempt(plan, a, 2)).toBe(202.5);
    a[1] = { weightKg: 202.5, result: 'good' };
    expect(suggestAttempt(plan, a, 2)).toBe(205);
  });
  test('miss → repeat the weight', () => {
    const a = emptyAttempts(plan);
    a[0].result = 'miss';
    expect(suggestAttempt(plan, a, 1)).toBe(180);
  });
  test('running total uses best good attempt and flags bomb-outs', () => {
    const s: LiftAttempts = [{ weightKg: 180, result: 'good' }, { weightKg: 192.5, result: 'good' }, { weightKg: 202.5, result: 'miss' }];
    const b: LiftAttempts = [{ weightKg: 110, result: 'miss' }, { weightKg: 110, result: 'miss' }, { weightKg: 110, result: 'miss' }];
    const d: LiftAttempts = [{ weightKg: 220, result: 'good' }, { weightKg: 240, result: null }, { weightKg: 250, result: null }];
    expect(bestOf(s)).toBe(192.5);
    const r = runningTotal({ squat: s, bench: b, deadlift: d });
    expect(r.total).toBe(412.5);
    expect(r.bombed).toEqual(['bench']);
  });
});
