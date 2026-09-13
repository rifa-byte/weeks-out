import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Body, Button, Card, Eyebrow, Field, Hint, Screen, Title } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { labelFor } from '@/lib/format';
import { setPendingTemplate } from '@/lib/pending';
import { decodeProgram, toTemplate, unknownExercises } from '@/lib/share';

export default function ImportProgramScreen() {
  const router = useRouter();
  const t = useTheme();
  const [text, setText] = useState('');
  const program = text.trim() ? decodeProgram(text) : null;
  const unknown = program ? unknownExercises(program) : [];
  const movements = program ? new Set(program.days.flatMap(d => d.sets.map(s => s.exercise))).size : 0;

  function use() {
    if (!program) return;
    setPendingTemplate(toTemplate(program));
    router.replace({ pathname: '/program/start', params: { template: 'pending' } });
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Use a shared program' }} />
      <Screen>
        <View>
          <Eyebrow>Got a code?</Eyebrow>
          <Title>Paste it here</Title>
          <Body muted>Codes start with WO1. — paste the whole message, the app finds the code inside it.</Body>
        </View>
        <Card>
          <Field value={text} onChangeText={setText} placeholder="WO1.…" multiline autoCapitalize="none" autoCorrect={false} style={{ minHeight: 90, textAlignVertical: 'top', fontSize: 13 }} />
        </Card>
        {text.trim() && !program ? <Body style={{ color: t.danger }}>That doesn’t look like a Weeks Out program code. Check nothing got cut off when it was copied.</Body> : null}
        {program ? (
          <Card>
            <Eyebrow>{program.weeks} weeks · {program.daysPerWeek} days a week · {movements} movements{program.author ? ` · by ${program.author}` : ''}</Eyebrow>
            <Text style={{ color: t.ink, fontSize: 20, fontWeight: '800' }}>{program.name}</Text>
            {program.about ? <Body muted>{program.about}</Body> : null}
            <Body muted style={{ fontSize: 13 }}>Week 1: {program.days.slice(0, program.daysPerWeek).map(d => `${d.name} (${d.sets.map(s => labelFor(s.exercise)).slice(0, 3).join(', ')}${d.sets.length > 3 ? '…' : ''})`).join(' · ')}</Body>
            {unknown.length ? <Body style={{ color: t.danger, fontSize: 13 }}>Unknown movements will show by their raw name: {unknown.join(', ')}</Body> : null}
            <Button title="Use this program" onPress={use} />
            <Hint style={{ textAlign: 'center' }}>Next you enter your bests and every weight is worked out for you.</Hint>
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
