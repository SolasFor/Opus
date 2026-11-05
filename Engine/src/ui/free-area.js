/* Свободная область кадра (П-4): прямоугольник окна между верхней панелью, боковыми панелями и лентой времени.
 * Центр кадра камеры сдвигается в её центр (camera.setViewOffset), расстояние до детали и стартовый кадр считаются
 * по её пропорциям. Без DOM и three.js — проверяет tests/free-area.test.js.
 * Прямоугольник f = { l, t, r, b } в CSS-пикселях окна W×H.
 */
const MIN_FREE = 0.4;                       // если панели оставляют меньше 40 % ширины или высоты — по этой оси не сдвигаем

// top — низ верхней панели; left — правый край левой панели, right — левый край правой, bottom — верх ленты;
// null — панели нет (скрыта). gap — отступ от панелей.
function freeRect(W, H, { top = 0, left = null, right = null, bottom = null, gap = 0 } = {}) {
  let l = left === null ? 0 : left + gap, r = right === null ? W : right - gap;
  if (r - l < W * MIN_FREE) { l = 0; r = W; }
  let t = top + gap, b = bottom === null ? H : bottom - gap;
  if (b - t < H * MIN_FREE) { t = top; b = H; }
  return { l, t, r, b };
}
// сдвиг для camera.setViewOffset(W, H, x, y, W, H): точка прицела камеры оказывается в центре области
const viewShift = (W, H, f) => ({ x: W / 2 - (f.l + f.r) / 2, y: H / 2 - (f.t + f.b) / 2 });
// тангенсы половин углов обзора, которые приходятся на область: по вертикали и по горизонтали
function halfTans(fovDeg, W, H, f) {
  const t = Math.tan(fovDeg * Math.PI / 360);
  return { v: t * (f.b - f.t) / H, h: t * (f.r - f.l) / H };
}
// расстояние, на котором сфера radius вписывается в область; для области во всё окно — прежняя формула distFor()
function fitDistance(radius, fovDeg, W, H, f, pad = 1.18) {
  const { v, h } = halfTans(fovDeg, W, H, f);
  return radius / Math.sin(Math.atan(Math.min(v, h))) * pad * 0.92;
}
// NDC всего окна → NDC области: края области — ±1
function toFreeNdc(x, y, W, H, f) {
  const px = (x + 1) / 2 * W, py = (1 - y) / 2 * H;
  return [(px - f.l) / (f.r - f.l) * 2 - 1, 1 - (py - f.t) / (f.b - f.t) * 2];
}
// во сколько раз отодвинуть стартовую камеру CAM_HOME от TGT_HOME, чтобы двигатель занял область так же, как раньше
// всё окно в альбомной ориентации (там его ограничивает высота окна): узкое окно и панели отодвигают камеру, не ближе 1
function homeScale(fovDeg, W, H, f) {
  const { v, h } = halfTans(fovDeg, W, H, f);
  return Math.max(1, Math.tan(fovDeg * Math.PI / 360) / Math.min(v, h));
}

// M-05c: расстояние для «Приблизить» до детали радиуса r (половина диагонали её рамки). На десктопе и планшете —
// прежнее max(2,3·r, 2,6). На телефоне (sheet — режим шторки) область над шторкой узкая и невысокая: камера
// отодвигается так же, как стартовый кадр (homeScale), и не ближе, чем сфера детали вписывается в область, —
// длинная деталь (коленвал) иначе выходит за края по ширине
function focusDistance(r, fovDeg, W, H, f, sheet) {
  const d = Math.max(r * 2.3, 2.6);
  return sheet ? Math.max(d * homeScale(fovDeg, W, H, f), fitDistance(r, fovDeg, W, H, f)) : d;
}

export { MIN_FREE, freeRect, viewShift, fitDistance, toFreeNdc, homeScale, focusDistance };
