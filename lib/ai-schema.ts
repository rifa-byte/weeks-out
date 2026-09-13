/**
 * Shared between the app and the API route: what the AI is asked to return, and how
 * that compact answer is expanded and validated into a Template. Kept dependency-free
 * so it runs in the app (Hermes) and on the server (EAS Hosting workers) alike.
 */
import { EXERCISES, exerciseById, customId } from './exercises';
import { describeAnswers, type Answers } from './generator';
import { taperWeek, type Phase } from './meetprep';
import type { PlannedDay, PlannedSet, Template } from './programs';

export interface AiSet { exercise: string; sets: number; reps: number; pct?: number; rpe?: number; note?: string }
export interface AiDay { name: string; sets: AiSet[] }
export interface AiPhase {
  phase: Phase;
  weeks: number;
  days: AiDay[];                       // the template week for this phase
  pctPerWeek: number;                  // added to every pct each week within the phase (e.g. 0.025)
  repsDropEveryWeeks?: number;         // reps on pct-bearing sets drop by 1 every N weeks (0 = never)
}
export interface AiProgram { name: string; about: string; why: string; phases: AiPhase[] }

/** JSON schema handed to the model as a tool, so the reply is structured. */
export const AI_TOOL = {
  name: 'write_program',
  description: 'Return the finished training program.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'about', 'why', 'phases'],
    properties: {
      name: { type: 'string', maxLength: 60 },
      about: { type: 'string', maxLength: 240, description: 'One sentence a lifter would read on the card.' },
      why: { type: 'string', maxLength: 600, description: 'Two to four sentences: why this structure for this lifter. Plain words.' },
      phases: {
        type: 'array', minItems: 1, maxItems: 4,
        items: {
          type: 'object', additionalProperties: false,
          required: ['phase', 'weeks', 'days', 'pctPerWeek'],
          properties: {
            phase: { type: 'string', enum: ['accumulate', 'intensify', 'peak', 'taper'] },
            weeks: { type: 'integer', minimum: 1, maximum: 16 },
            pctPerWeek: { type: 'number', minimum: 0, maximum: 0.05 },
            repsDropEveryWeeks: { type: 'integer', minimum: 0, maximum: 8 },
            days: {
              type: 'array', minItems: 2, maxItems: 6,
              items: {
                type: 'object', additionalProperties: false, required: ['name', 'sets'],
                properties: {
                  name: { type: 'string', maxLength: 40 },
                  sets: {
                    type: 'array', minItems: 0, maxItems: 10,
                    items: {
                      type: 'object', additionalProperties: false, required: ['exercise', 'sets', 'reps'],
                      properties: {
                        exercise: { type: 'string', description: 'An id from the movement list.' },
                        sets: { type: 'integer', minimum: 1, maximum: 8 },
                        reps: { type: 'integer', minimum: 1, maximum: 15 },
                        pct: { type: 'number', minimum: 0.4, maximum: 0.97, description: 'Fraction of the parent competition lift e1RM. Omit for accessories.' },
                        rpe: { type: 'number', minimum: 5, maximum: 10 },
                        note: { type: 'string', maxLength: 40 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export function systemPrompt(): string {
  const ids = EXERCISES.map(e => `${e.id}${e.parent && e.category === 'variation' ? `(${e.parent[0]},${Math.round(e.factor * 100)}%)` : ''}`).join(' ');
  return [
    'You write powerlifting programs for the Weeks Out app. You are a careful, experienced coach. You do not give medical advice; if a limitation is listed you choose joint-friendly variations and lower volume for that pattern.',
    'Method: block periodization as used by elite programs (Sheiko-style frequency, Calgary Barbell / RTS-style blocks). Phases: accumulate = 70–80% top sets of 4–6 with 3–4 back-off sets, more variations and accessories; intensify = 82–90% top sets of 2–3 with 2–3 back-offs; peak = singles at 90–95% (an opener, then a second attempt), very little else; taper = light, the app writes it. In meet mode the phases must sum exactly to the weeks out and the last phase must be "taper" with weeks 1. In general mode return a single block (plus, for a peaking block, a 1-week taper).',
    'Frequency: each competition lift heavy once a week; bench usually twice; deadlift back-offs fewer than squat. 2 days: squat+bench / deadlift+bench-variation. 3 days: SBD spread with bench twice. 4: heavy squat, heavy bench, heavy deadlift, variations. 5: bench three times. 6: everything twice plus an accessory day.',
    'Percentages are of the PARENT competition lift e1RM; the app multiplies variations by their factor (shown in brackets). Give pct and rpe on every barbell set; omit pct on accessories. Reps on pct sets 1–6; accessories 6–15. Keep sets 1–8.',
    'Fatigue tolerance low → one fewer back-off/volume set everywhere, and no more than one accessory a day; high → one more back-off set. Beginners: +1 rep, −3% on top sets, fewer variations. Advanced: more back-off work, harder variations.',
    'Compound focus → one extra exposure of that lift each week (volume role) and its variation should target the lifter’s likely weak point. Session length 45 min → one accessory per day; 60 → two; 90 → up to three.',
    'Return ONLY by calling write_program. Use exercise ids exactly from this list (variation ids show parent lift and % of parent): ' + ids,
  ].join('\n');
}

export function userPrompt(a: Answers): string {
  return `Lifter: ${describeAnswers(a)}. Mode: ${a.mode}. Total weeks must equal ${a.weeks}. Days per week: ${a.days}. Write the program.`;
}

// ---------- validation + expansion ----------
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function cleanExercise(id: string): string {
  const raw = String(id).trim().toLowerCase().replace(/\s+/g, '-');
  if (exerciseById(raw)) return raw;
  // try a loose match on name
  const byName = EXERCISES.find(e => e.name.toLowerCase() === String(id).trim().toLowerCase());
  return byName ? byName.id : customId(String(id));
}

function cleanSet(s: AiSet): PlannedSet {
  const ex = cleanExercise(s.exercise);
  const hasParent = !!exerciseById(ex)?.parent;
  const out: PlannedSet = { exercise: ex, sets: clamp(Math.round(s.sets || 1), 1, 8), reps: clamp(Math.round(s.reps || 1), 1, 15) };
  if (hasParent && typeof s.pct === 'number') out.pct = clamp(s.pct, 0.4, 0.97);
  if (typeof s.rpe === 'number') out.rpe = clamp(Math.round(s.rpe * 2) / 2, 5, 10);
  if (s.note) out.note = String(s.note).slice(0, 40);
  return out;
}

/** Turn the AI's compact answer into a Template; throws with a plain message if it is unusable. */
export function expandAiProgram(p: AiProgram, a: Answers): Template & { why: string } {
  if (!p || !Array.isArray(p.phases) || p.phases.length === 0) throw new Error('The AI returned no phases.');
  const Dn = clamp(Math.round(a.days), 2, 6);
  const phases: AiPhase[] = p.phases.map(ph => ({
    phase: (['accumulate', 'intensify', 'peak', 'taper'] as Phase[]).includes(ph.phase) ? ph.phase : 'accumulate',
    weeks: clamp(Math.round(ph.weeks || 1), 1, 16),
    days: (ph.days || []).slice(0, Dn).map(d => ({ name: String(d.name || 'Day').slice(0, 40), sets: (d.sets || []).map(cleanSet) })),
    pctPerWeek: clamp(Number(ph.pctPerWeek) || 0, 0, 0.05),
    repsDropEveryWeeks: clamp(Math.round(ph.repsDropEveryWeeks || 0), 0, 8),
  }));
  // pad short weeks with rest days so every week has Dn days
  for (const ph of phases) while (ph.days.length < Dn) ph.days.push({ name: 'Rest', sets: [] });
  // force the total to the requested length: trim or stretch the first non-taper phase
  const total = () => phases.reduce((s, x) => s + x.weeks, 0);
  const target = clamp(Math.round(a.weeks), 1, 24);
  const adjustable = phases.find(x => x.phase !== 'taper') ?? phases[0];
  while (total() > target && adjustable.weeks > 1) adjustable.weeks--;
  while (total() > target) { const last = phases[phases.length - 1]; if (last.weeks > 1) last.weeks--; else if (phases.length > 1) phases.pop(); else break; }
  while (total() < target) adjustable.weeks++;
  if (a.mode === 'meet' && phases[phases.length - 1].phase !== 'taper') {
    if (adjustable.weeks > 1) { adjustable.weeks--; phases.push({ phase: 'taper', weeks: 1, days: [], pctPerWeek: 0 }); }
  }

  const weekList: { ph: AiPhase; k: number }[] = [];
  for (const ph of phases) for (let k = 0; k < ph.weeks; k++) weekList.push({ ph, k });

  return {
    id: `ai:${Date.now()}`,
    name: String(p.name || 'Your program').slice(0, 60),
    weeks: weekList.length,
    daysPerWeek: Dn,
    who: 'Written for you.',
    shape: String(p.about || '').slice(0, 240),
    why: String(p.why || '').slice(0, 600),
    week(w: number): PlannedDay[] {
      const item = weekList[w - 1];
      if (!item || item.ph.phase === 'taper') return taperWeek(Dn);
      const { ph, k } = item;
      const dropEvery = ph.repsDropEveryWeeks || 0;
      const drop = dropEvery > 0 ? Math.floor(k / dropEvery) : 0;
      return ph.days.map(d => ({
        name: d.name,
        sets: d.sets.map(s => (s.pct == null ? s : { ...s, pct: clamp(s.pct + ph.pctPerWeek * k, 0.4, 0.97), reps: Math.max(1, s.reps - drop) })),
      }));
    },
  };
}
