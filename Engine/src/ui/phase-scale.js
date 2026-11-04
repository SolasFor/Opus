/* Шкала тактов 0–720° для строк «Фазы цилиндров» и ленты времени (П-9, П-10): номера и классы тактов, отрезки такта
 * цилиндра на шкале, ВМТ и НМТ, искра. Без DOM и three.js — проверяет tests/phases.test.js.
 * M-05b: отрезки считаются так же, как в прежней диаграмме ui/charts/timing.js: такт k (индекс STROKES: рабочий ход,
 * выпуск, впуск, сжатие) цилиндра i начинается в mod(FIRE_DEG[i] + 180k, 720), искра — в mod(FIRE_DEG[i] − SPARK_ADV, 720).
 */
import { FIRE_DEG, SPARK_ADV } from '../config/engine-spec.js';
import { mod } from '../sim/math.js';

const STROKE_NUM = [3, 4, 1, 2];                    // номер такта для индекса STROKES: 1 впуск, 2 сжатие, 3 рабочий ход, 4 выпуск
const STROKE_CLS = ['s-po', 's-ex', 's-in', 's-co'];
const pctOf = d => +(d / 7.2).toFixed(3) + '%';
// отрезки такта k цилиндра i на шкале 0–720°: [[начало, конец]], через 720° — два отрезка
function strokeSpans(i, k) {
  const a = mod(FIRE_DEG[i] + k * 180, 720), b = a + 180;
  return b <= 720 ? [[a, b]] : [[a, 720], [0, b - 720]];
}
// границы тактов цилиндра i: ВМТ в начале рабочего хода и впуска, НМТ в начале выпуска и сжатия; 0° повторяется в 720°
function deadCentres(i) {
  const marks = [0, 1, 2, 3].map(k => ({ deg: mod(FIRE_DEG[i] + k * 180, 720), name: k % 2 ? 'НМТ' : 'ВМТ' }));
  const zero = marks.find(m => m.deg === 0);
  if (zero) marks.push({ deg: 720, name: zero.name });
  return marks.sort((a, b) => a.deg - b.deg);
}
const sparkAt = i => mod(FIRE_DEG[i] - SPARK_ADV, 720);

export { STROKE_NUM, STROKE_CLS, pctOf, strokeSpans, deadCentres, sparkAt };
