import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';

import { palettes } from '@/constants/theme';
import { DB_NAME, migrate } from '@/lib/db';
import { SettingsProvider } from '@/lib/settings';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  const scheme = useColorScheme();
  const p = scheme === 'dark' ? palettes.dark : palettes.light;
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: p.ground, card: p.panel, text: p.ink, border: p.line, primary: p.accent },
  };

  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
      <SettingsProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerTitleStyle: { fontWeight: '700' } }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="session/[id]" options={{ title: 'Session' }} />
            <Stack.Screen name="program/start" options={{ title: 'Start program', presentation: 'modal' }} />
            <Stack.Screen name="program/day/[id]" options={{ title: 'Program day' }} />
          </Stack>
        </ThemeProvider>
      </SettingsProvider>
    </SQLiteProvider>
  );
}
