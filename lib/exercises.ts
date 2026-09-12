/**
 * Weeks Out — exercise library.
 *
 * Every movement has a stable id (what the log stores), a display name, a category,
 * and — for anything derived from a competition lift — the parent lift and a
 * `factor`: roughly what fraction of the parent's 1RM a lifter can handle on this
 * variation. Programs prescribe a percentage of the parent e1RM, and the factor
 * scales it, so swapping "pause squat" for "pin squat" re-computes the weight.
 *
 * Tags are what the picker filters on: which weak point a variation targets and
 * which rehab situations it tends to suit. They are coaching heuristics, not rules.
 */
import type { Lift } from './math';

export type Category = 'main' | 'variation' | 'secondary' | 'accessory';

export type Tag =
  // weak points
  | 'out-of-the-hole' | 'mid-range' | 'lockout' | 'off-the-chest' | 'off-the-floor' | 'bracing' | 'speed'
  // muscles / qualities
  | 'quads' | 'posterior-chain' | 'glutes' | 'hamstrings' | 'upper-back' | 'lats' | 'chest' | 'triceps' | 'shoulders' | 'biceps' | 'core' | 'hypertrophy'
  // rehab-friendly
  | 'low-back-friendly' | 'shoulder-friendly' | 'knee-friendly' | 'hip-friendly' | 'elbow-friendly';

export const TAG_LABEL: Record<Tag, string> = {
  'out-of-the-hole': 'out of the hole', 'mid-range': 'mid-range', 'lockout': 'lockout', 'off-the-chest': 'off the chest',
  'off-the-floor': 'off the floor', 'bracing': 'bracing', 'speed': 'speed',
  'quads': 'quads', 'posterior-chain': 'posterior chain', 'glutes': 'glutes', 'hamstrings': 'hamstrings', 'upper-back': 'upper back',
  'lats': 'lats', 'chest': 'chest', 'triceps': 'triceps', 'shoulders': 'shoulders', 'biceps': 'biceps', 'core': 'core', 'hypertrophy': 'hypertrophy',
  'low-back-friendly': 'low-back friendly', 'shoulder-friendly': 'shoulder friendly', 'knee-friendly': 'knee friendly',
  'hip-friendly': 'hip friendly', 'elbow-friendly': 'elbow friendly',
};

export interface Exercise {
  id: string;
  name: string;
  category: Category;
  parent: Lift | null;   // competition lift this derives from (for % and history grouping)
  factor: number;        // fraction of parent 1RM; 1 for the lift itself; ignored when parent is null
  tags: Tag[];
  unilateral?: boolean;
  bodyweight?: boolean;  // pull-ups, dips: weight logged is added load
}

const v = (id: string, name: string, parent: Lift, factor: number, tags: Tag[]): Exercise => ({ id, name, category: 'variation', parent, factor, tags });
const s = (id: string, name: string, tags: Tag[], extra: Partial<Exercise> = {}): Exercise => ({ id, name, category: 'secondary', parent: null, factor: 1, tags, ...extra });
const a = (id: string, name: string, tags: Tag[], extra: Partial<Exercise> = {}): Exercise => ({ id, name, category: 'accessory', parent: null, factor: 1, tags, ...extra });

export const EXERCISES: Exercise[] = [
  // ----- competition lifts -----
  { id: 'squat', name: 'Squat', category: 'main', parent: 'squat', factor: 1, tags: ['quads', 'posterior-chain', 'bracing'] },
  { id: 'bench', name: 'Bench press', category: 'main', parent: 'bench', factor: 1, tags: ['chest', 'triceps', 'shoulders'] },
  { id: 'deadlift', name: 'Deadlift', category: 'main', parent: 'deadlift', factor: 1, tags: ['posterior-chain', 'off-the-floor', 'lockout'] },

  // ----- squat variations -----
  v('pause-squat', 'Pause squat', 'squat', 0.90, ['out-of-the-hole', 'bracing', 'quads']),
  v('pin-squat', 'Pin squat', 'squat', 0.85, ['out-of-the-hole', 'mid-range']),
  v('tempo-squat', 'Tempo squat (3-0-3)', 'squat', 0.80, ['out-of-the-hole', 'bracing', 'knee-friendly']),
  v('box-squat', 'Box squat', 'squat', 0.90, ['posterior-chain', 'glutes', 'knee-friendly']),
  v('high-bar-squat', 'High-bar squat', 'squat', 0.92, ['quads', 'out-of-the-hole']),
  v('front-squat', 'Front squat', 'squat', 0.80, ['quads', 'bracing', 'upper-back', 'low-back-friendly']),
  v('ssb-squat', 'Safety-bar squat', 'squat', 0.85, ['upper-back', 'quads', 'shoulder-friendly', 'elbow-friendly']),
  v('belt-squat', 'Belt squat', 'squat', 0.70, ['quads', 'low-back-friendly', 'hypertrophy']),
  v('squat-chains', 'Squat with chains / bands', 'squat', 0.85, ['lockout', 'speed']),
  v('speed-squat', 'Speed squat', 'squat', 0.65, ['speed', 'bracing']),

  // ----- bench variations -----
  v('pause-bench', 'Long-pause bench', 'bench', 0.95, ['off-the-chest', 'chest']),
  v('close-grip-bench', 'Close-grip bench', 'bench', 0.90, ['lockout', 'triceps', 'shoulder-friendly']),
  v('spoto-press', 'Spoto press', 'bench', 0.93, ['off-the-chest', 'mid-range', 'chest']),
  v('board-press', 'Board press (2-board)', 'bench', 1.05, ['lockout', 'triceps']),
  v('larsen-press', 'Larsen press', 'bench', 0.90, ['off-the-chest', 'chest', 'bracing']),
  v('feet-up-bench', 'Feet-up bench', 'bench', 0.90, ['chest', 'off-the-chest', 'low-back-friendly']),
  v('incline-bench', 'Incline bench', 'bench', 0.80, ['chest', 'shoulders', 'hypertrophy']),
  v('floor-press', 'Floor press', 'bench', 0.92, ['lockout', 'triceps', 'shoulder-friendly']),
  v('tempo-bench', 'Tempo bench (3-1-0)', 'bench', 0.85, ['off-the-chest', 'chest', 'shoulder-friendly']),
  v('wide-grip-bench', 'Wide-grip bench', 'bench', 0.95, ['chest', 'off-the-chest']),
  v('bench-chains', 'Bench with chains / bands', 'bench', 0.85, ['lockout', 'speed']),
  v('speed-bench', 'Speed bench', 'bench', 0.65, ['speed']),
  v('db-bench', 'Dumbbell bench', 'bench', 0.35, ['chest', 'hypertrophy', 'shoulder-friendly']),

  // ----- deadlift variations -----
  v('deficit-deadlift', 'Deficit deadlift', 'deadlift', 0.90, ['off-the-floor', 'quads', 'posterior-chain']),
  v('block-pull', 'Block pull / rack pull', 'deadlift', 1.05, ['lockout', 'upper-back', 'glutes']),
  v('paused-deadlift', 'Paused deadlift (below knee)', 'deadlift', 0.88, ['off-the-floor', 'bracing', 'lats']),
  v('rdl', 'Romanian deadlift', 'deadlift', 0.75, ['hamstrings', 'glutes', 'posterior-chain', 'hypertrophy']),
  v('sldl', 'Stiff-leg deadlift', 'deadlift', 0.70, ['hamstrings', 'off-the-floor', 'posterior-chain']),
  v('snatch-grip-deadlift', 'Snatch-grip deadlift', 'deadlift', 0.80, ['upper-back', 'off-the-floor', 'lats']),
  v('opposite-stance-deadlift', 'Opposite-stance deadlift', 'deadlift', 0.85, ['posterior-chain', 'hip-friendly']),
  v('trap-bar-deadlift', 'Trap-bar deadlift', 'deadlift', 1.00, ['quads', 'low-back-friendly']),
  v('deadlift-chains', 'Deadlift with chains / bands', 'deadlift', 0.85, ['lockout', 'speed']),
  v('speed-deadlift', 'Speed deadlift', 'deadlift', 0.65, ['speed', 'off-the-floor']),
  v('good-morning', 'Good morning', 'deadlift', 0.45, ['hamstrings', 'posterior-chain', 'bracing']),

  // ----- secondary movements -----
  s('overhead-press', 'Overhead press', ['shoulders', 'triceps', 'lockout']),
  s('push-press', 'Push press', ['shoulders', 'triceps', 'speed']),
  s('barbell-row', 'Barbell row', ['upper-back', 'lats', 'hypertrophy']),
  s('pendlay-row', 'Pendlay row', ['upper-back', 'lats', 'off-the-floor']),
  s('db-row', 'Dumbbell row', ['upper-back', 'lats', 'low-back-friendly'], { unilateral: true }),
  s('chest-supported-row', 'Chest-supported row', ['upper-back', 'low-back-friendly', 'hypertrophy']),
  s('pull-up', 'Pull-up / chin-up', ['lats', 'upper-back', 'biceps'], { bodyweight: true }),
  s('lat-pulldown', 'Lat pulldown', ['lats', 'upper-back', 'shoulder-friendly']),
  s('dip', 'Dip', ['chest', 'triceps', 'lockout'], { bodyweight: true }),
  s('leg-press', 'Leg press', ['quads', 'low-back-friendly', 'hypertrophy']),
  s('hack-squat', 'Hack squat', ['quads', 'low-back-friendly', 'hypertrophy']),
  s('bulgarian-split-squat', 'Bulgarian split squat', ['quads', 'glutes', 'low-back-friendly', 'hip-friendly'], { unilateral: true }),
  s('walking-lunge', 'Walking lunge', ['quads', 'glutes', 'hypertrophy'], { unilateral: true }),
  s('step-up', 'Step-up', ['quads', 'glutes', 'knee-friendly'], { unilateral: true }),
  s('hip-thrust', 'Hip thrust', ['glutes', 'lockout', 'low-back-friendly']),
  s('single-leg-rdl', 'Single-leg RDL', ['hamstrings', 'glutes', 'hip-friendly'], { unilateral: true }),
  s('incline-db-press', 'Incline dumbbell press', ['chest', 'shoulders', 'shoulder-friendly']),
  s('db-shoulder-press', 'Dumbbell shoulder press', ['shoulders', 'triceps', 'shoulder-friendly']),

  // ----- accessories -----
  a('leg-curl', 'Leg curl', ['hamstrings', 'knee-friendly', 'hypertrophy']),
  a('leg-extension', 'Leg extension', ['quads', 'hypertrophy']),
  a('nordic-curl', 'Nordic curl', ['hamstrings', 'knee-friendly'], { bodyweight: true }),
  a('back-extension', 'Back extension (45°)', ['posterior-chain', 'glutes', 'low-back-friendly'], { bodyweight: true }),
  a('reverse-hyper', 'Reverse hyper', ['posterior-chain', 'glutes', 'low-back-friendly']),
  a('glute-bridge', 'Glute bridge', ['glutes', 'low-back-friendly', 'hip-friendly']),
  a('calf-raise', 'Calf raise', ['hypertrophy']),
  a('face-pull', 'Face pull', ['upper-back', 'shoulders', 'shoulder-friendly']),
  a('rear-delt-fly', 'Rear-delt fly', ['upper-back', 'shoulders', 'shoulder-friendly']),
  a('lateral-raise', 'Lateral raise', ['shoulders', 'hypertrophy']),
  a('cable-row', 'Seated cable row', ['upper-back', 'lats', 'low-back-friendly']),
  a('straight-arm-pulldown', 'Straight-arm pulldown', ['lats', 'shoulder-friendly']),
  a('tricep-pushdown', 'Triceps pushdown', ['triceps', 'lockout', 'elbow-friendly']),
  a('skull-crusher', 'Skull crusher', ['triceps', 'lockout']),
  a('jm-press', 'JM press', ['triceps', 'lockout']),
  a('overhead-tricep-extension', 'Overhead triceps extension', ['triceps', 'hypertrophy']),
  a('db-fly', 'Dumbbell / cable fly', ['chest', 'hypertrophy', 'shoulder-friendly']),
  a('push-up', 'Push-up', ['chest', 'triceps', 'shoulder-friendly'], { bodyweight: true }),
  a('biceps-curl', 'Biceps curl', ['biceps', 'elbow-friendly']),
  a('hammer-curl', 'Hammer curl', ['biceps', 'elbow-friendly']),
  a('external-rotation', 'Band external rotation', ['shoulders', 'shoulder-friendly']),
  a('ab-wheel', 'Ab wheel rollout', ['core', 'bracing'], { bodyweight: true }),
  a('hanging-leg-raise', 'Hanging leg raise', ['core'], { bodyweight: true }),
  a('plank', 'Plank', ['core', 'bracing', 'low-back-friendly'], { bodyweight: true }),
  a('pallof-press', 'Pallof press', ['core', 'bracing', 'low-back-friendly']),
  a('suitcase-carry', 'Suitcase carry', ['core', 'bracing'], { unilateral: true }),
  a('copenhagen-plank', 'Copenhagen plank', ['core', 'hip-friendly'], { bodyweight: true }),
  a('hip-abduction', 'Hip abduction', ['glutes', 'hip-friendly', 'knee-friendly']),
  a('terminal-knee-extension', 'Terminal knee extension (band)', ['quads', 'knee-friendly']),
  a('tibialis-raise', 'Tibialis raise', ['knee-friendly']),
];

const byIdMap = new Map(EXERCISES.map(e => [e.id, e]));

export const CUSTOM_PREFIX = 'custom:';

export function exerciseById(id: string): Exercise | null {
  return byIdMap.get(id) ?? null;
}

/** Display name for any exercise id, including custom (`custom:pause deadlift`) and legacy free text. */
export function exerciseName(id: string): string {
  const e = byIdMap.get(id);
  if (e) return e.name;
  const raw = id.startsWith(CUSTOM_PREFIX) ? id.slice(CUSTOM_PREFIX.length) : id;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function customId(name: string) {
  return CUSTOM_PREFIX + name.trim().toLowerCase();
}

export function parentOf(id: string): Lift | null {
  return byIdMap.get(id)?.parent ?? null;
}

export function factorOf(id: string): number {
  return byIdMap.get(id)?.factor ?? 1;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  main: 'Competition lifts',
  variation: 'Variations',
  secondary: 'Secondary movements',
  accessory: 'Accessories',
};

export interface PickerFilter {
  query?: string;
  parent?: Lift | null;   // only variations of this lift (plus the lift itself)
  tag?: Tag | null;
  category?: Category | null;
}

/** Filter the library for the picker. Matches name, id and tag labels. */
export function searchExercises(f: PickerFilter): Exercise[] {
  const q = (f.query ?? '').trim().toLowerCase();
  return EXERCISES.filter(e => {
    if (f.parent && e.parent !== f.parent) return false;
    if (f.category && e.category !== f.category) return false;
    if (f.tag && !e.tags.includes(f.tag)) return false;
    if (q && !(e.name.toLowerCase().includes(q) || e.id.includes(q) || e.tags.some(t => TAG_LABEL[t].includes(q)))) return false;
    return true;
  });
}

/** Tags worth showing as filter chips, in a sensible order. */
export const WEAKNESS_TAGS: Tag[] = ['out-of-the-hole', 'off-the-chest', 'off-the-floor', 'mid-range', 'lockout', 'bracing', 'speed'];
export const REHAB_TAGS: Tag[] = ['low-back-friendly', 'shoulder-friendly', 'knee-friendly', 'hip-friendly', 'elbow-friendly'];
export const MUSCLE_TAGS: Tag[] = ['quads', 'posterior-chain', 'hamstrings', 'glutes', 'upper-back', 'lats', 'chest', 'triceps', 'shoulders', 'biceps', 'core', 'hypertrophy'];
