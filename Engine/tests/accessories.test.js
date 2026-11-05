/**
 * M-07d: навесное оборудование — привод поликлиновым ремнём, генератор, натяжитель, стартер.
 * 1) render/drive.js — чистый модуль (импорт только из config): петля beltLoop() из общих касательных и дуг —
 *    точки дуг на своих окружностях, прямые участки касаются обеих окружностей, путь s непрерывен и замыкается;
 *    длина и углы обхвата; прямые участки не задевают третий шкив; ремень — в плоскости канавок демпфера, канавки
 *    шкива генератора того же шага.
 * 2) Передаточные отношения и направления: обод каждого шкива в точке касания движется вместе с ремнём (метка ремня
 *    сдвигается так же), updateKinematics() поворачивает ротор генератора и ролик и сдвигает метку по accDrive().
 * 3) Метка: целое число шагов на длину петли при обоих уровнях детализации, развёртка u = s / шаг, шов — с s = длина.
 * 4) Бюджет: генератор и стартер — в общем меше блока и только из материалов, которые у блока уже были; ротор —
 *    steel и steelDark, без корпусного материала; рычаг натяжителя — в меше кронштейна ролика ГРМ; новых мешей 5.
 * 5) Стартер: шестерня 11 зубьев на межосевом расстоянии зацепления с венцом, но перед ним — не в его плоскости
 *    и не задевает маховик.
 * Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACC_X, BELT_W, BELT_T, RIB_H, ALT, IDLER_R, DRIVE, beltLoop, accDrive, markPeriod } from '../src/render/drive.js';
import { CRANK_Y } from '../src/config/engine-spec.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const DRV = read('../src/render/drive.js'), ACC = read('../src/render/parts/accessories.js'), BLOCK = read('../src/render/parts/block.js');
const BELT = read('../src/render/parts/belt.js'), KIN = read('../src/render/kinematics.js'), CRANK = read('../src/render/parts/crankshaft.js');
const WORLD = read('../src/render/world.js');
const num = (src, re) => { const m = src.match(re); assert.ok(m, `нет ${re}`); return +m[1]; };
const lit = (src, name) => { const m = src.match(new RegExp(`const ${name} = (\\{[^}]*\\})`)); assert.ok(m, `нет const ${name}`); return Function(`return ${m[1]}`)(); };
const BELT_X = num(WORLD, /^const BELT_X\s*=\s*([\d.]+);/m);
const DEG = Math.PI / 180, near = (a, b, e, msg) => assert.ok(Math.abs(a - b) <= e, `${msg}: ${a} ≠ ${b} ± ${e}`);
// отрезок p–q и расстояние от точки c до него
const segDist = (p, q, c) => {
  const du = q.u - p.u, dv = q.v - p.v, t = Math.max(0, Math.min(1, ((c.u - p.u) * du + (c.v - p.v) * dv) / (du * du + dv * dv)));
  return Math.hypot(p.u + du * t - c.u, p.v + dv * t - c.v);
};
// дуги петли: индексы первой и последней точки каждой окружности
const arcs = L => { const out = []; let i = 0;
  DRIVE.forEach(c => { const a = i; while (i < L.pts.length && Math.abs(Math.hypot(L.pts[i].u - c.u, L.pts[i].v - c.v) - c.r) < 1e-9) i++; out.push([a, i - 1]); });
  return out; };

test('drive.js: чистый модуль — импорт только из config, без three.js и DOM', () => {
  const imports = DRV.split('\n').filter(l => /^\s*import\b/.test(l));
  assert.deepEqual(imports, ["import { CRANK_Y } from '../config/engine-spec.js';"]);
  assert.doesNotMatch(DRV.replace(/\/\*[\s\S]*?\*\//g, ''), /\b(?:THREE|document|window)\b/);
});

test('beltLoop: точки дуг на своих окружностях, прямые участки касаются обеих, путь s непрерывен и замыкается', () => {
  for (const step of [6, 12, 2]) {
    const L = beltLoop(DRIVE, step), P = L.pts, A = arcs(L), n = DRIVE.length;
    assert.equal(A[n - 1][1], P.length - 1, `шаг ${step}°: все точки лежат на дугах`);
    A.forEach(([a, b], i) => {
      const c = DRIVE[i];
      assert.ok(b - a >= 2, `${c.key}: дуга из ${b - a} отрезков`);
      for (let k = a; k <= b; k++) {   // нормаль наружу петли: от центра у шкива, к центру у ролика
        near(P[k].nu * c.s * c.r, P[k].u - c.u, 1e-12, `${c.key}: нормаль`); near(P[k].nv * c.s * c.r, P[k].v - c.v, 1e-12, `${c.key}: нормаль`);
        if (k > a) assert.ok(P[k].s > P[k - 1].s, 'путь растёт');
      }
      near(P[b].s - P[a].s, c.r * L.wraps[i], 1e-12, `${c.key}: длина дуги`);
      const p = P[b], q = P[(b + 1) % P.length], d = { u: q.u - p.u, v: q.v - p.v }, len = Math.hypot(d.u, d.v);
      near(len, L.seg[i], 1e-9, `${c.key}: длина прямого участка`);
      near((p.nu * d.u + p.nv * d.v) / len, 0, 1e-9, `${c.key}: участок касается окружности в начале`);
      near((q.nu * d.u + q.nv * d.v) / len, 0, 1e-9, `${c.key}: участок касается следующей окружности`);
      near(p.nu * q.nu + p.nv * q.nv, 1, 1e-9, `${c.key}: нормаль на участке одна и та же`);
      near((q.s || L.length) - p.s, len, 1e-9, `${c.key}: путь s по прямому участку`);
    });
    near(L.length, L.wraps.reduce((t, w, i) => t + DRIVE[i].r * w, 0) + L.seg.reduce((t, s) => t + s, 0), 1e-12, 'длина петли');
  }
  assert.throws(() => beltLoop([{ key: 'a', u: 0, v: 0, r: 1, s: 1 }, { key: 'b', u: 0.5, v: 0, r: 0.2, s: -1 }]), /нет общей касательной/);
});

test('beltLoop: длина 491 мм, обхват демпфера и генератора больше 180°, ролика — 37,5°, обход замкнут', () => {
  const L = beltLoop();
  near(L.length, 4.9108, 5e-4, 'длина');
  const w = L.wraps.map(x => x / DEG);
  near(w[0], 213.8, 0.1, 'демпфер'); near(w[1], 183.7, 0.1, 'генератор'); near(w[2], 37.5, 0.1, 'ролик');
  near(L.wraps.reduce((t, x, i) => t + DRIVE[i].s * x, 0), 2 * Math.PI, 1e-9, 'шкивы минус ролик = полный оборот');
  assert.deepEqual(DRIVE.map(c => [c.key, c.s]), [['crank', 1], ['alt', 1], ['idler', -1]]);
  assert.equal(DRIVE[0].v, CRANK_Y); assert.equal(DRIVE[0].u, 0);
  assert.deepEqual([DRIVE[1].u, DRIVE[1].v], [ALT.u, ALT.v]);
  assert.equal(DRIVE[2].r, IDLER_R + BELT_T, 'ремень касается ролика спинкой');
});

test('beltLoop: прямые участки не задевают третий шкив, спинка ремня не задевает шкивы', () => {
  const L = beltLoop(DRIVE, 2), A = arcs(L), P = L.pts;
  A.forEach(([, b], i) => {
    const p = P[b], q = P[(b + 1) % P.length];
    DRIVE.forEach((c, k) => {
      if (k === i || k === (i + 1) % DRIVE.length) return;
      assert.ok(segDist(p, q, c) > c.r + BELT_T + 0.02, `участок ${DRIVE[i].key} → ${DRIVE[(i + 1) % DRIVE.length].key} задевает ${c.key}`);
    });
  });
  // все точки петли вне шкивов (s = 1) и не ближе спинки к ролику (s = −1), кроме своих дуг
  P.forEach(p => DRIVE.forEach(c => assert.ok(Math.hypot(p.u - c.u, p.v - c.v) > (c.s > 0 ? c.r : c.r - BELT_T) - 1e-9, `${c.key}`)));
});

test('плоскость ремня — середина канавок демпфера; канавки демпфера и шкива генератора — 6 по BELT_W / 6, глубже ребра', () => {
  near(ACC_X, BELT_X + 0.15 + 0.035 + 3 * 0.024, 1e-12, 'ACC_X');
  assert.match(CRANK, /const dp = \[\[0, 0\], \[0\.12, 0\], \[0\.12, 0\.02\], \[0\.30, 0\.02\], \[0\.30, 0\.03\]\];\n {2}for \(let k = 0; k < 6; k\+\+\) \{ const y = 0\.035 \+ k \* 0\.024; dp\.push\(\[0\.34, y\], \[0\.322, y \+ 0\.012\], \[0\.34, y \+ 0\.024\]\); \}/);
  assert.match(CRANK, /P\.add\(G\.latheX\(dp, 64\), M\.iron, \[BELT_X \+ 0\.15, 0, 0\]\);/);
  near(6 * 0.024, BELT_W, 1e-12, 'ширина ручья демпфера');
  assert.equal(DRIVE[0].r, 0.34, 'по вершинам канавок демпфера');
  assert.ok(0.34 - 0.322 > RIB_H, 'канавка демпфера глубже ребра');
  // шкив генератора: в плоскости ремня, радиус DRIVE[1].r, 6 канавок с шагом BELT_W / 6 глубиной 0.018
  assert.match(ACC, /altRotor\.position\.set\(ACC_X, ALT\.v, ALT\.u\);/);
  assert.match(ACC, /const R = new Parts\(\), r = DRIVE\[1\]\.r, h = BELT_W \/ 2;/);
  assert.match(ACC, /for \(let k = 0; k < 6; k\+\+\) \{ const a = -h \+ k \* BELT_W \/ 6; pr\.push\(\[r - 0\.018, a \+ 0\.012\], \[r, a \+ 0\.024\]\); \}/);
  near(BELT_W / 6, 0.024, 1e-12, 'шаг канавок');
  // сечение ремня: 6 рёбер внутрь на RIB_H, спинка наружу на BELT_T
  assert.match(BELT, /out = \[\[-w, BELT_T\], \[w, BELT_T\], \[w, 0\]\];\n {2}for \(let k = 5; k >= 0; k--\) \{ const x0 = -w \+ k \* p; out\.push\(\[x0 \+ p \* 0\.64, -RIB_H\], \[x0 \+ p \* 0\.36, -RIB_H\], \[x0, 0\]\); \}/);
  assert.match(BELT, /pos\.push\(ACC_X \+ x, p\.v \+ p\.nv \* h, p\.u \+ p\.nu \* h\);/);
});

test('передаточные отношения и направления: обод шкива в точке касания движется вместе с ремнём', () => {
  for (const th of [0.3, -1.7, 12.5]) {
    const a = accDrive(th);
    near(a.s, th * 0.34, 1e-12, 's'); near(a.alt / th, 0.34 / 0.13, 1e-12, 'генератор'); near(a.idler / th, -3.4, 1e-12, 'ролик');
  }
  // поворот вокруг +x на dφ сдвигает точку (u = z, v = y) на (v, −u)·dφ; метка ремня при offset = s / шаг уходит
  // назад по s со скоростью ds/dθ
  const L = beltLoop(DRIVE, 6), A = arcs(L), d = accDrive(1), rate = [1, d.alt, d.idler];
  A.forEach(([a, b], i) => {
    const c = DRIVE[i], rho = c.s > 0 ? c.r : c.r - BELT_T;   // радиус касания: канавки шкива или спинка у ролика
    for (let k = a; k <= b; k++) {
      const p = L.pts[k], ru = (p.u - c.u) / c.r * rho, rv = (p.v - c.v) / c.r * rho;
      const tu = -p.nv, tv = p.nu;                            // касательная по ходу s (петля — против часовой)
      near(rv * rate[i], -d.s * tu, 1e-12, `${c.key}: скорость по u`); near(-ru * rate[i], -d.s * tv, 1e-12, `${c.key}: скорость по v`);
    }
  });
});

test('updateKinematics(): ротор, ролик и метка ремня — по accDrive(θ) того же угла, что коленвал', () => {
  assert.match(KIN, /^import \{ beltMat, idlerGroup, BELT_PITCH, accBeltMat, accIdler, accTex \} from '\.\/parts\/belt\.js';$/m);
  assert.match(KIN, /^import \{ altRotor \} from '\.\/parts\/accessories\.js';$/m);
  assert.match(KIN, /^import \{ accDrive \} from '\.\/drive\.js';$/m);
  const body = KIN.slice(KIN.indexOf('function updateKinematics() {'));
  assert.match(body, /^function updateKinematics\(\) \{\n {2}const th = sim\.theta;\n {2}crankGroup\.rotation\.x = th;/);
  assert.match(body, /\n {2}const acc = accDrive\(th\);\n {2}if \(altRotor\) altRotor\.rotation\.x = acc\.alt;\n {2}if \(accIdler\) accIdler\.rotation\.x = acc\.idler;\n {2}if \(accBeltMat\) accBeltMat\.map\.offset\.x = acc\.s \/ accTex;\n\}/);
});

test('метка ремня: целое число шагов на длину петли, развёртка u = s / шаг, шов на s = длина', () => {
  for (const step of [6, 12]) {
    const L = beltLoop(DRIVE, step), k = L.length / markPeriod(L.length);
    near(k, Math.round(k), 1e-9, `шаг ${step}°`);
    assert.ok(Math.abs(markPeriod(L.length) - 0.12) < 0.12 / Math.round(k), 'шаг около MARK');
  }
  assert.equal(markPeriod(0.05), 0.05, 'короче шага — одна метка');
  assert.match(BELT, /const loop = beltLoop\(DRIVE, detail\.low \? 12 : 6\), sec = accSection\(\), pts = loop\.pts;\n {2}accTex = markPeriod\(loop\.length\);\n {2}const col = \[\.\.\.pts, \{ \.\.\.pts\[0\], s: loop\.length \}\];/);
  assert.match(BELT, /uv\.push\(p\.s \/ accTex, e === 0 \? t : 0\);/);
  assert.match(BELT, /accBeltMat\.map = accBeltMat\.map\.clone\(\);/);
  const MAT = read('../src/render/materials.js');
  assert.match(MAT, /polyBelt: S\(std\(\{ color: 0xffffff, map: polyTex, metalness: 0\.0, roughness: 0\.74 \}\), 'rubber'\),/);
  assert.match(MAT, /polyTex\.wrapS = THREE\.RepeatWrapping;/);
});

test('бюджет: генератор и стартер — в меше блока из его материалов, ротор — steel и steelDark без корпуса, 5 новых мешей', () => {
  const mats = src => new Set([...src.matchAll(/(?<![\w$.])M\.([\w$]+)/g)].map(m => m[1]));
  const fn = (src, name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); const j = src.indexOf('\n}\n', i); return src.slice(i, j); };
  // ключ-цвет рисуется общим материалом узла (hw или paintHw, materials.js): меш — по нему
  const into = Object.fromEntries([...read('../src/render/materials.js').matchAll(/^ {4}([\w$]+): *tint\(0x[\da-f]+(?:, '([\w$]+)')?\)/gm)].map(m => [m[1], m[2] || 'hw']));
  assert.ok(into.bolt === 'hw' && into.paintBlue === 'paintHw' && into.hole === 'hw', 'ключи-цвета');
  const mesh = set => new Set([...set].map(m => into[m] || m));
  const block = mats(BLOCK), body = mats(fn(ACC, 'alternator') + fn(ACC, 'starter')), rotor = mats(fn(ACC, 'buildAltRotor'));
  for (const m of mesh(body)) assert.ok(mesh(block).has(m), `генератор и стартер: меша M.${m} у блока не было`);
  assert.deepEqual([...rotor].sort(), ['steel', 'steelDark']);
  for (const m of rotor) assert.ok(!mesh(block).has(m) && !mesh(body).has(m), `M.${m} у блока — корпусный клон, ротор его получит`);
  assert.match(fn(ACC, 'buildAltRotor'), /const ud = g\.userData, housing = ud\.housing;\n {2}ud\.housing = false; R\.build\(altRotor, g\); ud\.housing = housing;/);
  assert.match(BLOCK, /\n {2}buildAccessories\(P, g\);[^\n]*\n {2}P\.build\(g, g\);\n/);
  assert.match(ACC, /function buildAccessories\(P, g\) \{\n {2}alternator\(P\);\n {2}starter\(P\);\n {2}buildAltRotor\(g\);\n\}/);
  // натяжитель: рычаг и корпус — в BP (steelDark, chrome), ролик — steel и dark
  const acc = fn(BELT, 'buildAccBelt'), arm = acc.slice(acc.indexOf('const arm'));
  assert.deepEqual([...mats(arm)].sort(), ['chrome', 'steelDark']);
  assert.match(BELT, /\n {2}buildAccBelt\(g, BP\);[^\n]*\n {2}BP\.build\(g, g\);\n/);
  assert.deepEqual([...mats(acc.slice(acc.indexOf('const RP'), acc.indexOf('RP.build')))].sort(), ['dark', 'steel']);
  assert.equal((acc.match(/new THREE\.Mesh\(/g) || []).length, 1, 'один меш ремня');
  assert.equal((acc.match(/\.build\(/g) || []).length, 1, 'ролик — одна сборка');
  assert.equal((ACC.match(/\.build\(/g) || []).length, 1, 'ротор — одна сборка');
  // новые меши: ремень 1 + ролик (steel, dark) 2 + ротор (steel, steelDark) 2
  assert.equal(1 + 2 + rotor.size, 5);
});

test('стартер: шестерня 11 зубьев на расстоянии зацепления с венцом, но перед ним — не в плоскости венца и не задевает маховик', () => {
  const PIN = lit(ACC, 'PIN'), ST = lit(ACC, 'ST');
  const FX = num(CRANK, /const FX = (-?[\d.]+);/);
  assert.match(CRANK, /P\.add\(extrudeX\(gearShape\(96, 0\.92, 0\.985\), 0\.09, 1\), M\.steel, \[FX - 0\.05, 0, 0\]\);/);
  assert.match(CRANK, /P\.add\(G\.latheX\(\[\[0, -0\.10\], \[0\.86, -0\.10\], \[0\.90, -0\.08\], \[0\.90, 0\.08\]/);
  assert.match(ACC, /P\.add\(extrudeX\(gearShape\(PIN\.teeth, PIN\.rRoot, PIN\.rTip\), PIN\.w, 2\), M\.iron, pin\(PIN\.x\)\);/);
  assert.equal(PIN.teeth, 11);
  const ring = [FX - 0.05 - 0.045, FX - 0.05 + 0.045], pin = [PIN.x - PIN.w / 2, PIN.x + PIN.w / 2];
  const dist = Math.hypot(PIN.z, PIN.y - CRANK_Y), pitch = (0.92 + 0.985) / 2 + (PIN.rRoot + PIN.rTip) / 2;
  near(dist, pitch, 0.04, 'межосевое расстояние зацепления');
  assert.ok(dist - PIN.rTip < 0.985 && dist - PIN.rTip > 0.90, 'зубья заходят на венец по радиусу, маховик (r 0.90) не задевают');
  assert.ok(pin[0] > ring[1] && pin[0] - ring[1] < 0.1, `шестерня перед венцом: ${pin} и ${ring}`);
  assert.ok(pin[0] > FX + 0.08, 'перед ободом маховика');
  // двигатель стартера — за шестерней, вдоль блока
  assert.ok(ST.x0 > pin[1] - 0.05 && ST.x1 > ST.x0 && ST.r > PIN.rTip);
});

test('натяжитель: рычаг между ремнями, ось снаружи петли, ролик по спинке', () => {
  const T = lit(BELT, 'TENS'), L = beltLoop(DRIVE, 2), A = arcs(L), P = L.pts;
  assert.ok(T.x - 0.02 > BELT_X + 0.13 / 2 && T.x + 0.02 < ACC_X - BELT_W / 2, `рычаг ${T.x} ± 0.02 между ремнями`);
  const [, b] = A[2], p = P[b], q = P[0];                       // участок ролик → демпфер
  const side = (T.u - p.u) * p.nu + (T.v - p.v) * p.nv;
  assert.ok(side > 0.2, `ось рычага снаружи петли: ${side}`);
  assert.ok(segDist(p, q, T) > 0.2 && Math.hypot(T.u - DRIVE[0].u, T.v - DRIVE[0].v) > 0.34 + 0.3);
  assert.match(BELT, /accIdler\.position\.set\(ACC_X, idl\.v, idl\.u\);/);
});
