import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { mmss } from '@/lib/format';

/**
 * Rest timer. `startedAt` is the ms timestamp of the last set (null = idle).
 * Counts up from that moment and buzzes once when `targetSeconds` is reached.
 * Buzzes only while the app is open — no notifications yet.
 */
export function RestTimer({ startedAt, targetSeconds, onTargetChange, onReset }: {
  startedAt: number | null;
  targetSeconds: number;
  onTargetChange: (s: number) => void;
  onReset: () => void;
}) {
  const t = useTheme();
  const [now, setNow] = useState(Date.now());
  const buzzed = useRef(false);

  useEffect(() => {
    if (startedAt == null) return;
    buzzed.current = false;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [startedAt]);

  const elapsed = startedAt == null ? 0 : (now - startedAt) / 1000;
  const remaining = targetSeconds - elapsed;
  const done = startedAt != null && remaining <= 0;

  useEffect(() => {
    if (done && !buzzed.current) {
      buzzed.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [done]);

  const targets = [90, 120, 180, 240, 300];

  return (
    <View style={{ backgroundColor: done ? t.accentSoft : t.panel, borderColor: done ? t.accent : t.line, borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ color: t.ink3, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600' }}>
            {startedAt == null ? 'Rest' : done ? 'Go' : 'Resting'}
          </Text>
          <Text style={{ color: done ? t.accent : t.ink, fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 }}>
            {startedAt == null ? mmss(targetSeconds) : done ? `+${mmss(-remaining)}` : mmss(remaining)}
          </Text>
        </View>
        <Pressable onPress={onReset} accessibilityRole="button" style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, backgroundColor: t.panelAlt }}>
          <Text style={{ color: t.ink, fontWeight: '600' }}>{startedAt == null ? 'Start' : 'Reset'}</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {targets.map(s => (
          <Pressable key={s} onPress={() => onTargetChange(s)} accessibilityRole="button" accessibilityState={{ selected: s === targetSeconds }}
            style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: s === targetSeconds ? t.ink : t.panelAlt }}>
            <Text style={{ color: s === targetSeconds ? t.ground : t.ink2, fontSize: 12, fontWeight: '600' }}>{mmss(s)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
