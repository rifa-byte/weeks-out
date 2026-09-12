import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Card, Divider, Eyebrow, Row } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import type { Lift } from '@/lib/math';
import { KIND_LABEL, prepFor } from '@/lib/prep';

/** Checklist of stretches, band work and holds for the lifts in this session. Ticks are per visit. */
export function PrepBlock({ lifts }: { lifts: Lift[] }) {
  const t = useTheme();
  const items = useMemo(() => prepFor(lifts), [lifts]);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(true);
  const [skipped, setSkipped] = useState(false);
  const n = items.filter(i => done[i.id]).length;
  const finished = n === items.length;

  if (skipped) return null;

  return (
    <Card style={{ gap: 0, paddingVertical: 8 }}>
      <Pressable onPress={() => setOpen(o => !o)} style={{ paddingVertical: 4 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Eyebrow>Prep · {finished ? 'done' : `${n} of ${items.length}`}</Eyebrow>
          <Row>
            {!finished ? <Pressable onPress={() => setSkipped(true)} hitSlop={8}><Text style={{ color: t.ink3, fontSize: 12, fontWeight: '600' }}>Skip</Text></Pressable> : null}
            <Text style={{ color: t.ink3, fontSize: 12 }}>{open ? '▾' : '▸'}</Text>
          </Row>
        </Row>
        {!open ? <Body muted style={{ fontSize: 13 }}>{lifts.length ? `For ${lifts.join(', ')}: ` : ''}{items.slice(0, 3).map(i => i.name).join(' · ')}…</Body> : null}
      </Pressable>
      {open ? items.map((i, idx) => (
        <View key={i.id}>
          {idx > 0 ? <Divider /> : null}
          <Pressable onPress={() => setDone(d => ({ ...d, [i.id]: !d[i.id] }))} accessibilityRole="checkbox" accessibilityState={{ checked: !!done[i.id] }} style={{ paddingVertical: 8 }}>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 2, marginTop: 2, borderColor: done[i.id] ? t.good : t.line, backgroundColor: done[i.id] ? t.good : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {done[i.id] ? <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✓</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ color: done[i.id] ? t.ink3 : t.ink, fontWeight: '600', fontSize: 14, flexShrink: 1, textDecorationLine: done[i.id] ? 'line-through' : 'none' }}>{i.name}</Text>
                  <Text style={{ color: t.ink3, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>{KIND_LABEL[i.kind]}</Text>
                </Row>
                <Body muted style={{ fontSize: 12 }}>{i.dose} — {i.why}</Body>
              </View>
            </Row>
          </Pressable>
        </View>
      )) : null}
    </Card>
  );
}
