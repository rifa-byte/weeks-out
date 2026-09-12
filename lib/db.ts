import type { SQLiteDatabase } from 'expo-sqlite';
import { e1rm, type Lift, type Sex } from './math';

export const DB_NAME = 'weeksout.db';

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,            -- ISO yyyy-mm-dd
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      exercise TEXT NOT NULL,        -- 'squat' | 'bench' | 'deadlift' | free text
      weight_kg REAL NOT NULL,
      reps INTEGER NOT NULL,
      rpe REAL,
      e1rm REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sets_session ON sets(session_id);
    CREATE INDEX IF NOT EXISTS idx_sets_exercise ON sets(exercise);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

// ---------- types ----------
export interface Session { id: number; date: string; notes: string }
export interface SetRow { id: number; session_id: number; exercise: string; weight_kg: number; reps: number; rpe: number | null; e1rm: number }
export interface SessionSummary extends Session { set_count: number; top_lift: string | null; top_e1rm: number | null }

export interface Settings {
  units: 'kg' | 'lb';
  sex: Sex;
  bodyweightKg: number;
  meetDate: string; // ISO yyyy-mm-dd
  meetName: string;
}

export const DEFAULT_SETTINGS: Settings = {
  units: 'kg',
  sex: 'M',
  bodyweightKg: 83,
  meetDate: '2026-11-07',
  meetName: 'My meet',
};

// ---------- settings ----------
export async function loadSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key === 'units') out.units = r.value === 'lb' ? 'lb' : 'kg';
    else if (r.key === 'sex') out.sex = r.value === 'F' ? 'F' : 'M';
    else if (r.key === 'bodyweightKg') out.bodyweightKg = Number(r.value) || DEFAULT_SETTINGS.bodyweightKg;
    else if (r.key === 'meetDate') out.meetDate = r.value;
    else if (r.key === 'meetName') out.meetName = r.value;
  }
  return out;
}

export async function saveSetting<K extends keyof Settings>(db: SQLiteDatabase, key: K, value: Settings[K]) {
  await db.runAsync('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, String(value));
}

// ---------- sessions ----------
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export async function listSessions(db: SQLiteDatabase): Promise<SessionSummary[]> {
  return db.getAllAsync<SessionSummary>(`
    SELECT s.id, s.date, s.notes,
      (SELECT COUNT(*) FROM sets WHERE session_id = s.id) AS set_count,
      (SELECT exercise FROM sets WHERE session_id = s.id ORDER BY e1rm DESC LIMIT 1) AS top_lift,
      (SELECT MAX(e1rm) FROM sets WHERE session_id = s.id) AS top_e1rm
    FROM sessions s ORDER BY s.date DESC, s.id DESC`);
}

export async function createSession(db: SQLiteDatabase, date = todayIso()): Promise<number> {
  const r = await db.runAsync('INSERT INTO sessions(date) VALUES (?)', date);
  return r.lastInsertRowId;
}

export async function getSession(db: SQLiteDatabase, id: number): Promise<Session | null> {
  return db.getFirstAsync<Session>('SELECT id, date, notes FROM sessions WHERE id = ?', id);
}

export async function updateSessionNotes(db: SQLiteDatabase, id: number, notes: string) {
  await db.runAsync('UPDATE sessions SET notes = ? WHERE id = ?', notes, id);
}

export async function deleteSession(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM sets WHERE session_id = ?', id);
  await db.runAsync('DELETE FROM sessions WHERE id = ?', id);
}

// ---------- sets ----------
export async function listSets(db: SQLiteDatabase, sessionId: number): Promise<SetRow[]> {
  return db.getAllAsync<SetRow>('SELECT * FROM sets WHERE session_id = ? ORDER BY id ASC', sessionId);
}

export async function addSet(db: SQLiteDatabase, s: { sessionId: number; exercise: string; weightKg: number; reps: number; rpe: number | null }) {
  const est = e1rm(s.weightKg, s.reps, s.rpe);
  await db.runAsync(
    'INSERT INTO sets(session_id, exercise, weight_kg, reps, rpe, e1rm) VALUES (?, ?, ?, ?, ?, ?)',
    s.sessionId, s.exercise, s.weightKg, s.reps, s.rpe, est,
  );
}

export async function deleteSet(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM sets WHERE id = ?', id);
}

/** Best estimated 1RM for each competition lift across the whole log. */
export async function bestByLift(db: SQLiteDatabase): Promise<Record<Lift, number | null>> {
  const rows = await db.getAllAsync<{ exercise: string; best: number }>(
    "SELECT exercise, MAX(e1rm) AS best FROM sets WHERE exercise IN ('squat','bench','deadlift') GROUP BY exercise",
  );
  const out: Record<Lift, number | null> = { squat: null, bench: null, deadlift: null };
  for (const r of rows) out[r.exercise as Lift] = r.best;
  return out;
}

/** Was this set the best e1RM ever for its exercise at the time it was logged? */
export async function isPr(db: SQLiteDatabase, set: SetRow): Promise<boolean> {
  const r = await db.getFirstAsync<{ best: number | null }>(
    'SELECT MAX(e1rm) AS best FROM sets WHERE exercise = ? AND id < ?', set.exercise, set.id,
  );
  return r?.best == null || set.e1rm > r.best;
}
