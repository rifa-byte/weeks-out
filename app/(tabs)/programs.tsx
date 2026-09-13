import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HelpLink } from '@/components/HelpLink';
import { Body, Button, Card, Eyebrow, H2, Hint, Row, Screen, Segmented, Title } from '@/components/ui';
import { space, useTheme } from '@/constants/theme';
import { activeProgram, endProgram, exportProgram, getJson, listProgramDays, setJson, type ProgramDay, type ProgramRow } from '@/lib/db';
import { EXPLORE_COACHES, EXPLORE_PROGRAMS, GOAL_LABEL, LEVEL_LABEL, SUBMIT_URL, type ExploreProgram } from '@/lib/explore';
import { labelFor } from '@/lib/format';
import { PHASE_LABEL, phaseOfWeek } from '@/lib/meetprep';
import { setPendingTemplate } from '@/lib/pending';
import { TEMPLATES } from '@/lib/programs';
import { useSettings } from '@/lib/settings';
import { decodeProgram, encodeProgram, toTemplate } from '@/lib/share';

/**
 * Programs = one tab for everything program-shaped:
 *   Mine    — the program you are following (only when you have one)
 *   Make    — the questionnaire, build your own, shared codes, ready-made templates
 *   Find    — programs other lifters and coaches have shared, with filters
 *   Coaches — people taking clients
 */
type View_ = 'mine' | 'make' | 'find' | 'coaches';
const LABEL: Record<View_, string> = { mine: 'Mine', make: 'Make', find: 'Find', coaches: 'Coaches' };

export default function ProgramsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [view, setView] = useState<View_ | null>(null);      // null = not chosen yet → follows whether a program exists

  const refresh = useCallback(async () => {
    const p = await activeProgram(db);
    setProgram(p);
    setDays(p ? await listProgramDays(db, p.id) : []);
    setView(v => (v === 'mine' && !p ? 'make' : v));
  }, [db]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const options: View_[] = program ? ['mine', 'make', 'find', 'coaches'] : ['make', 'find', 'coaches'];
  const current: View_ = view ?? (program ? 'mine' : 'make');

  return (
    <Screen style={{ paddingTop: insets.top + space.lg }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Eyebrow>{program ? `${days.filter(d => d.session_id != null).length} of ${days.length} sessions done` : 'Make one · find one · find a coach'}</Eyebrow>
          <Title>{program && current === 'mine' ? program.name : 'Programs'}</Title>
        </View>
        <HelpLink topic="programs" />
      </Row>

      <Segmented<View_> options={options} value={current} onChange={setView} labels={v => LABEL[v]} />

      {current === 'mine' && program ? <Mine program={program} days={days} refresh={refresh} /> : null}
      {current === 'make' ? <Make hasProgram={!!program} /> : null}
      {current === 'find' ? <Find /> : null}
      {current === 'coaches' ? <Coaches /> : null}

      {current === 'make' && settings.mode === 'meet' ? <Hint style={{ textAlign: 'center' }}>Meet mode: anything you make here is scaled to your meet date.</Hint> : null}
      <Text style={{ color: t.ink3, fontSize: 11, textAlign: 'center' }}>Tap {program ? 'Mine · ' : ''}Make · Find · Coaches at the top to switch.</Text>
    </Screen>
  );
}

/* ---------- Mine: the program you are following ---------- */

function Mine({ program, days, refresh }: { program: ProgramRow; days: ProgramDay[]; refresh: () => void }) {
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useTheme();
  const { fmt } = useSettings();
  const next = days.find(d => d.session_id == null);
  const weeks = Array.from({ length: program.weeks }, (_, i) => i + 1);

  async function share() {
    const author = await getJson<string>(db, 'shareName', '');
    if (!author && Alert.prompt) {
      Alert.prompt('Your name on the program', 'Shown to whoever you send it to. You can change it later.', async (v?: string) => {
        if (v?.trim()) await setJson(db, 'shareName', v.trim());
        doShare(v?.trim() || undefined);
      });
      return;
    }
    doShare(author || undefined);
  }
  async function doShare(author?: string) {
    const shared = await exportProgram(db, program.id, author);
    if (!shared) return;
    const code = encodeProgram(shared);
    await Share.share({ message: `${shared.name} — a Weeks Out program${author ? ` by ${author}` : ''}. In the app: Programs → Make → Use a shared code → paste this.\n\n${code}` });
  }
  function confirmEnd() {
    Alert.alert('End this program?', 'Your logged sessions stay in the log. You can start another program after.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End program', style: 'destructive', onPress: async () => { await endProgram(db, program.id); refresh(); } },
    ]);
  }

  return (
    <>
      {next ? (
        <View style={{ gap: 6 }}>
          <Button title={`Open next: week ${next.week} · ${next.name}`} onPress={() => router.push({ pathname: '/program/day/[id]', params: { id: String(next.id) } })} />
          <Hint style={{ textAlign: 'center' }}>Or tap any day below to see its sets.</Hint>
        </View>
      ) : <Body muted>Every session is logged. Nice. Make or find the next one at the top.</Body>}

      <View style={{ gap: space.sm }}>
        {weeks.map(w => {
          const wd = days.filter(d => d.week === w);
          return (
            <Card key={w} style={{ gap: space.sm }}>
              <Eyebrow>Week {w}{program.template_id.startsWith('meet-prep') ? ` · ${w === program.weeks ? 'meet week' : PHASE_LABEL[phaseOfWeek(program.weeks, w)].toLowerCase()}` : ''}</Eyebrow>
              <View style={{ gap: 6 }}>
                {wd.map(d => {
                  const isDone = d.session_id != null;
                  const isNext = next?.id === d.id;
                  return (
                    <Pressable
                      key={d.id}
                      onPress={() => router.push({ pathname: '/program/day/[id]', params: { id: String(d.id) } })}
                      accessibilityRole="button"
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8,
                        backgroundColor: isNext ? t.accentSoft : t.panelAlt, opacity: pressed ? 0.7 : 1,
                      })}>
                      <Row>
                        <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: isDone ? t.good : isNext ? t.accent : t.line, backgroundColor: isDone ? t.good : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                          {isDone ? <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✓</Text> : null}
                        </View>
                        <Text style={{ color: isDone ? t.ink3 : t.ink, fontWeight: '600', fontSize: 15 }}>{d.name}</Text>
                      </Row>
                      <Row>
                        <Text style={{ color: t.ink3, fontSize: 13 }}>{summarize(d, fmt)}</Text>
                        <Text style={{ color: t.accent, fontSize: 18, fontWeight: '700' }}>›</Text>
                      </Row>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          );
        })}
      </View>

      <Button title="Share this program (send a code)" kind="ghost" onPress={share} />
      <Body muted style={{ fontSize: 12, textAlign: 'center' }}>Your friend pastes the code under Programs → Make → Use a shared code. Weights are worked out from their bests, not yours.</Body>
      <Button title="End program" kind="ghost" onPress={confirmEnd} />
    </>
  );
}

/* ---------- Make ---------- */

function Make({ hasProgram }: { hasProgram: boolean }) {
  const router = useRouter();
  const t = useTheme();
  const { settings } = useSettings();
  return (
    <>
      <Card style={{ borderColor: t.accent, borderWidth: 1.5, gap: 10 }}>
        <H2>Make me a program</H2>
        <Body muted style={{ fontSize: 14 }}>Eight quick questions — level, days, focus, what’s sore — and you get a program written for you{settings.mode === 'meet' ? ', scaled to your meet date' : ''}. Then you enter your bests and every weight is filled in.</Body>
        <Button title="Start the questions" onPress={() => router.push('/program/make')} />
        {hasProgram ? <Hint>Starting a new program ends the one you are on. Your log stays.</Hint> : null}
      </Card>

      <Row>
        <Button title="Build your own" kind="ghost" onPress={() => router.push('/program/new')} style={{ flex: 1 }} />
        <Button title="Use a shared code" kind="ghost" onPress={() => router.push('/program/import')} style={{ flex: 1 }} />
      </Row>

      <Eyebrow style={{ marginTop: 4 }}>Ready-made</Eyebrow>
      {TEMPLATES.filter(p => !p.id.startsWith('meet-prep')).map(p => (
        <Card key={p.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <H2 style={{ flexShrink: 1 }}>{p.name}</H2>
            <Eyebrow>{p.weeks} wk · {p.daysPerWeek}×/wk</Eyebrow>
          </Row>
          <Body muted>{p.who}</Body>
          <Button title="Start" kind="ghost" onPress={() => router.push({ pathname: '/program/start', params: { template: p.id } })} />
        </Card>
      ))}
    </>
  );
}

/* ---------- Find: programs shared by lifters and coaches ---------- */

function Find() {
  const router = useRouter();
  const t = useTheme();
  const [goal, setGoal] = useState<ExploreProgram['goal'] | 'all'>('all');
  const [level, setLevel] = useState<ExploreProgram['level'] | 'all'>('all');
  const [days, setDays] = useState<number>(0);
  const [filters, setFilters] = useState(false);

  function start(p: ExploreProgram) {
    if (p.template) { router.push({ pathname: '/program/start', params: { template: p.template } }); return; }
    if (p.code) {
      const shared = decodeProgram(p.code);
      if (shared) { setPendingTemplate(toTemplate(shared)); router.push({ pathname: '/program/start', params: { template: 'pending' } }); }
    }
  }

  const active = (goal !== 'all' ? 1 : 0) + (level !== 'all' ? 1 : 0) + (days !== 0 ? 1 : 0);
  const programs = EXPLORE_PROGRAMS.filter(p => (goal === 'all' || p.goal === goal) && (level === 'all' || p.level === level) && (days === 0 || p.daysPerWeek === days));

  return (
    <>
      <Row style={{ justifyContent: 'space-between' }}>
        <Body muted style={{ fontSize: 13, flex: 1 }}>{programs.length} program{programs.length === 1 ? '' : 's'} · all free for now</Body>
        <Pressable onPress={() => setFilters(f => !f)} hitSlop={8} accessibilityRole="button" style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: active ? t.accent : t.line, backgroundColor: active ? t.accentSoft : t.panel }}>
          <Text style={{ color: active ? t.accent : t.ink2, fontSize: 12, fontWeight: '700' }}>{filters ? 'Hide filters' : active ? `Filters · ${active}` : 'Filter'}</Text>
        </Pressable>
      </Row>
      {filters ? (
        <Card style={{ gap: 6 }}>
          <Segmented<ExploreProgram['goal'] | 'all'> options={['all', 'strength', 'meet-prep', 'hypertrophy', 'rehab']} value={goal} onChange={setGoal} labels={v => (v === 'all' ? 'Any goal' : GOAL_LABEL[v])} />
          <Segmented<ExploreProgram['level'] | 'all'> options={['all', 'beginner', 'intermediate', 'advanced']} value={level} onChange={setLevel} labels={v => (v === 'all' ? 'Any level' : LEVEL_LABEL[v])} />
          <Segmented<number> options={[0, 2, 3, 4, 5, 6]} value={days} onChange={setDays} labels={v => (v === 0 ? 'Any days' : `${v} days`)} />
        </Card>
      ) : null}

      {programs.length === 0 ? <Body muted>Nothing matches those filters yet. Try fewer filters, or tap Make at the top and the app writes one for you.</Body> : null}
      {programs.map(p => (
        <Card key={p.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <H2 style={{ flexShrink: 1 }}>{p.name}</H2>
            <Text style={{ color: t.good, fontWeight: '800', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Free</Text>
          </Row>
          <Eyebrow>{LEVEL_LABEL[p.level]} · {GOAL_LABEL[p.goal]} · {p.weeks} wk · {p.daysPerWeek}×/wk · by {p.author}</Eyebrow>
          <Body muted>{p.blurb}</Body>
          <Button title="Start this program" onPress={() => start(p)} />
          {p.coach ? <Button title={`Like it? Message @${p.coach} for coaching`} kind="ghost" onPress={() => Linking.openURL(`https://instagram.com/${p.coach}`)} /> : null}
        </Card>
      ))}

      <Card style={{ borderStyle: 'dashed' }}>
        <H2>Share yours</H2>
        <Body muted>Built something that works? Mine → Share this program gives you a code. Send the code with a name and a line about who it’s for and it goes on this list.</Body>
        <Button title="Submit a program" kind="ghost" onPress={() => Linking.openURL(SUBMIT_URL)} />
        <Hint>Paid programs are coming — for now everything here is free.</Hint>
      </Card>
    </>
  );
}

/* ---------- Coaches ---------- */

function Coaches() {
  const t = useTheme();
  return (
    <>
      {EXPLORE_COACHES.map(c => (
        <Card key={c.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <H2 style={{ flexShrink: 1 }}>{c.name}</H2>
            {c.spots ? <Text style={{ color: c.spots === 'open' ? t.good : t.ink3, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>{c.spots === 'open' ? 'Taking clients' : c.spots}</Text> : null}
          </Row>
          <Eyebrow>{c.location}{c.federations?.length ? ` · ${c.federations.join(', ')}` : ''} · {c.price}</Eyebrow>
          <Body muted>{c.about}</Body>
          <Row style={{ flexWrap: 'wrap' }}>
            {c.offers.map(o => (
              <View key={o} style={{ backgroundColor: t.panelAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: t.ink2, fontSize: 12, fontWeight: '600' }}>{o}</Text>
              </View>
            ))}
          </Row>
          <Button title={`Message @${c.handle} on Instagram`} onPress={() => Linking.openURL(`https://instagram.com/${c.handle}`)} />
        </Card>
      ))}
      <Card style={{ borderStyle: 'dashed' }}>
        <H2>Coach lifters?</H2>
        <Body muted>Get listed here. Say what you offer, where you are, and how people reach you. No fees, no cut — the app just makes the introduction.</Body>
        <Button title="Get listed" kind="ghost" onPress={() => Linking.openURL(SUBMIT_URL)} />
      </Card>
      <Body muted style={{ fontSize: 12, textAlign: 'center' }}>Payments and applications inside the app come later. For now it’s a DM.</Body>
    </>
  );
}

function summarize(d: ProgramDay, fmt: (kg: number) => string) {
  const main = d.sets.filter(s => s.weightKg != null);
  if (main.length === 0) return `${d.sets.length} movements`;
  const top = main.reduce((a, b) => (b.weightKg! > a.weightKg! ? b : a));
  return `${labelFor(top.exercise)} ${fmt(top.weightKg!)}×${top.reps}`;
}
