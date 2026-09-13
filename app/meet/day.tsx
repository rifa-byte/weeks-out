import { Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { PlateStrip } from '@/components/PlateStrip';
import { HelpLink } from '@/components/HelpLink';
import { Body, Button, Card, Divider, Dot, Eyebrow, Field, H2, Hint, Num, Row, Screen, Segmented, Title } from '@/components/ui';
import { liftColor, space, useTheme } from '@/constants/theme';
import { bestByLift, getJson, setJson, todayIso } from '@/lib/db';
import { formatDate, parseNum } from '@/lib/format';
import {
  buildTimeline, emptyAttempts, hhmm, parseHhmm, runningTotal, suggestAttempt,
  type LiftAttempts, type Phase, type TimelineItem, type WeighInType,
} from '@/lib/meetday';
import { dots, ipfGL, LIFTS, LIFT_LABEL, planAttempts, warmups, type Lift } from '@/lib/math';
import { useSettings } from '@/lib/settings';

interface MeetPlan {
  weighIn: WeighInType;
  weighInTime: string;     // "08:00"
  squatTime: string;       // "10:00"
  benchTime: string;       // "" = estimate
  deadliftTime: string;
  cutting: boolean;
}
const DEFAULT_PLAN: MeetPlan = { weighIn: '2h', weighInTime: '08:00', squatTime: '10:00', benchTime: '', deadliftTime: '', cutting: false };

type AllAttempts = Record<Lift, LiftAttempts>;

const PHASE_LABEL: Record<Phase, string> = {
  'day-before': 'Day before', morning: 'Morning', 'weigh-in': 'Weigh-in', recovery: 'Refuel', squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift', after: 'After',
};

export default function MeetDayScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const { settings, fmt, unit, toKg } = useSettings();

  const [plan, setPlan] = useState<MeetPlan>(DEFAULT_PLAN);
  const [attempts, setAttempts] = useState<AllAttempts | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({}); // `${lift}-${n}` -> text being edited
  const [now, setNow] = useState(new Date());

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      const p = await getJson<MeetPlan>(db, 'meetPlan', DEFAULT_PLAN);
      let a = await getJson<AllAttempts | null>(db, 'meetAttempts', null);
      if (!a) {
        const best = await bestByLift(db);
        a = { squat: emptyAttempts(planFor(best.squat)), bench: emptyAttempts(planFor(best.bench)), deadlift: emptyAttempts(planFor(best.deadlift)) };
      }
      if (alive) { setPlan(p); setAttempts(a); }
    })();
    return () => { alive = false; };
  }, [db]));

  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id); }, []);

  async function savePlan(next: MeetPlan) { setPlan(next); await setJson(db, 'meetPlan', next); }
  async function saveAttempts(next: AllAttempts) { setAttempts(next); await setJson(db, 'meetAttempts', next); }

  const timeline = useMemo(() => {
    const wi = parseHhmm(plan.weighInTime), sq = parseHhmm(plan.squatTime);
    if (wi == null || sq == null) return null;
    return buildTimeline({
      weighIn: plan.weighIn, weighInMin: wi, squatFlightMin: sq,
      benchFlightMin: parseHhmm(plan.benchTime) ?? undefined,
      deadliftFlightMin: parseHhmm(plan.deadliftTime) ?? undefined,
      cutting: plan.cutting, bodyweightKg: settings.bodyweightKg,
    });
  }, [plan, settings.bodyweightKg]);

  const isMeetDay = todayIso() === settings.meetDate;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nextIdx = isMeetDay && timeline ? timeline.findIndex(i => i.min >= nowMin) : -1;

  // ---------- attempts ----------
  function setResult(l: Lift, n: 0 | 1 | 2, result: 'good' | 'miss' | null) {
    if (!attempts) return;
    const la = attempts[l].map(a => ({ ...a })) as LiftAttempts;
    la[n].result = result;
    const planned: [number, number, number] = [la[0].weightKg, la[1].weightKg, la[2].weightKg];
    if (n < 2 && result) la[n + 1].weightKg = suggestAttempt(planned, la, (n + 1) as 1 | 2);
    saveAttempts({ ...attempts, [l]: la });
  }
  function setWeight(l: Lift, n: 0 | 1 | 2, text: string) {
    if (!attempts) return;
    const v = parseNum(text);
    if (!v || v <= 0) return;
    const la = attempts[l].map(a => ({ ...a })) as LiftAttempts;
    la[n].weightKg = Math.round(toKg(v) * 4) / 4;
    saveAttempts({ ...attempts, [l]: la });
  }
  function resetAttempts() {
    Alert.alert('Reset attempts?', 'Clears good/miss results and reloads openers from your best e1RMs.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => {
        const best = await bestByLift(db);
        await saveAttempts({ squat: emptyAttempts(planFor(best.squat)), bench: emptyAttempts(planFor(best.bench)), deadlift: emptyAttempts(planFor(best.deadlift)) });
        setEdit({});
      } },
    ]);
  }

  const totals = attempts ? runningTotal(attempts) : null;
  const current = attempts ? LIFTS.map(l => ({ l, n: attempts[l].findIndex(a => a.result == null) })).find(x => x.n >= 0) : null;

  return (
    <>
      <Stack.Screen options={{ title: 'Meet day' }} />
      <Screen>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Eyebrow>{settings.meetName} · {formatDate(settings.meetDate)}</Eyebrow>
            <Title>{isMeetDay ? 'Today' : 'Meet day'}</Title>
            <Body muted>Fill in the times below and the app writes your day. On the day it follows the clock.</Body>
          </View>
          <HelpLink topic="meetday" />
        </Row>

        <Card>
          <Eyebrow>Your meet</Eyebrow>
          <View style={{ gap: 4 }}>
            <Text style={{ color: t.ink3, fontSize: 12, fontWeight: '600' }}>Weigh-in</Text>
            <Segmented<WeighInType> options={['2h', '24h']} value={plan.weighIn} onChange={v => savePlan({ ...plan, weighIn: v })} labels={v => (v === '2h' ? '2 hours before (IPF)' : '24 hours before')} />
          </View>
          <Row style={{ alignItems: 'flex-end' }}>
            <Field label={plan.weighIn === '2h' ? 'Weigh-in time' : 'Weigh-in time (day before)'} value={plan.weighInTime} onChangeText={v => setPlan({ ...plan, weighInTime: v })} onBlur={() => savePlan(plan)} placeholder="08:00" keyboardType="numbers-and-punctuation" />
            <Field label="Squat flight starts" value={plan.squatTime} onChangeText={v => setPlan({ ...plan, squatTime: v })} onBlur={() => savePlan(plan)} placeholder="10:00" keyboardType="numbers-and-punctuation" />
          </Row>
          <Row style={{ alignItems: 'flex-end' }}>
            <Field label="Bench flight (optional)" value={plan.benchTime} onChangeText={v => setPlan({ ...plan, benchTime: v })} onBlur={() => savePlan(plan)} placeholder="estimate" keyboardType="numbers-and-punctuation" />
            <Field label="Deadlift flight (optional)" value={plan.deadliftTime} onChangeText={v => setPlan({ ...plan, deadliftTime: v })} onBlur={() => savePlan(plan)} placeholder="estimate" keyboardType="numbers-and-punctuation" />
          </Row>
          <Pressable onPress={() => savePlan({ ...plan, cutting: !plan.cutting })} accessibilityRole="switch" accessibilityState={{ checked: plan.cutting }}
            style={{ alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: plan.cutting ? t.ink : t.panelAlt }}>
            <Text style={{ color: plan.cutting ? t.ground : t.ink, fontWeight: '600' }}>{plan.cutting ? 'Cutting to make weight' : 'Not cutting'}</Text>
          </Pressable>
          <Body muted style={{ fontSize: 12 }}>Times are 24-hour, e.g. 08:00. Flight times come from the meet’s running order the night before; update them as the day slips.</Body>
        </Card>

        {timeline ? (
          <View style={{ gap: space.sm }}>
            <H2>Timeline</H2>
            <Hint>Tap any line to read what to do.</Hint>
            {(['before', 'day'] as const).map(part => {
              const items = timeline.filter(i => (part === 'before' ? i.min < 0 : i.min >= 0));
              return (
                <Card key={part} style={{ gap: 0, paddingVertical: 4 }}>
                  <Eyebrow style={{ paddingVertical: 8 }}>{part === 'before' ? 'The day before' : formatDate(settings.meetDate)}</Eyebrow>
                  {items.map((it, i) => {
                    const idx = timeline.indexOf(it);
                    const state = !isMeetDay ? 'plain' : idx < nextIdx || nextIdx === -1 ? 'done' : idx === nextIdx ? 'next' : 'plain';
                    return <TimelineRow key={i} item={it} state={state} first={i === 0} />;
                  })}
                </Card>
              );
            })}
          </View>
        ) : <Body muted>Enter a weigh-in time and a squat flight time to build the timeline.</Body>}

        {attempts && totals ? (
          <View style={{ gap: space.sm }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <H2>Platform</H2>
              <Pressable onPress={resetAttempts} hitSlop={8} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, backgroundColor: t.panelAlt }}><Text style={{ color: t.ink2, fontSize: 12, fontWeight: '700' }}>Reset attempts</Text></Pressable>
            </Row>
            <Hint>After each lift, tap Good or Miss. The next attempt fills itself in.</Hint>
            <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View><Eyebrow>Total so far</Eyebrow><Num size={26}>{fmt(totals.total)} {unit}</Num></View>
              <View><Eyebrow>IPF GL</Eyebrow><Num size={26}>{totals.total ? ipfGL(totals.total, settings.bodyweightKg, settings.sex).toFixed(1) : '—'}</Num></View>
              <View><Eyebrow>DOTS</Eyebrow><Num size={26}>{totals.total ? dots(totals.total, settings.bodyweightKg, settings.sex).toFixed(1) : '—'}</Num></View>
            </Card>
            {totals.bombed.length ? <Body style={{ color: t.accent }}>No successful {totals.bombed.map(l => LIFT_LABEL[l].toLowerCase()).join(', ')} — no total. It happens; finish the day anyway.</Body> : null}

            {LIFTS.map(l => {
              const la = attempts[l];
              const cur = la.findIndex(a => a.result == null);
              const isCurrentLift = current?.l === l;
              const goods = la.filter(a => a.result === 'good').map(a => a.weightKg);
              return (
                <Card key={l}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Row><Dot color={liftColor[l]} /><Text style={{ color: t.ink, fontWeight: '700', fontSize: 16 }}>{LIFT_LABEL[l]}</Text></Row>
                    <Eyebrow>best {goods.length ? `${fmt(Math.max(...goods))} ${unit}` : '—'}</Eyebrow>
                  </Row>
                  {la.map((a, n) => {
                    const key = `${l}-${n}`;
                    const active = n === cur;
                    return (
                      <View key={n} style={{ gap: 6 }}>
                        {n > 0 ? <Divider /> : null}
                        <Row style={{ justifyContent: 'space-between' }}>
                          <Text style={{ color: active ? t.ink : t.ink3, fontWeight: '700', width: 36 }}>{n + 1}{n === 0 ? 'st' : n === 1 ? 'nd' : 'rd'}</Text>
                          <Field
                            value={edit[key] ?? fmt(a.weightKg)}
                            onChangeText={v => setEdit(e => ({ ...e, [key]: v }))}
                            onBlur={() => { if (edit[key] != null) { setWeight(l, n as 0 | 1 | 2, edit[key]); setEdit(e => { const c = { ...e }; delete c[key]; return c; }); } }}
                            keyboardType="decimal-pad"
                            containerStyle={{ flex: 0, width: 96 }}
                            style={{ textAlign: 'right', paddingVertical: 6, fontWeight: '800', color: a.result === 'good' ? t.good : a.result === 'miss' ? t.danger : t.ink }}
                          />
                          <Row style={{ flex: 1, justifyContent: 'flex-end' }}>
                            <Mark label="Good" on={a.result === 'good'} color={t.good} onPress={() => setResult(l, n as 0 | 1 | 2, a.result === 'good' ? null : 'good')} />
                            <Mark label="Miss" on={a.result === 'miss'} color={t.danger} onPress={() => setResult(l, n as 0 | 1 | 2, a.result === 'miss' ? null : 'miss')} />
                          </Row>
                        </Row>
                        {active && isCurrentLift ? (
                          <>
                            <PlateStrip weightKg={a.weightKg} plateSet="ipf" barKg={20} collars />
                            {n === 0 ? (
                              <Row style={{ flexWrap: 'wrap' }}>
                                <Eyebrow style={{ width: '100%' }}>Warm-ups</Eyebrow>
                                {warmups(a.weightKg).map((w, i) => (
                                  <View key={i} style={{ backgroundColor: t.panelAlt, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                                    <Text style={{ color: t.ink, fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '600' }}>{fmt(w.weight)} × {w.reps}</Text>
                                  </View>
                                ))}
                              </Row>
                            ) : null}
                          </>
                        ) : null}
                      </View>
                    );
                  })}
                </Card>
              );
            })}
            <Body muted style={{ fontSize: 12 }}>After a good lift the next attempt fills with your plan (or +2.5 if you already beat it). After a miss it repeats the weight. Type over any weight to change it; attempts must go in within a minute of the previous lift.</Body>
          </View>
        ) : null}
      </Screen>
    </>
  );
}

function planFor(best: number | null): [number, number, number] {
  if (!best) return [60, 65, 70];
  const p = planAttempts(best);
  return [p.opener, p.second, p.third];
}

function TimelineRow({ item, state, first }: { item: TimelineItem; state: 'plain' | 'done' | 'next'; first: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(state === 'next');
  return (
    <Pressable onPress={() => setOpen(o => !o)} style={{ borderTopWidth: first ? 0 : 0.5, borderTopColor: t.line, paddingVertical: 10, backgroundColor: state === 'next' ? t.accentSoft : 'transparent', marginHorizontal: -16, paddingHorizontal: 16 }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <Text style={{ color: state === 'done' ? t.ink3 : t.ink, fontFamily: undefined, fontVariant: ['tabular-nums'], fontWeight: '700', width: 52 }}>{hhmm(item.min)}</Text>
        <View style={{ flex: 1 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: state === 'done' ? t.ink3 : t.ink, fontWeight: '700', fontSize: 15, textDecorationLine: state === 'done' ? 'line-through' : 'none', flexShrink: 1 }}>{item.title}</Text>
            <Text style={{ color: t.ink3, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>{PHASE_LABEL[item.phase]}</Text>
          </Row>
          {open ? <Body muted style={{ fontSize: 13, marginTop: 2 }}>{item.detail}</Body> : null}
        </View>
      </Row>
    </Pressable>
  );
}

function Mark({ label, on, color, onPress }: { label: string; on: boolean; color: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 6, backgroundColor: on ? color : t.panelAlt, minWidth: 60, alignItems: 'center' }}>
      <Text style={{ color: on ? '#fff' : t.ink, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
