import React from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '@/constants/theme';

/** Scrollable screen with the page gutter and safe-area bottom padding. */
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.ground }}
      contentContainerStyle={[{ padding: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.lg }, style]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic">
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.panel, borderColor: t.line, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.lg, gap: space.md }, style]}>
      {children}
    </View>
  );
}

export function Eyebrow({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ color: t.ink3, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600' }, style]}>{children}</Text>;
}

export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ color: t.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }, style]}>{children}</Text>;
}

export function H2({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ color: t.ink, fontSize: 18, fontWeight: '700' }, style]}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ color: muted ? t.ink2 : t.ink, fontSize: 15, lineHeight: 21 }, style]}>{children}</Text>;
}

/** Big tabular number, for weights and scores. */
export function Num({ children, size = 32, color, style }: { children: React.ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ color: color ?? t.ink, fontSize: size, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 }, style]}>{children}</Text>;
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, style]}>{children}</View>;
}

export function Button({ title, kind = 'primary', style, ...rest }: PressableProps & { title: string; kind?: 'primary' | 'ghost' | 'danger'; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : kind === 'danger' ? t.danger : 'transparent';
  const fg = kind === 'ghost' ? t.ink : t.onAccent;
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        { backgroundColor: bg, paddingVertical: 12, paddingHorizontal: 18, borderRadius: radius.sm, alignItems: 'center', opacity: pressed ? 0.7 : 1,
          borderWidth: kind === 'ghost' ? StyleSheet.hairlineWidth : 0, borderColor: t.line },
        style,
      ]}
      {...rest}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, style, containerStyle, ...rest }: TextInputProps & { label?: string; style?: StyleProp<TextStyle>; containerStyle?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ gap: 4, flex: 1 }, containerStyle]}>
      {label ? <Text style={{ color: t.ink3, fontSize: 12, fontWeight: '600' }}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.ink3}
        style={[{ backgroundColor: t.panelAlt, color: t.ink, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 17, fontVariant: ['tabular-nums'] }, style]}
        {...rest}
      />
    </View>
  );
}

/** Horizontal choice chips. */
export function Segmented<T extends string | number>({ options, value, onChange, labels }: { options: readonly T[]; value: T | null; onChange: (v: T) => void; labels?: (v: T) => string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => {
        const on = o === value;
        return (
          <Pressable key={String(o)} onPress={() => onChange(o)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: on ? t.ink : t.panelAlt }}>
            <Text style={{ color: on ? t.ground : t.ink, fontWeight: '600', fontSize: 14 }}>{labels ? labels(o) : String(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.line }} />;
}

export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}
