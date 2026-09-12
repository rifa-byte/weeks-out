import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PlateStrip } from '@/components/PlateStrip';
import { PrepBlock } from '@/components/PrepBlock';
import { RestTimer } from '@/components/RestTimer';
import { Body, Button, Card, Divider, Dot, Eyebrow, Field, Num, Row, Screen, Segmented } from '@/components/ui';
import { liftColor, space, useTheme } from '@/constants/theme';
import { addSet, bestFor, deleteSet, getSession, isPr, lastTimeFor, listSets, todayIso, updateSessionNotes, type LastTime, type SetRow } from '@/lib/db';
import { exerciseById, parentOf } from '@/lib/exercises';
import { formatDate, labelFor, parseNum } from '@/lib/format';
import { e1rm, LIFTS, LIFT_LABEL, RPE_VALUES, type Lift } from '@/lib/math';
import { registerPick } from '@/lib/picker';
import { useSettings } from '@/lib/settings';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useTheme();
  const { settings, set: setSetting, fmt, unit, toKg } = useSettings();

  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [sets, setSets] = useState<(SetRow & { pr: boolean })[]>([]);

  const [exercise, setExercise] = useState<string>('squat');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState<number | null>(8);
  const [restStart, setRestStart] = useState<number | null>(null);

  const [last, setLast] = useState<LastTime | null>(null);
  const [best, setBest] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const rows = await listSets(db, sessionId);
    const withPr = await Promise.all(rows.map(async r => ({ ...r, pr: !!parentOf(r.exercise) && (await isPr(db, r)) })));
    setSets(withPr);
  }, [db, sessionId]);

  useEffect(() => {
    getSession(db, sessionId).then(s => { if (s) { setDate(s.date); setNotes(s.notes); } });
    refresh();
  }, [db, sessionId, refresh]);

  // history for the selected movement
  useEffect(() => {
    let alive = true;
    lastTimeFor(db, exercise, sessionId).then(l => { if (alive) setLast(l); });
    bestFor(db, exercise).then(b => { if (alive) setBest(b); });
    return () => { alive = false; };
  }, [db, exercise, sessionId, sets.length]);

  const w = parseNum(weight);
  const r = parseNum(reps);
  const wKg = w && w > 0 ? toKg(w) : null;
  const preview = useMemo(() => (wKg && r && r > 0 ? e1rm(wKg, Math.round(r), rpe) : null), [wKg, r, rpe]);
  const canAdd = !!wKg && !!r && r > 0;
  const info = exerciseById(exercise);
  const isBarbell = !!parentOf(exercise) || ['overhead-press', 'push-press', 'barbell-row', 'pendlay-row', 'hip-thrust'].includes(exercise);

  async function add() {
    if (!canAdd || !wKg || !r) return;
    await addSet(db, { sessionId, exercise, weightKg: wKg, reps: Math.round(r), rpe });
    setRestStart(Date.now());
    await refresh();
  }

  async function remove(setId: number) {
    await deleteSet(db, setId);
    await refresh();
  }

  /** Pull a logged set back into the editor so it can be corrected. */
  async function edit(s: SetRow) {
    setExercise(s.exercise);
    setWeight(fmt(s.weight_kg));
    setReps(String(s.reps));
    setRpe(s.rpe);
    await deleteSet(db, s.id);
    await refresh();
  }

  async function saveNotes(v: string) {
    setNotes(v);
    await updateSessionNotes(db, sessionId, v);
  }

  function openPicker() {
    const key = registerPick({ title: 'Pick a movement' }, chosen => setExercise(chosen));
    router.push({ pathname: '/exercise/pick', params: { key } });
  }

  const quick: string[] = [...LIFTS, ...(LIFTS.includes(exercise as Lift) ? [] : [exercise])];
  // lifts this session is about: whatever is logged, plus the one selected
  const sessionLifts = useMemo(() => {
    const found = new Set<Lift>();
    for (const s of sets) { const p = parentOf(s.exercise); if (p) found.add(p); }
    const p = parentOf(exercise); if (p) found.add(p);
    return LIFTS.filter(l => found.has(l));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets.map(s => s.exercise).join(','), exercise]);

  return (
    <>
      <Stack.Screen options={{ title: date ? formatDate(date) : 'Session' }} />
      <Screen>
        {date === todayIso() ? <PrepBlock lifts={sessionLifts} /> : null}
        <RestTimer
          startedAt={restStart}
          targetSeconds={settings.restSeconds}
          onTargetChange={s => setSetting('restSeconds', s)}
          onReset={() => setRestStart(restStart == null ? Date.now() : null)}
        />

        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Eyebrow>Add a set</Eyebrow>
            <Pressable onPress={openPicker} accessibilityRole="button" hitSlop={8}>
              <Text style={{ color: t.accent, fontWeight: '700', fontSize: 13 }}>All movements ›</Text>
            </Pressable>
          </Row>
          <Segmented<string>
            options={quick}
            value={exercise}
            onChange={setExercise}
            labels={v => (LIFT_LABEL as Record<string, string>)[v] ?? labelFor(v)}
          />
          {info && info.category !== 'main' ? (
            <Body muted style={{ fontSize: 12 }}>{info.name}{info.parent ? ` · ~${Math.round(info.factor * 100)}% of ${LIFT_LABEL[info.parent].toLowerCase()}` : ''}{info.bodyweight ? ' · log added load' : ''}</Body>
          ) : null}

          {(last || best) ? (
            <View style={{ backgroundColor: t.panelAlt, borderRadius: 8, padding: 10, gap: 2 }}>
              {last ? (
                <Text style={{ color: t.ink2, fontSize: 13 }}>
                  <Text style={{ fontWeight: '700', color: t.ink }}>Last time</Text> ({formatDate(last.date)}): {summarizeSets(last.sets, fmt)}
                </Text>
              ) : null}
              {best ? <Text style={{ color: t.ink2, fontSize: 13 }}><Text style={{ fontWeight: '700', color: t.ink }}>Best e1RM</Text> {fmt(best)} {unit}</Text> : null}
            </View>
          ) : null}

          <Row style={{ alignItems: 'flex-end' }}>
            <Field label={`Weight (${unit})`} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="0" />
            <Field label="Reps" value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder="0" />
          </Row>
          {wKg && isBarbell && wKg > settings.barKg ? <PlateStrip weightKg={wKg} plateSet={settings.plateSet} barKg={settings.barKg} /> : null}
          <View style={{ gap: 4 }}>
            <Text style={{ color: t.ink3, fontSize: 12, fontWeight: '600' }}>RPE</Text>
            <Segmented<number | 0>
              options={[0, ...RPE_VALUES]}
              value={rpe ?? 0}
              onChange={v => setRpe(v === 0 ? null : v)}
              labels={v => (v === 0 ? 'none' : String(v))}
            />
          </View>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Eyebrow>e1RM</Eyebrow>
              <Num size={24}>{preview ? `${fmt(preview)} ${unit}` : '—'}</Num>
            </View>
            <Button title="Add set" onPress={add} disabled={!canAdd} style={{ opacity: canAdd ? 1 : 0.4, minWidth: 120 }} />
          </Row>
        </Card>

        <View style={{ gap: space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Eyebrow>Sets</Eyebrow>
            {sets.length > 0 ? <Body muted style={{ fontSize: 12 }}>tap a set to edit it</Body> : null}
          </Row>
          {sets.length === 0 ? <Body muted>No sets yet.</Body> : (
            <Card style={{ gap: 0, paddingVertical: 4 }}>
              {sets.map((s, i) => (
                <View key={s.id}>
                  {i > 0 ? <Divider /> : null}
                  <Row style={{ paddingVertical: 10, justifyContent: 'space-between' }}>
                    <Pressable onPress={() => edit(s)} accessibilityLabel="Edit set" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Dot color={parentOf(s.exercise) ? liftColor[parentOf(s.exercise)!] : t.ink3} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.ink, fontWeight: '700', fontSize: 15 }}>
                          {labelFor(s.exercise)}{s.pr ? <Text style={{ color: t.accent }}>  PR</Text> : null}
                        </Text>
                        <Body muted style={{ fontSize: 13 }}>
                          {fmt(s.weight_kg)} {unit} × {s.reps}{s.rpe != null ? ` @ ${s.rpe}` : ''} · e1RM {fmt(s.e1rm)}
                        </Body>
                      </View>
                    </Pressable>
                    <Pressable onPress={() => remove(s.id)} accessibilityLabel="Delete set" hitSlop={10} style={{ paddingHorizontal: 6 }}>
                      <Text style={{ color: t.ink3, fontSize: 18 }}>×</Text>
                    </Pressable>
                  </Row>
                </View>
              ))}
            </Card>
          )}
        </View>

        <Card>
          <Eyebrow>Notes</Eyebrow>
          <Field value={notes} onChangeText={saveNotes} placeholder="How did it move?" multiline style={{ minHeight: 70, textAlignVertical: 'top', fontSize: 15 }} />
        </Card>
      </Screen>
    </>
  );
}

function summarizeSets(sets: LastTime['sets'], fmt: (kg: number) => string) {
  // Collapse identical sets: "140 × 5 @ 8 ×3, 150 × 3 @ 9"
  const groups: { key: string; label: string; n: number }[] = [];
  for (const s of sets) {
    const label = `${fmt(s.weight_kg)} × ${s.reps}${s.rpe != null ? ` @ ${s.rpe}` : ''}`;
    const g = groups.find(x => x.key === label);
    if (g) g.n++; else groups.push({ key: label, label, n: 1 });
  }
  return groups.map(g => (g.n > 1 ? `${g.label} ×${g.n}` : g.label)).join(', ');
}
