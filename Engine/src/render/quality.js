/* Уровни качества (M-07a). «Высокое» — с экранным затенением GTAO (render/post.js), «стандартное» — без него.
 * По умолчанию AO включён на компьютере с WebGL2 и выключен на сенсорных устройствах (pointer: coarse);
 * ?ao включает его, ?noao выключает; без WebGL2 AO нет никогда.
 * Если кадр не укладывается в бюджет даже при pixelRatio 1, адаптивное разрешение в main.js выключает AO до
 * перезагрузки страницы: SLOW_RUN измерений подряд (по одному в секунду) медленнее FPS_LOW — того же порога,
 * при котором main.js снижает разрешение.
 * M-07c: уровень детализации «низкий» (lowDetail): вдвое меньше сегментов, без крепежа и мелочи, без AO
 * (render/parts/geometry.js). По умолчанию — на сенсорных устройствах; ?lod=low включает его, ?lod=high выключает.
 * ?ao включает AO и на уровне «низкий».
 * M-06b: шаг адаптивного разрешения (adaptPR) — с гистерезисом, см. ниже.
 * Модуль ничего не импортирует: решения — чистые функции, их проверяют tests/look.test.js и tests/perf.test.js.
 */

const FPS_LOW = 46, SLOW_RUN = 3;
/* query — URLSearchParams адреса страницы */
function wantAO(query, { webgl2, coarse, low = false }) {
  if (!webgl2 || query.has('noao')) return false;
  if (query.has('ao')) return true;
  return !coarse && !low;
}
/* M-07c: уровень «низкий» до сборки модели; query — как у wantAO */
function lowDetail(query, { coarse }) {
  const lod = query.get('lod');
  return lod === 'low' || (lod !== 'high' && coarse);
}
/* run — сколько измерений подряд кадр медленный при разрешении не выше 1×; AO выключается, когда run ≥ SLOW_RUN */
const slowRun = (run, fps, pr) => (fps < FPS_LOW && pr <= 1 ? run + 1 : 0);
/* M-06b: адаптивное разрешение, одно измерение fps в секунду. Как и раньше: fps < FPS_LOW — pixelRatio ниже на PR_STEP
 * (не ниже 1×) сразу; fps > FPS_HIGH hold измерений подряд — выше на PR_STEP (не выше maxPR). Новое — гистерезис:
 * если в первые TRIAL измерений после повышения fps снова ниже FPS_LOW, повышение не удалось, и следующего придётся
 * ждать вдвое дольше (4 → 8 → 16 с). Повышение, которое продержалось TRIAL измерений, возвращает ожидание к 4 с.
 * Без гистерезиса нагрузка на границе двух уровней качала разрешение каждые 5 с: вверх, через секунду вниз.
 * s — состояние прошлого шага (в начале — ADAPT0 с pr); возвращается новое, s не меняется */
const FPS_HIGH = 58, PR_STEP = 0.25, HOLD = 4, HOLD_MAX = 16, TRIAL = 10;
const ADAPT0 = { pr: 1, good: 0, hold: HOLD, since: Infinity };
function adaptPR(s, fps, maxPR) {
  let { pr, good, hold, since } = s;
  since++;
  if (fps < FPS_LOW && pr > 1) {
    if (since <= TRIAL) hold = Math.min(HOLD_MAX, hold * 2);
    pr = Math.max(1, pr - PR_STEP); good = 0; since = Infinity;
  } else {
    if (since === TRIAL + 1) hold = HOLD;
    if (fps > FPS_HIGH) { if (++good >= hold && pr < maxPR) { pr = Math.min(maxPR, pr + PR_STEP); good = 0; since = 0; } }
    else good = 0;
  }
  return { pr, good, hold, since };
}

export { FPS_LOW, SLOW_RUN, wantAO, lowDetail, slowRun, FPS_HIGH, HOLD, HOLD_MAX, TRIAL, ADAPT0, adaptPR };
