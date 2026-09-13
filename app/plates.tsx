import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { BarLoader } from '@/components/BarLoader';
import { Body, Card, Eyebrow, Hint, Screen, Title } from '@/components/ui';

/** Load the bar — for everyone, meet or not. Reachable from the Log tab and any session. */
export default function PlatesScreen() {
  const { kg } = useLocalSearchParams<{ kg?: string }>();
  const initial = kg ? Number(kg) : null;
  return (
    <>
      <Stack.Screen options={{ title: 'Load the bar' }} />
      <Screen>
        <View>
          <Eyebrow>Plate maths, done</Eyebrow>
          <Title>Load the bar</Title>
          <Body muted>Type the weight. It shows what goes on each side with the plates your gym has. Your plate choice is remembered.</Body>
        </View>
        <Card><BarLoader initialKg={initial && initial > 0 ? initial : null} /></Card>
        <Hint style={{ textAlign: 'center' }}>Tip: while logging a set, the plates appear under the weight box by themselves.</Hint>
      </Screen>
    </>
  );
}
