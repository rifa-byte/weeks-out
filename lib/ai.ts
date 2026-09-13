/**
 * Client side of the AI generator. Talks to /api/generate on the app's own server
 * (EXPO_PUBLIC_GENERATOR_URL). Falls back to the built-in generator when the server
 * is not configured, offline, slow, or returns something unusable.
 */
import { expandAiProgram, type AiProgram } from './ai-schema';
import { generateProgram, type Answers } from './generator';
import type { Template } from './programs';

export const GENERATOR_URL = (process.env.EXPO_PUBLIC_GENERATOR_URL || '').replace(/\/$/, '');

export function aiConfigured(): boolean {
  return GENERATOR_URL.length > 0;
}

export interface GenerationResult {
  template: Template & { why?: string };
  source: 'ai' | 'local';
  note?: string;           // why we fell back, in plain words
}

export async function generate(answers: Answers, opts: { timeoutMs?: number } = {}): Promise<GenerationResult> {
  if (!aiConfigured()) return { template: generateProgram(answers), source: 'local', note: 'AI not set up yet — built-in generator used.' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 45000);
  try {
    const res = await fetch(`${GENERATOR_URL}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.program) {
      return { template: generateProgram(answers), source: 'local', note: data.error || `Server said ${res.status}` };
    }
    return { template: expandAiProgram(data.program as AiProgram, answers), source: 'ai' };
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? 'The AI took too long' : 'No connection';
    return { template: generateProgram(answers), source: 'local', note: `${msg} — built-in generator used.` };
  } finally {
    clearTimeout(timer);
  }
}
