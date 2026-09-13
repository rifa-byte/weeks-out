import { TEMPLATES, resolveProgram } from '../programs';
import { b64urlDecode, b64urlEncode, blankProgram, decodeProgram, encodeProgram, toTemplate, unknownExercises, type SharedProgram } from '../share';

describe('base64url', () => {
  test('round-trips ascii and unicode', () => {
    for (const s of ['', 'a', 'ab', 'abc', 'Weeks Out — 8 wk × 3', '日本語 ✓']) {
      expect(b64urlDecode(b64urlEncode(s))).toBe(s);
    }
    expect(b64urlEncode('abc')).toBe('YWJj');
    expect(b64urlDecode('###')).toBeNull();
  });
});

function fromTemplate(id: string): SharedProgram {
  const t = TEMPLATES.find(x => x.id === id)!;
  const days: SharedProgram['days'] = [];
  for (let w = 1; w <= t.weeks; w++) for (const d of t.week(w)) days.push({ name: d.name, sets: d.sets });
  return { name: t.name, author: 'Rif', about: t.shape, weeks: t.weeks, daysPerWeek: t.daysPerWeek, days };
}

describe('share codes', () => {
  test('every built-in template survives encode → decode and resolves identically', () => {
    const bests = { squat: 200, bench: 130, deadlift: 240 };
    for (const t of TEMPLATES) {
      const code = encodeProgram(fromTemplate(t.id));
      expect(code.startsWith('WO1.')).toBe(true);
      const back = decodeProgram(code)!;
      expect(back).not.toBeNull();
      expect(back.name).toBe(t.name);
      const a = resolveProgram(t, bests).map(d => d.sets.map(s => [s.exercise, s.sets, s.reps, s.weightKg]));
      const b = resolveProgram(toTemplate(back), bests).map(d => d.sets.map(s => [s.exercise, s.sets, s.reps, s.weightKg]));
      expect(b).toEqual(a);
    }
  });
  test('codes are pasteable in a message and tolerate surrounding text', () => {
    const code = encodeProgram(fromTemplate('sbd-split-4'));
    expect(code.length).toBeLessThan(6000);
    expect(decodeProgram(`here you go bro:\n${code}\nenjoy`)?.name).toBe('4-day SBD split');
  });
  test('garbage is rejected', () => {
    expect(decodeProgram('WO1.notbase64!!')).toBeNull();
    expect(decodeProgram('hello')).toBeNull();
    expect(decodeProgram('WO1.' + b64urlEncode('{"v":1,"n":"x","w":2,"d":2,"days":[]}'))).toBeNull(); // day count mismatch
  });
  test('blank program has the right number of empty days', () => {
    const p = blankProgram('Mine', 4, 3);
    expect(p.days).toHaveLength(12);
    expect(p.days.every(d => d.sets.length === 0)).toBe(true);
    expect(decodeProgram(encodeProgram(p))?.days).toHaveLength(12);
  });
  test('unknown movements are reported, custom ones are not', () => {
    const p = blankProgram('x', 1, 1);
    p.days[0].sets = [{ exercise: 'squat', sets: 3, reps: 5 }, { exercise: 'zercher-yoke', sets: 1, reps: 1 }, { exercise: 'custom:my thing', sets: 1, reps: 1 }];
    expect(unknownExercises(p)).toEqual(['zercher-yoke']);
  });
});
