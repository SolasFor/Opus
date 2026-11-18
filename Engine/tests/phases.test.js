/**
 * M-05b / V12: шкала тактов «Фаз цилиндров» и ленты времени для 12 цилиндров (src/ui/phase-scale.js).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEG, CYLINDERS, FIRE_DEG, SPARK_ADV } from '../src/config/engine-spec.js';
import { cylinderPhaseDeg, strokeOf } from '../src/sim/cycle.js';
import { pistonPinDist, PIN_TDC_R, PIN_BDC_R } from '../src/sim/kinematics.js';
import { STROKE_NUM, STROKE_CLS, pctOf, strokeSpans, deadCentres, sparkAt } from '../src/ui/phase-scale.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

test('отрезки тактов V12: 12 цилиндров покрывают 0–720° без пропусков и наложений', () => {
  for (let i = 0; i < CYLINDERS; i++) {
    const all = [0, 1, 2, 3].flatMap(k => strokeSpans(i, k).map(([a, b]) => ({ a, b, k })));
    assert.equal(all.reduce((s, x) => s + x.b - x.a, 0), 720, `Ц${i + 1}: сумма отрезков`);
    for (let d = 0.5; d < 720; d += 1) {
      const hit = all.filter(x => x.a <= d && d < x.b);
      assert.equal(hit.length, 1, `Ц${i + 1}, ${d}°: отрезков ${hit.length}`);
      assert.equal(hit[0].k, strokeOf(cylinderPhaseDeg(d * DEG, i)), `Ц${i + 1}, ${d}°`);
    }
  }
});

test('номера и классы тактов: 1 впуск, 2 сжатие, 3 рабочий ход, 4 выпуск', () => {
  assert.deepEqual(STROKE_NUM, [3, 4, 1, 2]);
  assert.deepEqual(STROKE_CLS, ['s-po', 's-ex', 's-in', 's-co']);
  assert.equal(pctOf(360), '50%');
  assert.equal(pctOf(100), '13.889%');
});

test('ВМТ и НМТ: поршень каждого из 12 цилиндров в верхней и нижней мёртвой точке', () => {
  for (let i = 0; i < CYLINDERS; i++) {
    const marks = deadCentres(i);
    assert.deepEqual(marks.map(m => m.deg), [...marks.map(m => m.deg)].sort((a, b) => a - b));
    assert.ok(marks.length >= 4 && marks.every(m => m.deg >= 0 && m.deg <= 720));
    assert.equal(marks.length, FIRE_DEG[i] % 180 === 0 ? 5 : 4, `Ц${i + 1}`);
    for (const m of marks) {
      const r = pistonPinDist(cylinderPhaseDeg(m.deg * DEG, i));
      assert.ok(near(r, m.name === 'ВМТ' ? PIN_TDC_R : PIN_BDC_R, 1e-6), `Ц${i + 1}, ${m.deg}° — ${m.name}: r = ${r}`);
    }
  }
});

test('искра — за SPARK_ADV° до рабочего хода для всех 12 цилиндров', () => {
  for (let i = 0; i < CYLINDERS; i++) {
    const s = sparkAt(i);
    assert.ok(s >= 0 && s < 720);
    assert.ok(near(cylinderPhaseDeg((s + SPARK_ADV) * DEG, i), 0, 1e-6) || near(cylinderPhaseDeg((s + SPARK_ADV) * DEG, i), 720, 1e-6), `Ц${i + 1}`);
    assert.equal(strokeOf(cylinderPhaseDeg(s * DEG, i)), 3, `Ц${i + 1}: искра в конце сжатия`);
  }
  const sparks = FIRE_DEG.map((_, i) => sparkAt(i));
  assert.equal(new Set(sparks).size, 12, 'у каждого из 12 цилиндров свой угол зажигания');
});

test('классы строк «Фаз» и полос ленты: есть в app.css, не заняты разметкой index.html', () => {
  const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
  const js = read('../src/ui/phases.js'), css = read('../styles/app.css'), html = read('../index.html');
  const made = new Set([...js.matchAll(/node\('\w+', '([^']+)'/g)].flatMap(m => m[1].split(' ')).concat(['now', 'first', 'last'], STROKE_CLS));
  for (const c of [...js.matchAll(/'(stk|tick) ' \+/g)].map(m => m[1])) made.add(c);
  const used = new Set([...html.matchAll(/\sclass="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)));
  for (const c of made) {
    assert.match(css, new RegExp(`\\.${c}(?![\\w-])`), `app.css: нет .${c}`);
    if (!STROKE_CLS.includes(c)) assert.ok(!used.has(c), `index.html уже использует класс ${c}`);
  }
});
