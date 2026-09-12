import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Card, Dot, Eyebrow, Num, Row, Screen, Title } from '@/components/ui';
import { liftColor, space, useTheme } from '@/constants/theme';
import { bestByLift, createSession, deleteSession, listSessions, type SessionSummary } from '@/lib/db';
import { formatDate, labelFor, parseIso } from '@/lib/format';
import { LIFTS, LIFT_LABEL, weeksOut, type Lift } from '@/lib/math';
import { useSettings } from '@/lib/settings';

export default function LogScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, fmt, unit } = useSettings();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [best, setBest] = useState<Record<Lift, number | null>>({ squat: null, bench: null, deadlift: null });

  const refresh = useCallback(() => {
    listSessions(db).then(setSessions);
    bestByLift(db).then(setBest);
  }, [db]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const { weeks, days } = weeksOut(parseIso(settings.meetDate));
  const total = LIFTS.every(l => best[l] != null) ? LIFTS.reduce((s, l) => s + (best[l] ?? 0), 0) : null;

  async function newSession() {
    const id = await createSession(db);
    router.push({ pathname: '/session/[id]', params: { id: String(id) } });
  }

  function confirmDelete(s: SessionSummary) {
    Alert.alert('Delete session?', `${formatDate(s.date)} · ${s.set_count} sets`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteSession(db, s.id); refresh(); } },
    ]);
  }

  return (
    <Screen style={{ paddingTop: insets.top + space.lg }}>
      <View>
        <Eyebrow>{settings.meetName} · {formatDate(settings.meetDate)}</Eyebrow>
        <Title>{days === 0 ? 'Meet day' : weeks === 0 ? `${days} days out` : `${weeks} week${weeks === 1 ? '' : 's'} out`}</Title>
      </View>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Eyebrow>Best estimated 1RMs</Eyebrow>
          {total != null ? <Eyebrow>Total {fmt(total)} {unit}</Eyebrow> : null}
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          {LIFTS.map(l => (
            <View key={l} style={{ flex: 1, gap: 2 }}>
              <Row><Dot color={liftColor[l]} /><Body muted style={{ fontSize: 13 }}>{LIFT_LABEL[l]}</Body></Row>
              <Num size={26}>{fmt(best[l])}</Num>
            </View>
          ))}
        </Row>
        {total == null ? <Body muted style={{ fontSize: 13 }}>Log a set of each lift and your e1RMs will appear here.</Body> : null}
      </Card>

      <Button title="Start today’s session" onPress={newSession} />

      <View style={{ gap: space.sm }}>
        <Eyebrow>Sessions</Eyebrow>
        {sessions.length === 0 ? (
          <Body muted>Nothing logged yet. Start a session, add your sets, and every set gets an estimated 1RM from its reps and RPE.</Body>
        ) : sessions.map(s => (
          <Pressable
            key={s.id}
            onPress={() => router.push({ pathname: '/session/[id]', params: { id: String(s.id) } })}
            onLongPress={() => confirmDelete(s)}
            accessibilityRole="button"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <Text style={{ color: t.ink, fontWeight: '700', fontSize: 16 }}>{formatDate(s.date)}</Text>
                <Body muted style={{ fontSize: 13 }}>
                  {s.set_count === 0 ? 'No sets yet' : `${s.set_count} set${s.set_count === 1 ? '' : 's'}${s.top_lift ? ` · top ${labelFor(s.top_lift)} e1RM ${fmt(s.top_e1rm)} ${unit}` : ''}`}
                </Body>
              </View>
              <Text style={{ color: t.ink3, fontSize: 20 }}>›</Text>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
