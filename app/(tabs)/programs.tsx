import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Card, Eyebrow, H2, Screen, Title } from '@/components/ui';
import { space } from '@/constants/theme';

const TEMPLATES = [
  {
    name: '3-day full body',
    who: 'Newer lifters, or anyone short on time.',
    shape: 'Squat, bench and deadlift each session at rotating intensities. 4-week waves.',
  },
  {
    name: '4-day SBD split',
    who: 'Intermediates building volume between meets.',
    shape: 'Two squat days, two bench days, one heavy pull. Top set @ RPE 8 then back-offs.',
  },
  {
    name: '8-week meet prep',
    who: 'Anyone with a date on the calendar.',
    shape: 'Four weeks of heavy volume, three of singles at openers and above, one taper. Ends on the platform.',
  },
];

export default function ProgramsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <Screen style={{ paddingTop: insets.top + space.lg }}>
      <View>
        <Eyebrow>Sprint 3</Eyebrow>
        <Title>Programs</Title>
        <Body muted>Templates that load from your current e1RMs and push each session straight into the log. Coming after the meet tools.</Body>
      </View>
      {TEMPLATES.map(p => (
        <Card key={p.name}>
          <H2>{p.name}</H2>
          <Body muted>{p.who}</Body>
          <Body>{p.shape}</Body>
        </Card>
      ))}
    </Screen>
  );
}
