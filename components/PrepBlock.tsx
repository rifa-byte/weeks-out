import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Body, Card, Divider, Eyebrow, Row } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import type { Lift } from '@/lib/math';
import { KIND_LABEL, prepFor, type PrepItem } from '@/lib/prep';

/**
 * Short checklist of warm-up drills for the lifts in this session.
 * Default is the short list; "More" reveals the rest; "Add your own" is a free-text line.
 * Ticks are per visit — this is a nudge, not a record.
 */
export function PrepBlock({ lifts }: { lifts: Lift[] }) {
  const t = useTheme();
  const core = useMemo(() => prepFor(lifts), [lifts]);
  const extra = useMemo(() => prepFor(lifts, true).filter(i => !core.some(c => c.id === i.id)), [lifts, core]);
  const [added, setAdded] = useState<PrepItem[]>([]);      // extras the user pulled in, plus custom lines
  const [showMore, setShowMore] = useState(false);
  const [custom, setCustom] = useState('');
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(true);
  const [skipped, setSkipped] = useState(false);

  const items = [...core, ...added];
  const n = items.filter(i => done[i.id]).length;
  const finished = items.length > 0 && n === items.length;

  if (skipped) return null;

  function addCustom() {
    const name = custom.trim();
    if (!name) return;
    setAdded(a => [...a, { id: `custom-${Date.now()}`, name, kind: 'move', dose: '', why: 'Your own.', lifts: 'all' }]);
    setCustom('');
  }

  return (
    <Card style={{ gap: 0, paddingVertical: 8 }}>
      <Pressable onPress={() => setOpen(o => !o)} style={{ paddingVertical: 4 }} accessibilityRole="button">
        <Row style={{ justifyContent: 'space-between' }}>
          <Eyebrow>Warm-up · {finished ? 'done' : `${n} of ${items.length}`}</Eyebrow>
          <Row>
            {!finished ? (
              <Pressable onPress={() => setSkipped(true)} hitSlop={8} style={{ paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: t.panelAlt }}>
                <Text style={{ color: t.ink2, fontSize: 12, fontWeight: '700' }}>Skip</Text>
              </Pressable>
            ) : null}
            <Text style={{ color: t.ink3, fontSize: 14 }}>{open ? '▾ hide' : '▸ show'}</Text>
          </Row>
        </Row>
      </Pressable>
      {open ? (
        <>
          <Body muted style={{ fontSize: 12, marginBottom: 4 }}>Tap each one when it’s done. Five minutes, then the bar.</Body>
          {items.map((i, idx) => (
            <View key={i.id}>
              {idx > 0 ? <Divider /> : null}
              <Pressable onPress={() => setDone(d => ({ ...d, [i.id]: !d[i.id] }))} accessibilityRole="checkbox" accessibilityState={{ checked: !!done[i.id] }} style={{ paddingVertical: 9 }}>
                <Row style={{ alignItems: 'flex-start' }}>
                  <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: done[i.id] ? t.good : t.ink3, backgroundColor: done[i.id] ? t.good : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {done[i.id] ? <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Text style={{ color: done[i.id] ? t.ink3 : t.ink, fontWeight: '600', fontSize: 15, flexShrink: 1, textDecorationLine: done[i.id] ? 'line-through' : 'none' }}>{i.name}</Text>
                      <Text style={{ color: t.ink3, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>{KIND_LABEL[i.kind]}</Text>
                    </Row>
                    {i.dose ? <Body muted style={{ fontSize: 12 }}>{i.dose} — {i.why}</Body> : null}
                  </View>
                </Row>
              </Pressable>
            </View>
          ))}
          <Divider />
          <Row style={{ paddingTop: 8, flexWrap: 'wrap' }}>
            {extra.length ? (
              <Pressable onPress={() => setShowMore(m => !m)} accessibilityRole="button" style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1.5, borderColor: t.ink, backgroundColor: t.panel }}>
                <Text style={{ color: t.ink, fontWeight: '700', fontSize: 13 }}>{showMore ? 'Hide extras' : `More drills (${extra.length})`}</Text>
              </Pressable>
            ) : null}
          </Row>
          {showMore ? (
            <View style={{ gap: 4, paddingTop: 6 }}>
              <Body muted style={{ fontSize: 12 }}>Tap one to add it to today’s list.</Body>
              {extra.filter(e => !added.some(a => a.id === e.id)).map(e => (
                <Pressable key={e.id} onPress={() => setAdded(a => [...a, e])} accessibilityRole="button" style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: t.panelAlt }}>
                  <Text style={{ color: t.ink, fontSize: 14, fontWeight: '600' }}>+ {e.name} <Text style={{ color: t.ink3, fontWeight: '400' }}>· {e.dose}</Text></Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Row style={{ paddingTop: 8 }}>
            <TextInput
              value={custom}
              onChangeText={setCustom}
              onSubmitEditing={addCustom}
              returnKeyType="done"
              placeholder="Add your own, e.g. hip flexor stretch"
              placeholderTextColor={t.ink3}
              style={{ flex: 1, backgroundColor: t.panelAlt, color: t.ink, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 }}
            />
            <Pressable onPress={addCustom} accessibilityRole="button" style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: t.ink }}>
              <Text style={{ color: t.ground, fontWeight: '700' }}>Add</Text>
            </Pressable>
          </Row>
        </>
      ) : null}
    </Card>
  );
}
