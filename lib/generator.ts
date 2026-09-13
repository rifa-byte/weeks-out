/**
 * Weeks Out — the questionnaire → program generator (local, offline, deterministic).
 *
 * This is the baseline every program is checked against, and the fallback when the
 * AI is offline or not configured. It reuses the meet-prep engine and applies the
 * lifter's answers as modifiers: level, fatigue tolerance, compound focus,
 * limitations, equipment, session length.
 */
import { exerciseById, type Tag } from './exercises';
import { LIFTS, type Lift } from './math';
import { allocatePhases, phaseSummary, setsFor, split, taperWeek, weekRx, type DayShape, type Phase, type PhasePlan, type Slot, type WeekRx } from './meetprep';
import type { PlannedDay, PlannedSet, Template } from './programs';

export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Block = 'volume' | 'strength' | 'peak';
export type Fatigue = 'low' | 'medium' | 'high';
export type Focus = 'balanced' | Lift;
export type Limitation = 'knee' | 'shoulder' | 'low-back' | 'hip' | 'elbow';
export type Equipment = 'commercial' | 'powerlifting';

export interface Answers {
  mode: 'meet' | 'general';
  weeks: number;              // meet: weeks out; general: block length
  days: number;               // 2–6
  level: Level;
  block?: Block;              // general mode only
  fatigue: Fatigue;
  focus: Focus;
  limitations: Limitation[];
  equipment: Equipment;
  sessionMinutes: 45 | 60 | 90;
}

export const DEFAULT_ANSWERS: Answers = {
  mode: 'general', weeks: 6, days: 3, level: 'intermediate', block: 'volume', fatigue: 'medium', focus: 'balanced', limitations: [], equipment: 'commercial', sessionMinutes: 60,
};

export const LEVEL_LABEL: Record<Level, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
export const BLOCK_LABEL: Record<Block, string> = { volume: 'Volume block', strength: 'Strength block', peak: 'Peaking block' };
export const FATIGUE_LABEL: Record<Fatigue, string> = { low: 'I get beaten up easily', medium: 'Normal', high: 'I recover fast' };
export const FOCUS_LABEL: Record<Focus, string> = { balanced: 'All three', squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift' };
export const LIMITATION_LABEL: Record<Limitation, string> = { knee: 'Knee', shoulder: 'Shoulder', 'low-back': 'Low back', hip: 'Hip', elbow: 'Elbow' };
export const EQUIPMENT_LABEL: Record<Equipment, string> = { commercial: 'Commercial gym', powerlifting: 'Powerlifting gym' };

// ---------- limitation-aware swaps ----------
const FRIENDLY: Record<Limitation, Tag> = { knee: 'knee-friendly', shoulder: 'shoulder-friendly', 'low-back': 'low-back-friendly', hip: 'hip-friendly', elbow: 'elbow-friendly' };

/** Preferred variation swaps when a joint is complaining. Only variations get swapped; the competition lifts stay. */
const SWAPS: Record<Limitation, Record<string, string>> = {
  knee: { 'pause-squat': 'box-squat', 'walking-lunge': 'step-up', 'leg-curl': 'leg-curl' },
  shoulder: { 'pause-bench': 'floor-press', 'close-grip-bench': 'close-grip-bench', 'overhead-press': 'db-shoulder-press', 'dip': 'push-up', 'barbell-row': 'chest-supported-row' },
  'low-back': { 'pause-squat': 'front-squat', 'paused-deadlift': 'trap-bar-deadlift', 'back-extension': 'reverse-hyper', 'barbell-row': 'chest-supported-row', 'walking-lunge': 'bulgarian-split-squat' },
  hip: { 'pause-squat': 'box-squat', 'walking-lunge': 'step-up', 'paused-deadlift': 'opposite-stance-deadlift' },
  elbow: { 'close-grip-bench': 'pause-bench', 'tricep-pushdown': 'tricep-pushdown', 'dip': 'push-up', 'biceps-curl': 'hammer-curl' },
};

const COMMERCIAL_UNAVAILABLE = new Set(['ssb-squat', 'squat-chains', 'bench-chains', 'deadlift-chains', 'belt-squat', 'reverse-hyper', 'board-press', 'block-pull']);
const COMMERCIAL_FALLBACK: Record<string, string> = { 'reverse-hyper': 'back-extension', 'ssb-squat': 'front-squat', 'belt-squat': 'leg-press', 'board-press': 'floor-press', 'block-pull': 'rdl' };

function applyLimitations(ex: string, a: Answers): string {
  let out = ex;
  for (const l of a.limitations) out = SWAPS[l][out] ?? out;
  if (a.equipment === 'commercial' && COMMERCIAL_UNAVAILABLE.has(out)) out = COMMERCIAL_FALLBACK[out] ?? out;
  // never swap a competition lift away
  return LIFTS.includes(ex as Lift) ? ex : out;
}

// ---------- modifiers ----------
function scaleRx(rx: WeekRx, a: Answers): WeekRx {
  const f = a.fatigue === 'low' ? -1 : a.fatigue === 'high' ? 1 : 0;
  const lv = a.level === 'beginner' ? -1 : a.level === 'advanced' ? 1 : 0;
  const clampSets = (n: number) => Math.max(1, Math.min(8, n));
  // Beginners: fewer sets, slightly lower %, higher reps. Advanced: more back-off work.
  const pctAdj = lv < 0 ? -0.03 : 0;
  const r: WeekRx = {
    ...rx,
    top: { ...rx.top, pct: rx.top.pct + pctAdj, reps: lv < 0 && rx.phase !== 'peak' ? rx.top.reps + 1 : rx.top.reps },
    back: { ...rx.back, sets: clampSets(rx.back.sets + f + (lv > 0 ? 1 : 0) + (lv < 0 ? -1 : 0)), pct: rx.back.pct + pctAdj },
    vol: { ...rx.vol, sets: clampSets(rx.vol.sets + f), pct: rx.vol.pct + pctAdj },
    vari: { ...rx.vari, sets: clampSets(rx.vari.sets + (f < 0 ? -1 : 0)), pct: rx.vari.pct + pctAdj },
  };
  return r;
}

function focusShape(shape: DayShape[], a: Answers): DayShape[] {
  if (a.focus === 'balanced') return shape;
  const lift = a.focus;
  // Add one more exposure of the focus lift as volume on the first day that lacks it, and make its variation heavier by role.
  const out = shape.map(d => ({ ...d, slots: d.slots.map(s => ({ ...s })), acc: d.acc.slice() }));
  const hasLift = (d: DayShape) => d.slots.some(s => s.ex === lift || (exerciseById(s.ex)?.parent === lift));
  const target = out.find(d => !hasLift(d)) ?? null;
  if (target) target.slots.push({ ex: lift, role: 'volume' });
  return out;
}

function trimForTime(day: PlannedDay, a: Answers): PlannedDay {
  if (a.sessionMinutes === 90) return day;
  const mains = day.sets.filter(s => s.pct != null);
  const accs = day.sets.filter(s => s.pct == null);
  const keep = a.sessionMinutes === 45 ? 1 : 2;
  return { ...day, sets: [...mains, ...accs.slice(0, keep)] };
}

// ---------- building ----------
function weeksPlan(a: Answers): { plan: PhasePlan[]; taper: boolean } {
  if (a.mode === 'meet') return { plan: allocatePhases(a.weeks), taper: true };
  const phase: Phase = a.block === 'strength' ? 'intensify' : a.block === 'peak' ? 'peak' : 'accumulate';
  const W = Math.max(1, Math.min(16, Math.round(a.weeks)));
  // a single block; peaking blocks end with a light week so the lifter can test
  if (phase === 'peak') return { plan: [{ phase: 'peak', weeks: Math.max(1, W - 1) }, { phase: 'taper', weeks: 1 }], taper: true };
  return { plan: [{ phase, weeks: W }], taper: false };
}

/** Build a Template from the questionnaire. Deterministic; the AI path must produce the same shape. */
export function generateProgram(a: Answers): Template {
  const Dn = Math.max(2, Math.min(6, Math.round(a.days)));
  const { plan } = weeksPlan(a);
  const total = plan.reduce((s, p) => s + p.weeks, 0);
  const shape = focusShape(split(Dn), a);

  const rxs: WeekRx[] = [];
  for (const p of plan) {
    for (let i = 0; i < p.weeks; i++) {
      const deload = p.phase === 'accumulate' && p.weeks >= 4 && (i === p.weeks - 1 || (p.weeks >= 8 && i === 3));
      rxs.push(scaleRx(weekRx(p.phase, i, p.weeks, deload), a));
    }
  }

  const name = a.mode === 'meet'
    ? `${total}-week meet prep · ${Dn} days`
    : `${total}-week ${BLOCK_LABEL[a.block ?? 'volume'].toLowerCase()} · ${Dn} days`;
  const about = a.mode === 'meet'
    ? `${phaseSummary(total)}. ${LEVEL_LABEL[a.level]}, ${FOCUS_LABEL[a.focus].toLowerCase()} focus.`
    : `${LEVEL_LABEL[a.level]} ${BLOCK_LABEL[a.block ?? 'volume'].toLowerCase()}, ${FOCUS_LABEL[a.focus].toLowerCase()} focus${a.limitations.length ? `, working around ${a.limitations.map(l => LIMITATION_LABEL[l].toLowerCase()).join(' + ')}` : ''}.`;

  return {
    id: `made:${Date.now()}`,
    name,
    weeks: total,
    daysPerWeek: Dn,
    who: `Made for a ${LEVEL_LABEL[a.level].toLowerCase()} lifter.`,
    shape: about,
    week(w) {
      const rx = rxs[w - 1];
      if (!rx || rx.phase === 'taper') return taperWeek(Dn).map(d => ({ ...d, sets: d.sets.map(s => ({ ...s, exercise: applyLimitations(s.exercise, a) })) }));
      return shape.map(d => {
        const sets: PlannedSet[] = [
          ...d.slots.flatMap((s: Slot) => setsFor({ ...s, ex: applyLimitations(s.ex, a) }, rx)),
          ...(rx.phase === 'peak'
            ? d.acc.slice(0, 1).map(x => ({ exercise: applyLimitations(x.ex, a), sets: Math.max(1, x.sets - 1), reps: x.reps }))
            : d.acc.map(x => ({ exercise: applyLimitations(x.ex, a), sets: x.sets, reps: x.reps }))),
        ];
        return trimForTime({ name: d.name, sets }, a);
      });
    },
  };
}

/** Tags stored with a shared program so Explore can filter on them. */
export interface ProgramTags { level?: Level; goal?: 'meet-prep' | 'strength' | 'hypertrophy' | 'rehab'; focus?: Focus; days?: number; weeks?: number }

export function tagsFor(a: Answers): ProgramTags {
  return { level: a.level, goal: a.mode === 'meet' ? 'meet-prep' : a.block === 'volume' ? 'hypertrophy' : 'strength', focus: a.focus, days: a.days, weeks: a.weeks };
}

/** Human summary of answers, for the result screen and the AI prompt. */
export function describeAnswers(a: Answers): string {
  return [
    a.mode === 'meet' ? `${a.weeks} weeks out from a meet` : `${a.weeks}-week ${BLOCK_LABEL[a.block ?? 'volume'].toLowerCase()}`,
    `${a.days} days a week`, LEVEL_LABEL[a.level].toLowerCase(), `fatigue tolerance ${a.fatigue}`,
    `${FOCUS_LABEL[a.focus].toLowerCase()} focus`,
    a.limitations.length ? `working around ${a.limitations.map(l => LIMITATION_LABEL[l].toLowerCase()).join(', ')}` : 'no limitations',
    EQUIPMENT_LABEL[a.equipment].toLowerCase(), `${a.sessionMinutes}-minute sessions`,
  ].join(' · ');
}

export const FRIENDLY_TAG = FRIENDLY;
