import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import * as XLSX from 'xlsx';

import { Body, Button, Card, Divider, Dot, Eyebrow, Field, H2, Hint, Row, Screen, Title } from '@/components/ui';
import { liftColor, useTheme } from '@/constants/theme';
import { parentOf } from '@/lib/exercises';
import { labelFor } from '@/lib/format';
import { setPendingTemplate } from '@/lib/pending';
import { useSettings } from '@/lib/settings';
import { toTemplate } from '@/lib/share';
import { parseSheets, sheetsExportUrl, type ParsedProgram, type SheetInput } from '@/lib/sheet';

/**
 * A coach's spreadsheet → a Weeks Out program.
 * Three ways in: a Google Sheets link (shared "anyone with the link"), an Excel / CSV file from the phone,
 * or cells copied straight out of the Sheets app and pasted here.
 */
export default function SheetImportScreen() {
  const router = useRouter();
  const t = useTheme();
  const { settings, fmt, unit } = useSettings();
  const [link, setLink] = useState('');
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedProgram | null>(null);
  const [name, setName] = useState('');

  function finish(sheets: SheetInput[], fallbackName: string) {
    const p = parseSheets(sheets, { units: settings.units, name: fallbackName });
    if (!p) { setErr('Could not find any sets in there. The app looks for rows like “Squat · 4 · 5 · 140” — an exercise name with sets, reps and a weight or %. Try pasting just the program cells.'); return; }
    setParsed(p); setName(p.name); setErr(null);
  }
  function fromWorkbook(wb: XLSX.WorkBook, fallbackName: string) {
    const sheets: SheetInput[] = wb.SheetNames.map(n => ({ name: n, grid: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }) as SheetInput['grid'] }));
    finish(sheets, fallbackName);
  }

  async function readLink() {
    const url = sheetsExportUrl(link);
    if (!url) { setErr('That doesn’t look like a Google Sheets link. It should start with docs.google.com/spreadsheets/…'); return; }
    setBusy('Reading your sheet…'); setErr(null);
    try {
      const res = await fetch(url);
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || type.includes('text/html')) throw new Error('private');
      const buf = await res.arrayBuffer();
      fromWorkbook(XLSX.read(new Uint8Array(buf), { type: 'array' }), 'Coach’s program');
    } catch (e) {
      setErr(e instanceof Error && e.message === 'private'
        ? 'Google says this sheet is private. In Google Sheets tap Share → “Anyone with the link” → Viewer, then try again. Or download it as Excel and pick the file below.'
        : 'Could not download that sheet. Check the link and your connection.');
    } finally { setBusy(null); }
  }

  async function pickFile() {
    setErr(null);
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text', '*/*'] });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    setBusy('Reading the file…');
    try {
      const b64 = await new File(a.uri).base64();
      fromWorkbook(XLSX.read(b64, { type: 'base64' }), a.name ?? 'Coach’s program');
    } catch { setErr('Could not read that file. Excel (.xlsx) and CSV work best.'); }
    finally { setBusy(null); }
  }

  function readPasted() {
    setErr(null);
    if (!pasted.trim()) return;
    try { fromWorkbook(XLSX.read(pasted, { type: 'string' }), 'Pasted program'); }
    catch { setErr('Could not read the pasted cells.'); }
  }

  function start() {
    if (!parsed) return;
    setPendingTemplate(toTemplate({ name: name.trim() || parsed.name, weeks: parsed.weeks, daysPerWeek: parsed.daysPerWeek, days: parsed.days, about: 'From your coach’s spreadsheet' }, `sheet:${Date.now()}`));
    router.replace({ pathname: '/program/start', params: { template: 'pending' } });
  }

  if (parsed) {
    const w1 = parsed.days.slice(0, parsed.daysPerWeek);
    return (
      <>
        <Stack.Screen options={{ title: 'Check it over' }} />
        <Screen>
          <View>
            <Eyebrow>{parsed.weeks} weeks · {parsed.daysPerWeek} days a week</Eyebrow>
            <Title>Here’s what the app read</Title>
            <Body muted>Have a quick look at week 1. Anything off, you can fix after starting: open the day, tap “Change this day”.</Body>
          </View>
          <Field label="Program name" value={name} onChangeText={setName} />
          <Card style={{ gap: 4 }}>
            {parsed.notes.map(n => <Body key={n} style={{ fontSize: 14 }}>· {n}</Body>)}
            {parsed.unmatched.length ? <Hint>Movements the library doesn’t know are kept with the coach’s wording and log fine — they just won’t get plate maths or a % of your lifts.</Hint> : null}
          </Card>

          <Eyebrow>Week 1</Eyebrow>
          {w1.map((d, i) => (
            <Card key={i} style={{ gap: 0, paddingVertical: 6 }}>
              <H2 style={{ fontSize: 16, paddingBottom: 4 }}>{d.name}</H2>
              {d.sets.length === 0 ? <Body muted style={{ fontSize: 13 }}>Rest</Body> : d.sets.map((s, j) => {
                const parent = parentOf(s.exercise);
                return (
                  <View key={j}>
                    {j > 0 ? <Divider /> : null}
                    <Row style={{ paddingVertical: 6, justifyContent: 'space-between' }}>
                      <Row style={{ flex: 1 }}><Dot color={parent ? liftColor[parent] : t.ink3} size={8} /><Text style={{ color: t.ink, fontSize: 14, fontWeight: '600', flexShrink: 1 }}>{labelFor(s.exercise)}{s.note ? <Text style={{ color: t.ink3, fontWeight: '400' }}> · {s.note}</Text> : null}</Text></Row>
                      <Text style={{ color: t.ink2, fontSize: 13, fontVariant: ['tabular-nums'] }}>{s.sets}×{s.reps}{s.fixedKg != null ? ` @ ${fmt(s.fixedKg)} ${unit}` : s.pct != null ? ` @ ${Math.round(s.pct * 100)}%` : ''}{s.rpe != null ? ` · RPE ${s.rpe}` : ''}</Text>
                    </Row>
                  </View>
                );
              })}
            </Card>
          ))}

          <Button title="Looks right — start it" onPress={start} />
          <Hint style={{ textAlign: 'center' }}>{parsed.days.some(d => d.sets.some(s => s.pct != null && s.fixedKg == null)) ? 'Next you enter your bests for the % lines.' : 'Weights are exactly as your coach wrote them.'}</Hint>
          <Button title="Try a different sheet" kind="ghost" onPress={() => { setParsed(null); setErr(null); }} />
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Import a spreadsheet' }} />
      <Screen>
        <View>
          <Eyebrow>From your coach</Eyebrow>
          <Title>Bring in a spreadsheet</Title>
          <Body muted>Google Sheets or Excel, laid out however your coach likes. The app finds the weeks, days, sets, reps and weights and shows them the Weeks Out way.</Body>
        </View>

        <Card style={{ gap: 8 }}>
          <H2>Google Sheets link</H2>
          <Field value={link} onChangeText={setLink} placeholder="Paste the link (docs.google.com/spreadsheets/…)" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <Button title="Read the sheet" onPress={readLink} disabled={!link.trim() || !!busy} style={{ opacity: link.trim() && !busy ? 1 : 0.4 }} />
          <Hint>The sheet needs to be shared as “Anyone with the link” (Share button in Sheets). Every tab is read.</Hint>
        </Card>

        <Card style={{ gap: 8 }}>
          <H2>Excel or CSV file</H2>
          <Body muted style={{ fontSize: 13 }}>From Files, WhatsApp, email — anywhere on your phone.</Body>
          <Button title="Pick a file" kind="ghost" onPress={pickFile} disabled={!!busy} />
        </Card>

        <Card style={{ gap: 8 }}>
          <H2>Or paste the cells</H2>
          <Body muted style={{ fontSize: 13 }}>In the Sheets or Excel app, select the program cells, copy, and paste here. Works for private sheets.</Body>
          <Field value={pasted} onChangeText={setPasted} placeholder="Paste here" multiline style={{ minHeight: 90, textAlignVertical: 'top', fontSize: 13 }} autoCapitalize="none" autoCorrect={false} />
          <Button title="Read what I pasted" kind="ghost" onPress={readPasted} disabled={!pasted.trim() || !!busy} style={{ opacity: pasted.trim() && !busy ? 1 : 0.4 }} />
        </Card>

        {busy ? <Row style={{ justifyContent: 'center' }}><ActivityIndicator color={t.accent} /><Body muted>{busy}</Body></Row> : null}
        {err ? <Card style={{ borderColor: t.danger, borderWidth: 1 }}><Body>{err}</Body></Card> : null}
        <Body muted style={{ fontSize: 12, textAlign: 'center' }}>Reads layouts like “Week 1 / Day 1 / Exercise · Sets · Reps · Weight · RPE”, tables with Week and Day columns, one tab per week, or weeks across the top. Weights in lb are converted.</Body>
      </Screen>
    </>
  );
}
