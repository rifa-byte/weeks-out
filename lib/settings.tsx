import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { DEFAULT_SETTINGS, loadSettings, saveSetting, type Settings } from './db';
import { kgToLb, lbToKg } from './math';

interface Ctx {
  settings: Settings;
  ready: boolean;
  set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>;
  /** Format a kg value in the user's units, e.g. "182.5" or "402". */
  fmt(kg: number | null | undefined, digits?: number): string;
  /** Unit label: "kg" | "lb". */
  unit: string;
  /** Convert user-entered number (in their units) to kg. */
  toKg(n: number): number;
  /** Convert kg to the user's units. */
  fromKg(kg: number): number;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSettings(db).then(s => { setSettings(s); setReady(true); });
  }, [db]);

  const set = useCallback(async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    await saveSetting(db, key, value);
  }, [db]);

  const value = useMemo<Ctx>(() => {
    const lb = settings.units === 'lb';
    return {
      settings, ready, set,
      unit: lb ? 'lb' : 'kg',
      toKg: n => (lb ? lbToKg(n) : n),
      fromKg: kg => (lb ? kgToLb(kg) : kg),
      fmt: (kg, digits) => {
        if (kg == null || !Number.isFinite(kg)) return '—';
        const v = lb ? kgToLb(kg) : kg;
        const d = digits ?? (lb ? 0 : (Math.abs(v % 1) < 1e-9 ? 0 : 1));
        return v.toFixed(d);
      },
    };
  }, [settings, ready, set]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
