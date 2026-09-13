import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HelpLink } from '@/components/HelpLink';
import { Body, Button, Card, Dot, Eyebrow, Hint, Num, Row, Screen, TapRow, Title } from '@/components/ui';
import { liftColor, space, useTheme } from '@/constants/theme';
import { bestByLift, createSession, deleteSession, getJson, listSessions, logProgramDay, nextProgramDay, type SessionSummary } from '@/lib/db';
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
  const [next, setNext] = useState<Awaited<ReturnType<typeof nextProgramDay>>>(null);

  const refresh = useCallback(() => {
    listSessions(db).then(setSessions);
    bestByLift(db).then(setBest);
    nextProgramDay(db).then(setNext);
  }, [db]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // First launch → "meet or not?" → the questionnaire. Nothing else until that is done (or skipped).
  // Keyed on setupDone, not the old onboarded flag, so phones that saw the earlier tour get the new flow too.
  useEffect(() => {
    getJson<boolean>(db, 'setupDone', false).then(done => { if (!done) router.push('/welcome'); });
  }, [db, router]);

  const { weeks, days } = weeksOut(parseIso(settings.meetDate));
  const total = LIFTS.every(l => best[l] != null) ? LIFTS.reduce((s, l) => s + (best[l] ?? 0), 0) : null;

  async function newSession() {
    const id = await createSession(db);
    router.push({ pathname: '/session/[id]', params: { id: String(id) } });
  }

  async function logNext() {
    if (!next) return;
    const id = await logProgramDay(db, next.day);
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
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          {settings.mode === 'meet' ? (
            <>
              <Eyebrow>{settings.meetName} · {formatDate(settings.meetDate)}</Eyebrow>
              <Title>{days === 0 ? 'Meet day' : weeks === 0 ? `${days} days out` : `${weeks} week${weeks === 1 ? '' : 's'} out`}</Title>
            </>
          ) : (
            <>
              <Eyebrow>{next ? next.program.name : 'Training log'}</Eyebrow>
              <Title>{next ? `Week ${next.day.week} of ${next.program.weeks}` : 'Log'}</Title>
            </>
          )}
          <Pressable onPress={() => router.push('/mode')} hitSlop={6} accessibilityRole="button">
            <Text style={{ color: t.accent, fontSize: 12, fontWeight: '700', marginTop: 4 }}>{settings.mode === 'meet' ? 'Meet mode · change' : 'Not prepping for a meet · change'}</Text>
          </Pressable>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <HelpLink topic="log" />
          <Pressable onPress={() => router.push('/plates')} accessibilityRole="button" hitSlop={8}
            style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.panel }}>
            <Text style={{ color: t.ink2, fontSize: 12, fontWeight: '700' }}>⚖ Load the bar</Text>
          </Pressable>
        </View>
      </Row>

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
        {total == null ? <Body muted style={{ fontSize: 13 }}>These fill in once you have logged one set of each lift.</Body> : null}
      </Card>

      {next ? (
        <Card style={{ gap: space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Eyebrow>{next.program.name}</Eyebrow>
            <Eyebrow>{next.done} / {next.total} done</Eyebrow>
          </Row>
          <Text style={{ color: t.ink, fontWeight: '700', fontSize: 17 }}>Week {next.day.week} · {next.day.name}</Text>
          <Body muted style={{ fontSize: 13 }}>{next.day.sets.map(s => `${labelFor(s.exercise)} ${s.weightKg != null ? `${fmt(s.weightKg)}×${s.reps}` : `${s.sets}×${s.reps}`}`).join(' · ')}</Body>
          <Row>
            <Button title="Log this session" onPress={logNext} style={{ flex: 1 }} />
            <Button title="See the sets first" kind="ghost" onPress={() => router.push({ pathname: '/program/day/[id]', params: { id: String(next.day.id) } })} />
          </Row>
          <Hint>Tap “Log this session” — the sets are filled in for you.</Hint>
          <Button title="Start a blank session instead" kind="ghost" onPress={newSession} />
        </Card>
      ) : (
        <View style={{ gap: 6 }}>
          <Button title="Start today’s session" onPress={newSession} />
          <Hint style={{ textAlign: 'center' }}>Tap here to log what you lift today.</Hint>
        </View>
      )}

      <View style={{ gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Eyebrow>Past sessions</Eyebrow>
          {sessions.length > 0 ? <Body muted style={{ fontSize: 12 }}>tap to open · hold to delete</Body> : null}
        </Row>
        {sessions.length === 0 ? (
          <Body muted>Your sessions will show up here after you log the first one.</Body>
        ) : sessions.map(s => (
          <TapRow
            key={s.id}
            title={formatDate(s.date)}
            subtitle={s.set_count === 0 ? 'No sets yet' : `${s.set_count} set${s.set_count === 1 ? '' : 's'}${s.top_lift ? ` · top ${labelFor(s.top_lift)} e1RM ${fmt(s.top_e1rm)} ${unit}` : ''}`}
            onPress={() => router.push({ pathname: '/session/[id]', params: { id: String(s.id) } })}
            onLongPress={() => confirmDelete(s)}
          />
        ))}
      </View>
    </Screen>
  );
}
