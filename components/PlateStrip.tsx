import { Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { PLATE_SETS, loadBar, type PlateSetId } from '@/lib/math';
import { useSettings } from '@/lib/settings';

/** Per-side plate loading for a weight, drawn with the plate set the lifter's gym has. */
export function PlateStrip({ weightKg, plateSet, barKg, collars }: { weightKg: number; plateSet: PlateSetId; barKg: number; collars?: boolean }) {
  const t = useTheme();
  const { fmt, unit } = useSettings();
  const set = PLATE_SETS[plateSet];
  const collarsKg = collars === undefined ? set.collarsKg : collars ? 5 : 0;
  const load = loadBar(weightKg, { barKg, collarsKg, plates: set.plates });
  const lbSet = plateSet === 'gym-lb';
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
        <View style={{ width: 22, height: 8, backgroundColor: t.ink3, borderRadius: 2 }} />
        {load.perSide.map((p, i) => {
          const big = p.kg >= 10;
          const light = p.color === '#F2F2F2' || p.color === '#D9A400';
          return (
            <View key={i} style={{ width: big ? 24 : 16, height: big ? 46 : p.kg >= 2.5 ? 34 : 26, backgroundColor: p.color, borderRadius: 3, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}>
              <Text style={{ color: light ? '#1C1B19' : '#fff', fontSize: 9, fontWeight: '700' }}>{lbSet ? p.name : p.kg >= 1 ? p.kg : ''}</Text>
            </View>
          );
        })}
        {load.perSide.length === 0 ? <Text style={{ color: t.ink3, fontSize: 12 }}>bar only</Text> : null}
      </View>
      <Text style={{ color: t.ink3, fontSize: 12 }}>
        per side · {fmt(barKg, 0)} {unit} bar{collarsKg ? ' + collars' : ''}
        {load.remainder > 0.01 ? ` · ${fmt(load.remainder, 2)} ${unit} short` : ''}
      </Text>
    </View>
  );
}
