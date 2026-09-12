import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Body, Button, Card, Dot, Eyebrow, Field, Row, Screen, Title } from '@/components/ui';
import { liftColor, useTheme } from '@/constants/theme';
import { bestByLift, startProgram } from '@/lib/db';
import { parseNum } from '@/lib/format';
import { LIFTS, LIFT_LABEL, type Lift } from '@/lib/math';
import { templateById, type Bests } from '@/lib/programs';
import { useSettings } from '@/lib/settings';

export default function StartProgramScreen() {
  const { template: templateId } = useLocalSearchParams<{ template: string }>();
  const template = templateById(String(templateId));
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useTheme();
  const { fmt, unit, toKg } = useSettings();
  const [text, setText] = useState<Record<Lift, string>>({ squat: '', bench: '', deadlift: '' });
  const [fromLog, setFromLog] = useState<Record<Lift, number | null>>({ squat: null, bench: null, deadlift: null });

  useEffect(() => {
    bestByLift(db).then(b => {
      setFromLog(b);
      setText({ squat: b.squat ? fmt(b.squat) : '', bench: b.bench ? fmt(b.bench) : '', deadlift: b.deadlift ? fmt(b.deadlift) : '' });
    });
  }, [db, fmt]);

  if (!template) {
    return <Screen><Body>Unknown template.</Body></Screen>;
  }

  const bests: Bests = {};
  for (const l of LIFTS) { const n = parseNum(text[l]); bests[l] = n && n > 0 ? toKg(n) : null; }
  const ready = LIFTS.every(l => bests[l]);

  async function start() {
    if (!template || !ready) return;
    await startProgram(db, template, bests);
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Start program' }} />
      <Screen>
        <View>
          <Eyebrow>{template.weeks} weeks · {template.daysPerWeek} days a week</Eyebrow>
          <Title>{template.name}</Title>
          <Body muted>{template.shape}</Body>
        </View>
        <Card>
          <Eyebrow>Your current bests ({unit})</Eyebrow>
          <Body muted style={{ fontSize: 13 }}>Pre-filled from your log where you have one. A true 1RM or a recent e1RM both work — the program loads percentages off these and rounds down to 2.5 kg.</Body>
          {LIFTS.map(l => (
            <Row key={l} style={{ justifyContent: 'space-between' }}>
              <Row style={{ width: 120 }}><Dot color={liftColor[l]} /><Text style={{ color: t.ink, fontWeight: '600' }}>{LIFT_LABEL[l]}</Text></Row>
              <Field value={text[l]} onChangeText={v => setText(s => ({ ...s, [l]: v }))} keyboardType="decimal-pad" placeholder={fromLog[l] ? fmt(fromLog[l]) : `best ${unit}`} style={{ textAlign: 'right' }} />
            </Row>
          ))}
        </Card>
        <Button title="Start program" onPress={start} disabled={!ready} style={{ opacity: ready ? 1 : 0.4 }} />
        {!ready ? <Body muted style={{ fontSize: 13, textAlign: 'center' }}>Enter all three lifts to start.</Body> : null}
      </Screen>
    </>
  );
}
