import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTheme } from '@/constants/theme';

export default function TabLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.ink3,
        tabBarStyle: { backgroundColor: t.panel, borderTopColor: t.line },
        tabBarLabelStyle: { fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Log', tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="meet"
        options={{ title: 'Meet', tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="programs"
        options={{ title: 'Programs', tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
