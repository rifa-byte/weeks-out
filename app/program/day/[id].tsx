import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { Body, Button, Card, Divider, Dot, Eyebrow, Row, Screen, Title } from '@/components/ui';
import { liftColor, useTheme } from '@/constants/theme';
import { getProgramDay, logProgramDay, type ProgramDay } from '@/lib/db';
import { labelFor } from '@/lib/format';
import { useSettings } from '@/lib/settings';

export default function ProgramDayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dayId = Number(id);
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useTheme();
  const { fmt, unit } = useSettings();
  const [day, setDay] = useState<ProgramDay | null>(null);

  useFocusEffect(useCallback(() => { getProgramDay(db, dayId).then(setDay); }, [db, dayId]));

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
        <View>
          <Eyebrow>Week {day.week} · day {day.day}</Eyebrow>
          <Title>{day.name}</Title>
        </View>

        <Card style={{ gap: 0, paddingVertical: 4 }}>
          {day.sets.map((s, i) => (
            <View key={i}>
              {i > 0 ? <Divider /> : null}
              <Row style={{ paddingVertical: 10, justifyContent: 'space-between' }}>
                <Row style={{ flex: 1 }}>
                  <Dot color={(liftColor as Record<string, string>)[s.exercise] ?? t.ink3} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.ink, fontWeight: '700', fontSize: 15, textTransform: 'capitalize' }}>{labelFor(s.exercise)}</Text>
                    {s.note ? <Body muted style={{ fontSize: 12 }}>{s.note}{s.pct != null ? ` · ${Math.round(s.pct * 100)}%` : ''}</Body> : s.pct != null ? <Body muted style={{ fontSize: 12 }}>{Math.round(s.pct * 100)}%</Body> : null}
                  </View>
                </Row>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: t.ink, fontWeight: '800', fontSize: 17, fontVariant: ['tabular-nums'] }}>
                    {s.weightKg != null ? `${fmt(s.weightKg)} ${unit}` : '—'}
                  </Text>
                  <Body muted style={{ fontSize: 12 }}>{s.sets} × {s.reps}{s.rpe != null ? ` @ ${s.rpe}` : ''}</Body>
                </View>
              </Row>
            </View>
          ))}
        </Card>

        {day.session_id != null ? (
          <>
            <Body muted style={{ textAlign: 'center' }}>Logged. Open the session to see what you actually did.</Body>
            <Button title="Open session" kind="ghost" onPress={() => router.push({ pathname: '/session/[id]', params: { id: String(day.session_id) } })} />
          </>
        ) : (
          <>
            <Button title="Log this day" onPress={log} />
            <Body muted style={{ fontSize: 13, textAlign: 'center' }}>Creates today’s session with these sets filled in. Tap any set there to correct weight, reps or RPE to what actually happened; accessories you add by hand.</Body>
          </>
        )}
      </Screen>
    </>
  );
}
