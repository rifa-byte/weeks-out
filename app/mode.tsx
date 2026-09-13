import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Button, Card, Eyebrow, Field, Hint, Row, Screen, Title } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { formatDate, parseIso } from '@/lib/format';
import { weeksOut } from '@/lib/math';
import { useSettings } from '@/lib/settings';

/** Meet mode or general mode. Reachable from the Log header any time. */
export default function ModeScreen() {
  const router = useRouter();
  const t = useTheme();
  const { settings, set } = useSettings();
  const [mode, setMode] = useState<'meet' | 'general'>(settings.mode);
  const [date, setDate] = useState(settings.meetDate);
  const [name, setName] = useState(settings.meetName);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parseIso(date).getTime());
  const wk = validDate ? weeksOut(parseIso(date)).weeks : null;

  async function save() {
    await set('mode', mode);
    if (mode === 'meet' && validDate) { await set('meetDate', date); await set('meetName', name.trim() || 'My meet'); }
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'How are you using Weeks Out?' }} />
      <Screen>
        <View>
          <Eyebrow>Change any time</Eyebrow>
          <Title>Prepping for a meet?</Title>
          <Body muted>Meet mode adds the Meet tab and counts down your weeks. General mode keeps things simple: log, programs, coaches.</Body>
        </View>

        <Choice on={mode === 'meet'} title="Yes — I have a meet coming" sub="Weeks out, attempts, meet-day mode, prep scaled to my date." onPress={() => setMode('meet')} />
        <Choice on={mode === 'general'} title="No — I just want to train" sub="Log, follow or build programs, find a coach. No meet stuff." onPress={() => setMode('general')} />

        {mode === 'meet' ? (
          <Card>
            <Eyebrow>Your meet</Eyebrow>
            <Row style={{ alignItems: 'flex-end' }}>
              <Field label="Meet name" value={name} onChangeText={setName} placeholder="e.g. Nationals" />
              <Field label="Date (yyyy-mm-dd)" value={date} onChangeText={setDate} placeholder="2026-11-07" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
            </Row>
            {validDate ? <Body muted style={{ fontSize: 13 }}>{formatDate(date)} — {wk === 0 ? 'that’s this week' : `${wk} weeks out`}.</Body> : <Text style={{ color: t.danger, fontSize: 13 }}>Type the date as year-month-day, e.g. 2026-11-07.</Text>}
          </Card>
        ) : null}

        <Button title="Save" onPress={save} disabled={mode === 'meet' && !validDate} style={{ opacity: mode === 'meet' && !validDate ? 0.4 : 1 }} />
        <Hint style={{ textAlign: 'center' }}>Nothing you’ve logged changes. This only changes what the app shows you.</Hint>
      </Screen>
    </>
  );
}

function Choice({ on, title, sub, onPress }: { on: boolean; title: string; sub: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }}
      style={{ padding: 16, borderRadius: 10, borderWidth: 2, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accentSoft : t.panel, gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: t.ink, fontWeight: '800', fontSize: 17, flexShrink: 1 }}>{title}</Text>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? t.accent : t.ink3, backgroundColor: on ? t.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {on ? <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text> : null}
        </View>
      </Row>
      <Body muted style={{ fontSize: 14 }}>{sub}</Body>
    </Pressable>
  );
}
