/**
 * Приводы ремней V12 и навесное оборудование (render/drive.js, parts/accessories.js, parts/belt.js, kinematics.js):
 *   1) Чистота render/drive.js (импорт только из config);
 *   2) 8-шкивный контур ГРМ (TIMING_DRIVE) и 5-шкивный поликлиновой ремень (DRIVE): касание, непрерывность s,
 *      замкнутость обхода и отсутствие пересечений ветвей со шкивами;
 *   3) Кинематика: скорость ленты и угловые скорости 4 распредвалов, генератора, помпы, компрессора A/C и 4 роликов;
 *   4) Стартер 11 зубьев в зацеплении с 108-зубым венцом маховика перед плоскостью маховика без касания.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TIMING_X, TIMING_TENS_R, TIMING_VALLEY_R, TIMING_DRIVE,
  ACC_X, BELT_W, BELT_T, RIB_H, ALT, WP, AC, IDLER_R, MARK, DRIVE,
  beltLoop, timingDrive, accDrive, markPeriod
} from '../src/render/drive.js';
import { CRANK_Y } from '../src/config/engine-spec.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const DRV = read('../src/render/drive.js'), ACC = read('../src/render/parts/accessories.js');
const BELT = read('../src/render/parts/belt.js'), KIN = read('../src/render/kinematics.js');
const CRANK = read('../src/render/parts/crankshaft.js'), WORLD = read('../src/render/world.js');
const num = (src, re) => { const m = src.match(re); assert.ok(m, `нет ${re}`); return +m[1]; };
const lit = (src, name) => { const m = src.match(new RegExp(`const ${name} = (\\{[^}]*\\})`)); assert.ok(m, `нет const ${name}`); return Function(`return ${m[1]}`)(); };
const BELT_X = num(WORLD, /^const BELT_X\s*=\s*([\d.]+);/m);
const R_CRANK_SPR = num(WORLD, /^const R_CRANK_SPR\s*=\s*([\d.]+);/m);
const R_CAM_SPR = num(WORLD, /^const R_CAM_SPR\s*=\s*([\d.]+);/m);
const FLYWHEEL_X = num(WORLD, /^const FLYWHEEL_X\s*=\s*(-?[\d.]+);/m);
const near = (a, b, e, msg) => assert.ok(Math.abs(a - b) <= e, `${msg}: ${a} ≠ ${b} ± ${e}`);

const segDist = (p, q, c) => {
  const du = q.u - p.u, dv = q.v - p.v, t = Math.max(0, Math.min(1, ((c.u - p.u) * du + (c.v - p.v) * dv) / (du * du + dv * dv)));
  return Math.hypot(p.u + du * t - c.u, p.v + dv * t - c.v);
};

const arcs = (L, C) => {
  const out = []; let i = 0;
  C.forEach(c => { const a = i; while (i < L.pts.length && Math.abs(Math.hypot(L.pts[i].u - c.u, L.pts[i].v - c.v) - c.r) < 1e-9) i++; out.push([a, i - 1]); });
  return out;
};

test('drive.js: чистый модуль — импорт только из config, без three.js и DOM', () => {
  const imports = DRV.split('\n').filter(l => /^\s*import\b/.test(l));
  assert.deepEqual(imports, ["import { CRANK_Y, BANK_TILT, VALVE_TILT } from '../config/engine-spec.js';"]);
  assert.doesNotMatch(DRV.replace(/\/\*[\s\S]*?\*\//g, ''), /\b(?:THREE|document|window)\b/);
});

for (const [label, C, thick] of [['TIMING_DRIVE (8 шкивов ГРМ)', TIMING_DRIVE, 0.03], ['DRIVE (5 шкивов навесного)', DRIVE, BELT_T]]) {
  test(`${label}: касание дуг и ветвей, непрерывность s, замкнутость обхода и отсутствие пересечений`, () => {
    for (const step of [6, 12, 3]) {
      const L = beltLoop(C, step), P = L.pts, A = arcs(L, C), n = C.length;
      assert.equal(A[n - 1][1], P.length - 1, `шаг ${step}°: все точки на дугах`);
      A.forEach(([a, b], i) => {
        const c = C[i];
        assert.ok(b - a >= 2, `${c.key}: дуга из ${b - a} отрезков`);
        for (let k = a; k <= b; k++) {
          near(P[k].nu * c.s * c.r, P[k].u - c.u, 1e-12, `${c.key}: нормаль u`);
          near(P[k].nv * c.s * c.r, P[k].v - c.v, 1e-12, `${c.key}: нормаль v`);
          if (k > a) assert.ok(P[k].s > P[k - 1].s, 'путь растёт');
        }
        near(P[b].s - P[a].s, c.r * L.wraps[i], 1e-12, `${c.key}: длина дуги`);
        const p = P[b], q = P[(b + 1) % P.length], d = { u: q.u - p.u, v: q.v - p.v }, len = Math.hypot(d.u, d.v);
        near(len, L.seg[i], 1e-9, `${c.key}: длина участка`);
        near((p.nu * d.u + p.nv * d.v) / len, 0, 1e-9, `${c.key}: касание в начале`);
        near((q.nu * d.u + q.nv * d.v) / len, 0, 1e-9, `${c.key}: касание в конце`);
        near(p.nu * q.nu + p.nv * q.nv, 1, 1e-9, `${c.key}: общая нормаль`);
        near((q.s || L.length) - p.s, len, 1e-9, `${c.key}: шаг s по прямой`);
      });
      near(L.length, L.wraps.reduce((t, w, i) => t + C[i].r * w, 0) + L.seg.reduce((t, s) => t + s, 0), 1e-12, 'суммарная длина');
      near(L.wraps.reduce((t, x, i) => t + C[i].s * x, 0), 2 * Math.PI, 1e-9, 'полный оборот 2π');
    }

    const L = beltLoop(C, 2), A = arcs(L, C), P = L.pts;
    A.forEach(([, b], i) => {
      const p = P[b], q = P[(b + 1) % P.length];
      C.forEach((c, k) => {
        if (k === i || k === (i + 1) % C.length) return;
        assert.ok(segDist(p, q, c) > c.r + 0.02, `ветвь ${C[i].key} → ${C[(i + 1) % C.length].key} задевает ${c.key}`);
      });
    });
    P.forEach(p => C.forEach(c => assert.ok(Math.hypot(p.u - c.u, p.v - c.v) > (c.s > 0 ? c.r : c.r - thick) - 1e-9, c.key)));
  });
}

test('конфигурация шкивов, демпфера 6PK и плоскости приводов V12', () => {
  near(R_CRANK_SPR, 0.20, 1e-12);
  near(R_CAM_SPR, 0.40, 1e-12);
  assert.equal(TIMING_X, BELT_X);
  near(ACC_X, BELT_X + 0.15 + 0.035 + 3 * 0.024, 1e-12, 'ACC_X');
  assert.equal(DRIVE[0].v, CRANK_Y);
  assert.deepEqual([DRIVE[1].u, DRIVE[1].v], [ALT.u, ALT.v]);
  assert.deepEqual([DRIVE[3].u, DRIVE[3].v], [WP.u, WP.v]);
  assert.deepEqual([DRIVE[4].u, DRIVE[4].v], [AC.u, AC.v]);
  assert.equal(DRIVE[2].r, IDLER_R + BELT_T);
  assert.match(CRANK, /for \(let k = 0; k < 6; k\+\+\) \{ const y = 0\.035 \+ k \* 0\.024;/);
  near(6 * 0.024, BELT_W, 1e-12);
  assert.ok(0.34 - 0.322 > RIB_H, 'канавки демпфера глубже ребра');
});

test('передаточные отношения ГРМ (2:1) и навесных агрегатов', () => {
  for (const th of [0.4, -1.3, 9.2]) {
    const td = timingDrive(th), ac = accDrive(th);
    near(td.s, th * 0.20, 1e-12);
    near(td.tensR, -td.s / TIMING_TENS_R, 1e-12);
    near(td.valleyIdler, -td.s / TIMING_VALLEY_R, 1e-12);
    near(ac.s, th * 0.34, 1e-12);
    near(ac.alt, ac.s / DRIVE[1].r, 1e-12);
    near(ac.idler, -ac.s / (DRIVE[2].r - BELT_T), 1e-12);
    near(ac.wpump, ac.s / DRIVE[3].r, 1e-12);
    near(ac.ac, ac.s / DRIVE[4].r, 1e-12);
  }
  const L = beltLoop(DRIVE, 6), d = accDrive(1);
  near(markPeriod(L.length) * Math.round(L.length / markPeriod(L.length)), L.length, 1e-9);
  assert.ok(Math.abs(markPeriod(L.length) - MARK) <= MARK / Math.round(L.length / MARK));
  assert.match(KIN, /timingDrive\(th\)/);
  assert.match(KIN, /accDrive\(th\)/);
  assert.match(KIN, /beltTex\.offset\.x = td\.s \/ BELT_PITCH;/);
  assert.match(KIN, /accTex\.offset\.x = acc\.s \/ ACC_PITCH;/);
  assert.match(KIN, /altRotor\.rotation\.x = acc\.alt;/);
  assert.match(KIN, /wpumpRotor\.rotation\.x = acc\.wpump;/);
  assert.match(KIN, /acRotor\.rotation\.x = acc\.ac;/);
  assert.match(KIN, /accIdler\.rotation\.x = acc\.idler;/);
  assert.ok(BELT.includes('beltLoop(TIMING_DRIVE') && BELT.includes('beltLoop(DRIVE'));
});

test('стартер 11 зубьев и маховик 108 зубьев: зацепление по радиусу и зазор по X', () => {
  const PIN = lit(ACC, 'PIN'), ST = lit(ACC, 'ST');
  assert.match(CRANK, /gearShape\(108, 0\.96, 1\.02\), 0\.09/);
  assert.match(ACC, /gearShape\(PIN\.teeth, PIN\.rRoot, PIN\.rTip\), PIN\.w/);
  assert.equal(PIN.teeth, 11);
  const dist = Math.hypot(PIN.z, PIN.y - CRANK_Y);
  const pitch = (0.96 + 1.02) / 2 + (PIN.rRoot + PIN.rTip) / 2;
  near(dist, pitch, 0.02, 'межосевое расстояние зацепления');
  assert.ok(dist - PIN.rTip < 1.02 && dist - PIN.rTip > 0.90, 'зубья заходят на венец без касания диска');
  const ring = [FLYWHEEL_X - 0.05 - 0.045, FLYWHEEL_X - 0.05 + 0.045];
  const pin = [PIN.x - PIN.w / 2, PIN.x + PIN.w / 2];
  assert.ok(pin[0] > ring[1], `шестерня ${pin} спереди от венца ${ring}`);
  assert.ok(ST.x0 > pin[1] - 0.05 && ST.x1 > ST.x0 && ST.r > PIN.rTip);
});
