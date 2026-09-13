/**
 * Weeks Out — pre-session prep.
 * Short, specific, and biased toward what a powerlifter needs before the bar:
 * a little movement, some band work to wake the right muscles, a static hold
 * or two that teaches position, then the empty bar. Nothing here is long.
 */
import { LIFTS, type Lift } from './math';

export type PrepKind = 'move' | 'band' | 'hold' | 'activate';

export interface PrepItem {
  id: string;
  name: string;
  kind: PrepKind;
  dose: string;       // "2 × 10", "3 × 20 s", "60 s each side"
  why: string;        // one line: what it's for
  lifts: Lift[] | 'all';
  when?: 'first' | 'last';   // pin to the start (general) or end (bar) of the list
  core?: boolean;            // shown by default; everything else is behind "More"
}

export const KIND_LABEL: Record<PrepKind, string> = { move: 'Move', band: 'Band', hold: 'Hold', activate: 'Activate' };

export const PREP_ITEMS: PrepItem[] = [
  // ----- general -----
  { id: 'walk-bike', name: 'Easy bike or brisk walk', kind: 'move', dose: '3–5 min', why: 'Raise body temperature; nothing more.', lifts: 'all', when: 'first' },
  { id: 'cat-cow', core: true, name: 'Cat–cow', kind: 'move', dose: '10 slow reps', why: 'Wake the spine up before you brace it.', lifts: 'all' },
  { id: 'dead-bug', name: 'Dead bug', kind: 'activate', dose: '2 × 8 each side', why: 'Brace against the floor so you can brace against the bar.', lifts: 'all' },

  // ----- squat -----
  { id: 'leg-swings', name: 'Leg swings, front and side', kind: 'move', dose: '10 each way', why: 'Loosen the hips without stretching them slack.', lifts: ['squat'] },
  { id: 'ankle-rock', name: 'Ankle rocks against the wall', kind: 'move', dose: '10 each side', why: 'Depth comes from the ankle as much as the hip.', lifts: ['squat'] },
  { id: 'banded-walk', core: true, name: 'Banded lateral walk', kind: 'band', dose: '2 × 10 steps each way', why: 'Glute medius on, so the knees track out.', lifts: ['squat', 'deadlift'] },
  { id: 'goblet-hold', core: true, name: 'Bottom-position squat hold (goblet or bodyweight)', kind: 'hold', dose: '2 × 20–30 s', why: 'Own the bottom before the bar asks you to.', lifts: ['squat'] },
  { id: 'glute-bridge-hold', name: 'Glute bridge hold', kind: 'hold', dose: '2 × 15 s', why: 'Hips switched on; low back stays quiet.', lifts: ['squat', 'deadlift'] },
  { id: 'empty-bar-squat', core: true, name: 'Empty-bar squats, competition tempo', kind: 'move', dose: '2 × 8', why: 'Rehearse the walk-out, the brace and the depth.', lifts: ['squat'], when: 'last' },

  // ----- bench -----
  { id: 'band-pull-apart', core: true, name: 'Band pull-aparts', kind: 'band', dose: '2 × 15', why: 'Upper back and rear delts hold the arch.', lifts: ['bench'] },
  { id: 'band-dislocate', name: 'Band shoulder dislocates', kind: 'band', dose: '10 slow', why: 'Full range for the shoulders without loading them.', lifts: ['bench'] },
  { id: 'face-pull-prep', name: 'Band face pulls', kind: 'band', dose: '2 × 12', why: 'External rotators on; shoulders happy under the bar.', lifts: ['bench'] },
  { id: 'lat-stretch', name: 'Lat stretch on the rack', kind: 'move', dose: '30 s each side', why: 'Lats set the bar path — give them room.', lifts: ['bench', 'deadlift'] },
  { id: 'scap-hang', name: 'Dead hang, then scapular pull', kind: 'hold', dose: '2 × 20 s + 5 pulls', why: 'Decompress and learn to pull the shoulders down and back.', lifts: ['bench', 'deadlift'] },
  { id: 'bench-arch-hold', core: true, name: 'Arch hold on the bench, feet planted', kind: 'hold', dose: '2 × 15 s', why: 'Set-up rehearsal: shoulders pinned, feet driving.', lifts: ['bench'] },
  { id: 'empty-bar-bench', core: true, name: 'Empty-bar bench with a pause', kind: 'move', dose: '2 × 10', why: 'Groove the pause and the press command.', lifts: ['bench'], when: 'last' },

  // ----- deadlift -----
  { id: 'hip-hinge-band', core: true, name: 'Banded hip hinge (band across the hips)', kind: 'band', dose: '2 × 10', why: 'Teaches the hips to push back, not the knees to bend.', lifts: ['deadlift'] },
  { id: 'hamstring-sweep', name: 'Hamstring sweeps', kind: 'move', dose: '10 each side', why: 'Enough length to get to the bar with a flat back.', lifts: ['deadlift'] },
  { id: 'banded-good-morning', name: 'Banded good mornings', kind: 'band', dose: '2 × 15', why: 'Posterior chain warm and awake.', lifts: ['deadlift'] },
  { id: 'rdl-hold', core: true, name: 'Bottom-position RDL hold, empty bar', kind: 'hold', dose: '2 × 15 s', why: 'Find the lat tension and the flat back you want off the floor.', lifts: ['deadlift'] },
  { id: 'plank-brace', name: 'Plank with a hard brace', kind: 'hold', dose: '2 × 20 s', why: 'Rehearse the breath and brace you take before every pull.', lifts: ['deadlift', 'squat'] },
  { id: 'empty-bar-pulls', core: true, name: 'Light pulls, perfect set-up', kind: 'move', dose: '2 × 5 at 40–60 kg', why: 'Wedge, tension, then stand. Every warm-up looks like the opener.', lifts: ['deadlift'], when: 'last' },
];

/**
 * Prep list for a session that contains these lifts.
 * `all = false` (default) returns the short list: one band drill, one hold and the empty bar per lift,
 * plus one general item. `all = true` returns everything relevant, for lifters who want more.
 */
export function prepFor(lifts: Lift[], all = false): PrepItem[] {
  const want = new Set<Lift>(lifts.length ? lifts : []);
  const pick = PREP_ITEMS.filter(i => (all || i.core) && (i.lifts === 'all' || i.lifts.some(l => want.has(l))));
  const order = (i: PrepItem) => (i.when === 'first' ? 0 : i.when === 'last' ? 2 : 1);
  // keep per-lift grouping in SBD order, general first, bar work last
  const liftRank = (i: PrepItem) => (i.lifts === 'all' ? -1 : Math.min(...i.lifts.map(l => LIFTS.indexOf(l))));
  return pick.sort((a, b) => order(a) - order(b) || liftRank(a) - liftRank(b));
}
