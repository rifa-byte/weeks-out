import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { useTheme } from '@/constants/theme';

export default function NotFoundScreen() {
  const t = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: t.ground }}>
        <Text style={{ color: t.ink, fontSize: 18, fontWeight: '700' }}>This screen doesn’t exist.</Text>
        <Link href="/" style={{ marginTop: 15, paddingVertical: 15 }}>
          <Text style={{ color: t.accent, fontSize: 15 }}>Back to the log</Text>
        </Link>
      </View>
    </>
  );
}
