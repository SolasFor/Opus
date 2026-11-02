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

// Значения констант Engine.html: строки объявлений исполняются в порядке файла.
function htmlConstants(names) {
  const idx = [...new Set(names.map(declarationIndex))].sort((a, b) => a - b);
  return new Function('THREE', `'use strict';\n${idx.map(i => LINES[i]).join('\n')}\nreturn { ${names.join(', ')} };`)(THREE_STUB);
}

// Числовые параметры, которые есть и в Engine.html, и в engine-spec.js.
const SHARED = ['DEG', 'CRANK_Y', 'CRANK_R', 'ROD_L', 'BORE_R', 'VALVE_TILT', 'CAM_LIFT', 'CAM_HALF',
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
