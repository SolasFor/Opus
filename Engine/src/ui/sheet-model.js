/* Шторка телефона без DOM и three.js (M-05c): высоты, выбор высоты после перетаскивания, вкладки и что переносится
 * в шторку. Поведение и разметка — ui/sheet.js; проверяет tests/sheet.test.js.
 * Высоты: свёрнутая SHEET_MIN px (плюс безопасная зона снизу), половина окна SHEET_HALF, почти всё окно SHEET_FULL.
 * После перетаскивания — ближайшая высота, а при быстром взмахе (скорость за последние FLING_MS мс выше FLING_V px/мс)
 * — следующая в его сторону. Сдвиг меньше TAP_PX — касание, а не перетаскивание.
 */
const SHEET_MIN = 124, SHEET_HALF = 0.45, SHEET_FULL = 0.85, FLING_MS = 150, FLING_V = 0.4, TAP_PX = 8;
const STOPS = ['min', 'half', 'full'];
const TABS = ['work', 'explode', 'view', 'parts'];
// что переносится в шторку: [селектор, id контейнера]; порядок — порядок на экране
const MOVES = [
  ['#btnRun', 'barSlot'], ['#readout', 'barSlot'],
  ['#tlMain', 'pane-work'], ['#tlScrub', 'pane-work'], ['.sec[data-sec="phases"]', 'pane-work'], ['#pvWrap', 'pane-work'], ['.panel-foot', 'pane-work'],
  ['.sec[data-sec="explode"]', 'pane-explode'],
  ['#viewSeg', 'viewSlot'], ['#cutRow', 'viewSlot'],
  ['#btnLabels', 'sheetTogs'], ['#btnRotate', 'sheetTogs'], ['#btnSound', 'sheetTogs'], ['#btnShot', 'sheetTogs'],
  ['#infocard', 'pane-parts'], ['.sec[data-sec="parts"]', 'pane-parts']
];

// высота шторки в px для окна высотой H; safe — безопасная зона снизу (env(safe-area-inset-bottom))
function stopHeight(stop, H, safe = 0) {
  const min = SHEET_MIN + safe, half = Math.max(min, Math.round(H * SHEET_HALF)), full = Math.max(half, Math.round(H * SHEET_FULL));
  return stop === 'full' ? full : stop === 'half' ? half : min;
}
// куда встать после перетаскивания: h — высота в момент отпускания, v — скорость (px/мс, больше 0 — вверх)
function snapStop(h, v, H, safe = 0) {
  const hs = STOPS.map(s => stopHeight(s, H, safe));
  if (v > FLING_V) { const i = hs.findIndex(x => x > h + 1); return STOPS[i < 0 ? 2 : i]; }
  if (v < -FLING_V) { const i = hs.findLastIndex(x => x < h - 1); return STOPS[i < 0 ? 0 : i]; }
  let best = 0;
  hs.forEach((x, k) => { if (Math.abs(x - h) < Math.abs(hs[best] - h)) best = k; });
  return STOPS[best];
}
// dir = 0 — по кругу (касание ручки), +1 и −1 — выше и ниже без перехода через край
const nextStop = (stop, dir = 0) => {
  const i = STOPS.indexOf(stop);
  return STOPS[dir ? Math.min(2, Math.max(0, i + dir)) : (i + 1) % 3];
};

export { SHEET_MIN, SHEET_HALF, SHEET_FULL, FLING_MS, FLING_V, TAP_PX, STOPS, TABS, MOVES, stopHeight, snapStop, nextStop };
