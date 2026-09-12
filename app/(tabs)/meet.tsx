import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Card, Divider, Dot, Eyebrow, Field, H2, Num, Row, Screen, Segmented, Title } from '@/components/ui';
import { liftColor, space, useTheme } from '@/constants/theme';
import { bestByLift, deleteBodyweight, listBodyweight, setBodyweight, todayIso, type BodyweightRow } from '@/lib/db';
import { formatDate, parseIso, parseNum } from '@/lib/format';
import {
  dots, ipfClass, ipfGL, IPF_CLASSES, LIFTS, LIFT_LABEL, loadBar, PLATE_SETS, planAttempts, roundTo, warmups, weeksOut, wilks,
  type Lift, type PlateSetId, type Sex,
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
  function commitDate() {
    if (/^\d{4}-\d{2}-\d{2}$/.test(meetDate) && !Number.isNaN(parseIso(meetDate).getTime())) set('meetDate', meetDate);
    else setMeetDate(settings.meetDate);
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

  // ----- plates -----
  const [plateText, setPlateText] = useState('');
  const [collars, setCollars] = useState(settings.plateSet === 'ipf');
  const plateKg = (() => { const n = parseNum(plateText); return n && n > 0 ? toKg(n) : null; })();
  const load = plateKg ? loadBar(plateKg, { barKg: settings.barKg, collarsKg: collars ? 5 : 0, plates: PLATE_SETS[settings.plateSet].plates }) : null;

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
      <View>
        <Eyebrow>Meet day</Eyebrow>
        <Title>{days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}${weeks > 1 ? ` · ${weeks} weeks` : ''} out`}</Title>
      </View>

      <Button title="Meet-day mode: timeline, attempts, running total" onPress={() => router.push('/meet/day')} />

      <Card>
        <Eyebrow>You and your meet</Eyebrow>
        <Row style={{ alignItems: 'flex-end' }}>
          <Field label="Meet" value={meetName} onChangeText={setMeetName} onBlur={() => set('meetName', meetName.trim() || 'My meet')} placeholder="Meet name" />
          <Field label="Date (yyyy-mm-dd)" value={meetDate} onChangeText={setMeetDate} onBlur={commitDate} placeholder="2026-11-07" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
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
        <Body muted style={{ fontSize: 13 }}>Opener ≈ 91% of your best (rounded down), second ≈ 96%, third = a small PR. Everything lands on 2.5 {unit === 'kg' ? 'kg' : 'kg-equivalent'} steps. Type a different best to plan from it.</Body>
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
            <Field label={`Today (${unit})`} value={bwToday} onChangeText={setBwToday} keyboardType="decimal-pad" placeholder={fmt(bw, 1)} onSubmitEditing={saveToday} returnKeyType="done" />
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
        <Card>
          <View style={{ gap: 4 }}>
            <Text style={{ color: t.ink3, fontSize: 12, fontWeight: '600' }}>Plates in your gym</Text>
            <Segmented<PlateSetId>
              options={['gym-kg', 'gym-lb', 'ipf']}
              value={settings.plateSet}
              onChange={v => { set('plateSet', v); set('barKg', PLATE_SETS[v].barKg); setCollars(v === 'ipf'); }}
              labels={v => PLATE_SETS[v].label}
            />
          </View>
          <Row style={{ alignItems: 'flex-end' }}>
            <Field label={`Weight (${unit})`} value={plateText} onChangeText={setPlateText} keyboardType="decimal-pad" placeholder="0" />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: t.ink3, fontSize: 12, fontWeight: '600' }}>Bar</Text>
              <Segmented<number>
                options={settings.plateSet === 'gym-lb' ? [45 * 0.45359237, 35 * 0.45359237] : [20, 15]}
                value={settings.barKg}
                onChange={v => set('barKg', v)}
                labels={v => settings.plateSet === 'gym-lb' ? `${Math.round(v / 0.45359237)} lb` : `${v} kg`}
              />
            </View>
            <Pressable onPress={() => setCollars(c => !c)} accessibilityRole="switch" accessibilityState={{ checked: collars }}
              style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, backgroundColor: collars ? t.ink : t.panelAlt }}>
              <Text style={{ color: collars ? t.ground : t.ink, fontWeight: '600' }}>Collars</Text>
            </Pressable>
          </Row>
          {load ? (
            <>
              <Row style={{ flexWrap: 'wrap', gap: 4 }}>
                <BarEnd />
                {load.perSide.map((p, i) => <PlateChip key={i} kg={p.kg} color={p.color} label={settings.plateSet === 'gym-lb' ? p.name : undefined} />)}
                {load.perSide.length === 0 ? <Body muted>Just the bar{collars ? ' and collars' : ''}.</Body> : null}
              </Row>
              <Body muted style={{ fontSize: 13 }}>
                Per side, {fmt(settings.barKg, 0)} {unit} bar{collars ? ' + collars' : ''}.
                {load.remainder > 0.01 ? ` ${fmt(load.remainder, 2)} ${unit} can’t be loaded with these plates — nearest is ${fmt(roundTo(plateKg! - load.remainder, 0.5))}.` : ''}
              </Body>
            </>
          ) : null}
          <Row style={{ flexWrap: 'wrap' }}>
            {[60, 100, 140, 180, 220].map(k => (
              <Pressable key={k} onPress={() => setPlateText(fmt(k, 0))} style={{ backgroundColor: t.panelAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: t.ink2, fontSize: 13 }}>{fmt(k, 0)}</Text>
              </Pressable>
            ))}
          </Row>
        </Card>
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

function BarEnd() {
  const t = useTheme();
  return <View style={{ width: 28, height: 10, backgroundColor: t.ink3, borderRadius: 2, alignSelf: 'center' }} />;
}

function PlateChip({ kg, color, label }: { kg: number; color: string; label?: string }) {
  const light = color === '#F2F2F2' || color === '#D9A400';
  const h = kg >= 10 ? 54 : kg >= 2.5 ? 40 : 30;
  return (
    <View style={{ width: kg >= 10 ? 26 : 18, height: h, backgroundColor: color, borderRadius: 4, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
      <Text style={{ color: light ? '#1C1B19' : '#fff', fontSize: 10, fontWeight: '700' }}>{label ?? (kg >= 1 ? kg : '')}</Text>
    </View>
  );
}
