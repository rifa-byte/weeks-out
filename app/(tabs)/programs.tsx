import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Card, Eyebrow, H2, Row, Screen, Title } from '@/components/ui';
import { space, useTheme } from '@/constants/theme';
import { activeProgram, endProgram, listProgramDays, type ProgramDay, type ProgramRow } from '@/lib/db';
import { TEMPLATES } from '@/lib/programs';

export default function ProgramsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [days, setDays] = useState<ProgramDay[]>([]);

  const refresh = useCallback(async () => {
    const p = await activeProgram(db);
    setProgram(p);
    setDays(p ? await listProgramDays(db, p.id) : []);
  }, [db]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  function confirmEnd() {
    if (!program) return;
    Alert.alert('End this program?', 'Your logged sessions stay in the log. You can start another program after.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End program', style: 'destructive', onPress: async () => { await endProgram(db, program.id); refresh(); } },
    ]);
  }

  if (program) {
    const done = days.filter(d => d.session_id != null).length;
    const next = days.find(d => d.session_id == null);
    const weeks = Array.from({ length: program.weeks }, (_, i) => i + 1);
    return (
      <Screen style={{ paddingTop: insets.top + space.lg }}>
        <View>
          <Eyebrow>{done} of {days.length} sessions done</Eyebrow>
          <Title>{program.name}</Title>
          {next ? <Body muted>Up next: week {next.week}, {next.name.toLowerCase()}.</Body> : <Body muted>Every session is logged. Nice.</Body>}
        </View>

        {next ? (
          <Button title={`Open week ${next.week} · ${next.name}`} onPress={() => router.push({ pathname: '/program/day/[id]', params: { id: String(next.id) } })} />
        ) : null}

        <View style={{ gap: space.sm }}>
          {weeks.map(w => {
            const wd = days.filter(d => d.week === w);
            return (
              <Card key={w} style={{ gap: space.sm }}>
                <Eyebrow>Week {w}{w === program.weeks && program.template_id === 'meet-prep-8' ? ' · meet week' : ''}</Eyebrow>
                <View style={{ gap: 6 }}>
                  {wd.map(d => {
                    const isDone = d.session_id != null;
                    const isNext = next?.id === d.id;
                    return (
                      <Pressable
                        key={d.id}
                        onPress={() => router.push({ pathname: '/program/day/[id]', params: { id: String(d.id) } })}
                        accessibilityRole="button"
                        style={({ pressed }) => ({
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                          paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8,
                          backgroundColor: isNext ? t.accentSoft : t.panelAlt, opacity: pressed ? 0.7 : 1,
                        })}>
                        <Row>
                          <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: isDone ? t.good : isNext ? t.accent : t.line, backgroundColor: isDone ? t.good : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                            {isDone ? <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✓</Text> : null}
                          </View>
                          <Text style={{ color: isDone ? t.ink3 : t.ink, fontWeight: '600', fontSize: 15 }}>{d.name}</Text>
                        </Row>
                        <Text style={{ color: t.ink3, fontSize: 13 }}>{summarize(d)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            );
          })}
        </View>

        <Button title="End program" kind="ghost" onPress={confirmEnd} />
      </Screen>
    );
  }

  return (
    <Screen style={{ paddingTop: insets.top + space.lg }}>
      <View>
        <Eyebrow>Pick one</Eyebrow>
        <Title>Programs</Title>
        <Body muted>Each template loads from your best e1RMs and pushes every session straight into the log.</Body>
      </View>
      {TEMPLATES.map(p => (
        <Card key={p.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <H2>{p.name}</H2>
            <Eyebrow>{p.weeks} wk · {p.daysPerWeek}×/wk</Eyebrow>
          </Row>
          <Body muted>{p.who}</Body>
          <Body>{p.shape}</Body>
          <Button title="Start" onPress={() => router.push({ pathname: '/program/start', params: { template: p.id } })} />
        </Card>
      ))}
    </Screen>
  );
}

function summarize(d: ProgramDay) {
  const main = d.sets.filter(s => s.weightKg != null);
  if (main.length === 0) return `${d.sets.length} movements`;
  const top = main.reduce((a, b) => (b.weightKg! > a.weightKg! ? b : a));
  return `${top.exercise} ${top.weightKg}×${top.reps}`;
}
