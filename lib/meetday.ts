/**
 * Weeks Out — meet-day engine.
 *
 * From a handful of inputs (weigh-in format and time, flight start, whether the lifter is
 * cutting) build a timeline for the evening before and the day itself, and handle the
 * attempt logic on the platform. All times are minutes-from-midnight on meet day
 * (negative = the day before), so the module stays free of Date/timezone concerns.
 */
import { LIFTS, type Lift } from './math';

export type WeighInType = '2h' | '24h';

export interface MeetPlanInput {
  weighIn: WeighInType;
  weighInMin: number;        // minutes from midnight, meet day (24h: the day before, so pass e.g. 16*60 and it's treated as day-before)
  squatFlightMin: number;    // when your squat flight starts
  benchFlightMin?: number;   // optional; estimated when missing
  deadliftFlightMin?: number;
  cutting: boolean;          // making weight needs a cut
  bodyweightKg: number;
}

export type Phase = 'day-before' | 'morning' | 'weigh-in' | 'recovery' | 'squat' | 'bench' | 'deadlift' | 'after';

export interface TimelineItem {
  min: number;       // minutes from midnight of meet day; negative = day before
  phase: Phase;
  title: string;
  detail: string;
}

export const DEFAULT_GAP_SQUAT_TO_BENCH = 105;   // minutes, typical two-flight session
export const DEFAULT_GAP_BENCH_TO_DEADLIFT = 105;

export function hhmm(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function parseHhmm(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

const g = (kg: number, perKg: number) => Math.round(kg * perKg / 5) * 5;

/** Build the full timeline. Items come back sorted by time. */
export function buildTimeline(p: MeetPlanInput): TimelineItem[] {
  const items: TimelineItem[] = [];
  const bench = p.benchFlightMin ?? p.squatFlightMin + DEFAULT_GAP_SQUAT_TO_BENCH;
  const dead = p.deadliftFlightMin ?? bench + DEFAULT_GAP_BENCH_TO_DEADLIFT;
  const carbs = g(p.bodyweightKg, 1.2);   // g of easy carbs across the recovery window
  const fluids = Math.min(1.5, Math.max(0.5, Math.round(p.bodyweightKg / 60 * 10) / 10)); // litres

  // ---------- day before ----------
  if (p.weighIn === '24h') {
    const wi = p.weighInMin - 1440; // the day before
    if (p.cutting) {
      items.push({ min: wi - 180, phase: 'day-before', title: 'Last fluids before weigh-in', detail: 'Only if you have practised this cut before. Sip, don’t chug. If you are close to the limit, a hot shower beats anything drastic.' });
    }
    items.push({ min: wi, phase: 'weigh-in', title: 'Weigh-in (24-hour)', detail: 'Bring ID and membership card. Get your openers and rack heights checked at the same time if the meet does it here.' });
    items.push({ min: wi + 10, phase: 'recovery', title: 'Rehydrate and eat', detail: `You have all day. Start with ${fluids} L of water with electrolytes over the next 2 hours, then normal meals — carbs, salt, familiar food. Stop eating heavy food 3 hours before bed.` });
    items.push({ min: -240, phase: 'day-before', title: 'Pack the bag', detail: 'Singlet, belt, shoes, knee sleeves, deadlift socks, wrist wraps, chalk, tape, ID, water, snacks, headphones, charger, warm layers. Lay out tomorrow’s clothes.' });
    items.push({ min: -150, phase: 'day-before', title: 'Lights out', detail: 'Aim for 8 hours. Alarm set. Phone charging.' });
  } else {
    items.push({ min: -300, phase: 'day-before', title: 'Last big meal', detail: p.cutting ? 'Lighter than usual and low in fibre — you are making weight tomorrow morning. Salt as normal.' : 'Normal dinner, familiar food. Nothing new.' });
    items.push({ min: -240, phase: 'day-before', title: 'Pack the bag', detail: 'Singlet, belt, shoes, knee sleeves, deadlift socks, wrist wraps, chalk, tape, ID, water, snacks for after weigh-in, headphones, charger, warm layers.' });
    items.push({ min: -180, phase: 'day-before', title: 'Openers on paper', detail: 'Write your three openers and rack heights on your hand or phone. Openers should be something you could triple on a bad day.' });
    items.push({ min: -150, phase: 'day-before', title: 'Lights out', detail: 'Aim for 8 hours. Alarm set, phone charging. If sleep is bad, that’s normal — one night doesn’t cost strength.' });
  }

  // ---------- meet day ----------
  const wake = p.weighIn === '2h' ? p.weighInMin - 90 : p.squatFlightMin - 180;
  items.push({ min: wake, phase: 'morning', title: 'Wake up', detail: p.weighIn === '2h' && p.cutting ? 'Small sips only until you weigh in. Bathroom, then straight to the venue.' : 'Water, a normal breakfast you have eaten before training a hundred times.' });
  if (p.weighIn === '2h') {
    items.push({ min: p.weighInMin - 45, phase: 'morning', title: 'Leave for the venue', detail: 'Arrive early: equipment check, find the warm-up room, find your flight on the board.' });
    items.push({ min: p.weighInMin, phase: 'weigh-in', title: 'Weigh-in (2-hour)', detail: 'Bring ID. Hand in your openers and rack heights right after — they cannot be lowered later.' });
    items.push({ min: p.weighInMin + 5, phase: 'recovery', title: 'Drink and eat, straight away', detail: `${fluids} L with electrolytes over the next 90 minutes. About ${carbs} g of easy carbs by the time squats start: white rice, bread and jam, bananas, sports drink, sweets. Salt something. Nothing heavy, nothing new.` });
    items.push({ min: p.weighInMin + 60, phase: 'recovery', title: 'Second snack, then sit down', detail: 'Top up carbs, ease off the fluids. Feet up. Music. Watch the earlier flights so you know the platform commands.' });
  } else {
    items.push({ min: p.squatFlightMin - 120, phase: 'morning', title: 'Leave for the venue', detail: 'Equipment check if it wasn’t done yesterday. Find the warm-up room and your flight on the board.' });
  }

  // ---------- squat ----------
  items.push({ min: p.squatFlightMin - 45, phase: 'squat', title: 'Start squat warm-ups', detail: 'Bar first, then the warm-up ladder in the app. Finish your last warm-up about 10 minutes before your opener. Count attempts on the board: 3 lifters out = start belting up.' });
  items.push({ min: p.squatFlightMin, phase: 'squat', title: 'Squat flight', detail: 'Opener first. Wait for “Squat”, then “Rack”. After each lift, hand in the next attempt within 60 seconds — the app suggests it.' });
  items.push({ min: p.squatFlightMin + 60, phase: 'recovery', title: 'Eat between lifts', detail: 'Small carbs and a little salt. Sip. Sit down, stay warm, keep sleeves off until bench warm-ups.' });

  // ---------- bench ----------
  items.push({ min: bench - 35, phase: 'bench', title: 'Start bench warm-ups', detail: 'Shoulders and lats first (band pull-aparts, dislocates), then bar and the ladder. Practise the pause on every warm-up.' });
  items.push({ min: bench, phase: 'bench', title: 'Bench flight', detail: '“Start” — “Press” — “Rack”. Wait for every command. Feet planted before the start command.' });
  items.push({ min: bench + 50, phase: 'recovery', title: 'Eat again', detail: 'Same as before. Deadlifts are the last thing; keep the tank topped up.' });

  // ---------- deadlift ----------
  items.push({ min: dead - 30, phase: 'deadlift', title: 'Start deadlift warm-ups', detail: 'Fewer warm-ups than squat — you are already warm. Bar, then jumps to the opener. Chalk and tape ready.' });
  items.push({ min: dead, phase: 'deadlift', title: 'Deadlift flight', detail: 'Wait for “Down”. Third attempt: pick something you would be proud of and can actually lock out.' });
  items.push({ min: dead + 45, phase: 'after', title: 'Done', detail: 'Total is in. Eat properly, thank the spotters and loaders, and log how it felt while you remember.' });

  return items.sort((a, b) => a.min - b.min);
}

// ---------- attempts on the platform ----------
export type AttemptResult = 'good' | 'miss' | null;
export interface Attempt { weightKg: number; result: AttemptResult }
export type LiftAttempts = [Attempt, Attempt, Attempt];

/**
 * Suggested weight for attempt `n` (0-based) given the plan and what has happened.
 * Rules: after a good lift the next attempt must go up (min +2.5); after a miss you may
 * repeat the same weight (that is the suggestion); the bar never goes down.
 */
export function suggestAttempt(plan: [number, number, number], attempts: LiftAttempts, n: 1 | 2, step = 2.5): number {
  const prev = attempts[n - 1];
  if (prev.result === 'miss') return prev.weightKg;
  if (prev.result === 'good') return Math.max(prev.weightKg + step, plan[n]);
  return plan[n];
}

/** Best successful attempt for a lift, or 0 (a bomb-out). */
export function bestOf(attempts: LiftAttempts): number {
  return attempts.reduce((b, a) => (a.result === 'good' && a.weightKg > b ? a.weightKg : b), 0);
}

export function runningTotal(all: Record<Lift, LiftAttempts>): { total: number; bombed: Lift[] } {
  let total = 0;
  const bombed: Lift[] = [];
  for (const l of LIFTS) {
    const b = bestOf(all[l]);
    const done = all[l].every(a => a.result != null);
    if (done && b === 0) bombed.push(l);
    total += b;
  }
  return { total, bombed };
}

export function emptyAttempts(plan: [number, number, number]): LiftAttempts {
  return [{ weightKg: plan[0], result: null }, { weightKg: plan[1], result: null }, { weightKg: plan[2], result: null }];
}
