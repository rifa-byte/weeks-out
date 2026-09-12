import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Body, Button, Card, Divider, Dot, Eyebrow, Row, Screen, Title } from '@/components/ui';
import { liftColor, useTheme } from '@/constants/theme';
import { activeProgram, getProgramDay, logProgramDay, updateProgramDayPlan, type ProgramDay } from '@/lib/db';
import { exerciseById, parentOf } from '@/lib/exercises';
import { labelFor } from '@/lib/format';
import { LIFT_LABEL } from '@/lib/math';
import { registerPick } from '@/lib/picker';
import { resolveSet, swapExercise, type Bests, type ResolvedSet } from '@/lib/programs';
import { useSettings } from '@/lib/settings';

export default function ProgramDayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dayId = Number(id);
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useTheme();
  const { fmt, unit } = useSettings();
  const [day, setDay] = useState<ProgramDay | null>(null);
  const [bests, setBests] = useState<Bests>({});
  const [editing, setEditing] = useState(false);

  useFocusEffect(useCallback(() => {
    getProgramDay(db, dayId).then(setDay);
    activeProgram(db).then(p => { if (p) setBests(JSON.parse(p.bests_json)); });
  }, [db, dayId]));

  async function save(sets: ResolvedSet[]) {
    if (!day) return;
    await updateProgramDayPlan(db, day.id, sets);
    setDay({ ...day, sets });
  }

  function swap(i: number) {
    if (!day) return;
    const cur = day.sets[i];
    const parent = parentOf(cur.exercise);
    const key = registerPick(
      { parent, title: parent ? `Swap ${labelFor(cur.exercise)} (${LIFT_LABEL[parent]} family)` : `Swap ${labelFor(cur.exercise)}`, allowCustom: true },
      chosen => { const next = day.sets.slice(); next[i] = swapExercise(cur, chosen, bests); save(next); },
    );
    router.push({ pathname: '/exercise/pick', params: { key } });
  }

  function addMovement() {
    if (!day) return;
    const key = registerPick({ title: 'Add a movement' }, chosen => {
      const parent = parentOf(chosen);
      const planned = parent
        ? { exercise: chosen, sets: 3, reps: 5, pct: 0.7, rpe: 7 }
        : { exercise: chosen, sets: 3, reps: 10 };
      save([...day.sets, resolveSet(planned, bests)]);
    });
    router.push({ pathname: '/exercise/pick', params: { key } });
  }

  function remove(i: number) {
    if (!day) return;
    Alert.alert('Remove movement?', labelFor(day.sets[i].exercise), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => save(day.sets.filter((_, j) => j !== i)) },
    ]);
  }

  function nudge(i: number, field: 'sets' | 'reps', delta: number) {
    if (!day) return;
    const next = day.sets.slice();
    next[i] = { ...next[i], [field]: Math.max(1, next[i][field] + delta) };
    save(next);
  }

  async function log() {
    if (!day) return;
    const sessionId = await logProgramDay(db, day);
    router.replace({ pathname: '/session/[id]', params: { id: String(sessionId) } });
  }

  if (!day) return <Screen><Body muted>Loading…</Body></Screen>;

  return (
    <>
      <Stack.Screen options={{ title: `Week ${day.week}` }} />
      <Screen>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Eyebrow>Week {day.week} · day {day.day}</Eyebrow>
            <Title>{day.name}</Title>
          </View>
          {day.session_id == null ? (
            <Pressable onPress={() => setEditing(e => !e)} accessibilityRole="button" style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: editing ? t.ink : t.panelAlt }}>
              <Text style={{ color: editing ? t.ground : t.ink, fontWeight: '700' }}>{editing ? 'Done' : 'Customise'}</Text>
            </Pressable>
          ) : null}
        </Row>

        {editing ? <Body muted style={{ fontSize: 13 }}>Swap a movement for a variation that hits your weak point or works around a niggle; weights re-derive from your bests. Only this day changes.</Body> : null}

        <Card style={{ gap: 0, paddingVertical: 4 }}>
          {day.sets.map((s, i) => {
            const parent = parentOf(s.exercise);
            const info = exerciseById(s.exercise);
            return (
              <View key={i}>
                {i > 0 ? <Divider /> : null}
                <Row style={{ paddingVertical: 10, justifyContent: 'space-between' }}>
                  <Row style={{ flex: 1 }}>
                    <Dot color={parent ? liftColor[parent] : t.ink3} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.ink, fontWeight: '700', fontSize: 15 }}>{labelFor(s.exercise)}</Text>
                      <Body muted style={{ fontSize: 12 }}>
                        {[s.note, s.pct != null ? `${Math.round(s.pct * 100)}%${info && info.factor !== 1 ? ` × ${Math.round(info.factor * 100)}%` : ''}` : null].filter(Boolean).join(' · ')}
                      </Body>
                    </View>
                  </Row>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: t.ink, fontWeight: '800', fontSize: 17, fontVariant: ['tabular-nums'] }}>
                      {s.weightKg != null ? `${fmt(s.weightKg)} ${unit}` : '—'}
                    </Text>
                    <Body muted style={{ fontSize: 12 }}>{s.sets} × {s.reps}{s.rpe != null ? ` @ ${s.rpe}` : ''}</Body>
                  </View>
                </Row>
                {editing ? (
                  <Row style={{ paddingBottom: 10, flexWrap: 'wrap' }}>
                    <Mini label="Swap" onPress={() => swap(i)} />
                    <Mini label="− set" onPress={() => nudge(i, 'sets', -1)} />
                    <Mini label="+ set" onPress={() => nudge(i, 'sets', 1)} />
                    <Mini label="− rep" onPress={() => nudge(i, 'reps', -1)} />
                    <Mini label="+ rep" onPress={() => nudge(i, 'reps', 1)} />
                    <Mini label="Remove" onPress={() => remove(i)} danger />
                  </Row>
                ) : null}
              </View>
            );
          })}
        </Card>

        {editing ? <Button title="Add a movement" kind="ghost" onPress={addMovement} /> : null}

        {day.session_id != null ? (
          <>
            <Body muted style={{ textAlign: 'center' }}>Logged. Open the session to see what you actually did.</Body>
            <Button title="Open session" kind="ghost" onPress={() => router.push({ pathname: '/session/[id]', params: { id: String(day.session_id) } })} />
          </>
        ) : !editing ? (
          <>
            <Button title="Log this day" onPress={log} />
            <Body muted style={{ fontSize: 13, textAlign: 'center' }}>Creates today’s session with these sets filled in. Tap any set there to correct weight, reps or RPE to what actually happened; accessories you add by hand.</Body>
          </>
        ) : null}
      </Screen>
    </>
  );
}

function Mini({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6, backgroundColor: danger ? t.accentSoft : t.panelAlt }}>
      <Text style={{ color: danger ? t.accent : t.ink, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
