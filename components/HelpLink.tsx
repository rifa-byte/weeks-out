import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useTheme } from '@/constants/theme';

/** "How this works" link for a screen header. */
export function HelpLink({ topic }: { topic: 'log' | 'session' | 'programs' | 'meet' | 'meetday' }) {
  const router = useRouter();
  const t = useTheme();
  return (
    <Pressable onPress={() => router.push({ pathname: '/help', params: { topic } })} accessibilityRole="button" hitSlop={8}
      style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.panel }}>
      <Text style={{ color: t.ink2, fontSize: 12, fontWeight: '700' }}>? How this works</Text>
    </Pressable>
  );
}
