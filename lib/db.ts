import type { SQLiteDatabase } from 'expo-sqlite';
import { e1rm, type Lift, type PlateSetId, type Sex } from './math';
import { resolveProgram, type Bests, type ResolvedSet, type Template } from './programs';
import type { SharedProgram } from './share';

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
    CREATE TABLE IF NOT EXISTS programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id TEXT NOT NULL,
      name TEXT NOT NULL,
      weeks INTEGER NOT NULL,
      days_per_week INTEGER NOT NULL,
      bests_json TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT
    );
    CREATE TABLE IF NOT EXISTS program_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
      week INTEGER NOT NULL,
      day INTEGER NOT NULL,
      name TEXT NOT NULL,
      plan_json TEXT NOT NULL,
      session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_program_days_program ON program_days(program_id);
    CREATE TABLE IF NOT EXISTS bodyweight (
      date TEXT PRIMARY KEY,          -- ISO yyyy-mm-dd, one entry per day
      kg REAL NOT NULL
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
  plateSet: PlateSetId;   // what the gym you're in actually has
  barKg: number;          // bar weight for plate maths
  restSeconds: number;    // rest timer target
  mode: 'meet' | 'general';   // meet: Meet tab + weeks-out header; general: just train
}

export const DEFAULT_SETTINGS: Settings = {
  units: 'kg',
  sex: 'M',
  bodyweightKg: 83,
  meetDate: '2026-11-07',
  meetName: 'My meet',
  plateSet: 'gym-kg',
  barKg: 20,
  restSeconds: 180,
  mode: 'general',
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
    else if (r.key === 'plateSet') out.plateSet = (['ipf', 'gym-kg', 'gym-lb'] as PlateSetId[]).includes(r.value as PlateSetId) ? (r.value as PlateSetId) : DEFAULT_SETTINGS.plateSet;
    else if (r.key === 'barKg') out.barKg = Number(r.value) || DEFAULT_SETTINGS.barKg;
    else if (r.key === 'restSeconds') out.restSeconds = Number(r.value) || DEFAULT_SETTINGS.restSeconds;
    else if (r.key === 'mode') out.mode = r.value === 'meet' ? 'meet' : 'general';
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
  await db.runAsync('UPDATE program_days SET session_id = NULL WHERE session_id = ?', id);
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

// ---------- programs ----------

export interface ProgramRow { id: number; template_id: string; name: string; weeks: number; days_per_week: number; bests_json: string; started_at: string; ended_at: string | null }
export interface ProgramDayRow { id: number; program_id: number; week: number; day: number; name: string; plan_json: string; session_id: number | null }
export interface ProgramDay extends Omit<ProgramDayRow, 'plan_json'> { sets: ResolvedSet[] }

export async function activeProgram(db: SQLiteDatabase): Promise<ProgramRow | null> {
  return db.getFirstAsync<ProgramRow>('SELECT * FROM programs WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1');
}

export async function startProgram(db: SQLiteDatabase, template: Template, bests: Bests): Promise<number> {
  const days = resolveProgram(template, bests);
  let programId = 0;
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE programs SET ended_at = datetime('now') WHERE ended_at IS NULL");
    const r = await db.runAsync(
      'INSERT INTO programs(template_id, name, weeks, days_per_week, bests_json) VALUES (?, ?, ?, ?, ?)',
      template.id, template.name, template.weeks, template.daysPerWeek, JSON.stringify(bests),
    );
    programId = r.lastInsertRowId;
    for (const d of days) {
      await db.runAsync(
        'INSERT INTO program_days(program_id, week, day, name, plan_json) VALUES (?, ?, ?, ?, ?)',
        programId, d.week, d.day, d.name, JSON.stringify(d.sets),
      );
    }
  });
  return programId;
}

export async function endProgram(db: SQLiteDatabase, id: number) {
  await db.runAsync("UPDATE programs SET ended_at = datetime('now') WHERE id = ?", id);
}

const parseDay = (r: ProgramDayRow): ProgramDay => {
  const { plan_json, ...rest } = r;
  return { ...rest, sets: JSON.parse(plan_json) as ResolvedSet[] };
};

export async function listProgramDays(db: SQLiteDatabase, programId: number): Promise<ProgramDay[]> {
  const rows = await db.getAllAsync<ProgramDayRow>('SELECT * FROM program_days WHERE program_id = ? ORDER BY week, day', programId);
  return rows.map(parseDay);
}

export async function getProgramDay(db: SQLiteDatabase, id: number): Promise<ProgramDay | null> {
  const r = await db.getFirstAsync<ProgramDayRow>('SELECT * FROM program_days WHERE id = ?', id);
  return r ? parseDay(r) : null;
}

/** Create a log session pre-filled with the day's planned sets, and link it to the day. */
export async function logProgramDay(db: SQLiteDatabase, day: ProgramDay): Promise<number> {
  const sessionId = await createSession(db);
  await db.withTransactionAsync(async () => {
    for (const s of day.sets) {
      if (s.weightKg == null) continue; // accessories and meet-day attempts are logged by hand
      for (let i = 0; i < s.sets; i++) {
        await addSet(db, { sessionId, exercise: s.exercise, weightKg: s.weightKg, reps: s.reps, rpe: s.rpe ?? null });
      }
    }
    await db.runAsync('UPDATE program_days SET session_id = ? WHERE id = ?', sessionId, day.id);
  });
  return sessionId;
}

/** Sessions deleted from the log should unlink from their program day. */
export async function unlinkSession(db: SQLiteDatabase, sessionId: number) {
  await db.runAsync('UPDATE program_days SET session_id = NULL WHERE session_id = ?', sessionId);
}

// ---------- exercise history ----------
export interface LastTime { date: string; session_id: number; sets: { weight_kg: number; reps: number; rpe: number | null; e1rm: number }[] }

/** The most recent session (other than `excludeSessionId`) that contains this exercise, with its sets. */
export async function lastTimeFor(db: SQLiteDatabase, exercise: string, excludeSessionId: number): Promise<LastTime | null> {
  const s = await db.getFirstAsync<{ id: number; date: string }>(
    `SELECT s.id, s.date FROM sessions s
     WHERE s.id != ? AND EXISTS (SELECT 1 FROM sets WHERE session_id = s.id AND exercise = ?)
     ORDER BY s.date DESC, s.id DESC LIMIT 1`, excludeSessionId, exercise,
  );
  if (!s) return null;
  const sets = await db.getAllAsync<{ weight_kg: number; reps: number; rpe: number | null; e1rm: number }>(
    'SELECT weight_kg, reps, rpe, e1rm FROM sets WHERE session_id = ? AND exercise = ? ORDER BY id', s.id, exercise,
  );
  return { date: s.date, session_id: s.id, sets };
}

export async function bestFor(db: SQLiteDatabase, exercise: string): Promise<number | null> {
  const r = await db.getFirstAsync<{ best: number | null }>('SELECT MAX(e1rm) AS best FROM sets WHERE exercise = ?', exercise);
  return r?.best ?? null;
}

// ---------- program editing ----------
export async function updateProgramDayPlan(db: SQLiteDatabase, dayId: number, sets: ResolvedSet[]) {
  await db.runAsync('UPDATE program_days SET plan_json = ? WHERE id = ?', JSON.stringify(sets), dayId);
}

export async function nextProgramDay(db: SQLiteDatabase): Promise<{ program: ProgramRow; day: ProgramDay; done: number; total: number } | null> {
  const program = await activeProgram(db);
  if (!program) return null;
  const days = await listProgramDays(db, program.id);
  const day = days.find(d => d.session_id == null);
  if (!day) return null;
  return { program, day, done: days.filter(d => d.session_id != null).length, total: days.length };
}

// ---------- bodyweight ----------
export interface BodyweightRow { date: string; kg: number }

export async function listBodyweight(db: SQLiteDatabase, limit = 60): Promise<BodyweightRow[]> {
  return db.getAllAsync<BodyweightRow>('SELECT date, kg FROM bodyweight ORDER BY date DESC LIMIT ?', limit);
}

export async function setBodyweight(db: SQLiteDatabase, date: string, kg: number) {
  await db.runAsync('INSERT INTO bodyweight(date, kg) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET kg = excluded.kg', date, kg);
}

export async function deleteBodyweight(db: SQLiteDatabase, date: string) {
  await db.runAsync('DELETE FROM bodyweight WHERE date = ?', date);
}

// ---------- free-form JSON settings (meet plan, attempts) ----------
export async function getJson<T>(db: SQLiteDatabase, key: string, fallback: T): Promise<T> {
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  if (!r) return fallback;
  try { return JSON.parse(r.value) as T; } catch { return fallback; }
}

export async function setJson(db: SQLiteDatabase, key: string, value: unknown) {
  await db.runAsync('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, JSON.stringify(value));
}

// ---------- sharing ----------

/** The active program as a shareable shape: weights stripped, percentages kept. */
export async function exportProgram(db: SQLiteDatabase, programId: number, author?: string): Promise<SharedProgram | null> {
  const p = await db.getFirstAsync<ProgramRow>('SELECT * FROM programs WHERE id = ?', programId);
  if (!p) return null;
  const days = await listProgramDays(db, programId);
  return {
    name: p.name,
    author,
    weeks: p.weeks,
    daysPerWeek: p.days_per_week,
    days: days.map(d => ({
      name: d.name,
      sets: d.sets.map(({ weightKg: _w, ...rest }) => rest),
    })),
  };
}

/** Copy one day's plan onto the same day number in every other week of the program. */
export async function applyDayToAllWeeks(db: SQLiteDatabase, day: ProgramDay) {
  await db.runAsync(
    'UPDATE program_days SET plan_json = ?, name = ? WHERE program_id = ? AND day = ? AND id != ? AND session_id IS NULL',
    JSON.stringify(day.sets), day.name, day.program_id, day.day, day.id,
  );
}

export async function renameProgramDay(db: SQLiteDatabase, dayId: number, name: string) {
  await db.runAsync('UPDATE program_days SET name = ? WHERE id = ?', name, dayId);
}
