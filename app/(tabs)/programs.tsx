import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HelpLink } from '@/components/HelpLink';
import { Body, Button, Card, Eyebrow, H2, Hint, Row, Screen, Segmented, Title } from '@/components/ui';
import { space, useTheme } from '@/constants/theme';
import { activeProgram, endProgram, exportProgram, getJson, listProgramDays, setJson, type ProgramDay, type ProgramRow } from '@/lib/db';
import { EXPLORE_COACHES, EXPLORE_PROGRAMS, GOAL_LABEL, LEVEL_LABEL, SUBMIT_URL, type ExploreProgram } from '@/lib/explore';
import { FAMOUS } from '@/lib/famous';
import { DEFAULT_ANSWERS, generateProgram } from '@/lib/generator';
import { labelFor } from '@/lib/format';
import { PHASE_LABEL, phaseOfWeek } from '@/lib/meetprep';
import { setPendingTemplate } from '@/lib/pending';
import { useSettings } from '@/lib/settings';
import { decodeProgram, encodeProgram, toTemplate } from '@/lib/share';

/**
 * Programs = one tab for everything program-shaped.
 *   While a program is running, the tab IS that program (plus a way to reach a coach).
 *   Otherwise: Make (questionnaire, spreadsheet import, build your own, shared code, quick ready-made 2–6 days),
 *   Find (well-known programs + coach-made ones), Coaches (people taking clients).
 */
type View_ = 'make' | 'find' | 'coaches';
const LABEL: Record<View_, string> = { make: 'Make', find: 'Find', coaches: 'Coaches' };

export default function ProgramsScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const [program, setProgram] = useState<ProgramRow | null | 'loading'>('loading');
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [view, setView] = useState<View_>('make');
  const [coachesOverlay, setCoachesOverlay] = useState(false);          // "Find a coach" while a program is running
  const { view: wanted, t: stamp } = useLocalSearchParams<{ view?: string; t?: string }>();   // e.g. Rank tab → "Find a coach"
  useEffect(() => {
    if (wanted === 'coaches') { setView('coaches'); setCoachesOverlay(true); }
    else if (wanted === 'make' || wanted === 'find') { setView(wanted); setCoachesOverlay(false); }
  }, [wanted, stamp]);

  const refresh = useCallback(async () => {
    const p = await activeProgram(db);
    setProgram(p);
    setDays(p ? await listProgramDays(db, p.id) : []);
    if (!p) setCoachesOverlay(false);
  }, [db]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  if (program === 'loading') return <Screen style={{ paddingTop: insets.top + space.lg }}><View /></Screen>;

  // A program is running: the page IS the program. Nothing else to wander into, except a coach when asked for.
  if (program && !coachesOverlay) {
    const done = days.filter(d => d.session_id != null).length;
    return (
      <Screen style={{ paddingTop: insets.top + space.lg }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Eyebrow>{done} of {days.length} sessions done</Eyebrow>
            <Title>{program.name}</Title>
          </View>
          <HelpLink topic="programs" />
        </Row>
        <Mine program={program} days={days} refresh={refresh} onFindCoach={() => setCoachesOverlay(true)} />
      </Screen>
    );
  }

  if (program && coachesOverlay) {
    return (
      <Screen style={{ paddingTop: insets.top + space.lg }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Eyebrow>Taking clients</Eyebrow>
            <Title>Coaches</Title>
          </View>
          <HelpLink topic="programs" />
        </Row>
        <Button title="‹ Back to my program" kind="ghost" onPress={() => setCoachesOverlay(false)} />
        <Coaches />
      </Screen>
    );
  }

  return (
    <Screen style={{ paddingTop: insets.top + space.lg }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Make one · find one · find a coach</Eyebrow>
          <Title>Programs</Title>
        </View>
        <HelpLink topic="programs" />
      </Row>

      <Segmented<View_> options={['make', 'find', 'coaches']} value={view} onChange={setView} labels={v => LABEL[v]} />

      {view === 'make' ? <Make /> : null}
      {view === 'find' ? <Find /> : null}
      {view === 'coaches' ? <Coaches /> : null}

      {view === 'make' && settings.mode === 'meet' ? <Hint style={{ textAlign: 'center' }}>Meet mode: anything you make here is scaled to your meet date.</Hint> : null}
    </Screen>
  );
}

/* ---------- Mine: the program you are following ---------- */

function Mine({ program, days, refresh, onFindCoach }: { program: ProgramRow; days: ProgramDay[]; refresh: () => void; onFindCoach: () => void }) {
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
      ) : <Body muted>Every session is logged. Nice. Tap End program below to make or find the next one.</Body>}

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
      <Body muted style={{ fontSize: 12, textAlign: 'center' }}>Ending brings back Make and Find. Your log stays.</Body>
      <Pressable onPress={onFindCoach} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 6 }}><Text style={{ color: t.accent, fontWeight: '700', fontSize: 13 }}>Want a coach to run this with you? Find a coach ›</Text></Pressable>
    </>
  );
}

/* ---------- Make ---------- */

function Make() {
  const router = useRouter();
  const t = useTheme();
  const { settings } = useSettings();
  const [quickDays, setQuickDays] = useState(3);

  function startQuick() {
    setPendingTemplate(generateProgram({ ...DEFAULT_ANSWERS, mode: 'general', days: quickDays, weeks: 6 }));
    router.push({ pathname: '/program/start', params: { template: 'pending' } });
  }

  return (
    <>
      <Card style={{ borderColor: t.accent, borderWidth: 1.5, gap: 10 }}>
        <H2>Make me a program</H2>
        <Body muted style={{ fontSize: 14 }}>Eight quick questions — level, days, focus, what’s sore — and you get a program written for you{settings.mode === 'meet' ? ', scaled to your meet date' : ''}. Then you enter your bests and every weight is filled in.</Body>
        <Button title="Start the questions" onPress={() => router.push('/program/make')} />
      </Card>

      <Card style={{ gap: 8 }}>
        <H2>Got a program from your coach?</H2>
        <Body muted style={{ fontSize: 14 }}>Paste the Google Sheets link or pick the Excel file. The app reads the weeks, days, sets, reps and weights and lays it out the Weeks Out way — one tap to log each session.</Body>
        <Button title="Import a spreadsheet" onPress={() => router.push('/program/sheet')} />
      </Card>

      <Card style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <H2>Quick start</H2>
          <Eyebrow>6 weeks · {quickDays} days a week</Eyebrow>
        </Row>
        <Body muted style={{ fontSize: 13 }}>No questions. A sensible strength block for the days you have. Pick the days, tap Start.</Body>
        <Segmented<number> options={[2, 3, 4, 5, 6]} value={quickDays} onChange={setQuickDays} labels={v => `${v} days`} />
        <Button title="Start" kind="ghost" onPress={startQuick} />
      </Card>

      <Row>
        <Button title="Build your own" kind="ghost" onPress={() => router.push('/program/new')} style={{ flex: 1 }} />
        <Button title="Use a shared code" kind="ghost" onPress={() => router.push('/program/import')} style={{ flex: 1 }} />
      </Row>
    </>
  );
}

/* ---------- Find: well-known programs + coach-made ones ---------- */

type FindGoal = 'all' | 'strength' | 'hypertrophy' | 'meet-prep' | 'rehab';
type FindLevel = 'all' | 'beginner' | 'intermediate' | 'advanced';

function Find() {
  const router = useRouter();
  const t = useTheme();
  const [goal, setGoal] = useState<FindGoal>('all');
  const [level, setLevel] = useState<FindLevel>('all');
  const [days, setDays] = useState<number>(0);
  const [filters, setFilters] = useState(false);

  function startCoach(p: ExploreProgram) {
    if (p.template) { router.push({ pathname: '/program/start', params: { template: p.template } }); return; }
    if (p.code) {
      const shared = decodeProgram(p.code);
      if (shared) { setPendingTemplate(toTemplate(shared)); router.push({ pathname: '/program/start', params: { template: 'pending' } }); }
    }
  }

  const active = (goal !== 'all' ? 1 : 0) + (level !== 'all' ? 1 : 0) + (days !== 0 ? 1 : 0);
  const famous = FAMOUS.filter(p => (goal === 'all' || p.meta.goal === goal) && (level === 'all' || p.meta.level === level) && (days === 0 || p.daysPerWeek === days));
  const coachMade = EXPLORE_PROGRAMS.filter(p => (goal === 'all' || p.goal === goal) && (level === 'all' || p.level === level) && (days === 0 || p.daysPerWeek === days));

  return (
    <>
      <Row style={{ justifyContent: 'space-between' }}>
        <Body muted style={{ fontSize: 13, flex: 1 }}>{famous.length + coachMade.length} program{famous.length + coachMade.length === 1 ? '' : 's'} · all free</Body>
        <Pressable onPress={() => setFilters(f => !f)} hitSlop={8} accessibilityRole="button" style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: active ? t.accent : t.line, backgroundColor: active ? t.accentSoft : t.panel }}>
          <Text style={{ color: active ? t.accent : t.ink2, fontSize: 12, fontWeight: '700' }}>{filters ? 'Hide filters' : active ? `Filters · ${active}` : 'Filter'}</Text>
        </Pressable>
      </Row>
      {filters ? (
        <Card style={{ gap: 6 }}>
          <Segmented<FindGoal> options={['all', 'strength', 'hypertrophy', 'meet-prep', 'rehab']} value={goal} onChange={setGoal} labels={v => (v === 'all' ? 'Any goal' : GOAL_LABEL[v])} />
          <Segmented<FindLevel> options={['all', 'beginner', 'intermediate', 'advanced']} value={level} onChange={setLevel} labels={v => (v === 'all' ? 'Any level' : LEVEL_LABEL[v])} />
          <Segmented<number> options={[0, 2, 3, 4, 5, 6]} value={days} onChange={setDays} labels={v => (v === 0 ? 'Any days' : `${v} days`)} />
        </Card>
      ) : null}

      {coachMade.length > 0 ? <Eyebrow>From coaches on Weeks Out</Eyebrow> : null}
      {coachMade.map(p => (
        <Card key={p.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <H2 style={{ flexShrink: 1 }}>{p.name}</H2>
            <Text style={{ color: t.good, fontWeight: '800', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Free</Text>
          </Row>
          <Eyebrow>{LEVEL_LABEL[p.level]} · {GOAL_LABEL[p.goal]} · {p.weeks} wk · {p.daysPerWeek}×/wk · by {p.author}</Eyebrow>
          <Body muted>{p.blurb}</Body>
          <Button title="Start this program" onPress={() => startCoach(p)} />
          {p.coach ? <Button title={`Like it? Message @${p.coach} for coaching`} kind="ghost" onPress={() => Linking.openURL(`https://instagram.com/${p.coach}`)} /> : null}
        </Card>
      ))}

      {famous.length > 0 ? <Eyebrow>Well-known programs</Eyebrow> : null}
      {famous.map(p => (
        <Card key={p.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <H2 style={{ flexShrink: 1 }}>{p.name}</H2>
            <Eyebrow>{p.weeks} wk · {p.daysPerWeek}×/wk</Eyebrow>
          </Row>
          <Eyebrow>{LEVEL_LABEL[p.meta.level]} · {GOAL_LABEL[p.meta.goal]} · by {p.meta.author}</Eyebrow>
          <Body muted>{p.meta.blurb}</Body>
          <Button title="Start this program" onPress={() => router.push({ pathname: '/program/start', params: { template: p.id } })} />
        </Card>
      ))}
      {famous.length + coachMade.length === 0 ? <Body muted>Nothing matches those filters. Try fewer, or tap Make and the app writes one for you.</Body> : null}

      <Card style={{ borderStyle: 'dashed' }}>
        <H2>Coach? List your program here</H2>
        <Body muted>Build it in the app (or import your spreadsheet), tap Share this program for a code, and send the code with a name and a line about who it’s for. Lifters who start it see a “message you for coaching” button.</Body>
        <Button title="Submit a program" kind="ghost" onPress={() => Linking.openURL(SUBMIT_URL)} />
        <Hint>Well-known programs are the authors’ public methods, translated to percentages of your estimated 1RM. Paid programs are coming.</Hint>
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
