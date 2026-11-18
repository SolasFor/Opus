'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML_PATH = path.resolve(__dirname, '../SolarSystem.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

function loadPureSolar() {
  const m = html.match(/\/\* @pure-solar-start \*\/([\s\S]*?)\/\* @pure-solar-end \*\//);
  assert.ok(m, 'Missing @pure-solar-start / @pure-solar-end block in SolarSystem.html');
  const ctx = { Date, Math, Number, String, isFinite };
  vm.runInNewContext(
    m[1] + '\nObject.assign(this, { TAU, DEG, AU_KM, U_AU, U_KM, C_KMS, J2000_MS, KIRKWOOD, SOLAR_KEPLER, dateToJ2000Days, j2000DaysToDate, formatISODateUTC, formatRuDateUTC, keplerSolve, keplerOrbitPoint, keplerPos3D, discCoverJS, sampleBeltAU, fmtSig, fmtNum, fmtKm, fmtFactor, fmtLight });',
    ctx
  );
  return ctx;
}

const pure = loadPureSolar();

test('SolarSystem.html main script compiles cleanly without syntax errors', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length >= 1, 'Expected inline script in SolarSystem.html');
  const mainScript = scripts[scripts.length - 1][1];
  assert.doesNotThrow(() => new vm.Script(mainScript));
});

test('Offline fonts & required interactive HUD elements + LF line endings', () => {
  assert.equal(/\r\n/.test(html), false, 'SolarSystem.html must use LF line endings');
  assert.equal(/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html), false, 'No external Google Fonts links');
  assert.equal(/\b(Inter|Unbounded)\b/.test(html), false, 'No Inter or Unbounded font names');
  for (const id of [
    'timeBar', 'dateLabel', 'rateBtn', 'dateInput', 'todayBtn',
    'eventsBtn', 'eventsMenu', 'lineupButton', 'missionsToggle',
    'signalBtn', 'signalStatus', 'scEarth', 'scEarthRow'
  ]) {
    assert.ok(html.includes('id="' + id + '"'), 'Missing HUD element #' + id);
  }
});

test('BAKE_FS PLANET shader branches match build() jobs list completely', () => {
  const bakeBlockMatch = html.match(/const BAKE_FS = NOISE \+ `([\s\S]*?)const bakeScene/);
  assert.ok(bakeBlockMatch, 'Missing BAKE_FS block');
  const planetIds = new Set([...bakeBlockMatch[1].matchAll(/#(?:el)?if PLANET == (\d+)/g)].map((m) => Number(m[1])));

  const jobsMatch = html.match(/const jobs = \[([\s\S]*?)\];/);
  assert.ok(jobsMatch, 'Missing jobs list');
  const jobIds = new Set([...jobsMatch[1].matchAll(/\[\s*'[^']+'\s*,\s*(\d+)\s*,/g)].map((m) => Number(m[1])));

  assert.ok(jobIds.size >= 23, 'Expected at least 23 unique BAKE_FS PLANET job IDs');
  for (const id of jobIds) {
    assert.ok(planetIds.has(id), 'BAKE_FS missing #elif PLANET == ' + id);
  }
  for (const id of planetIds) {
    assert.ok(jobIds.has(id), 'jobs list unused BAKE_FS PLANET == ' + id);
  }
});

test('applyPlanetShading covers all physical shading kinds and addShadowRecv preserves cache keys', () => {
  for (const kind of ['earth', 'clouds', 'gas', 'saturn', 'regolith']) {
    assert.ok(html.includes("kind === '" + kind + "'"), 'Missing applyPlanetShading kind: ' + kind);
  }
  assert.ok(html.includes("'solar-shadow|' + tag + '|' + baseKey"), 'addShadowRecv must append baseKey to avoid WebGL program collisions');
  assert.ok(/TEX\s*=\s*\[512,\s*1024,\s*2048,\s*4096\]\.includes\(qTex\)/.test(html), 'Missing 4K TEX auto configuration');
});

test('J2000 date conversion and UTC formatting round-trip accurately', () => {
  assert.equal(pure.dateToJ2000Days('2000-01-01'), 0);
  assert.equal(pure.formatISODateUTC(0), '2000-01-01');
  assert.equal(pure.formatRuDateUTC(0), '01.01.2000');

  for (const iso of ['1977-09-05', '1986-02-09', '2015-07-14', '2020-12-21', '2061-07-28']) {
    const d = pure.dateToJ2000Days(iso);
    assert.equal(pure.formatISODateUTC(d), iso);
  }
});

test('Kepler solver converges to < 1e-10 across eccentricities including Halley (e=0.967)', () => {
  for (const e of [0, 0.01671123, 0.20563593, 0.2488273, 0.738, 0.9671429]) {
    for (let k = -12; k <= 12; k++) {
      const M = (k / 12) * Math.PI;
      const E = pure.keplerSolve(M, e);
      let mWrap = ((M % pure.TAU) + pure.TAU) % pure.TAU;
      if (mWrap > Math.PI) mWrap -= pure.TAU;
      const residual = Math.abs(E - e * Math.sin(E) - mWrap);
      assert.ok(residual < 1e-10, `Residual ${residual} exceeded 1e-10 for e=${e}, M=${M}`);
    }
  }
});

test('1P/Halley hits perihelion (~0.586 AU) on 1986-02-09 and 2061-07-28, aphelion > 34 AU, and orbits retrograde', () => {
  const h = pure.SOLAR_KEPLER.halley;
  const p1986 = pure.keplerPos3D(h, pure.dateToJ2000Days('1986-02-09'));
  const p2061 = pure.keplerPos3D(h, pure.dateToJ2000Days('2061-07-28'));
  const aph = pure.keplerOrbitPoint(h, Math.PI, h.a);

  assert.ok(Math.abs(p1986.r - 0.586) < 0.005, `Expected 1986 perihelion ~0.586 AU, got ${p1986.r}`);
  assert.ok(Math.abs(p2061.r - 0.586) < 0.005, `Expected 2061 perihelion ~0.586 AU, got ${p2061.r}`);
  assert.ok(aph.r > 34.5, `Expected aphelion > 34.5 AU, got ${aph.r}`);
  assert.ok(h.i > 90, 'Halley orbit must be retrograde (i > 90 deg)');

  const pNext = pure.keplerPos3D(h, pure.dateToJ2000Days('1986-02-09') + 2);
  // Angular momentum y-component = z*vx - x*vz (since scene +Y is ecliptic North, retrograde has L_y < 0)
  const vx = pNext.x - p1986.x, vz = pNext.z - p1986.z;
  const ly = p1986.z * vx - p1986.x * vz;
  assert.ok(ly < 0, `Expected negative vertical angular momentum (retrograde clockwise from +Y), got ${ly}`);
});

test('Pluto crosses inside Neptune distance in projection yet maintains > 2 AU 3D orbital clearance', () => {
  const pl = pure.SOLAR_KEPLER.pluto;
  const nep = pure.SOLAR_KEPLER.neptune;
  const qPluto = pl.a * (1 - pl.e);
  assert.ok(qPluto < nep.a, `Pluto perihelion (${qPluto}) should be < Neptune a (${nep.a})`);

  let minD = Infinity;
  for (let i = 0; i < 360; i++) {
    const p = pure.keplerOrbitPoint(pl, i * pure.DEG, pl.a);
    for (let j = 0; j < 360; j++) {
      const n = pure.keplerOrbitPoint(nep, j * pure.DEG, nep.a);
      const d = Math.hypot(p.x - n.x, p.y - n.y, p.z - n.z);
      if (d < minD) minD = d;
    }
  }
  assert.ok(minD > 2.0, `Expected Pluto-Neptune 3D clearance > 2.0 AU, got ${minD}`);
});

test('Great Conjunction 2020-12-21 places Jupiter and Saturn within 3.5 deg heliocentrically', () => {
  const days = pure.dateToJ2000Days('2020-12-21');
  const jup = pure.keplerPos3D(pure.SOLAR_KEPLER.jupiter, days);
  const sat = pure.keplerPos3D(pure.SOLAR_KEPLER.saturn, days);
  const dot = (jup.x * sat.x + jup.y * sat.y + jup.z * sat.z) / (jup.r * sat.r);
  const deg = Math.acos(Math.max(-1, Math.min(1, dot))) / pure.DEG;
  assert.ok(deg < 3.5, `Expected Jupiter-Saturn heliocentric separation < 3.5 deg, got ${deg}`);
});

test('discCoverJS analytical penumbra overlap satisfies exact geometric bounds', () => {
  assert.equal(pure.discCoverJS(1, 0.5, 2.0), 0);
  assert.equal(pure.discCoverJS(1, 2.0, 0.5), 1);
  assert.ok(Math.abs(pure.discCoverJS(2, 1, 0) - 0.25) < 1e-12);
  const partial = pure.discCoverJS(1, 1, 1);
  assert.ok(partial > 0.35 && partial < 0.45, `Half-radius equal disc overlap ~0.391, got ${partial}`);
  assert.ok(pure.discCoverJS(1, 0.8, 0.5) > pure.discCoverJS(1, 0.8, 1.0));
});

test('sampleBeltAU stays within Main Asteroid Belt and respects Kirkwood gaps', () => {
  let s = 1234567;
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s + 0.5) / 4294967296; };
  for (let k = 0; k < 1000; k++) {
    const r = pure.sampleBeltAU(rng);
    assert.ok(r >= 2.06 && r <= 3.35, `Belt sample out of range: ${r}`);
    for (const gap of pure.KIRKWOOD) {
      assert.ok(Math.abs(r - gap) >= 0.022, `Sample ${r} fell inside Kirkwood gap ${gap}`);
    }
  }
});
