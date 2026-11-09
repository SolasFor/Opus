/**
 * Качество кадра (A-05): чистые решения без three и DOM — MSAA контекста WebGL и стартовое разрешение.
 * Замер A-05 (Intel UHD 0x46A3, ANGLE D3D11, окно 1440×900, DPR 1.75, ?noadapt, частота кадров не ограничена):
 * с MSAA — 38–47 кадров/с, без MSAA — 66–81; при DPR 1.25 — 54–76 и 87–127. Кадр упирается в заполнение пикселей.
 * На плотном экране (DPR от AA_MAX_PR) ступеньки на краях скрадывает сама плотность пикселей — MSAA там нет;
 * на обычном MSAA остаётся, пока кадр не больше AA_PIX пикселей. ?aa=1 — MSAA всегда, ?aa=0 — никогда (для сравнения).
 * Замер A-05b (тот же ПК, vsync): при 1.5–1.75 кадр GPU не укладывается в 16,7 мс — 6–9 % кадров по 33 мс при JS кадра 1–7 мс,
 * при 1.25 — 1,5 %. Поэтому старт — с запасом (Р-A15), а выше разрешение поднимает adaptStep, когда кадры ровные.
 * Стартовое разрешение — в бюджете пикселей (PIX без MSAA, AA_PIX с MSAA) и на сетке шага adaptStep (adapt.js);
 * дальше разрешение ведёт adaptStep. MSAA выбирается один раз, при создании renderer. Проверки — tests/quality.test.js.
 */
const QUALITY = Object.freeze({
  AA_MAX_PR: 1.5,          // с этой плотности пикселей MSAA выключен
  AA_PIX: 2.1e6,           // MSAA — пока кадр не больше 2,1 Мп (1920×1080 при DPR 1 — ещё с MSAA)
  PIX: 2.6e6,              // Р-A15: без MSAA стартовый кадр — до 2,6 Мп (1440×900 при DPR 1.75 — с 1.25 = 2,03 Мп; выше ведёт adaptStep)
  STEP: 0.25, MIN: 0.75,   // как ADAPT.STEP и ADAPT.MIN (adapt.js): стартовое разрешение — на той же сетке
});
// MSAA для экрана с плотностью dpr и окном w×h (CSS-пиксели); search — location.search
function msaaFor(dpr, w, h, search) {
  const q = new URLSearchParams(search || '').get('aa');
  if (q === '1') return true;
  if (q === '0') return false;
  const pr = dpr > 0 ? dpr : 1;
  return pr < QUALITY.AA_MAX_PR && w * h * pr * pr <= QUALITY.AA_PIX;
}
// стартовый pixelRatio: maxPR, если кадр в бюджете, иначе ступень сетки STEP под бюджетом, но не ниже MIN
function startPR(maxPR, w, h, msaa) {
  const fit = Math.sqrt((msaa ? QUALITY.AA_PIX : QUALITY.PIX) / Math.max(1, w * h));
  if (fit >= maxPR) return maxPR;
  return Math.min(maxPR, Math.max(QUALITY.MIN, Math.floor(fit / QUALITY.STEP) * QUALITY.STEP));
}

export { msaaFor, QUALITY, startPR };
