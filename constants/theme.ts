import { useColorScheme } from 'react-native';

export const plate = {
  red: '#C7362E',
  blue: '#2C55B2',
  yellow: '#D9A400',
  green: '#2F8F5B',
};

export const palettes = {
  light: {
    ground: '#F6F4EF',
    panel: '#FFFFFF',
    panelAlt: '#EFECE5',
    ink: '#1C1B19',
    ink2: '#4F4B45',
    ink3: '#8A857D',
    line: '#E2DED6',
    accent: plate.red,
    accentSoft: '#FBE8E6',
    onAccent: '#FFFFFF',
    good: plate.green,
    danger: '#B3261E',
  },
  dark: {
    ground: '#141312',
    panel: '#1E1C1A',
    panelAlt: '#26231F',
    ink: '#EEEAE3',
    ink2: '#BDB7AE',
    ink3: '#7F7A72',
    line: '#302D29',
    accent: '#E45A50',
    accentSoft: '#3A1F1D',
    onAccent: '#FFFFFF',
    good: '#5BBA84',
    danger: '#F2726A',
  },
};

export type Palette = typeof palettes.light;

export function useTheme(): Palette {
  const scheme = useColorScheme();
  return scheme === 'dark' ? palettes.dark : palettes.light;
}

export const liftColor = { squat: plate.blue, bench: plate.red, deadlift: plate.green } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 6, md: 10, lg: 14 };
