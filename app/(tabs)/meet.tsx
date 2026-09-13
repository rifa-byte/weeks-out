import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateField } from '@/components/DateField';
import { BarLoader } from '@/components/BarLoader';
import { HelpLink } from '@/components/HelpLink';
import { Body, Button, Card, Divider, Dot, Eyebrow, Field, H2, Hint, Num, Row, Screen, Segmented, Title } from '@/components/ui';
import { liftColor, space, useTheme } from '@/constants/theme';
import { bestByLift, deleteBodyweight, listBodyweight, setBodyweight, todayIso, type BodyweightRow } from '@/lib/db';
import { formatDate, parseIso, parseNum } from '@/lib/format';
import {
  dots, ipfClass, ipfGL, IPF_CLASSES, LIFTS, LIFT_LABEL, planAttempts, warmups, weeksOut, wilks,
  type Lift, type Sex,
} from '@/lib/math';
import { useSettings } from '@/lib/settings';

export default function MeetScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, set, fmt, unit, toKg, fromKg } = useSettings();

  // ----- profile -----
  const [bwText, setBwText] = useState('');
  const [meetName, setMeetName] = useState(settings.meetName);
  const [meetDate, setMeetDate] = useState(settings.meetDate);
  useEffect(() => { setBwText(fmt(settings.bodyweightKg, settings.units === 'lb' ? 0 : 1)); }, [settings.bodyweightKg, settings.units, fmt]);
  useEffect(() => { setMeetName(settings.meetName); setMeetDate(settings.meetDate); }, [settings.meetName, settings.meetDate]);

  function commitBw() {
    const n = parseNum(bwText);
    if (n && n > 0) set('bodyweightKg', Math.round(toKg(n) * 100) / 100);
  }

  // ----- attempts -----
  const [best, setBest] = useState<Record<Lift, number | null>>({ squat: null, bench: null, deadlift: null });
  const [override, setOverride] = useState<Record<Lift, string>>({ squat: '', bench: '', deadlift: '' });
  useFocusEffect(useCallback(() => { bestByLift(db).then(setBest); }, [db]));

  const basis = (l: Lift): number | null => {
    const o = parseNum(override[l]);
    if (o && o > 0) return toKg(o);
    return best[l];
  };
  const plans = useMemo(() => {
    const out: Partial<Record<Lift, ReturnType<typeof planAttempts>>> = {};
    for (const l of LIFTS) { const b = basis(l); if (b) out[l] = planAttempts(b); }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [best, override, settings.units]);
  const projectedTotal = LIFTS.every(l => plans[l]) ? LIFTS.reduce((s, l) => s + (plans[l]?.third ?? 0), 0) : null;

  // ----- scoring -----
  const [totalText, setTotalText] = useState('');
  useEffect(() => { if (projectedTotal && totalText === '') setTotalText(fmt(projectedTotal, 1)); }, [projectedTotal]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalKg = (() => { const n = parseNum(totalText); return n && n > 0 ? toKg(n) : null; })();
  const bw = settings.bodyweightKg;
  const sex: Sex = settings.sex;

  // ----- bodyweight log -----
  const [bwLog, setBwLog] = useState<BodyweightRow[]>([]);
  const [bwToday, setBwToday] = useState('');
  useFocusEffect(useCallback(() => { listBodyweight(db).then(setBwLog); }, [db]));
  async function saveToday() {
    const n = parseNum(bwToday);
    if (!n || n <= 0) return;
    const kg = Math.round(toKg(n) * 100) / 100;
    await setBodyweight(db, todayIso(), kg);
    await set('bodyweightKg', kg);
    setBwToday('');
    setBwLog(await listBodyweight(db));
  }
  const classLimit = IPF_CLASSES[sex].find(c => bw <= c) ?? null;
  const toLimit = classLimit != null ? classLimit - bw : null;
  const trend = bwLog.length >= 2 ? bwLog[0].kg - bwLog[Math.min(bwLog.length - 1, 6)].kg : null;

  const { weeks, days } = weeksOut(parseIso(settings.meetDate));

  return (
    <Screen style={{ paddingTop: insets.top + space.lg }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Eyebrow>Meet day</Eyebrow>
          <Title>{days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}${weeks > 1 ? ` · ${weeks} weeks` : ''} out`}</Title>
        </View>
        <HelpLink topic="meet" />
      </Row>

      <View style={{ gap: 6 }}>
        <Button title="Open meet-day mode ›" onPress={() => router.push('/meet/day')} />
        <Hint style={{ textAlign: 'center' }}>Your timeline for the day, attempts, and running total.</Hint>
      </View>

      <Card>
        <Eyebrow>You and your meet</Eyebrow>
        <Body muted style={{ fontSize: 12 }}>Tap a box to edit. It saves when you tap away.</Body>
        <Row style={{ alignItems: 'flex-end' }}>
          <Field label="Meet" value={meetName} onChangeText={setMeetName} onBlur={() => set('meetName', meetName.trim() || 'My meet')} placeholder="Meet name" />
          <DateField label="Date" value={meetDate} onChange={d => { setMeetDate(d); set('meetDate', d); }} />
        </Row>
        <Row style={{ alignItems: 'flex-end' }}>
          <Field label={`Bodyweight (${unit})`} value={bwText} onChangeText={setBwText} onBlur={commitBw} keyboardType="decimal-pad" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: t.ink3, fontSize: 12, fontWeight: '600' }}>Sex</Text>
            <Segmented<Sex> options={['M', 'F']} value={sex} onChange={v => set('sex', v)} labels={v => (v === 'M' ? 'Men' : 'Women')} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: t.ink3, fontSize: 12, fontWeight: '600' }}>Units</Text>
            <Segmented<'kg' | 'lb'> options={['kg', 'lb']} value={settings.units} onChange={v => set('units', v)} />
          </View>
        </Row>
        <Body muted style={{ fontSize: 13 }}>IPF class: {ipfClass(bw, sex)} kg · {formatDate(settings.meetDate)}</Body>
      </Card>

      <View style={{ gap: space.sm }}>
        <H2>Attempts</H2>
        <Body muted style={{ fontSize: 13 }}>Worked out from your best e1RM in the log: opener ≈ 91%, second ≈ 96%, third = a small PR. To plan from a different number, type it in the box on the right.</Body>
        {LIFTS.map(l => {
          const p = plans[l];
          const b = basis(l);
          return (
            <Card key={l}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row><Dot color={liftColor[l]} /><Text style={{ color: t.ink, fontWeight: '700', fontSize: 16 }}>{LIFT_LABEL[l]}</Text></Row>
                <Field
                  value={override[l]}
                  onChangeText={v => setOverride(o => ({ ...o, [l]: v }))}
                  placeholder={best[l] ? `best ${fmt(best[l])}` : `best (${unit})`}
                  keyboardType="decimal-pad"
                  containerStyle={{ flex: 0, width: 140 }}
                  style={{ textAlign: 'right', paddingVertical: 6 }}
                />
              </Row>
              {p ? (
                <>
                  <Row style={{ justifyContent: 'space-between' }}>
                    {(['opener', 'second', 'third'] as const).map(k => (
                      <View key={k} style={{ flex: 1 }}>
                        <Eyebrow>{k === 'opener' ? '1st' : k === 'second' ? '2nd' : '3rd'}</Eyebrow>
                        <Num size={28} color={k === 'third' ? t.accent : t.ink}>{fmt(p[k])}</Num>
                        <Body muted style={{ fontSize: 12 }}>{b ? `${Math.round((p[k] / b) * 100)}%` : ''}</Body>
                      </View>
                    ))}
                  </Row>
                  <Divider />
                  <Eyebrow>Warm-up to the opener</Eyebrow>
                  <Row style={{ flexWrap: 'wrap' }}>
                    {warmups(p.opener).map((s, i) => (
                      <View key={i} style={{ backgroundColor: t.panelAlt, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Text style={{ color: t.ink, fontVariant: ['tabular-nums'], fontWeight: '600' }}>{fmt(s.weight)} × {s.reps}</Text>
                      </View>
                    ))}
                    <View style={{ backgroundColor: t.accentSoft, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: t.accent, fontVariant: ['tabular-nums'], fontWeight: '700' }}>{fmt(p.opener)} × 1</Text>
                    </View>
                  </Row>
                </>
              ) : (
                <Body muted style={{ fontSize: 13 }}>Log a {LIFT_LABEL[l].toLowerCase()} set, or type your best above.</Body>
              )}
            </Card>
          );
        })}
        {projectedTotal ? (
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Eyebrow>If all thirds go</Eyebrow>
            <Num size={24}>{fmt(projectedTotal)} {unit}</Num>
          </Card>
        ) : null}
      </View>

      <View style={{ gap: space.sm }}>
        <H2>Bodyweight</H2>
        <Card>
          <Row style={{ alignItems: 'flex-end' }}>
            <Field label={`Today’s weight (${unit})`} value={bwToday} onChangeText={setBwToday} keyboardType="decimal-pad" placeholder={fmt(bw, 1)} onSubmitEditing={saveToday} returnKeyType="done" />
            <Button title="Save" onPress={saveToday} style={{ minWidth: 90 }} />
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Eyebrow>Class</Eyebrow>
              <Num size={22}>{ipfClass(bw, sex)} kg</Num>
            </View>
            <View style={{ flex: 1 }}>
              <Eyebrow>To limit</Eyebrow>
              <Num size={22} color={toLimit != null && toLimit < 1 ? t.accent : t.ink}>{toLimit != null ? `${fmt(toLimit, 1)} ${unit}` : 'top class'}</Num>
            </View>
            <View style={{ flex: 1 }}>
              <Eyebrow>7-day</Eyebrow>
              <Num size={22}>{trend != null ? `${trend > 0 ? '+' : ''}${fmt(trend, 1)}` : '—'}</Num>
            </View>
          </Row>
          {bwLog.length > 0 ? (
            <Row style={{ flexWrap: 'wrap' }}>
              {bwLog.slice(0, 10).map(r => (
                <Pressable key={r.date} onLongPress={() => { deleteBodyweight(db, r.date).then(() => listBodyweight(db).then(setBwLog)); }} style={{ backgroundColor: t.panelAlt, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ color: t.ink2, fontSize: 12, fontVariant: ['tabular-nums'] }}>{formatDate(r.date).replace(/^\w+,?\s*/, '')} · {fmt(r.kg, 1)}</Text>
                </Pressable>
              ))}
            </Row>
          ) : <Body muted style={{ fontSize: 13 }}>Weigh in most mornings and the trend will show here. Long-press an entry to delete it.</Body>}
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <H2>Score a total</H2>
        <Card>
          <Field label={`Total (${unit})`} value={totalText} onChangeText={setTotalText} keyboardType="decimal-pad" placeholder="0" />
          <Row style={{ justifyContent: 'space-between' }}>
            <ScoreTile label="IPF GL" value={totalKg ? ipfGL(totalKg, bw, sex).toFixed(2) : '—'} />
            <ScoreTile label="DOTS" value={totalKg ? dots(totalKg, bw, sex).toFixed(2) : '—'} />
            <ScoreTile label="Wilks" value={totalKg ? wilks(totalKg, bw, sex).toFixed(2) : '—'} />
          </Row>
          <Body muted style={{ fontSize: 12 }}>Scored at {fmt(bw, 1)} {unit}, {sex === 'M' ? 'men' : 'women'}, raw / classic. Uses the published IPF GL (2020), DOTS (2019) and original Wilks coefficients.</Body>
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <H2>Load the bar</H2>
        <Card><BarLoader /></Card>
      </View>

      <Button title={fromKg(1) === 1 ? 'Switch to lb' : 'Switch to kg'} kind="ghost" onPress={() => set('units', settings.units === 'kg' ? 'lb' : 'kg')} />
    </Screen>
  );
}

function ScoreTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Eyebrow>{label}</Eyebrow>
      <Num size={24}>{value}</Num>
    </View>
  );
}

