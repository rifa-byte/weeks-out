import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Eyebrow, Field, Row, Title } from '@/components/ui';
import { space, useTheme } from '@/constants/theme';
import { setJson } from '@/lib/db';
import { parseIso } from '@/lib/format';
import { useSettings } from '@/lib/settings';

/**
 * Two jobs, one file:
 *  - /welcome          first launch: "meet or not?" → straight into the questionnaire. Nothing else.
 *  - /welcome?tour=1   the optional tab-by-tab tour, reachable from Help.
 */

const STEPS = [
  {
    eyebrow: 'Weeks Out',
    title: 'Log your lifts. Follow a program. Find a coach.',
    body: 'Two tabs at the bottom: Log and Programs (three if you are prepping for a meet). Everything you log stays on your phone — no account needed.',
  },
  {
    eyebrow: 'Log tab',
    title: 'Every session is four taps.',
    body: '1. Tap the big red button to start a session.\n2. Tap a lift, type weight and reps.\n3. Tap how hard it was (RPE): 10 = nothing left, 8 = two reps left.\n4. Tap Add set.\n\nThe app works out your estimated 1RM and flags PRs.',
  },
  {
    eyebrow: 'Programs tab',
    title: 'Make one, find one, or find a coach.',
    body: '“Make” asks eight quick questions and writes a program for you. “Find” shows programs other lifters and coaches have shared. “Coaches” lists people taking clients — message them straight from their card. Whatever you pick, the Log tab then shows your next session: one tap to log it.',
  },
  {
    eyebrow: 'Meet tab',
    title: 'Competing? It’s all here.',
    body: 'Attempts, plates, scores, bodyweight, and a meet-day timeline. If you never compete, you never see this tab.',
  },
];

export default function WelcomeScreen() {
  const { tour } = useLocalSearchParams<{ tour?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, set } = useSettings();
  const [i, setI] = useState(0);
  const [mode, setMode] = useState<'meet' | 'general'>(settings.mode);
  const [date, setDate] = useState(settings.meetDate);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parseIso(date).getTime());
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  async function finishTour() {
    await setJson(db, 'onboarded', true);
    router.back();
  }
  async function chooseMode() {
    await set('mode', mode);
    if (mode === 'meet' && validDate) await set('meetDate', date);
    // Straight into the questionnaire. It marks set-up done when you start a program (or skip).
    router.replace({ pathname: '/program/make', params: { first: '1' } });
  }

  const frame = { flex: 1, backgroundColor: t.ground, paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.xl, justifyContent: 'space-between' as const };

  if (!tour) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <View style={frame}>
          <View style={{ gap: space.lg }}>
            <Eyebrow>Weeks Out · one question first</Eyebrow>
            <Title style={{ fontSize: 34 }}>Are you prepping for a meet?</Title>
            <Body style={{ fontSize: 17, lineHeight: 25 }}>Tap one. You can change it any time from the Log tab.</Body>
            <Button title={mode === 'meet' ? '✓ Yes — I have a meet coming' : 'Yes — I have a meet coming'} kind={mode === 'meet' ? 'primary' : 'ghost'} onPress={() => setMode('meet')} />
            <Button title={mode === 'general' ? '✓ No — I just want to train' : 'No — I just want to train'} kind={mode === 'general' ? 'primary' : 'ghost'} onPress={() => setMode('general')} />
            {mode === 'meet' ? <Field label="Meet date (yyyy-mm-dd)" value={date} onChangeText={setDate} placeholder="2026-11-07" autoCapitalize="none" keyboardType="numbers-and-punctuation" /> : null}
          </View>
          <View style={{ gap: space.sm }}>
            <Button title="Continue" onPress={chooseMode} disabled={mode === 'meet' && !validDate} style={{ opacity: mode === 'meet' && !validDate ? 0.4 : 1 }} />
            <Text style={{ color: t.ink3, fontSize: 12, textAlign: 'center' }}>Next: eight quick questions and the app writes your first program.</Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <View style={frame}>
        <View style={{ gap: space.lg }}>
          <Eyebrow>{step.eyebrow} · {i + 1} of {STEPS.length}</Eyebrow>
          <Title style={{ fontSize: 34 }}>{step.title}</Title>
          <Body style={{ fontSize: 17, lineHeight: 25 }}>{step.body}</Body>
        </View>
        <View style={{ gap: space.md }}>
          <Row style={{ justifyContent: 'center', gap: 6 }}>
            {STEPS.map((_, k) => <View key={k} style={{ width: k === i ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: k === i ? t.accent : t.line }} />)}
          </Row>
          <Button title={last ? 'Got it' : 'Next'} onPress={() => (last ? finishTour() : setI(i + 1))} />
          {!last ? <Button title="Skip" kind="ghost" onPress={finishTour} /> : null}
          <Text style={{ color: t.ink3, fontSize: 12, textAlign: 'center' }}>You can read this again any time: tap “How this works” on any tab.</Text>
        </View>
      </View>
    </>
  );
}
