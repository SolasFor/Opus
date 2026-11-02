/**
 * Сверка параметров D-05: константы Engine/Engine.html и Engine/src/config/engine-spec.js.
 *
 * До M-01b Engine.html не импортирует модули Engine/src и держит собственные копии констант.
 * Тест читает Engine.html как текст, находит объявления нужных констант (строки, которые начинаются
 * с «const »), исполняет их через new Function в той же среде, что и модули, и сравнивает
 * с engine-spec.js побитно (Object.is).
 * THREE.MathUtils.degToRad заменён заглушкой с семантикой three r160: degrees * (Math.PI / 180).
 * Если константа меняется, её меняют одновременно в Engine.html и в engine-spec.js.
 *
 * Без сторонних зависимостей.
 * Требования к Node: 20.19+ (линия 20) или 22.7+. Файлы — ES-модули без package.json, нужно автоопределение
 * синтаксиса модулей; на 18.20.8, 20.18.3, 21.7.3, 22.6.0 — «SyntaxError: Cannot use import statement outside a module».
 * Запуск из корня репозитория:
 *   Node 22.7+:   node --test "Engine/tests/*.test.js"
 *   Node 20.19+:  node --test Engine/tests/*.test.js   (шаблон раскрывает оболочка: Node 20 не принимает шаблоны в --test)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as spec from '../src/config/engine-spec.js';
import { cycleDeg, cylinderPhaseDeg, strokeOf } from '../src/sim/cycle.js';
import { PIN_TDC, PIN_BDC } from '../src/sim/kinematics.js';
import { volumeAt, pressureAt } from '../src/sim/thermo.js';

const LINES = readFileSync(new URL('../Engine.html', import.meta.url), 'utf8').split('\n');
const DEG2RAD = Math.PI / 180;
const THREE_STUB = { MathUtils: { degToRad: degrees => degrees * DEG2RAD } };

// Номер единственной строки Engine.html, которая начинается с «const » и объявляет name (вне комментария «//»).
function declarationIndex(name) {
  const re = new RegExp(`^const\\s(?:.*[\\s,])?${name}\\s*=(?!=)`);
  const found = [];
  LINES.forEach((line, i) => { if (re.test(line.replace(/\/\/.*$/, ''))) found.push(i); });
  assert.equal(found.length, 1, `объявлений ${name} в Engine.html: ${found.length}, ожидается 1`);
  return found[0];
}

// Текст функции Engine.html, объявленной с начала строки: до строки, на которой скобки { } уравновешиваются.
function functionSource(name) {
  const re = new RegExp(`^function ${name}\\(`);
  const found = LINES.flatMap((line, i) => (re.test(line) ? [i] : []));
  assert.equal(found.length, 1, `объявлений function ${name} в Engine.html: ${found.length}, ожидается 1`);
  let depth = 0;
  for (let j = found[0]; j < LINES.length; j++) {
    const code = LINES[j].replace(/\/\/.*$/, '');
    for (const ch of code) depth += ch === '{' ? 1 : ch === '}' ? -1 : 0;
    if (depth === 0 && code.includes('}')) return LINES.slice(found[0], j + 1).join('\n');
  }
  assert.fail(`конец функции ${name}`);
}

// Значения констант Engine.html: строки объявлений исполняются в порядке файла.
function htmlConstants(names) {
  const idx = [...new Set(names.map(declarationIndex))].sort((a, b) => a - b);
  return new Function('THREE', `'use strict';\n${idx.map(i => LINES[i]).join('\n')}\nreturn { ${names.join(', ')} };`)(THREE_STUB);
}

// Числовые параметры, которые есть и в Engine.html, и в engine-spec.js.
// D-05: CRANK_R, ROD_L, BORE_R, PIN_TOP, CAM_LIFT в engine-spec.js выводятся из мм, VS и VC — из геометрии A.
const SHARED = ['DEG', 'CRANK_Y', 'CRANK_R', 'ROD_L', 'BORE_R', 'PIN_TOP', 'VALVE_TILT', 'CAM_LIFT', 'CAM_HALF',
  'IN_MID', 'EX_MID', 'SPARK_ADV', 'VS', 'VC'];

test('заглушка degToRad даёт значения three r160', () => {
  // значения THREE.MathUtils.degToRad(12) и (58) из three r160 — эталоны M-01a (characterization.test.js)
  assert.equal(THREE_STUB.MathUtils.degToRad(12), 0.20943951023931956);
  assert.equal(THREE_STUB.MathUtils.degToRad(58), 1.0122909661567112);
});

test('константы Engine.html побитно равны engine-spec.js', () => {
  const html = htmlConstants([...SHARED, 'FIRE_DEG']);
  for (const name of SHARED) {
    assert.equal(typeof spec[name], 'number', `engine-spec.js экспортирует ${name}`);
    assert.equal(html[name], spec[name], `${name}: Engine.html ${html[name]}, engine-spec.js ${spec[name]}`);
  }
  assert.deepEqual([...html.FIRE_DEG], [...spec.FIRE_DEG], 'FIRE_DEG');
});

test('ограничение D-05 (решение 7): степень сжатия 10,5 3D-геометрией не подтверждается', () => {
  // В ВМТ днище поршня — ось пальца PIN_TDC = CRANK_Y + CRANK_R + ROD_L плюс PIN_TOP; низ ГБЦ — HEAD_BOT.
  // Зазор 9 мм; плоская камера Ø 85 мм такой высоты дала бы CR ≈ 9,0. Если 3D-геометрия изменится,
  // описание ограничения в engine-spec.js нужно пересмотреть.
  const h = htmlConstants(['CRANK_Y', 'CRANK_R', 'ROD_L', 'PIN_TOP', 'HEAD_BOT', 'BORE_R']);
  const gapMm = (h.HEAD_BOT - (h.CRANK_Y + h.CRANK_R + h.ROD_L + h.PIN_TOP)) * spec.U_MM;
  assert.ok(Math.abs(gapMm - 9) < 1e-9, `зазор в ВМТ ${gapMm} мм`);
  const vcFlat = Math.PI * (h.BORE_R * 10) * (h.BORE_R * 10) * (gapMm / 10);   // см³
  const cr3d = (spec.VS + vcFlat) / vcFlat;
  assert.ok(Math.abs(vcFlat - 51.07) < 0.01, `VC плоской камеры ${vcFlat} см³`);
  assert.ok(Math.abs(cr3d - 9.0) < 0.01, `CR по 3D ${cr3d}`);
  assert.ok(cr3d < spec.CR);
});

// ---------- D-05: показания карточек (liveRows) ----------

// liveRows из Engine.html с заглушками состояния страницы; константы — из Engine.html, формулы модели — модули.
function makeLiveRows() {
  const c = htmlConstants(['DEG', 'FIRE_DEG', 'CRANK_R', 'ROD_L', 'CAM_LIFT', 'SPARK_ADV', 'BASE_RPM', 'R_CRANK_SPR', 'IDLER']);
  const sim = { theta: 0, running: false, pistonY: [0, 0, 0, 0], intakeLift: [0, 0, 0, 0], exhaustLift: [0, 0, 0, 0], heat: 0 };
  const env = { ...c, sim, ui: { pvCyl: 0 }, effSpeed: () => 1, PIN_TDC, PIN_BDC, volumeAt, pressureAt, strokeOf,
    mod: (a, n) => ((a % n) + n) % n, cycDeg: () => cycleDeg(sim.theta), phaseOf: i => cylinderPhaseDeg(sim.theta, i),
    STROKES: ['Рабочий ход', 'Выпуск', 'Впуск', 'Сжатие'].map(name => ({ name })) };
  const names = Object.keys(env);
  const liveRows = new Function(...names, `'use strict';\n${functionSource('liveRows')}\nreturn liveRows;`)(...names.map(k => env[k]));
  return { liveRows, sim };
}
const row = (rows, label) => { const r = rows.find(([k]) => k === label); assert.ok(r, `строка «${label}»`); return r[1]; };

test('показания: ход поршня 0…72 мм и подъём клапана 0…9,2 мм из 3D-констант', () => {
  const { liveRows, sim } = makeLiveRows();
  sim.pistonY[0] = PIN_TDC;
  assert.equal(row(liveRows('pistons'), 'От ВМТ'), '0.0 мм');
  sim.pistonY[0] = PIN_BDC;
  assert.equal(row(liveRows('pistons'), 'От ВМТ'), '72.0 мм');
  sim.pistonY[0] = (PIN_TDC + PIN_BDC) / 2;
  assert.equal(row(liveRows('pistons'), 'От ВМТ'), '36.0 мм');
  sim.intakeLift[0] = 1; sim.exhaustLift[0] = 0.5;   // доли наибольшего подъёма, как в updateKinematics
  assert.equal(row(liveRows('valvetrain'), 'Впускные, ц. 1'), '9.2 мм');
  assert.equal(row(liveRows('valvetrain'), 'Выпускные, ц. 1'), '4.6 мм');
});

test('показания: объём камеры 43…452 см³, давление на впуске 0,92 бар — значение модели', () => {
  const { liveRows, sim } = makeLiveRows();
  sim.theta = 0;
  assert.equal(row(liveRows('head'), 'Объём'), '43 см³');
  sim.theta = 180 * spec.DEG;
  assert.equal(row(liveRows('head'), 'Объём'), '452 см³');
  // 0,92 бар — плато pressureAt на такте впуска (φ 400…500°), формулы давления D-05 не меняет
  for (let phi = 400; phi <= 500; phi += 0.5) assert.equal(pressureAt(phi), 0.92, `pressureAt(${phi})`);
  const intake = liveRows('intake');
  assert.equal(row(intake, 'Давление на впуске (модель)'), pressureAt(450).toFixed(2).replace('.', ',') + ' бар');
  assert.ok(!intake.some(([k]) => /ресивер/i.test(k)), 'в модели нет ресивера: подпись не должна его упоминать');
});

test('показания: в Engine.html нет множителей хода 86 мм и подъёма 9,6 мм', () => {
  const src = functionSource('liveRows');
  assert.doesNotMatch(src, /\*\s*86\b/);
  assert.doesNotMatch(src, /\*\s*9\.6\b/);
  assert.ok(!LINES.some(l => l.includes('Давление в ресивере')), '«Давление в ресивере»');
});
