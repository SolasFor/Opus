/**
 * M-05b: шкала тактов «Фаз цилиндров» и ленты времени (src/ui/phase-scale.js) согласована с моделью:
 *   1) отрезки тактов цилиндра покрывают 0–720° без пропусков и наложений, такт под каждым углом — strokeOf(φ),
 *      φ = cylinderPhaseDeg (как в прежней диаграмме на canvas и в sim/cycle.js);
 *   2) номера тактов: 1 впуск, 2 сжатие, 3 рабочий ход, 4 выпуск (П-10);
 *   3) метки ВМТ и НМТ стоят там, где поршень выбранного цилиндра в ВМТ и НМТ (sim/kinematics.js);
 *   4) искра — за SPARK_ADV° до начала рабочего хода;
 *   5) классы, которые создаёт ui/phases.js, описаны в styles/app.css и не заняты разметкой index.html
 *      (иначе стили компонентов смешиваются).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEG, FIRE_DEG, SPARK_ADV } from '../src/config/engine-spec.js';
import { cylinderPhaseDeg, strokeOf } from '../src/sim/cycle.js';
import { pistonPinY, PIN_TDC, PIN_BDC } from '../src/sim/kinematics.js';
import { STROKE_NUM, STROKE_CLS, pctOf, strokeSpans, deadCentres, sparkAt } from '../src/ui/phase-scale.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

test('отрезки тактов: покрывают 0–720° ровно один раз, такт под углом совпадает со strokeOf(φ)', () => {
  for (let i = 0; i < 4; i++) {
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
  // индексы STROKES: 0 рабочий ход, 1 выпуск, 2 впуск, 3 сжатие (sim/cycle.js, strokeOf)
  assert.deepEqual(STROKE_NUM, [3, 4, 1, 2]);
  assert.deepEqual(STROKE_CLS, ['s-po', 's-ex', 's-in', 's-co']);
  assert.equal(pctOf(360), '50%');
  assert.equal(pctOf(100), '13.889%');
});

test('ВМТ и НМТ: поршень цилиндра в верхней и нижней мёртвой точке', () => {
  for (let i = 0; i < 4; i++) {
    const marks = deadCentres(i);
    assert.deepEqual(marks.map(m => m.deg), [...marks.map(m => m.deg)].sort((a, b) => a - b));
    assert.ok(marks.length >= 4 && marks.every(m => m.deg >= 0 && m.deg <= 720));
    // FIRE_DEG кратны 180°: границы тактов на 0, 180, 360, 540 и 720° — шкала закрыта с обеих сторон
    assert.deepEqual(marks.map(m => m.deg), [0, 180, 360, 540, 720], `Ц${i + 1}`);
    assert.equal(marks[0].name, marks[4].name, `Ц${i + 1}: 0° и 720° — одна и та же мёртвая точка`);
    for (const m of marks) {
      const y = pistonPinY(cylinderPhaseDeg(m.deg * DEG, i));
      assert.ok(near(y, m.name === 'ВМТ' ? PIN_TDC : PIN_BDC, 1e-6), `Ц${i + 1}, ${m.deg}° — ${m.name}: y = ${y}`);
    }
  }
});

test('искра — за SPARK_ADV° до рабочего хода', () => {
  for (let i = 0; i < 4; i++) {
    const s = sparkAt(i);
    assert.ok(s >= 0 && s < 720);
    assert.ok(near(cylinderPhaseDeg((s + SPARK_ADV) * DEG, i), 0, 1e-6) || near(cylinderPhaseDeg((s + SPARK_ADV) * DEG, i), 720, 1e-6), `Ц${i + 1}`);
    assert.equal(strokeOf(cylinderPhaseDeg(s * DEG, i)), 3, `Ц${i + 1}: искра в конце сжатия`);
  }
  assert.deepEqual(FIRE_DEG.map((_, i) => sparkAt(i)), [710, 530, 170, 350]);
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
