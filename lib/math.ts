/**
 * Weeks Out — powerlifting math.
 * Everything here is a pure function on kilograms so it can be unit-tested
 * without touching React Native.
 */

export type Sex = 'M' | 'F';
export type Lift = 'squat' | 'bench' | 'deadlift';
export const LIFTS: Lift[] = ['squat', 'bench', 'deadlift'];
export const LIFT_LABEL: Record<Lift, string> = { squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift' };

// ---------- units ----------
export const KG_PER_LB = 0.45359237;
export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;

/** Round to the nearest `step` (2.5 kg by default). */
export const roundTo = (x: number, step = 2.5) => Math.round(x / step) * step;
export const floorTo = (x: number, step = 2.5) => Math.floor(x / step + 1e-9) * step;

// ---------- RPE chart (RTS-style) ----------
// percent of 1RM for reps 1..10 at a given RPE.
const RPE_TABLE: Record<string, number[]> = {
  '10':  [100, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9],
  '9.5': [97.8, 93.9, 90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3],
  '9':   [95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7],
  '8.5': [93.9, 90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4],
  '8':   [92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0],
  '7.5': [90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7],
  '7':   [89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3],
  '6.5': [87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64.0],
  '6':   [86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3, 62.6],
};

export const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

/** Percent of 1RM (0–100) for a given reps @ RPE. Returns null outside the chart. */
export function rpePercent(reps: number, rpe: number): number | null {
  const row = RPE_TABLE[String(rpe)];
  if (!row) return null;
  if (reps < 1 || reps > 10 || !Number.isInteger(reps)) return null;
  return row[reps - 1];
}

/** Estimated 1RM from weight × reps @ RPE using the chart. Falls back to Epley when RPE is missing. */
export function e1rm(weightKg: number, reps: number, rpe?: number | null): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (rpe != null) {
    const pct = rpePercent(reps, rpe);
    if (pct) return weightKg / (pct / 100);
  }
  // Epley — assumes the set was taken to failure (RPE 10).
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Working weight for a target reps @ RPE given a 1RM. */
export function weightFor(oneRm: number, reps: number, rpe: number): number | null {
  const pct = rpePercent(reps, rpe);
  return pct == null ? null : oneRm * (pct / 100);
}

// ---------- scoring ----------

/** DOTS (2019). */
export function dots(total: number, bodyweightKg: number, sex: Sex): number {
  const c = sex === 'M'
    ? [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093]
    : [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706];
  const bw = clamp(bodyweightKg, sex === 'M' ? 40 : 40, sex === 'M' ? 210 : 150);
  const denom = c[0] + c[1] * bw + c[2] * bw ** 2 + c[3] * bw ** 3 + c[4] * bw ** 4;
  return (total * 500) / denom;
}

export type IpfEvent = 'SBD' | 'B';
export type IpfEquipment = 'raw' | 'equipped';

/** IPF GL points (2020). */
export function ipfGL(total: number, bodyweightKg: number, sex: Sex, event: IpfEvent = 'SBD', equipment: IpfEquipment = 'raw'): number {
  const table: Record<string, [number, number, number]> = {
    'M-SBD-raw': [1199.72839, 1025.18162, 0.00921],
    'F-SBD-raw': [610.32796, 1045.59282, 0.03048],
    'M-SBD-equipped': [1236.25115, 1449.21864, 0.01644],
    'F-SBD-equipped': [758.63878, 949.31382, 0.02435],
    'M-B-raw': [320.98041, 281.40258, 0.01008],
    'F-B-raw': [142.40398, 442.52671, 0.04724],
    'M-B-equipped': [381.22073, 733.79378, 0.02186],
    'F-B-equipped': [124.62061, 1006.11302, 0.05165],
  };
  const [A, B, C] = table[`${sex}-${event}-${equipment}`];
  const bw = clamp(bodyweightKg, 40, sex === 'M' ? 210 : 150);
  const coeff = 100 / (A - B * Math.exp(-C * bw));
  return total * coeff;
}

/** Original Wilks (the one most lifters still quote). */
export function wilks(total: number, bodyweightKg: number, sex: Sex): number {
  const c = sex === 'M'
    ? [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 7.01863e-6, -1.291e-8]
    : [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 4.731582e-5, -9.054e-8];
  const bw = clamp(bodyweightKg, 40, sex === 'M' ? 201.9 : 154.53);
  const denom = c[0] + c[1] * bw + c[2] * bw ** 2 + c[3] * bw ** 3 + c[4] * bw ** 4 + c[5] * bw ** 5;
  return (total * 500) / denom;
}

/** Wilks 2 (2020 revision, 600-point scale). */
export function wilks2020(total: number, bodyweightKg: number, sex: Sex): number {
  const c = sex === 'M'
    ? [47.46178854, 8.472061379, 0.07369410346, -0.001395833811, 7.07665973070743e-6, -1.20804336482315e-8]
    : [-125.4255398, 13.71219419, -0.03307250631, -0.001050400051, 9.38773881462799e-6, -2.3334613884954e-8];
  const bw = clamp(bodyweightKg, 40, sex === 'M' ? 200.95 : 150.95);
  const denom = c[0] + c[1] * bw + c[2] * bw ** 2 + c[3] * bw ** 3 + c[4] * bw ** 4 + c[5] * bw ** 5;
  return (total * 600) / denom;
}

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}

// ---------- weight classes ----------
export const IPF_CLASSES: Record<Sex, number[]> = {
  M: [59, 66, 74, 83, 93, 105, 120],
  F: [47, 52, 57, 63, 69, 76, 84],
};

/** IPF weight-class label for a bodyweight, e.g. "93" or "120+". */
export function ipfClass(bodyweightKg: number, sex: Sex): string {
  const classes = IPF_CLASSES[sex];
  for (const c of classes) if (bodyweightKg <= c) return `${c}`;
  return `${classes[classes.length - 1]}+`;
}

// ---------- attempts ----------
export interface AttemptPlan { opener: number; second: number; third: number }

/**
 * Attempt selection from a best (true or estimated 1RM), in kg.
 * Defaults: opener ~91% (rounded down), second ~96%, third = goal (default 101%).
 * All attempts land on 2.5 kg increments as the rules require.
 */
export function planAttempts(best: number, opts: { openerPct?: number; secondPct?: number; thirdPct?: number; step?: number } = {}): AttemptPlan {
  const { openerPct = 0.91, secondPct = 0.96, thirdPct = 1.01, step = 2.5 } = opts;
  const opener = floorTo(best * openerPct, step);
  const second = Math.max(opener + step, roundTo(best * secondPct, step));
  const third = Math.max(second + step, roundTo(best * thirdPct, step));
  return { opener, second, third };
}

export interface WarmupSet { weight: number; reps: number }

/** Warm-up sequence from an opener. Bar (20 kg) first, then rising percentages. */
export function warmups(openerKg: number, barKg = 20, step = 2.5): WarmupSet[] {
  const scheme: [number, number][] = [
    [0.4, 5], [0.55, 3], [0.7, 2], [0.8, 1], [0.9, 1],
  ];
  const out: WarmupSet[] = [{ weight: barKg, reps: 10 }];
  for (const [pct, reps] of scheme) {
    const w = roundTo(openerKg * pct, step);
    if (w > barKg && w < openerKg && w !== out[out.length - 1].weight) out.push({ weight: w, reps });
  }
  return out;
}

// ---------- plates ----------
export interface Plate { kg: number; color: string; name: string }
/** IPF calibrated plate set (per side, heaviest first). */
export const IPF_PLATES: Plate[] = [
  { kg: 25, color: '#C7362E', name: 'red' },
  { kg: 20, color: '#2C55B2', name: 'blue' },
  { kg: 15, color: '#D9A400', name: 'yellow' },
  { kg: 10, color: '#2F8F5B', name: 'green' },
  { kg: 5, color: '#F2F2F2', name: 'white' },
  { kg: 2.5, color: '#1C1B19', name: 'black' },
  { kg: 1.25, color: '#9A9A9A', name: 'chrome' },
  { kg: 0.5, color: '#9A9A9A', name: 'chrome' },
  { kg: 0.25, color: '#9A9A9A', name: 'chrome' },
];

/** Typical commercial-gym kg set (black rubber / iron). */
export const GYM_KG_PLATES: Plate[] = [
  { kg: 25, color: '#2A2826', name: '25' },
  { kg: 20, color: '#2A2826', name: '20' },
  { kg: 15, color: '#2A2826', name: '15' },
  { kg: 10, color: '#2A2826', name: '10' },
  { kg: 5, color: '#2A2826', name: '5' },
  { kg: 2.5, color: '#2A2826', name: '2.5' },
  { kg: 1.25, color: '#2A2826', name: '1.25' },
];

/** Typical commercial-gym lb set, expressed in kg. */
export const GYM_LB_PLATES: Plate[] = [45, 35, 25, 10, 5, 2.5].map(lb => ({ kg: lb * KG_PER_LB, color: '#2A2826', name: `${lb}` }));

export type PlateSetId = 'ipf' | 'gym-kg' | 'gym-lb';
export const PLATE_SETS: Record<PlateSetId, { label: string; plates: Plate[]; barKg: number; collarsKg: number; step: number }> = {
  'ipf': { label: 'Competition (IPF)', plates: IPF_PLATES, barKg: 20, collarsKg: 5, step: 2.5 },
  'gym-kg': { label: 'Gym, kg plates', plates: GYM_KG_PLATES, barKg: 20, collarsKg: 0, step: 2.5 },
  'gym-lb': { label: 'Gym, lb plates', plates: GYM_LB_PLATES, barKg: 45 * KG_PER_LB, collarsKg: 0, step: 5 * KG_PER_LB },
};

export interface PlateLoad { perSide: Plate[]; remainder: number }

/**
 * Plates per side to load `targetKg`. Collars are 2.5 kg each in competition (5 kg total).
 * `remainder` is the weight that could not be loaded with the available plates.
 */
export function loadBar(targetKg: number, opts: { barKg?: number; collarsKg?: number; plates?: Plate[] } = {}): PlateLoad {
  const { barKg = 20, collarsKg = 5, plates = IPF_PLATES } = opts;
  let perSideKg = (targetKg - barKg - collarsKg) / 2;
  const perSide: Plate[] = [];
  if (perSideKg <= 0) return { perSide, remainder: 0 };
  for (const p of plates) {
    while (perSideKg + 1e-9 >= p.kg) { perSide.push(p); perSideKg -= p.kg; }
  }
  return { perSide, remainder: Math.round(perSideKg * 2 * 100) / 100 };
}

// ---------- dates ----------
/** Whole weeks (rounded up) between `from` and `meetDate`, never negative. Days too. */
export function weeksOut(meetDate: Date, from: Date = new Date()): { weeks: number; days: number } {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(meetDate.getFullYear(), meetDate.getMonth(), meetDate.getDate());
  const days = Math.max(0, Math.round((b - a) / 86400000));
  return { weeks: Math.ceil(days / 7), days };
}
