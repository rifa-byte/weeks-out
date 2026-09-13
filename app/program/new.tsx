import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Card, Eyebrow, Field, Hint, Screen, Segmented, Title } from '@/components/ui';
import { setPendingTemplate } from '@/lib/pending';
import { blankProgram, toTemplate } from '@/lib/share';

export default function NewProgramScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState(4);
  const [days, setDays] = useState(3);
  const ready = name.trim().length > 0;

  function next() {
    if (!ready) return;
    setPendingTemplate(toTemplate(blankProgram(name.trim(), weeks, days), `custom:${Date.now()}`));
    router.replace({ pathname: '/program/start', params: { template: 'pending' } });
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Build your own' }} />
      <Screen>
        <View>
          <Eyebrow>Your program</Eyebrow>
          <Title>Build your own</Title>
          <Body muted>Give it a name and a shape. You fill in the movements day by day afterwards — and you can share it with a code.</Body>
        </View>
        <Card>
          <Field label="Program name" value={name} onChangeText={setName} placeholder="e.g. Rif’s off-season block" autoFocus />
          <View style={{ gap: 4 }}>
            <Eyebrow>Weeks</Eyebrow>
            <Segmented<number> options={[1, 2, 3, 4, 6, 8, 12]} value={weeks} onChange={setWeeks} />
          </View>
          <View style={{ gap: 4 }}>
            <Eyebrow>Days a week</Eyebrow>
            <Segmented<number> options={[2, 3, 4, 5, 6]} value={days} onChange={setDays} />
          </View>
        </Card>
        <Button title="Next: enter your bests" onPress={next} disabled={!ready} style={{ opacity: ready ? 1 : 0.4 }} />
        {!ready ? <Hint style={{ textAlign: 'center' }}>Type a name and the button lights up.</Hint> : null}
      </Screen>
    </>
  );
}
