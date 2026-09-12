import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Button, Card, Divider, Dot, Eyebrow, Field, Num, Row, Screen, Segmented } from '@/components/ui';
import { liftColor, space, useTheme } from '@/constants/theme';
import { addSet, deleteSet, getSession, isPr, listSets, updateSessionNotes, type SetRow } from '@/lib/db';
import { formatDate, labelFor, parseNum } from '@/lib/format';
import { e1rm, LIFTS, LIFT_LABEL, RPE_VALUES, type Lift } from '@/lib/math';
import { useSettings } from '@/lib/settings';

type ExerciseChoice = Lift | 'other';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const db = useSQLiteContext();
  const t = useTheme();
  const { fmt, unit, toKg } = useSettings();

  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [sets, setSets] = useState<(SetRow & { pr: boolean })[]>([]);

  const [exercise, setExercise] = useState<ExerciseChoice>('squat');
  const [otherName, setOtherName] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState<number | null>(8);

  const refresh = useCallback(async () => {
    const rows = await listSets(db, sessionId);
    const withPr = await Promise.all(rows.map(async r => ({ ...r, pr: LIFTS.includes(r.exercise as Lift) && (await isPr(db, r)) })));
    setSets(withPr);
  }, [db, sessionId]);

  useEffect(() => {
    getSession(db, sessionId).then(s => { if (s) { setDate(s.date); setNotes(s.notes); } });
    refresh();
  }, [db, sessionId, refresh]);

  const w = parseNum(weight);
  const r = parseNum(reps);
  const preview = useMemo(() => (w && r && r > 0 ? e1rm(toKg(w), Math.round(r), rpe) : null), [w, r, rpe, toKg]);
  const exerciseName = exercise === 'other' ? otherName.trim().toLowerCase() : exercise;
  const canAdd = !!w && w > 0 && !!r && r > 0 && exerciseName.length > 0;

  async function add() {
    if (!canAdd || !w || !r) return;
    await addSet(db, { sessionId, exercise: exerciseName, weightKg: toKg(w), reps: Math.round(r), rpe });
    setReps('');
    await refresh();
  }

  async function remove(setId: number) {
    await deleteSet(db, setId);
    await refresh();
  }

  /** Pull a logged set back into the editor so it can be corrected. */
  async function edit(s: SetRow) {
    const isLift = LIFTS.includes(s.exercise as Lift);
    setExercise(isLift ? (s.exercise as Lift) : 'other');
    if (!isLift) setOtherName(s.exercise);
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

  return (
    <>
      <Stack.Screen options={{ title: date ? formatDate(date) : 'Session' }} />
      <Screen>
        <Card>
          <Eyebrow>Add a set</Eyebrow>
          <Segmented<ExerciseChoice>
            options={[...LIFTS, 'other']}
            value={exercise}
            onChange={setExercise}
            labels={v => (v === 'other' ? 'Other' : LIFT_LABEL[v])}
          />
          {exercise === 'other' ? (
            <Field label="Exercise" value={otherName} onChangeText={setOtherName} placeholder="e.g. pause squat, row" autoCapitalize="none" />
          ) : null}
          <Row style={{ alignItems: 'flex-end' }}>
            <Field label={`Weight (${unit})`} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="0" />
            <Field label="Reps" value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder="0" />
          </Row>
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
                      <Dot color={(liftColor as Record<string, string>)[s.exercise] ?? t.ink3} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.ink, fontWeight: '700', fontSize: 15, textTransform: 'capitalize' }}>
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
