#!/usr/bin/env node
/**
 * Weeks Out — build the in-app OpenPowerlifting index.
 *
 * OpenPowerlifting puts its competition data in the public domain and asks people to use the
 * bulk download instead of scraping the website. This script does exactly that: it downloads
 * the bulk CSV (IPF affiliates by default, or everything), streams it once, and writes a set of
 * small static JSON files the app fetches on demand:
 *
 *   public/opl/meta.json                 when it was built, how many lifters, which source
 *   public/opl/lifters/{aa}.json         name search shards (first two letters of each word of the name)
 *   public/opl/ladders/index.json        list of countries that have a ladder file
 *   public/opl/ladders/world.json        per sex / equipment / weight class: histogram of totals (last 2 years), top 20
 *   public/opl/ladders/{Country}.json    same, for meets held in that country, plus recent meets with podium totals
 *
 * Usage (from the repo root):
 *   node scripts/opl-build.mjs                  IPF affiliates, lifters active since 2016
 *   node scripts/opl-build.mjs --source all     every federation (bigger: ~3x the files)
 *   node scripts/opl-build.mjs --since 2019     only lifters with a result since 2019
 *   node scripts/opl-build.mjs --file x.zip     use an already-downloaded zip
 *
 * Attribution the app shows: "Data from the OpenPowerlifting project, https://www.openpowerlifting.org".
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import yauzl from 'yauzl';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : [])).filter(x => x.length));
const SOURCE = args.source === 'all' ? 'openpowerlifting' : 'openipf';
const SINCE = String(args.since || '2016');
const OUT = path.resolve(args.out || 'public/opl');
const URL_ = `https://openpowerlifting.gitlab.io/opl-csv/files/${SOURCE}-latest.zip`;
const ZIP = args.file ? path.resolve(String(args.file)) : path.resolve(`.opl-cache/${SOURCE}-latest.zip`);
const TODAY = new Date().toISOString().slice(0, 10);
const WINDOW_START = new Date(Date.now() - 730 * 86400e3).toISOString().slice(0, 10);   // 2 years for ladders
const EQUIP = { Raw: 'raw', Wraps: 'wraps', 'Single-ply': 'single', 'Multi-ply': 'multi', Unlimited: 'multi' };
const STEP = 2.5;

async function download() {
  if (fs.existsSync(ZIP)) { console.log(`Using ${ZIP}`); return; }
  fs.mkdirSync(path.dirname(ZIP), { recursive: true });
  console.log(`Downloading ${URL_} …`);
  const res = await fetch(URL_);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  await pipeline(res.body, fs.createWriteStream(ZIP));
  console.log(`Saved ${ZIP} (${(fs.statSync(ZIP).size / 1e6).toFixed(0)} MB)`);
}

function openCsvStream() {
  return new Promise((resolve, reject) => {
    yauzl.open(ZIP, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      zip.readEntry();
      zip.on('entry', entry => {
        if (!entry.fileName.endsWith('.csv')) { zip.readEntry(); return; }
        zip.openReadStream(entry, (e, stream) => (e ? reject(e) : resolve(stream)));
      });
      zip.on('end', () => reject(new Error('No CSV inside the zip')));
    });
  });
}

/** RFC-4180-ish line parser: handles quoted fields with commas and doubled quotes. */
function parseLine(line) {
  if (!line.includes('"')) return line.split(',');
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function normalizeName(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/#\d+$/, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
export function shardKeys(normalized) {
  const keys = new Set();
  for (const w of normalized.split(' ')) if (w.length) keys.add((w + '_').slice(0, 2).replace(/[^a-z0-9]/g, '_'));
  return [...keys];
}

function num(s) { const n = parseFloat(s); return Number.isFinite(n) ? n : null; }

async function build() {
  await download();
  const stream = await openCsvStream();
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let header = null; let col = {}; let rows = 0;

  /** name -> { sex, country, entries: { eq -> best entry }, last } */
  const lifters = new Map();
  /** scope -> combo -> { totals: number[] (best per lifter), top: [], meets: Map } */
  const ladders = new Map();

  function ladder(scope, combo) {
    let s = ladders.get(scope); if (!s) { s = new Map(); ladders.set(scope, s); }
    let c = s.get(combo); if (!c) { c = { best: new Map(), meets: new Map() }; s.set(combo, c); }
    return c;
  }

  for await (const line of rl) {
    if (!header) { header = parseLine(line); header.forEach((h, i) => (col[h] = i)); continue; }
    if (!line) continue;
    const f = parseLine(line);
    rows++;
    if (rows % 500000 === 0) console.log(`  ${rows.toLocaleString()} rows…`);
    const event = f[col.Event]; if (event !== 'SBD') continue;
    const total = num(f[col.TotalKg]); if (!total) continue;
    const place = f[col.Place]; if (place === 'DQ' || place === 'DD' || place === 'NS' || place === 'G') continue;
    const date = f[col.Date]; if (!date || date < SINCE) continue;
    const eq = EQUIP[f[col.Equipment]]; if (!eq) continue;
    const name = f[col.Name]; const sex = f[col.Sex]; if (sex !== 'M' && sex !== 'F') continue;
    const bw = num(f[col.BodyweightKg]); const cls = f[col.WeightClassKg];
    const s = num(f[col.Best3SquatKg]), b = num(f[col.Best3BenchKg]), d = num(f[col.Best3DeadliftKg]);
    const dots = num(f[col.Dots]), gl = num(f[col.Goodlift]);
    const meet = f[col.MeetName]; const fed = f[col.Federation]; const mc = f[col.MeetCountry]; const country = f[col.Country];

    // lifters index: best total per equipment
    let L = lifters.get(name);
    if (!L) { L = { sex, country: country || '', entries: {}, last: date, n: 0 }; lifters.set(name, L); }
    L.n++; if (date > L.last) L.last = date; if (!L.country && country) L.country = country;
    const prev = L.entries[eq];
    if (!prev || total > prev[1]) L.entries[eq] = [eq, total, dots, gl, s, b, d, bw, cls, date, meet, fed];

    // ladders (last 2 years only)
    if (date < WINDOW_START || !cls) continue;
    const combo = `${sex}-${eq}-${cls}`;
    for (const scope of ['world', mc || 'Unknown']) {
      const c = ladder(scope, combo);
      const pb = c.best.get(name);
      if (!pb || total > pb.total) c.best.set(name, { name, total, dots, gl, bw, date, meet });
      if (scope !== 'world') {
        const mk = `${date}|${meet}`;
        let m = c.meets.get(mk); if (!m) { m = { meet, date, fed, n: 0, totals: [] }; c.meets.set(mk, m); }
        m.n++; m.totals.push(total);
      }
    }
  }
  console.log(`Read ${rows.toLocaleString()} rows → ${lifters.size.toLocaleString()} lifters`);

  // ---- write lifters shards ----
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'lifters'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'ladders'), { recursive: true });
  const shards = new Map();
  for (const [name, L] of lifters) {
    const entries = Object.values(L.entries).sort((a, b) => b[1] - a[1]);
    const row = [name, L.sex, L.country, L.n, L.last, entries];
    for (const k of shardKeys(normalizeName(name))) { let a = shards.get(k); if (!a) { a = []; shards.set(k, a); } a.push(row); }
  }
  for (const [k, a] of shards) fs.writeFileSync(path.join(OUT, 'lifters', `${k}.json`), JSON.stringify(a));

  // ---- write ladders ----
  const countries = [];
  for (const [scope, combos] of ladders) {
    const out = {};
    for (const [combo, c] of combos) {
      const totals = [...c.best.values()].map(x => x.total).sort((a, b) => a - b);
      const min = Math.floor(totals[0] / STEP) * STEP;
      const bins = Math.floor((totals[totals.length - 1] - min) / STEP) + 1;
      const counts = new Array(bins).fill(0);
      for (const t of totals) counts[Math.floor((t - min) / STEP)]++;
      const top = [...c.best.values()].sort((a, b) => b.total - a.total).slice(0, 20).map(x => [x.name, x.total, x.dots, x.gl, x.bw, x.date, x.meet]);
      const meets = [...c.meets.values()].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 40)
        .map(m => [m.meet, m.date, m.fed, m.n, m.totals.sort((a, b) => b - a).slice(0, 3)]);
      out[combo] = { n: totals.length, min, step: STEP, counts, top, ...(scope === 'world' ? {} : { meets }) };
    }
    const file = scope === 'world' ? 'world' : scope.replace(/[^A-Za-z0-9 _-]/g, '');
    fs.writeFileSync(path.join(OUT, 'ladders', `${file}.json`), JSON.stringify(out));
    if (scope !== 'world') countries.push({ name: scope, file });
  }
  countries.sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(path.join(OUT, 'ladders', 'index.json'), JSON.stringify(countries));
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ built: TODAY, source: SOURCE, since: SINCE, window: WINDOW_START, lifters: lifters.size, shards: shards.size, countries: countries.length, attribution: 'Data from the OpenPowerlifting project, https://www.openpowerlifting.org' }));

  const bytes = dirSize(OUT);
  console.log(`Wrote ${shards.size} lifter shards, ${countries.length + 1} ladder files → ${OUT} (${(bytes / 1e6).toFixed(1)} MB)`);
}

function dirSize(p) {
  let n = 0;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) { const f = path.join(p, e.name); n += e.isDirectory() ? dirSize(f) : fs.statSync(f).size; }
  return n;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch(e => { console.error(e); process.exit(1); });
}
