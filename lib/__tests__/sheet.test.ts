import { loadOf, matchExercise, parseSheets, setsReps, sheetsExportUrl } from '../sheet';

describe('cell parsing', () => {
  test('sets × reps', () => {
    expect(setsReps('3x5')).toEqual({ sets: 3, reps: 5 });
    expect(setsReps('4 × 6')).toEqual({ sets: 4, reps: 6 });
    expect(setsReps('5 sets of 3')).toEqual({ sets: 5, reps: 3 });
    expect(setsReps('140kg')).toBeNull();
  });
  test('loads', () => {
    expect(loadOf('140', 'kg')).toEqual({ kg: 140 });
    expect(loadOf('315 lb', 'kg').kg).toBe(143);
    expect(loadOf('80%', 'kg')).toEqual({ pct: 0.8 });
    expect(loadOf('5 @ 8', 'kg')).toEqual({ rpe: 8 });
    expect(loadOf('140x5@8', 'kg')).toEqual({ kg: 140, reps: 5, rpe: 8 });
    expect(loadOf('315lb x 3', 'kg')).toEqual({ kg: 143, reps: 3 });
    expect(loadOf('RPE 8.5', 'kg')).toEqual({ rpe: 8.5 });
    expect(loadOf('3x5 @ 75%', 'kg')).toEqual({ pct: 0.75, sets: 3, reps: 5 });
  });
  test('exercise names', () => {
    expect(matchExercise('Comp Squat')).toEqual({ id: 'squat', matched: true });
    expect(matchExercise('Bench Press')).toEqual({ id: 'bench', matched: true });
    expect(matchExercise('Sumo DL')).toEqual({ id: 'deadlift', matched: true });
    expect(matchExercise('Paused Bench (2s)')).toEqual({ id: 'pause-bench', matched: true });
    expect(matchExercise('RDLs')).toEqual({ id: 'rdl', matched: true });
    expect(matchExercise('Romanian Deadlift')).toEqual({ id: 'rdl', matched: true });
    expect(matchExercise('Cable Crunch Special')).toEqual({ id: 'custom:cable crunch special', matched: false });
  });
  test('google sheets link → export url', () => {
    expect(sheetsExportUrl('https://docs.google.com/spreadsheets/d/1AbC_dEf-123/edit#gid=0')).toBe('https://docs.google.com/spreadsheets/d/1AbC_dEf-123/export?format=xlsx');
    expect(sheetsExportUrl('https://example.com/x.xlsx')).toBeNull();
  });
});

describe('layouts', () => {
  test('vertical: Week / Day markers with a header row', () => {
    const grid = [
      ['Week 1'],
      ['Day 1 - Squat'],
      ['Exercise', 'Sets', 'Reps', 'Weight', 'RPE', 'Notes'],
      ['Comp Squat', 4, 5, 140, 8, 'belt'],
      ['Paused Bench', 3, 6, 90, 7, ''],
      ['Leg curl', 3, 12, '', '', ''],
      [],
      ['Day 2 - Deadlift'],
      ['Exercise', 'Sets', 'Reps', 'Weight', 'RPE'],
      ['Deadlift', 3, 3, 180, 8.5],
      ['Week 2'],
      ['Day 1'],
      ['Comp Squat', 4, 4, 145, 8],
      ['Day 2'],
      ['Deadlift', 3, 2, 185, 8.5],
    ];
    const p = parseSheets([{ name: 'Block 1', grid }])!;
    expect(p).not.toBeNull();
    expect(p.weeks).toBe(2);
    expect(p.daysPerWeek).toBe(2);
    expect(p.days).toHaveLength(4);
    expect(p.days[0].name).toBe('Day 1 - Squat');
    expect(p.days[0].sets).toEqual([
      { exercise: 'squat', sets: 4, reps: 5, fixedKg: 140, rpe: 8, note: 'belt' },
      { exercise: 'pause-bench', sets: 3, reps: 6, fixedKg: 90, rpe: 7 },
      { exercise: 'leg-curl', sets: 3, reps: 12 },
    ]);
    expect(p.days[1].sets[0]).toEqual({ exercise: 'deadlift', sets: 3, reps: 3, fixedKg: 180, rpe: 8.5 });
    expect(p.days[2].sets[0].fixedKg).toBe(145);
    expect(p.days[3].sets[0].reps).toBe(2);
    expect(p.name).toBe('Block 1');
  });

  test('table: Week and Day columns, one row per line, percentages and lb', () => {
    const grid = [
      ['Week', 'Day', 'Exercise', 'Sets', 'Reps', 'Weight (lbs)', 'RPE'],
      [1, 1, 'Squat', 5, 5, 315, ''],
      [1, 1, 'Bench Press', 5, 5, 225, ''],
      [1, 2, 'Deadlift', 1, 5, 405, 9],
      [2, 1, 'Squat', 5, 5, 325, ''],
      [2, 2, 'Deadlift', 1, 5, 415, 9],
    ];
    const p = parseSheets([{ name: 'Sheet1', grid }], { name: 'Coach Tan LP' })!;
    expect(p.units).toBe('lb');
    expect(p.weeks).toBe(2);
    expect(p.daysPerWeek).toBe(2);
    expect(p.days[0].sets[0]).toEqual({ exercise: 'squat', sets: 5, reps: 5, fixedKg: 143 });
    expect(p.days[1].sets[0].rpe).toBe(9);
    expect(p.days[3].sets[0].fixedKg).toBe(188);   // 415 lb
    expect(p.name).toBe('Coach Tan LP');
  });

  test('weeks across: block per day, one column per week', () => {
    const grid = [
      ['Lower A'],
      ['Exercise', 'Sets', 'Reps', 'Week 1', 'Week 2', 'Week 3'],
      ['Squat', 4, 5, '140', '145', '150 x 3'],
      ['RDL', 3, 8, '100', '105', '110'],
      [],
      ['Upper A'],
      ['Exercise', 'Sets', 'Reps', 'Week 1', 'Week 2', 'Week 3'],
      ['Bench', 4, 5, '80%', '82.5%', '85% @ 8'],
    ];
    const p = parseSheets([{ name: 'Program', grid }])!;
    expect(p.weeks).toBe(3);
    expect(p.daysPerWeek).toBe(2);
    expect(p.days[0].name).toBe('Lower A');
    expect(p.days[0].sets[0]).toEqual({ exercise: 'squat', sets: 4, reps: 5, fixedKg: 140 });
    expect(p.days[4].sets[0]).toEqual({ exercise: 'squat', sets: 4, reps: 3, fixedKg: 150 });   // week 3 "150 x 3" overrides reps
    expect(p.days[1].sets[0]).toEqual({ exercise: 'bench', sets: 4, reps: 5, pct: 0.8 });
    expect(p.days[5].sets[0]).toEqual({ exercise: 'bench', sets: 4, reps: 5, pct: 0.85, rpe: 8 });
  });

  test('one sheet per week, blank rows separate days, no header', () => {
    const wk = (mult: number) => [
      ['Squat', '3x5', `${140 * mult}kg`],
      ['Bench', '3x5', `${90 * mult}kg`],
      [],
      ['Deadlift', '1x5', `${180 * mult}kg @ 8`],
      ['Pull ups', '3x8', ''],
    ];
    const p = parseSheets([{ name: 'Week 1', grid: wk(1) }, { name: 'Week 2', grid: wk(1.05) }])!;
    expect(p.weeks).toBe(2);
    expect(p.daysPerWeek).toBe(2);
    expect(p.days[0].sets).toEqual([{ exercise: 'squat', sets: 3, reps: 5, fixedKg: 140 }, { exercise: 'bench', sets: 3, reps: 5, fixedKg: 90 }]);
    expect(p.days[1].sets[0]).toEqual({ exercise: 'deadlift', sets: 1, reps: 5, fixedKg: 180, rpe: 8 });
    expect(p.days[1].sets[1]).toEqual({ exercise: 'pull-up', sets: 3, reps: 8 });
    expect(p.days[2].sets[0].fixedKg).toBe(147);
  });

  test('nothing recognisable → null', () => {
    expect(parseSheets([{ name: 'x', grid: [['hello', 'world'], ['just', 'text']] }])).toBeNull();
    expect(parseSheets([])).toBeNull();
  });
});
