import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Body, Button, Card, Divider, Dot, Eyebrow, H2, Hint, Row, Screen, Segmented, Title } from '@/components/ui';
import { liftColor, useTheme } from '@/constants/theme';
import { aiConfigured, generate, type GenerationResult } from '@/lib/ai';
import { getJson, setJson } from '@/lib/db';
import { parentOf } from '@/lib/exercises';
import { labelFor, parseIso } from '@/lib/format';
import {
  BLOCK_LABEL, DEFAULT_ANSWERS, EQUIPMENT_LABEL, FATIGUE_LABEL, FOCUS_LABEL, LEVEL_LABEL, LIMITATION_LABEL,
  type Answers, type Block, type Equipment, type Fatigue, type Focus, type Level, type Limitation,
} from '@/lib/generator';
import { weeksOut } from '@/lib/math';
import { PHASE_LABEL, phaseOfWeek } from '@/lib/meetprep';
import { setPendingTemplate } from '@/lib/pending';
import { useSettings } from '@/lib/settings';

type StepKey = 'level' | 'days' | 'block' | 'fatigue' | 'focus' | 'limits' | 'gym' | 'time';

export default function MakeProgramScreen() {
  const { first } = useLocalSearchParams<{ first?: string }>();
  const isFirst = first === '1';                // first launch: this IS the app until you start (or skip)
  const router = useRouter();
  const db = useSQLiteContext();
  const t = useTheme();
  const { settings } = useSettings();
  const meetWeeks = Math.max(1, Math.min(24, weeksOut(parseIso(settings.meetDate)).weeks || 1));

  const [a, setA] = useState<Answers>({ ...DEFAULT_ANSWERS, mode: settings.mode, weeks: settings.mode === 'meet' ? meetWeeks : 6 });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);

  // remember last answers so the next time is pre-filled
  useEffect(() => {
    getJson<Answers | null>(db, 'lastAnswers', null).then(saved => {
      if (saved) setA({ ...saved, mode: settings.mode, weeks: settings.mode === 'meet' ? meetWeeks : saved.weeks || 6 });
    });
  }, [db, settings.mode, meetWeeks]);

  const steps: StepKey[] = settings.mode === 'meet'
    ? ['level', 'days', 'fatigue', 'focus', 'limits', 'gym', 'time']
    : ['level', 'days', 'block', 'fatigue', 'focus', 'limits', 'gym', 'time'];
  const key = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;

  async function make() {
    setBusy(true);
    await setJson(db, 'lastAnswers', a);
    const r = await generate(a);
    setResult(r);
    setBusy(false);
  }

  async function start() {
    if (!result) return;
    if (isFirst) await setJson(db, 'setupDone', true);
    setPendingTemplate(result.template);
    router.replace({ pathname: '/program/start', params: { template: 'pending' } });
  }
  async function skip() {
    await setJson(db, 'setupDone', true);
    router.back();
  }
  const lock = isFirst ? { gestureEnabled: false, headerBackVisible: false } : {};
  const firstTitle = isFirst ? 'Set up Weeks Out' : undefined;

  if (busy) {
    return (
      <>
        <Stack.Screen options={{ title: 'Making your program', ...lock }} />
        <Screen style={{ alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
          <ActivityIndicator size="large" color={t.accent} />
          <Title style={{ textAlign: 'center' }}>{aiConfigured() ? 'Writing your program…' : 'Building your program…'}</Title>
          <Body muted style={{ textAlign: 'center' }}>{aiConfigured() ? 'Usually 10–20 seconds. The app checks every number before you see it.' : 'A second or two.'}</Body>
        </Screen>
      </>
    );
  }

  if (result) {
    const tpl = result.template;
    const w1 = tpl.week(1);
    return (
      <>
        <Stack.Screen options={{ title: firstTitle ?? 'Your program', ...lock }} />
        <Screen>
          <View>
            <Eyebrow>{isFirst ? 'Your first program · ' : ''}{tpl.weeks} weeks · {tpl.daysPerWeek} days a week · {result.source === 'ai' ? 'written by AI, checked by the app' : 'built-in generator'}</Eyebrow>
            <Title>{tpl.name}</Title>
            {tpl.shape ? <Body muted>{tpl.shape}</Body> : null}
          </View>
          {tpl.why ? (
            <Card style={{ borderColor: t.accent, borderWidth: 1.5 }}>
              <Eyebrow>Why this shape</Eyebrow>
              <Body>{tpl.why}</Body>
            </Card>
          ) : null}
          {result.note ? <Body muted style={{ fontSize: 12 }}>{result.note}</Body> : null}

          <Card style={{ gap: 6 }}>
            <Eyebrow>Weeks</Eyebrow>
            <Row style={{ flexWrap: 'wrap' }}>
              {Array.from({ length: tpl.weeks }, (_, i) => i + 1).map(w => (
                <View key={w} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: t.panelAlt }}>
                  <Text style={{ color: t.ink2, fontSize: 12, fontWeight: '600' }}>{w} · {a.mode === 'meet' ? PHASE_LABEL[phaseOfWeek(tpl.weeks, w)].toLowerCase() : (tpl.week(w)[0]?.sets[0]?.pct ? `${Math.round((tpl.week(w)[0].sets[0].pct ?? 0) * 100)}%` : '—')}</Text>
                </View>
              ))}
            </Row>
          </Card>

          <Eyebrow>Week 1</Eyebrow>
          {w1.map((d, i) => (
            <Card key={i} style={{ gap: 0, paddingVertical: 6 }}>
              <H2 style={{ fontSize: 16, paddingBottom: 4 }}>{d.name}</H2>
              {d.sets.length === 0 ? <Body muted style={{ fontSize: 13 }}>Rest</Body> : d.sets.map((s, j) => {
                const parent = parentOf(s.exercise);
                return (
                  <View key={j}>
                    {j > 0 ? <Divider /> : null}
                    <Row style={{ paddingVertical: 6, justifyContent: 'space-between' }}>
                      <Row style={{ flex: 1 }}><Dot color={parent ? liftColor[parent] : t.ink3} size={8} /><Text style={{ color: t.ink, fontSize: 14, fontWeight: '600', flexShrink: 1 }}>{labelFor(s.exercise)}{s.note ? <Text style={{ color: t.ink3, fontWeight: '400' }}> · {s.note}</Text> : null}</Text></Row>
                      <Text style={{ color: t.ink2, fontSize: 13, fontVariant: ['tabular-nums'] }}>{s.sets}×{s.reps}{s.pct != null ? ` @ ${Math.round(s.pct * 100)}%` : ''}{s.rpe != null ? ` · RPE ${s.rpe}` : ''}</Text>
                    </Row>
                  </View>
                );
              })}
            </Card>
          ))}

          <Button title="Start this program" onPress={start} />
          <Hint style={{ textAlign: 'center' }}>Next you enter your bests and every weight is worked out.</Hint>
          <Row>
            <Button title="Make another" kind="ghost" onPress={make} style={{ flex: 1 }} />
            <Button title="Change answers" kind="ghost" onPress={() => { setResult(null); setStep(0); }} style={{ flex: 1 }} />
          </Row>
          {isFirst ? <Button title="Skip for now — I’ll just log" kind="ghost" onPress={skip} /> : null}
          <Body muted style={{ fontSize: 11, textAlign: 'center' }}>Training advice, not medical advice. If something hurts, stop and see a professional.</Body>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: firstTitle ?? 'Make me a program', ...lock }} />
      <Screen>
        <View>
          <Eyebrow>{isFirst ? 'Your first program · ' : ''}Question {step + 1} of {steps.length}</Eyebrow>
          <Title>{TITLES[key]}</Title>
          <Body muted>{SUBS[key]}</Body>
        </View>
        <Row style={{ gap: 4 }}>
          {steps.map((s, i) => <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? t.accent : t.line }} />)}
        </Row>

        <Card>
          {key === 'level' ? (
            <Options<Level> options={['beginner', 'intermediate', 'advanced']} value={a.level} onChange={v => setA({ ...a, level: v })} label={v => LEVEL_LABEL[v]}
              sub={v => v === 'beginner' ? 'Under a year of proper lifting, or still adding weight every week.' : v === 'intermediate' ? 'A few years in; progress comes in blocks, not sessions.' : 'Competed a few times; you know your weak points.'} />
          ) : key === 'days' ? (
            <>
              <Segmented<number> options={[2, 3, 4, 5, 6]} value={a.days} onChange={v => setA({ ...a, days: v })} labels={v => `${v} days`} />
              <Body muted style={{ fontSize: 13 }}>Pick what you will actually do, not what you wish you could.</Body>
            </>
          ) : key === 'block' ? (
            <>
              <Options<Block> options={['volume', 'strength', 'peak']} value={a.block ?? 'volume'} onChange={v => setA({ ...a, block: v })} label={v => BLOCK_LABEL[v]}
                sub={v => v === 'volume' ? 'More sets, moderate weights (70–80%). Build muscle and work capacity.' : v === 'strength' ? 'Heavier (82–90%), fewer reps. Turn muscle into numbers.' : 'Singles at 90%+ to test or to peak for a mock meet. Short.'} />
              <View style={{ gap: 4 }}>
                <Eyebrow>Length</Eyebrow>
                <Segmented<number> options={[4, 6, 8, 12]} value={a.weeks} onChange={v => setA({ ...a, weeks: v })} labels={v => `${v} wk`} />
              </View>
            </>
          ) : key === 'fatigue' ? (
            <Options<Fatigue> options={['low', 'medium', 'high']} value={a.fatigue} onChange={v => setA({ ...a, fatigue: v })} label={v => FATIGUE_LABEL[v]}
              sub={v => v === 'low' ? 'Sleep, work or age mean you need fewer sets to make the same progress.' : v === 'medium' ? 'Most lifters.' : 'You can take volume and bounce back in a day.'} />
          ) : key === 'focus' ? (
            <Options<Focus> options={['balanced', 'squat', 'bench', 'deadlift']} value={a.focus} onChange={v => setA({ ...a, focus: v })} label={v => FOCUS_LABEL[v]}
              sub={v => v === 'balanced' ? 'Equal attention to all three.' : `One extra ${v} session a week and variations aimed at its weak points.`} />
          ) : key === 'limits' ? (
            <>
              <Row style={{ flexWrap: 'wrap' }}>
                {(['knee', 'shoulder', 'low-back', 'hip', 'elbow'] as Limitation[]).map(l => {
                  const on = a.limitations.includes(l);
                  return (
                    <Pressable key={l} onPress={() => setA({ ...a, limitations: on ? a.limitations.filter(x => x !== l) : [...a.limitations, l] })} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                      style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? t.ink : t.panelAlt }}>
                      <Text style={{ color: on ? t.ground : t.ink, fontWeight: '700' }}>{LIMITATION_LABEL[l]}</Text>
                    </Pressable>
                  );
                })}
              </Row>
              <Body muted style={{ fontSize: 13 }}>{a.limitations.length ? 'Variations that load that joint get swapped for friendlier ones. The competition lifts stay.' : 'Nothing bothering you? Leave these blank.'}</Body>
            </>
          ) : key === 'gym' ? (
            <Options<Equipment> options={['commercial', 'powerlifting']} value={a.equipment} onChange={v => setA({ ...a, equipment: v })} label={v => EQUIPMENT_LABEL[v]}
              sub={v => v === 'commercial' ? 'Racks, barbells, machines. No specialty bars or chains.' : 'Calibrated plates, SSB, chains, blocks, the works.'} />
          ) : (
            <Options<45 | 60 | 90> options={[45, 60, 90]} value={a.sessionMinutes} onChange={v => setA({ ...a, sessionMinutes: v })} label={v => `${v} minutes`}
              sub={v => v === 45 ? 'Main lifts and one accessory.' : v === 60 ? 'Main lifts and two accessories.' : 'Everything, including the extras.'} />
          )}
        </Card>

        <Row>
          {step > 0 ? <Button title="Back" kind="ghost" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
          <Button title={last ? (aiConfigured() ? 'Make my program' : 'Build my program') : 'Next'} onPress={() => (last ? make() : setStep(step + 1))} style={{ flex: 2 }} />
        </Row>
        {a.mode === 'meet' ? <Body muted style={{ fontSize: 12, textAlign: 'center' }}>{meetWeeks} weeks out from {settings.meetName}. Phases scale to that.</Body> : null}
        {isFirst ? <Pressable onPress={skip} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 6 }}><Text style={{ color: t.ink3, fontSize: 12 }}>Skip for now — I’ll just log</Text></Pressable> : null}
      </Screen>
    </>
  );
}

const TITLES: Record<StepKey, string> = {
  level: 'How long have you been lifting?', days: 'How many days a week?', block: 'What kind of block?', fatigue: 'How do you handle fatigue?',
  focus: 'Which lift matters most right now?', limits: 'Anything to work around?', gym: 'What kind of gym?', time: 'How long is a session?',
};
const SUBS: Record<StepKey, string> = {
  level: 'Sets the intensity, the variations, and how much the program asks of you.', days: 'Tap one.', block: 'A block is one focus for a few weeks. Tap one, then pick how long.',
  fatigue: 'Be honest — it changes how many sets you get.', focus: 'Tap one.', limits: 'Tap any that apply. Not medical advice — just fewer things that poke a sore joint.',
  gym: 'Tap one.', time: 'Tap one.',
};

function Options<T extends string | number>({ options, value, onChange, label, sub }: { options: readonly T[]; value: T; onChange: (v: T) => void; label: (v: T) => string; sub?: (v: T) => string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {options.map(o => {
        const on = o === value;
        return (
          <Pressable key={String(o)} onPress={() => onChange(o)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={{ padding: 14, borderRadius: 10, borderWidth: 2, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accentSoft : t.panelAlt, gap: 2 }}>
            <Text style={{ color: t.ink, fontWeight: '800', fontSize: 16 }}>{label(o)}</Text>
            {sub ? <Body muted style={{ fontSize: 13 }}>{sub(o)}</Body> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
