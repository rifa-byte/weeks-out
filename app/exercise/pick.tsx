import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Button, Card, Dot, Eyebrow, Field, Row, Screen } from '@/components/ui';
import { liftColor, useTheme } from '@/constants/theme';
import {
  CATEGORY_LABEL, MUSCLE_TAGS, REHAB_TAGS, TAG_LABEL, WEAKNESS_TAGS, customId, searchExercises,
  type Category, type Exercise, type Tag,
} from '@/lib/exercises';
import { LIFT_LABEL, LIFTS, type Lift } from '@/lib/math';
import { cancelPick, pickRequest, resolvePick } from '@/lib/picker';

const ORDER: Category[] = ['main', 'variation', 'secondary', 'accessory'];

export default function PickExerciseScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const req = useMemo(() => pickRequest(String(key)), [key]);
  const router = useRouter();
  const t = useTheme();

  const [query, setQuery] = useState('');
  const [parent, setParent] = useState<Lift | null>(req.parent ?? null);
  const [tag, setTag] = useState<Tag | null>(req.tag ?? null);

  useEffect(() => () => cancelPick(String(key)), [key]);

  const results = searchExercises({ query, parent, tag });
  const grouped = ORDER.map(c => ({ category: c, items: results.filter(e => e.category === c) })).filter(g => g.items.length > 0);
  const customName = query.trim();
  const showCustom = (req.allowCustom ?? true) && customName.length > 1 && !results.some(e => e.name.toLowerCase() === customName.toLowerCase());

  function choose(id: string) {
    resolvePick(String(key), id);
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: req.title ?? 'Pick a movement' }} />
      <Screen>
        <Field value={query} onChangeText={setQuery} placeholder="Search: spoto, lockout, knee friendly…" autoCapitalize="none" autoCorrect={false} autoFocus />

        <View style={{ gap: 6 }}>
          <Eyebrow>Lift</Eyebrow>
          <Row style={{ flexWrap: 'wrap' }}>
            <Chip label="Any" on={parent == null} onPress={() => setParent(null)} />
            {LIFTS.map(l => <Chip key={l} label={LIFT_LABEL[l]} on={parent === l} onPress={() => setParent(parent === l ? null : l)} dot={liftColor[l]} />)}
          </Row>
          <Eyebrow>Weak point</Eyebrow>
          <Row style={{ flexWrap: 'wrap' }}>{WEAKNESS_TAGS.map(x => <Chip key={x} label={TAG_LABEL[x]} on={tag === x} onPress={() => setTag(tag === x ? null : x)} />)}</Row>
          <Eyebrow>Rehab</Eyebrow>
          <Row style={{ flexWrap: 'wrap' }}>{REHAB_TAGS.map(x => <Chip key={x} label={TAG_LABEL[x]} on={tag === x} onPress={() => setTag(tag === x ? null : x)} />)}</Row>
          <Eyebrow>Muscle</Eyebrow>
          <Row style={{ flexWrap: 'wrap' }}>{MUSCLE_TAGS.map(x => <Chip key={x} label={TAG_LABEL[x]} on={tag === x} onPress={() => setTag(tag === x ? null : x)} />)}</Row>
        </View>

        {showCustom ? (
          <Button title={`Use “${customName}” as a custom movement`} kind="ghost" onPress={() => choose(customId(customName))} />
        ) : null}

        {grouped.length === 0 ? <Body muted>Nothing matches. Clear a filter, or type a name to add it as custom.</Body> : null}

        {grouped.map(g => (
          <View key={g.category} style={{ gap: 6 }}>
            <Eyebrow>{CATEGORY_LABEL[g.category]}</Eyebrow>
            <Card style={{ gap: 0, paddingVertical: 2, paddingHorizontal: 0 }}>
              {g.items.map((e, i) => <ExerciseRow key={e.id} e={e} first={i === 0} onPress={() => choose(e.id)} />)}
            </Card>
          </View>
        ))}
      </Screen>
    </>
  );
}

function Chip({ label, on, onPress, dot }: { label: string; on: boolean; onPress: () => void; dot?: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999, backgroundColor: on ? t.ink : t.panelAlt }}>
      {dot ? <Dot color={dot} size={8} /> : null}
      <Text style={{ color: on ? t.ground : t.ink, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function ExerciseRow({ e, first, onPress }: { e: Exercise; first: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({ paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: first ? 0 : 0.5, borderTopColor: t.line, backgroundColor: pressed ? t.panelAlt : 'transparent' })}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ flex: 1 }}>
          <Dot color={e.parent ? liftColor[e.parent] : t.ink3} size={8} />
          <Text style={{ color: t.ink, fontWeight: '600', fontSize: 15, flexShrink: 1 }}>{e.name}</Text>
        </Row>
        {e.parent && e.category === 'variation' ? <Text style={{ color: t.ink3, fontSize: 12, fontVariant: ['tabular-nums'] }}>~{Math.round(e.factor * 100)}%</Text> : null}
      </Row>
      <Text style={{ color: t.ink3, fontSize: 12, marginTop: 2 }}>{e.tags.map(x => TAG_LABEL[x]).join(' · ')}</Text>
    </Pressable>
  );
}
