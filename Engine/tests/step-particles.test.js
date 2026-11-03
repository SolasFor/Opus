/**
 * Регрессия stepParticles в Engine/Engine.html и модульной версии (решение 9 по плану M-01b). С M-02b функция
 * в Engine/src/render/effects/strokes.js: раздел 8 main.js перенесён туда дословно.
 *
 * Частицы впуска и выпуска движутся по таблице пути из LUT_N точек, позиция частицы p.s лежит в [0, 1].
 * За кадр p.s сдвигается на flow · dPhi · k, где flow — подъём клапана / CAM_LIFT (0…1), dPhi — шаг угла
 * (frame() ограничивает его ±90°), k = 1/85 для впуска и 1/75 для выпуска. Сдвиг доходит до 1,2 периода:
 * при скачке угла (setTheta, ползунок) и на скорости ×10, если кадр длиннее ≈ 42 мс (dt ограничен 50 мс).
 * Прежний перенос на один период оставлял p.s вне [0, 1]. Индекс выходил за таблицу, возникала
 * TypeError «reading 'x'», и остаток кадра пропускался.
 *
 * Тест извлекает функцию из текста обоих файлов и исполняет её через new Function (smooth — из src/sim/math.js).
 * Проверяется:
 *   1) сдвиг до ±1,2 периода: исключений нет, p.s остаётся в [0, 1], координаты конечны;
 *   2) сдвиг меньше периода, где прежний перенос работал: результат побитно равен прежнему.
 *      Эталон — та же функция с прежней строкой переноса;
 *   3) прежний перенос на входах из п. 1 падает с TypeError, то есть тест воспроизводит дефект.
 * Запуск — как у остальных тестов (см. legacy-parity.test.js).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { smooth } from '../src/sim/math.js';

const OLD_WRAP = '    if (p.s > 1) p.s -= 1; else if (p.s < 0) p.s += 1;';
const NEW_WRAP = '    if (p.s > 1 || p.s < 0) p.s -= Math.floor(p.s);   // one frame can move a particle by more than one period (|dPhi| <= 90°)';
const FILES = ['../Engine.html', '../src/render/effects/strokes.js'];

// Текст function stepParticles: от объявления с начала строки до строки, где скобки { } уравновешиваются.
function extract(file) {
  const lines = readFileSync(new URL(file, import.meta.url), 'utf8').split('\n');
  const starts = lines.flatMap((l, i) => (l.startsWith('function stepParticles(') ? [i] : []));
  assert.equal(starts.length, 1, `объявлений function stepParticles в ${file}`);
  let depth = 0;
  for (let j = starts[0]; j < lines.length; j++) {
    const code = lines[j].replace(/\/\/.*$/, '');
    for (const ch of code) depth += ch === '{' ? 1 : ch === '}' ? -1 : 0;
    if (depth === 0 && code.includes('}')) return lines.slice(starts[0], j + 1).join('\n');
  }
  assert.fail(`конец stepParticles в ${file}`);
}
const build = src => new Function('smooth', `'use strict';\n${src}\nreturn stepParticles;`)(smooth);
const withOldWrap = src => {
  assert.equal(src.split(NEW_WRAP).length, 2, 'строка переноса в stepParticles');
  return src.replace(NEW_WRAP, OLD_WRAP);
};

// Облако частиц той же формы, что возвращает makeParticles: два пути по LUT_N точек, Float32Array, как на странице.
const LUT_N = 160;
const S0 = [0, 1e-12, 0.1, 0.25, 0.5, 0.75, 0.8, 0.9, 0.99, 1 - 1e-12, 1];
function cloud(s0 = S0) {
  const luts = [0, 1].map(c => Array.from({ length: LUT_N }, (_, i) => ({ x: i / 7 + c, y: Math.sin(i / 9) - c, z: (i % 13) / 5 })));
  const parts = s0.map((s, i) => ({ cyl: i % 2, s, j: { x: (i % 5 - 2) / 40, y: (i % 3 - 1) / 30, z: (i % 7 - 3) / 50 } }));
  const n = parts.length, attr = () => ({ needsUpdate: false });
  return { parts, luts, LUT_N, pos: new Float32Array(n * 3), aT: new Float32Array(n), aA: new Float32Array(n),
    geo: { attributes: { position: attr(), aT: attr(), aA: attr() } }, points: { material: { uniforms: { uVis: { value: 0 } } }, visible: false } };
}
const FLOWS = [0, 0.3, 0.84, 1];
const KS = [1 / 85, 1 / 75];
const DPHI_LARGE = [-90, -89.5, -80, -75.5, 75.5, 80, 89.5, 90];
const DPHI_SMALL = [-74, -45, -12.5, -1, -0.01, 0, 0.01, 1, 12.5, 45, 74];   // |flow · dPhi · k| ≤ 74/75 < 1

for (const file of FILES) {
  test(`${file}: сдвиг до ±1,2 периода — без исключений, p.s в [0, 1]`, () => {
    const step = build(extract(file));
    for (const k of KS) for (const flow of FLOWS) for (const dPhi of DPHI_LARGE) {
      const P = cloud();
      for (let frame = 0; frame < 4; frame++) {
        step(P, [flow, flow], dPhi, k, 1);
        P.parts.forEach((p, i) => assert.ok(p.s >= 0 && p.s <= 1, `p.s = ${p.s}: частица ${i}, flow ${flow}, dPhi ${dPhi}, k ${k}`));
        assert.ok(P.pos.every(Number.isFinite) && P.aT.every(Number.isFinite) && P.aA.every(Number.isFinite), 'координаты конечны');
      }
    }
  });

  test(`${file}: сдвиг меньше периода — побитно как прежний перенос`, () => {
    const src = extract(file), step = build(src), old = build(withOldWrap(src));
    let rnd = 0x9e3779b9;   // xorshift32, детерминированно
    const next = () => { rnd ^= rnd << 13; rnd >>>= 0; rnd ^= rnd >>> 17; rnd ^= rnd << 5; rnd >>>= 0; return rnd / 2 ** 32; };
    const cases = [];
    for (const k of KS) for (const flow of FLOWS) for (const dPhi of DPHI_SMALL) cases.push([S0, flow, dPhi, k]);
    for (let c = 0; c < 2000; c++) cases.push([[next(), next(), next(), next()], next(), (next() * 2 - 1) * 74, KS[c % 2]]);
    for (const [s0, flow, dPhi, k] of cases) {
      const A = cloud(s0), B = cloud(s0);
      for (let frame = 0; frame < 5; frame++) { step(A, [flow, flow], dPhi, k, 0.5); old(B, [flow, flow], dPhi, k, 0.5); }
      A.parts.forEach((p, i) => assert.ok(Object.is(p.s, B.parts[i].s), `p.s частицы ${i}: ${p.s} ≠ ${B.parts[i].s}`));
      for (const key of ['pos', 'aT', 'aA']) A[key].forEach((v, i) => assert.ok(Object.is(v, B[key][i]), `${key}[${i}]: ${v} ≠ ${B[key][i]}`));
      assert.equal(A.points.visible, B.points.visible);
      assert.equal(A.points.material.uniforms.uVis.value, B.points.material.uniforms.uVis.value);
    }
  });
}

test('прежний перенос на тех же входах падает с TypeError: тест воспроизводит дефект', () => {
  const old = build(withOldWrap(extract('../Engine.html')));
  let thrown = 0;
  for (const k of KS) for (const dPhi of DPHI_LARGE) {
    try { old(cloud(), [1, 1], dPhi, k, 1); } catch (e) { assert.ok(e instanceof TypeError, String(e)); thrown++; }
  }
  assert.ok(thrown > 0, 'прежний перенос ни разу не упал');
});
