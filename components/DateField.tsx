import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';

import { radius, useTheme } from '@/constants/theme';
import { formatDate, parseIso } from '@/lib/format';

/** yyyy-mm-dd in local time. */
export function toIso(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * A date you pick, not type. iOS shows an inline calendar under the field; Android opens the
 * system date dialog. Value in and out is ISO yyyy-mm-dd, same as everywhere else in the app.
 */
export function DateField({ label, value, onChange, minimumDate, style }: {
  label?: string; value: string; onChange: (iso: string) => void; minimumDate?: Date; style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const dark = useColorScheme() === 'dark';
  const [open, setOpen] = useState(false);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseIso(value) : new Date(NaN);
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  function onPick(e: DateTimePickerEvent, d?: Date) {
    if (Platform.OS !== 'ios') setOpen(false);
    if (e.type === 'set' && d) onChange(toIso(d));
  }

  return (
    <View style={[{ gap: 4, flex: 1 }, style]}>
      {label ? <Text style={{ color: t.ink3, fontSize: 12, fontWeight: '600' }}>{label}</Text> : null}
      <Pressable onPress={() => setOpen(o => !o)} accessibilityRole="button" accessibilityLabel={`${label ?? 'Date'}: ${formatDate(value)}. Tap to change`}
        style={{ backgroundColor: t.panelAlt, borderColor: open ? t.accent : t.line, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: t.ink, fontSize: 16, fontWeight: '600' }}>{Number.isNaN(parsed.getTime()) ? 'Pick a date' : formatDate(value)}</Text>
        <Text style={{ color: t.accent, fontSize: 13, fontWeight: '700' }}>{open ? 'Done' : 'Change'}</Text>
      </Pressable>
      {open ? (
        <View style={{ backgroundColor: t.panel, borderRadius: radius.sm, overflow: 'hidden' }}>
          <DateTimePicker value={date} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={onPick} minimumDate={minimumDate} accentColor={t.accent} themeVariant={dark ? 'dark' : 'light'} />
        </View>
      ) : null}
    </View>
  );
}
