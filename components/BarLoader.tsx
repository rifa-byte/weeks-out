import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Field, Row, Segmented } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { parseNum } from '@/lib/format';
import { loadBar, PLATE_SETS, roundTo, type PlateSetId } from '@/lib/math';
import { useSettings } from '@/lib/settings';

/**
 * Load the bar — type a weight, see the plates per side for the plates your gym actually has.
 * Lives on the Log tab (Load the bar), the Meet tab, and inside every session.
 */
export function BarLoader({ initialKg }: { initialKg?: number | null }) {
  const t = useTheme();
  const { settings, set, fmt, unit, toKg } = useSettings();
  const [plateText, setPlateText] = useState(initialKg ? fmt(initialKg) : '');
  const [collars, setCollars] = useState(settings.plateSet === 'ipf');
  const plateKg = (() => {
    const n = parseNum(plateText);
    return n && n > 0 ? toKg(n) : null;
  })();
  const load = plateKg ? loadBar(plateKg, { barKg: settings.barKg, collarsKg: collars ? 5 : 0, plates: PLATE_SETS[settings.plateSet].plates }) : null;

  return (
    <>
      <View style={{ gap: 4 }}>
        <Text style={{ color: t.ink3, fontSize: 12, fontWeight: '600' }}>Plates in your gym</Text>
        <Segmented<PlateSetId>
          options={['gym-kg', 'gym-lb', 'ipf']}
          value={settings.plateSet}
          onChange={(v) => {
            set('plateSet', v);
            set('barKg', PLATE_SETS[v].barKg);
            setCollars(v === 'ipf');
          }}
          labels={(v) => PLATE_SETS[v].label}
        />
      </View>
      <Row style={{ alignItems: 'flex-end' }}>
        <Field label={`Weight (${unit})`} value={plateText} onChangeText={setPlateText} keyboardType="decimal-pad" placeholder="0" />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: t.ink3, fontSize: 12, fontWeight: '600' }}>Bar</Text>
          <Segmented<number>
            options={settings.plateSet === 'gym-lb' ? [45 * 0.45359237, 35 * 0.45359237] : [20, 15]}
            value={settings.barKg}
            onChange={(v) => set('barKg', v)}
            labels={(v) => (settings.plateSet === 'gym-lb' ? `${Math.round(v / 0.45359237)} lb` : `${v} kg`)}
          />
        </View>
        <Pressable
          onPress={() => setCollars((c) => !c)}
          accessibilityRole="switch"
          accessibilityState={{ checked: collars }}
          style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, backgroundColor: collars ? t.ink : t.panelAlt }}
        >
          <Text style={{ color: collars ? t.ground : t.ink, fontWeight: '600' }}>Collars</Text>
        </Pressable>
      </Row>
      {load ? (
        <>
          <Row style={{ flexWrap: 'wrap', gap: 4 }}>
            <BarEnd />
            {load.perSide.map((p, i) => (
              <PlateChip key={i} kg={p.kg} color={p.color} label={settings.plateSet === 'gym-lb' ? p.name : undefined} />
            ))}
            {load.perSide.length === 0 ? <Body muted>Just the bar{collars ? ' and collars' : ''}.</Body> : null}
          </Row>
          <Body muted style={{ fontSize: 13 }}>
            Per side, {fmt(settings.barKg, 0)} {unit} bar{collars ? ' + collars' : ''}.
            {load.remainder > 0.01 ? ` ${fmt(load.remainder, 2)} ${unit} can’t be loaded with these plates — nearest is ${fmt(roundTo(plateKg! - load.remainder, 0.5))}.` : ''}
          </Body>
        </>
      ) : null}
      <Row style={{ flexWrap: 'wrap' }}>
        {[60, 100, 140, 180, 220].map((k) => (
          <Pressable key={k} onPress={() => setPlateText(fmt(k, 0))} style={{ backgroundColor: t.panelAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ color: t.ink2, fontSize: 13 }}>{fmt(k, 0)}</Text>
          </Pressable>
        ))}
      </Row>
    </>
  );
}

function BarEnd() {
  const t = useTheme();
  return <View style={{ width: 28, height: 10, backgroundColor: t.ink3, borderRadius: 2, alignSelf: 'center' }} />;
}

function PlateChip({ kg, color, label }: { kg: number; color: string; label?: string }) {
  const light = color === '#F2F2F2' || color === '#D9A400';
  const h = kg >= 10 ? 54 : kg >= 2.5 ? 40 : 30;
  return (
    <View
      style={{
        width: kg >= 10 ? 26 : 18,
        height: h,
        backgroundColor: color,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
      }}
    >
      <Text style={{ color: light ? '#1C1B19' : '#fff', fontSize: 10, fontWeight: '700' }}>{label ?? (kg >= 1 ? kg : '')}</Text>
    </View>
  );
}
