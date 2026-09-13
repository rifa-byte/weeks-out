/**
 * End-to-end: the files scripts/opl-build.mjs writes must be exactly what lib/opl.ts expects.
 * fixtures/opl was produced by running the script on fixtures/openipf-sample.zip (synthetic rows,
 * real column layout). If you change either side, regenerate:
 *   node scripts/opl-build.mjs --file lib/__tests__/fixtures/openipf-sample.zip --out lib/__tests__/fixtures/opl
 */
import fs from 'fs';
import path from 'path';

import { _resetCache, classesIn, fetchCountries, fetchLadder, fetchMeta, OPL_URL, percentile, placeLabel, searchLifters } from '../opl';

const FIX = path.join(__dirname, 'fixtures', 'opl');

beforeAll(() => {
  _resetCache();
  (global as unknown as { fetch: unknown }).fetch = async (url: string) => {
    const rel = decodeURIComponent(url.replace(`${OPL_URL}/`, ''));
    const file = path.join(FIX, rel);
    if (!fs.existsSync(file)) return { ok: false, status: 404, json: async () => null };
    return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) };
  };
});

describe('script output ↔ client', () => {
  test('meta', async () => {
    const m = await fetchMeta();
    expect(m?.source).toBe('openipf');
    expect(m?.lifters).toBe(11);
  });
  test('search by first name, surname, accent-free, and #2 disambiguation', async () => {
    const byFirst = await searchLifters('taylor');
    expect(byFirst.map(l => l.name)).toEqual(['Taylor Atwood']);
    const bySurname = await searchLifters('atwood');
    expect(bySurname[0].name).toBe('Taylor Atwood');
    expect(bySurname[0].entries[0].total).toBeGreaterThan(0);
    expect(bySurname[0].entries[0].squat).not.toBeNull();
    const accent = await searchLifters('jesus');
    expect(accent[0].name).toBe('Jesús Olivares');
    const rif = await searchLifters('rif tan');
    expect(rif.map(l => l.name).sort()).toEqual(['Rif Tan', 'Rif Tan #2']);
    const apostrophe = await searchLifters("o'brien");
    expect(apostrophe[0].name).toBe("Adam O'Brien");
    expect(await searchLifters('zzzz')).toEqual([]);
  });
  test('ladders: world + countries, classes, percentile and placings', async () => {
    const countries = await fetchCountries();
    expect(countries.map(c => c.name)).toContain('Singapore');
    const world = await fetchLadder('world');
    expect(world).not.toBeNull();
    const mClasses = classesIn(world!, 'M', 'raw');
    expect(mClasses.length).toBeGreaterThan(0);
    const combo = world![`M-raw-${mClasses[0]}`];
    expect(combo.counts.reduce((a, b) => a + b, 0)).toBe(combo.n);
    expect(percentile(combo, 10000)).toBe(100);
    expect(combo.meets).toBeUndefined();
    const sg = await fetchLadder('Singapore');
    const sgCombo = Object.values(sg!)[0];
    expect(sgCombo.meets!.length).toBeGreaterThan(0);
    const m = sgCombo.meets![0];
    expect(placeLabel(m, m.podium[0] + 1)).toBe('1st');
    expect(await fetchLadder('Atlantis')).toBeNull();
  });
});
