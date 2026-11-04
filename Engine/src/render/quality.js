/* Уровни качества (M-07a). «Высокое» — с экранным затенением GTAO (render/post.js), «стандартное» — без него.
 * По умолчанию AO включён на компьютере с WebGL2 и выключен на сенсорных устройствах (pointer: coarse);
 * ?ao включает его, ?noao выключает; без WebGL2 AO нет никогда.
 * Если кадр не укладывается в бюджет даже при pixelRatio 1, адаптивное разрешение в main.js выключает AO до
 * перезагрузки страницы: SLOW_RUN измерений подряд (по одному в секунду) медленнее FPS_LOW — того же порога,
 * при котором main.js снижает разрешение.
 * Модуль ничего не импортирует: решения — чистые функции, их проверяет tests/look.test.js.
 */

const FPS_LOW = 46, SLOW_RUN = 3;
/* query — URLSearchParams адреса страницы */
function wantAO(query, { webgl2, coarse }) {
  if (!webgl2 || query.has('noao')) return false;
  if (query.has('ao')) return true;
  return !coarse;
}
/* run — сколько измерений подряд кадр медленный при разрешении не выше 1×; AO выключается, когда run ≥ SLOW_RUN */
const slowRun = (run, fps, pr) => (fps < FPS_LOW && pr <= 1 ? run + 1 : 0);

export { FPS_LOW, SLOW_RUN, wantAO, slowRun };
