/**
 * Weeks Out — the Fail Map.
 *
 * Every logging app records how much you lifted. This records WHERE the rep died (or ground):
 * out of the hole / halfway / lockout for the squat, off the chest / halfway / lockout for the
 * bench, off the floor / at the knees / lockout for the deadlift. Over a few weeks that becomes a
 * sticking-point map per lift, and each sticking point comes with the variations and cues that
 * coaches use to fix it. Heuristics, not medicine — and a nudge to ask a coach when it keeps happening.
 */
import { exerciseById, type Exercise } from './exercises';
import type { Lift } from './math';

export type FailPos = 'bottom' | 'mid' | 'top';
export const FAIL_POSITIONS: FailPos[] = ['bottom', 'mid', 'top'];

/** What each position is called for each lift — the words a lifter would use. */
export const FAIL_LABEL: Record<Lift, Record<FailPos, string>> = {
  squat: { bottom: 'Out of the hole', mid: 'Halfway up', top: 'Lockout' },
  bench: { bottom: 'Off the chest', mid: 'Halfway up', top: 'Lockout' },
  deadlift: { bottom: 'Off the floor', mid: 'At the knees', top: 'Lockout' },
};

export interface FailEvent { lift: Lift; pos: FailPos; missed: boolean; date: string; exercise: string; weightKg: number; reps: number; rpe: number | null }

export interface LiftMap {
  lift: Lift;
  events: number;                       // sets that stuck or missed
  misses: number;
  byPos: Record<FailPos, number>;
  worst: FailPos | null;                // the position with the most events (ties → the lower position)
  share: number;                        // worst / events, 0–1
  lastDate: string | null;
}

/** Aggregate events (already filtered to the window you care about) per lift. */
export function buildMap(events: FailEvent[]): Record<Lift, LiftMap> {
  const out = {} as Record<Lift, LiftMap>;
  for (const lift of ['squat', 'bench', 'deadlift'] as Lift[]) {
    const ev = events.filter(e => e.lift === lift);
    const byPos: Record<FailPos, number> = { bottom: 0, mid: 0, top: 0 };
    for (const e of ev) byPos[e.pos]++;
    let worst: FailPos | null = null;
    for (const p of FAIL_POSITIONS) if (byPos[p] > 0 && (worst == null || byPos[p] > byPos[worst])) worst = p;
    out[lift] = {
      lift, events: ev.length, misses: ev.filter(e => e.missed).length, byPos, worst,
      share: worst && ev.length ? byPos[worst] / ev.length : 0,
      lastDate: ev.length ? ev.map(e => e.date).sort().at(-1)! : null,
    };
  }
  return out;
}

export interface Fix {
  why: string;                          // what a sticking point there usually means
  cues: string[];                       // two or three things to try on the next set
  exercises: Exercise[];                // variations that attack it, in order
  accessories: Exercise[];              // muscles to build
}

const FIXES: Record<Lift, Record<FailPos, { why: string; cues: string[]; variations: string[]; accessories: string[] }>> = {
  squat: {
    bottom: {
      why: 'Slow out of the bottom usually means the quads and the brace let go at the same time — you lose tightness in the hole and there is nothing to bounce off.',
      cues: ['Big breath into the belt, then sit in — don’t dive.', 'Drive your upper back into the bar as you turn it around.', 'Knees out over the toes; stay on the whole foot.'],
      variations: ['pause-squat', 'pin-squat', 'tempo-squat', 'high-bar-squat'],
      accessories: ['leg-press', 'bulgarian-split-squat', 'leg-extension'],
    },
    mid: {
      why: 'Stalling halfway is nearly always the hips shooting up first: the back takes over, the chest drops, and the bar stops. It is a positioning and upper-back problem more than a strength one.',
      cues: ['Chest up — hips and shoulders rise together.', 'Push the floor away with the quads, don’t lift the hips.', 'Elbows under the bar to keep the upper back locked.'],
      variations: ['pin-squat', 'front-squat', 'ssb-squat', 'squat-chains'],
      accessories: ['barbell-row', 'back-extension', 'leg-press'],
    },
    top: {
      why: 'Failing near lockout is rare and usually means you drifted forward and ran out of glutes and hips — or the brace released early.',
      cues: ['Squeeze the glutes through the last third.', 'Keep the breath until you are standing.', 'Bar over mid-foot the whole way.'],
      variations: ['squat-chains', 'box-squat', 'speed-squat'],
      accessories: ['hip-thrust', 'rdl', 'back-extension'],
    },
  },
  bench: {
    bottom: {
      why: 'Stuck on the chest: the pause and the first inch are chest and leg drive. Long pauses with no tightness, or no leg drive on the press command, are the usual culprits.',
      cues: ['Leg drive the instant you hear “press”.', 'Elbows under the bar, not behind it.', 'Squeeze the bar hard; keep the shoulder blades pinned.'],
      variations: ['pause-bench', 'spoto-press', 'larsen-press', 'tempo-bench', 'wide-grip-bench'],
      accessories: ['db-bench', 'incline-bench', 'dip'],
    },
    mid: {
      why: 'Stalling halfway up is a bar-path problem: elbows flare too early and the bar drifts over the face before the triceps are ready.',
      cues: ['Press back toward the face, not straight up.', 'Keep the elbows tucked until the bar passes the sticking point, then flare.', 'Stay on the shoulder blades — don’t let the arch collapse.'],
      variations: ['spoto-press', 'pause-bench', 'incline-bench', 'close-grip-bench'],
      accessories: ['db-bench', 'incline-bench', 'overhead-press'],
    },
    top: {
      why: 'Missing at lockout is the triceps. Board presses and close-grip work fix it faster than anything else.',
      cues: ['Flare and push through at the top.', 'Think “elbows to the ceiling”.', 'Keep the wrists stacked over the elbows.'],
      variations: ['close-grip-bench', 'board-press', 'floor-press', 'bench-chains'],
      accessories: ['dip', 'tricep-pushdown', 'skull-crusher'],
    },
  },
  deadlift: {
    bottom: {
      why: 'Slow off the floor means the legs are not doing their share: hips too high at the start, or the slack not pulled out before the bar moves.',
      cues: ['Pull the slack out — arms straight, bar bent — before you push.', 'Push the floor away; the bar leaves when the legs decide.', 'Chest tall, lats tight, bar against the shins.'],
      variations: ['deficit-deadlift', 'paused-deadlift', 'sldl', 'speed-deadlift'],
      accessories: ['leg-press', 'front-squat', 'back-extension'],
    },
    mid: {
      why: 'Sticking at the knees means the bar drifted forward: the lats let it swing out and the hamstrings could not bring it back. Keep it on the legs.',
      cues: ['Drag the bar up the legs — lats squeeze the whole way.', 'Hips and shoulders rise together, not hips first.', 'Knees back out of the way, then hips through.'],
      variations: ['paused-deadlift', 'snatch-grip-deadlift', 'rdl', 'good-morning'],
      accessories: ['barbell-row', 'lat-pulldown', 'back-extension'],
    },
    top: {
      why: 'Failing at lockout is glutes and hips, or leaning back instead of driving forward. Block pulls and heavy hinge work fix it.',
      cues: ['Hips through, squeeze the glutes — don’t lean back.', 'Keep the bar close; lock the knees and hips together.', 'Finish tall, not hyperextended.'],
      variations: ['block-pull', 'deadlift-chains', 'rdl'],
      accessories: ['hip-thrust', 'back-extension', 'nordic-curl'],
    },
  },
};

export function fixFor(lift: Lift, pos: FailPos): Fix {
  const f = FIXES[lift][pos];
  const pick = (ids: string[]) => ids.map(exerciseById).filter((e): e is Exercise => !!e);
  return { why: f.why, cues: f.cues, exercises: pick(f.variations), accessories: pick(f.accessories) };
}

/** One honest sentence for the top of a lift's card. */
export function headline(m: LiftMap, weeks: number): string {
  if (m.events === 0) return `No sticking points logged in the last ${weeks} weeks.`;
  const where = FAIL_LABEL[m.lift][m.worst!].toLowerCase();
  const pct = Math.round(m.share * 100);
  if (m.events === 1) return `One set stuck ${where}. Log a few more before reading anything into it.`;
  if (m.share >= 0.6) return `${m.events} sets stuck or missed — ${pct}% of them ${where}. That is your sticking point.`;
  return `${m.events} sets stuck or missed, spread across positions (${pct}% ${where}). No single weak point yet.`;
}

/** When to suggest talking to a coach instead of self-fixing. */
export function askACoach(m: LiftMap): boolean {
  return m.events >= 6 && m.share >= 0.6 || m.misses >= 3;
}
