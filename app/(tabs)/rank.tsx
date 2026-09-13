import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HelpLink } from '@/components/HelpLink';
import { Body, Button, Card, Divider, Dot, Eyebrow, Field, H2, Hint, Num, Row, Screen, Segmented, TapRow, Title } from '@/components/ui';
import { liftColor, space, useTheme } from '@/constants/theme';
import { bestByLift, getJson, listFailEvents, setJson } from '@/lib/db';
import { FAIL_LABEL, FAIL_POSITIONS, askACoach, buildMap, fixFor, headline, type FailEvent } from '@/lib/failmap';
import { formatDate, parseNum } from '@/lib/format';
import { dots, ipfClass, ipfGL, LIFTS, LIFT_LABEL, type Lift } from '@/lib/math';
import {
  EQUIP_LABEL, OPL_ATTRIBUTION, classesIn, comboKey, fetchCountries, fetchLadder, fetchMeta, percentile, placeLabel, rankOf, searchLifters,
  type Equip, type Ladder, type Lifter, type LifterEntry, type OplMeta,
} from '@/lib/opl';
import { useSettings } from '@/lib/settings';

/**
 * Rank — the tab no other lifting app has.
 *   Where you stand: your numbers against OpenPowerlifting — search any lifter, compare, see where your total lands.
 *   Where you fail:  the Fail Map — where your reps die, and what fixes it.
 */
type Seg = 'stand' | 'fail';

export default function RankScreen() {
  const insets = useSafeAreaInsets();
  const [seg, setSeg] = useState<Seg>('stand');
  return (
    <Screen style={{ paddingTop: insets.top + space.lg }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Eyebrow>{seg === 'stand' ? 'You vs the world' : 'Sticking points'}</Eyebrow>
          <Title>{seg === 'stand' ? 'Where you stand' : 'Where you fail'}</Title>
        </View>
        <HelpLink topic="rank" />
      </Row>
      <Segmented<Seg> options={['stand', 'fail']} value={seg} onChange={setSeg} labels={v => (v === 'stand' ? 'Where you stand' : 'Where you fail')} />
      {seg === 'stand' ? <Stand /> : <Fail />}
    </Screen>
  );
}

/* ================= Where you stand ================= */

function Stand() {
  const db = useSQLiteContext();
  const t = useTheme();
  const { settings, set, fmt, unit, toKg } = useSettings();
  const [best, setBest] = useState<Record<Lift, number | null>>({ squat: null, bench: null, deadlift: null });
  const [totalText, setTotalText] = useState('');
  const [editBody, setEditBody] = useState(false);
  const [bwText, setBwText] = useState('');
  useEffect(() => { setBwText(fmt(settings.bodyweightKg, settings.units === 'lb' ? 0 : 1)); }, [settings.bodyweightKg, settings.units, fmt]);
  const [eq, setEq] = useState<Equip>('raw');
  const [meta, setMeta] = useState<OplMeta | null | 'loading' | 'error'>('loading');

  useFocusEffect(useCallback(() => { bestByLift(db).then(setBest); }, [db]));
  useEffect(() => { fetchMeta().then(m => setMeta(m)).catch(() => setMeta('error')); }, []);

  const sumBest = LIFTS.every(l => best[l] != null) ? LIFTS.reduce((s, l) => s + (best[l] ?? 0), 0) : null;
  const typed = parseNum(totalText);
  const total = typed && typed > 0 ? toKg(typed) : sumBest;
  const bw = settings.bodyweightKg;
  const sex = settings.sex;
  const cls = ipfClass(bw, sex);
  const myDots = total ? dots(total, bw, sex) : null;
  const myGL = total ? ipfGL(total, bw, sex, 'SBD', eq === 'raw' || eq === 'wraps' ? 'raw' : 'equipped') : null;
  const me: LifterEntry | null = total ? { eq, total, dots: myDots, gl: myGL, squat: best.squat, bench: best.bench, deadlift: best.deadlift, bw, cls, date: '', meet: 'your log', fed: '' } : null;

  return (
    <>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Eyebrow>Your numbers</Eyebrow>
          <Pressable onPress={() => setEditBody(e => !e)} hitSlop={8}><Text style={{ color: t.accent, fontSize: 12, fontWeight: '700' }}>{sex === 'M' ? 'Men' : 'Women'} · {cls} kg class · {fmt(bw)} {unit} · {editBody ? 'done' : 'change'}</Text></Pressable>
        </Row>
        {editBody ? (
          <Row style={{ alignItems: 'flex-end' }}>
            <Field label={`Bodyweight (${unit})`} value={bwText} onChangeText={setBwText} onBlur={() => { const n = parseNum(bwText); if (n && n > 0) set('bodyweightKg', Math.round(toKg(n) * 100) / 100); }} keyboardType="decimal-pad" />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: t.ink3, fontSize: 12, fontWeight: '600' }}>Sex</Text>
              <Segmented<'M' | 'F'> options={['M', 'F']} value={sex} onChange={v => set('sex', v)} labels={v => (v === 'M' ? 'Men' : 'Women')} />
            </View>
          </Row>
        ) : null}
        <Row style={{ justifyContent: 'space-between' }}>
          {LIFTS.map(l => (
            <View key={l} style={{ flex: 1 }}>
              <Row><Dot color={liftColor[l]} /><Body muted style={{ fontSize: 12 }}>{LIFT_LABEL[l]}</Body></Row>
              <Num size={22}>{fmt(best[l])}</Num>
            </View>
          ))}
          <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
            <Body muted style={{ fontSize: 12 }}>Total</Body>
            <Num size={22} color={t.accent}>{total ? fmt(total) : '—'}</Num>
          </View>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <View><Body muted style={{ fontSize: 12 }}>DOTS</Body><Num size={20}>{myDots ? myDots.toFixed(1) : '—'}</Num></View>
          <View><Body muted style={{ fontSize: 12 }}>IPF GL</Body><Num size={20}>{myGL ? myGL.toFixed(1) : '—'}</Num></View>
          <Field label={`Or type a total (${unit})`} value={totalText} onChangeText={setTotalText} keyboardType="decimal-pad" placeholder={sumBest ? fmt(sumBest) : 'e.g. 500'} containerStyle={{ flex: 0, width: 150 }} />
        </Row>
        <Segmented<Equip> options={['raw', 'wraps', 'single', 'multi']} value={eq} onChange={setEq} labels={v => EQUIP_LABEL[v]} />
        <Hint>{sumBest ? 'Total = your best estimated 1RMs added up. Type a total to try a goal instead.' : 'Log one set of each lift (or type a total) and this fills in.'} Tap the line at the top right to set your bodyweight.</Hint>
      </Card>

      {meta === 'loading' ? <Row style={{ justifyContent: 'center' }}><ActivityIndicator color={t.accent} /><Body muted>Checking the OpenPowerlifting index…</Body></Row>
        : meta === 'error' ? <Card><Body>Could not reach the OpenPowerlifting index. Check your connection and try again.</Body></Card>
        : meta === null ? <NotBuilt />
        : (
          <>
            <SearchLifters me={me} sex={sex} />
            <Ladder me={me} sex={sex} eq={eq} defaultClass={cls} />
            <Body muted style={{ fontSize: 11, textAlign: 'center' }}>{OPL_ATTRIBUTION} · index built {formatDate(meta.built)} · {meta.lifters.toLocaleString()} lifters{meta.source === 'openipf' ? ' (IPF affiliates)' : ''}</Body>
          </>
        )}
    </>
  );
}

function NotBuilt() {
  return (
    <Card style={{ borderStyle: 'dashed' }}>
      <H2>OpenPowerlifting search is not switched on yet</H2>
      <Body muted>The app reads a small index built from OpenPowerlifting’s public-domain data. It has not been published for this version yet. Once it is, you can search any lifter, compare, and see where your total lands — right here.</Body>
      <Hint>Developer: run `npm run opl:build`, commit `public/opl/`, push.</Hint>
    </Card>
  );
}

function SearchLifters({ me, sex }: { me: LifterEntry | null; sex: 'M' | 'F' }) {
  const t = useTheme();
  const { fmt, unit } = useSettings();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Lifter[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<Lifter | null>(null);
  const [pickedEq, setPickedEq] = useState<Equip | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    let alive = true;
    const h = setTimeout(async () => {
      setBusy(true); setErr(null);
      try { const r = await searchLifters(term); if (alive) setResults(r); }
      catch (e) { if (alive) setErr(e instanceof Error ? e.message : 'Search failed'); }
      finally { if (alive) setBusy(false); }
    }, 350);
    return () => { alive = false; clearTimeout(h); };
  }, [q]);

  const entry = picked ? (picked.entries.find(e => e.eq === (pickedEq ?? me?.eq)) ?? picked.entries[0]) : null;

  return (
    <Card>
      <Eyebrow>Search any lifter</Eyebrow>
      <Field value={q} onChangeText={v => { setQ(v); setPicked(null); setPickedEq(null); }} placeholder="Type a name, e.g. Taylor Atwood" autoCapitalize="words" autoCorrect={false} />
      {busy ? <ActivityIndicator color={t.accent} /> : null}
      {err ? <Text style={{ color: t.danger, fontSize: 13 }}>{err}</Text> : null}
      {!picked && q.trim().length >= 2 && !busy && results.length === 0 && !err ? <Body muted style={{ fontSize: 13 }}>No one by that name in the index. Try the surname only.</Body> : null}
      {!picked ? results.slice(0, 12).map(l => (
        <TapRow key={l.name} title={l.name} subtitle={`${l.sex === 'M' ? 'M' : 'F'}${l.country ? ` · ${l.country}` : ''} · best ${fmt(l.entries[0].total)} ${unit} ${EQUIP_LABEL[l.entries[0].eq].toLowerCase()} · ${l.meets} meet${l.meets === 1 ? '' : 's'} · last ${formatDate(l.last)}`} onPress={() => { setPicked(l); setPickedEq(null); }} />
      )) : null}

      {picked && entry ? (
        <View style={{ gap: space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <H2 style={{ flexShrink: 1 }}>{picked.name}</H2>
            <Pressable onPress={() => setPicked(null)} hitSlop={8}><Text style={{ color: t.accent, fontWeight: '700', fontSize: 13 }}>Back to results</Text></Pressable>
          </Row>
          <Body muted style={{ fontSize: 13 }}>Best {EQUIP_LABEL[entry.eq].toLowerCase()} total: {entry.meet}, {formatDate(entry.date)}{entry.bw ? ` · ${fmt(entry.bw)} ${unit} bodyweight` : ''} · {entry.cls} kg class{entry.fed ? ` · ${entry.fed}` : ''}</Body>
          {picked.entries.length > 1 ? <Segmented<Equip> options={picked.entries.map(e => e.eq)} value={entry.eq} onChange={setPickedEq} labels={v => EQUIP_LABEL[v]} /> : null}
          <Compare me={me} them={entry} sameSex={picked.sex === sex} />
        </View>
      ) : null}
      {!picked ? <Hint>Tap a name to compare their best meet with your numbers.</Hint> : null}
    </Card>
  );
}

function Compare({ me, them, sameSex }: { me: LifterEntry | null; them: LifterEntry; sameSex: boolean }) {
  const t = useTheme();
  const { fmt, unit } = useSettings();
  const rows: { label: string; mine: number | null; theirs: number | null; fmt: (n: number) => string }[] = [
    { label: 'Squat', mine: me?.squat ?? null, theirs: them.squat, fmt: n => `${fmt(n)}` },
    { label: 'Bench', mine: me?.bench ?? null, theirs: them.bench, fmt: n => `${fmt(n)}` },
    { label: 'Deadlift', mine: me?.deadlift ?? null, theirs: them.deadlift, fmt: n => `${fmt(n)}` },
    { label: `Total (${unit})`, mine: me?.total ?? null, theirs: them.total, fmt: n => `${fmt(n)}` },
    { label: 'DOTS', mine: me?.dots ?? null, theirs: them.dots, fmt: n => n.toFixed(1) },
    { label: 'IPF GL', mine: me?.gl ?? null, theirs: them.gl, fmt: n => n.toFixed(1) },
  ];
  return (
    <View style={{ backgroundColor: t.panelAlt, borderRadius: 8, padding: 10 }}>
      <Row style={{ justifyContent: 'space-between', paddingBottom: 6 }}>
        <View style={{ flex: 1.2 }} />
        <Body muted style={{ fontSize: 12, flex: 1, textAlign: 'right' }}>You</Body>
        <Body muted style={{ fontSize: 12, flex: 1, textAlign: 'right' }}>Them</Body>
        <Body muted style={{ fontSize: 12, flex: 1, textAlign: 'right' }}>Gap</Body>
      </Row>
      {rows.map((r, i) => {
        const gap = r.mine != null && r.theirs != null ? r.mine - r.theirs : null;
        return (
          <View key={r.label}>
            {i > 0 ? <Divider /> : null}
            <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={{ color: t.ink, fontWeight: '700', fontSize: 14, flex: 1.2 }}>{r.label}</Text>
              <Text style={{ color: t.ink, fontSize: 14, flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{r.mine != null ? r.fmt(r.mine) : '—'}</Text>
              <Text style={{ color: t.ink, fontSize: 14, flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{r.theirs != null ? r.fmt(r.theirs) : '—'}</Text>
              <Text style={{ color: gap == null ? t.ink3 : gap >= 0 ? t.good : t.danger, fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{gap == null ? '—' : `${gap >= 0 ? '+' : '−'}${r.fmt(Math.abs(gap))}`}</Text>
            </Row>
          </View>
        );
      })}
      {!sameSex ? <Body muted style={{ fontSize: 11, paddingTop: 6 }}>Different sex category — compare DOTS or IPF GL rather than kilos.</Body> : null}
      {!me ? <Body muted style={{ fontSize: 11, paddingTop: 6 }}>Log your lifts (or type a total above) to fill in your column.</Body> : null}
    </View>
  );
}

function Ladder({ me, sex, eq, defaultClass }: { me: LifterEntry | null; sex: 'M' | 'F'; eq: Equip; defaultClass: string }) {
  const db = useSQLiteContext();
  const t = useTheme();
  const { fmt, unit } = useSettings();
  const [scope, setScope] = useState<string>('world');
  const [countries, setCountries] = useState<{ name: string; file: string }[]>([]);
  const [countryQ, setCountryQ] = useState('');
  const [pickCountry, setPickCountry] = useState(false);
  const [ladder, setLadder] = useState<Ladder | null | 'loading'>('loading');
  const [cls, setCls] = useState<string | null>(null);

  useEffect(() => { getJson<string>(db, 'oplScope', 'world').then(setScope); fetchCountries().then(setCountries).catch(() => {}); }, [db]);
  useEffect(() => {
    let alive = true;
    setLadder('loading');
    fetchLadder(scope).then(l => { if (alive) setLadder(l); }).catch(() => { if (alive) setLadder(null); });
    return () => { alive = false; };
  }, [scope]);

  const classes = useMemo(() => (ladder && ladder !== 'loading' ? classesIn(ladder, sex, eq) : []), [ladder, sex, eq]);
  const useCls = cls && classes.includes(cls) ? cls : classes.includes(defaultClass) ? defaultClass : classes[0] ?? null;
  const combo = ladder && ladder !== 'loading' && useCls ? ladder[comboKey(sex, eq, useCls)] : null;
  const total = me?.total ?? null;

  function chooseScope(s: string) { setScope(s); setPickCountry(false); setCountryQ(''); setJson(db, 'oplScope', s); }
  const countryMatches = countries.filter(c => c.name.toLowerCase().includes(countryQ.toLowerCase())).slice(0, 8);

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Eyebrow>Where your total lands</Eyebrow>
        <Pressable onPress={() => setPickCountry(p => !p)} hitSlop={8}><Text style={{ color: t.accent, fontWeight: '700', fontSize: 13 }}>{scope === 'world' ? 'World · change' : `${scope} · change`}</Text></Pressable>
      </Row>
      {pickCountry ? (
        <View style={{ gap: 6 }}>
          <Row><Button title="World" kind={scope === 'world' ? 'primary' : 'ghost'} onPress={() => chooseScope('world')} /><Field value={countryQ} onChangeText={setCountryQ} placeholder="or type a country, e.g. Singapore" autoCorrect={false} /></Row>
          {countryQ ? countryMatches.map(c => <TapRow key={c.file} title={c.name} subtitle="meets held here, last 2 years" onPress={() => chooseScope(c.name)} />) : null}
          {countryQ && countryMatches.length === 0 ? <Body muted style={{ fontSize: 13 }}>No meets from that country in the index.</Body> : null}
        </View>
      ) : null}

      {classes.length > 0 ? <Segmented<string> options={classes} value={useCls} onChange={setCls} labels={v => `${v}`} /> : null}

      {ladder === 'loading' ? <ActivityIndicator color={t.accent} />
        : !combo ? <Body muted>No {sex === 'M' ? 'men’s' : 'women’s'} {EQUIP_LABEL[eq].toLowerCase()} results for {scope === 'world' ? 'the world' : scope} in the last two years.</Body>
        : (
          <>
            {total ? (
              <View style={{ gap: 2 }}>
                <Num size={30} color={t.accent}>Top {Math.max(1, 100 - percentile(combo, total))}%</Num>
                <Body>A {fmt(total)} {unit} total ranks about <Text style={{ fontWeight: '800' }}>{rankOf(combo, total)} of {combo.n}</Text> {sex === 'M' ? 'men' : 'women'} who totalled {EQUIP_LABEL[eq].toLowerCase()} in the {useCls} kg class{scope === 'world' ? ' worldwide' : ` at meets in ${scope}`} in the last two years.</Body>
                <Body muted style={{ fontSize: 12 }}>Best total per lifter, all ages and divisions together — so this is stricter than a placing in your own division.</Body>
              </View>
            ) : <Body muted>Log your lifts or type a total above and this tells you where it lands.</Body>}

            {combo.meets && combo.meets.length > 0 && total ? (
              <View style={{ gap: 4 }}>
                <Eyebrow>Recent meets in {scope}</Eyebrow>
                {combo.meets.slice(0, 6).map(m => (
                  <Row key={`${m.date}${m.meet}`} style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.ink, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{m.meet}</Text>
                      <Body muted style={{ fontSize: 12 }}>{formatDate(m.date)} · {m.fed} · {m.n} in class · winner {fmt(m.podium[0])}</Body>
                    </View>
                    <Text style={{ color: placeLabel(m, total).startsWith('1st') ? t.good : t.ink, fontWeight: '800', fontSize: 14 }}>{placeLabel(m, total)}</Text>
                  </Row>
                ))}
                <Body muted style={{ fontSize: 11 }}>Where your total would have placed in that class at that meet.</Body>
              </View>
            ) : null}

            <View style={{ gap: 2 }}>
              <Eyebrow>Top of the class{scope === 'world' ? ' (world)' : ` (${scope})`}</Eyebrow>
              {combo.top.slice(0, 10).map((x, i) => (
                <Row key={x.name} style={{ justifyContent: 'space-between', paddingVertical: 3 }}>
                  <Text style={{ color: t.ink3, width: 24, fontVariant: ['tabular-nums'] }}>{i + 1}</Text>
                  <Text style={{ color: t.ink, flex: 1, fontWeight: '600' }} numberOfLines={1}>{x.name}</Text>
                  <Text style={{ color: t.ink, fontVariant: ['tabular-nums'], fontWeight: '700' }}>{fmt(x.total)}</Text>
                  <Text style={{ color: t.ink3, fontSize: 12, width: 52, textAlign: 'right' }}>{x.dots ? x.dots.toFixed(0) : ''} DOTS</Text>
                </Row>
              ))}
            </View>
            <Pressable onPress={() => Linking.openURL('https://www.openpowerlifting.org')}><Body muted style={{ fontSize: 11, textAlign: 'center' }}>Full history for any lifter: openpowerlifting.org</Body></Pressable>
          </>
        )}
    </Card>
  );
}

/* ================= Where you fail ================= */

function Fail() {
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useTheme();
  const { fmt, unit } = useSettings();
  const [weeks, setWeeks] = useState<4 | 8 | 12>(8);
  const [events, setEvents] = useState<FailEvent[]>([]);
  const since = new Date(Date.now() - weeks * 7 * 86400e3).toISOString().slice(0, 10);

  useFocusEffect(useCallback(() => { listFailEvents(db, since).then(setEvents); }, [db, since]));
  const map = useMemo(() => buildMap(events), [events]);
  const any = events.length > 0;

  return (
    <>
      <Row style={{ justifyContent: 'space-between' }}>
        <Body muted style={{ fontSize: 13 }}>Last</Body>
        <Segmented<4 | 8 | 12> options={[4, 8, 12]} value={weeks} onChange={setWeeks} labels={v => `${v} weeks`} />
      </Row>
      {!any ? (
        <Card style={{ borderColor: t.accent, borderWidth: 1.5 }}>
          <H2>Nothing on the map yet</H2>
          <Body muted>When a rep slows down or stops, log where. In a session, after you tap the RPE, tap <Text style={{ fontWeight: '700', color: t.ink }}>where it stuck</Text> — out of the hole, halfway, lockout — and whether you missed it. A few sets later this page shows your sticking point for each lift and what fixes it.</Body>
          <Hint>Every app knows how much you lift. This is the one that knows where you fail.</Hint>
        </Card>
      ) : null}
      {LIFTS.map(lift => {
        const m = map[lift];
        const max = Math.max(1, ...FAIL_POSITIONS.map(p => m.byPos[p]));
        const fix = m.worst ? fixFor(lift, m.worst) : null;
        const recent = events.filter(e => e.lift === lift).slice(0, 3);
        return (
          <Card key={lift} style={{ gap: space.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row><Dot color={liftColor[lift]} /><H2>{LIFT_LABEL[lift]}</H2></Row>
              {m.events ? <Eyebrow>{m.events} stuck · {m.misses} missed</Eyebrow> : null}
            </Row>
            <Body style={{ fontSize: 14 }}>{headline(m, weeks)}</Body>
            {m.events ? (
              <View style={{ gap: 6 }}>
                {FAIL_POSITIONS.map(p => (
                  <Row key={p}>
                    <Text style={{ color: p === m.worst ? t.ink : t.ink3, fontWeight: p === m.worst ? '800' : '600', fontSize: 13, width: 110 }}>{FAIL_LABEL[lift][p]}</Text>
                    <View style={{ flex: 1, height: 14, borderRadius: 7, backgroundColor: t.panelAlt, overflow: 'hidden' }}>
                      <View style={{ width: `${(100 * m.byPos[p]) / max}%`, height: '100%', backgroundColor: p === m.worst ? liftColor[lift] : t.line }} />
                    </View>
                    <Text style={{ color: t.ink2, fontSize: 13, width: 22, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{m.byPos[p]}</Text>
                  </Row>
                ))}
              </View>
            ) : null}
            {fix && m.worst ? (
              <>
                <View style={{ backgroundColor: t.panelAlt, borderRadius: 8, padding: 10, gap: 6 }}>
                  <Eyebrow>What that usually means</Eyebrow>
                  <Body style={{ fontSize: 14 }}>{fix.why}</Body>
                  <Eyebrow>Try on the next set</Eyebrow>
                  {fix.cues.map(c => <Body key={c} style={{ fontSize: 14 }}>· {c}</Body>)}
                </View>
                <View style={{ gap: 4 }}>
                  <Eyebrow>Variations that attack it</Eyebrow>
                  <Row style={{ flexWrap: 'wrap' }}>
                    {fix.exercises.map(e => <Chip key={e.id} text={`${e.name} · ~${Math.round(e.factor * 100)}%`} strong />)}
                  </Row>
                  <Eyebrow>Muscles to build</Eyebrow>
                  <Row style={{ flexWrap: 'wrap' }}>
                    {fix.accessories.map(e => <Chip key={e.id} text={e.name} />)}
                  </Row>
                  <Hint>Swap one of these into your program: open the day, tap “Change this day”, then Swap.</Hint>
                </View>
                {askACoach(m) ? (
                  <View style={{ gap: 6 }}>
                    <Body style={{ fontSize: 14 }}>This keeps happening. A coach watching one video of you would fix it faster than any variation.</Body>
                    <Button title="Find a coach" onPress={() => router.push({ pathname: '/(tabs)/programs', params: { view: 'coaches', t: String(Date.now()) } })} />
                  </View>
                ) : null}
              </>
            ) : null}
            {recent.length ? (
              <View style={{ gap: 2 }}>
                <Eyebrow>Latest</Eyebrow>
                {recent.map((e, i) => <Body key={i} muted style={{ fontSize: 12 }}>{formatDate(e.date)} · {fmt(e.weightKg)} {unit} × {e.reps}{e.rpe != null ? ` @ ${e.rpe}` : ''} · {e.missed ? 'missed' : 'stuck'} {FAIL_LABEL[lift][e.pos].toLowerCase()}</Body>)}
              </View>
            ) : null}
          </Card>
        );
      })}
      <Body muted style={{ fontSize: 11, textAlign: 'center' }}>Coaching heuristics, not medical advice. Pain is a different problem — see a professional.</Body>
    </>
  );
}

function Chip({ text, strong }: { text: string; strong?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: strong ? t.ink : t.panelAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text style={{ color: strong ? t.ground : t.ink2, fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}
