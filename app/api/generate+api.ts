/**
 * POST /api/generate — asks Claude for a program shaped by the questionnaire.
 * Runs on EAS Hosting (deploy with `eas deploy`). The API key lives in the
 * ANTHROPIC_API_KEY environment variable on the server, never in the app.
 */
import { AI_TOOL, expandAiProgram, systemPrompt, userPrompt, type AiProgram } from '@/lib/ai-schema';
import type { Answers } from '@/lib/generator';

const MODEL = process.env.GENERATOR_MODEL || 'claude-haiku-4-5';

export async function POST(request: Request): Promise<Response> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: 'The AI generator is not configured yet (no ANTHROPIC_API_KEY). The app will use its built-in generator.' }, 503);

  let answers: Answers;
  try { answers = (await request.json()).answers as Answers; } catch { return json({ error: 'Bad request' }, 400); }
  if (!answers || !answers.days || !answers.weeks) return json({ error: 'Missing answers' }, 400);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      temperature: 0.4,
      system: systemPrompt(),
      tools: [AI_TOOL],
      tool_choice: { type: 'tool', name: AI_TOOL.name },
      messages: [{ role: 'user', content: userPrompt(answers) }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return json({ error: `Model request failed (${res.status}). ${text.slice(0, 200)}` }, 502);
  }
  const data = await res.json() as { content?: { type: string; name?: string; input?: unknown }[]; usage?: unknown };
  const call = data.content?.find(c => c.type === 'tool_use' && c.name === AI_TOOL.name);
  if (!call?.input) return json({ error: 'The model did not return a program.' }, 502);

  // Validate on the server too, so a bad answer never reaches the phone.
  try { expandAiProgram(call.input as AiProgram, answers); } catch (e) { return json({ error: (e as Error).message }, 502); }
  return json({ program: call.input, usage: data.usage, model: MODEL });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
