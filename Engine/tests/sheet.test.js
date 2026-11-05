/**
 * M-05c: телефон — шторка (src/ui/sheet-model.js, src/ui/sheet.js), режимы раскладки (src/ui/layout.js), разметка
 * шторки (index.html) и её стили (styles/app.css). П-6, П-7 и §5 в 14_M05.
 *   1) Высоты stopHeight(): 124 px (плюс безопасная зона), 45 % и 85 % окна, по возрастанию даже в низком окне.
 *   2) snapStop(): без взмаха — ближайшая высота; взмах — следующая в его сторону, у края — край. nextStop(): касание
 *      по кругу, стрелки — выше и ниже без перехода через край.
 *   3) layoutMode(w, h): десктоп ≥1100 px по ширине при любой высоте; ниже — альбом при высоте <500 px, планшет
 *      760–1099 px, телефон <760 px. Те же границы — у @media шторки в app.css.
 *   4) Таблица MOVES: каждый селектор находит в index.html ровно один элемент, контейнер есть в шторке; ничего не
 *      переносится дважды. Каждая кнопка и ползунок боковых панелей и ленты либо уезжает в шторку вместе со своим
 *      блоком, либо в списке NOT_MOVED с причиной; кнопки верхней панели, которых нет на телефоне, заменены.
 *   5) Вкладки: tablist из 4 вкладок в порядке TABS, aria-controls ↔ tabpanel с aria-labelledby, выбрана первая,
 *      остальные с tabindex="-1" и их панели скрыты.
 *   6) Стили: шторка без backdrop-filter, высота из --sheet-h с запасным значением SHEET_MIN, безопасные зоны env(),
 *      на reduced motion анимация высоты выключается общим правилом.
 * Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHEET_MIN, SHEET_HALF, SHEET_FULL, FLING_V, STOPS, TABS, MOVES, stopHeight, snapStop, nextStop } from '../src/ui/sheet-model.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const INDEX = read('../index.html'), APP = read('../styles/app.css'), LAYOUT = read('../src/ui/layout.js');
const BODY = INDEX.slice(INDEX.indexOf('<body>'), INDEX.indexOf('<script>'));
const count = (s, sub) => s.split(sub).length - 1;
// фрагмент разметки от открывающего тега элемента с этим id до его закрывающего тега (вложенные того же тега учитываются)
function block(html, id) {
  const i = html.indexOf(`id="${id}"`); assert.ok(i >= 0, id);
  const start = html.lastIndexOf('<', i), tag = html.slice(start + 1).match(/^\w+/)[0];
  let depth = 0; const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g'); re.lastIndex = start;
  for (let m; (m = re.exec(html));) { depth += m[1] ? -1 : 1; if (!depth) return html.slice(start, re.lastIndex); }
  throw new Error('нет закрывающего тега ' + id);
}

test('высоты шторки: 124 px с безопасной зоной, 45 % и 85 % окна, по возрастанию', () => {
  assert.equal(SHEET_MIN, 124); assert.equal(SHEET_HALF, 0.45); assert.equal(SHEET_FULL, 0.85);
  assert.deepEqual(STOPS.map(s => stopHeight(s, 844)), [124, 380, 717]);
  assert.deepEqual(STOPS.map(s => stopHeight(s, 800)), [124, 360, 680]);
  assert.deepEqual(STOPS.map(s => stopHeight(s, 844, 34)), [158, 380, 717]);
  for (let H = 200; H <= 1400; H += 7) {
    const [a, b, c] = STOPS.map(s => stopHeight(s, H, H % 3 ? 0 : 30));
    assert.ok(a <= b && b <= c, `H=${H}`);
  }
});

test('после перетаскивания: ближайшая высота, взмах — следующая в его сторону; касание и стрелки', () => {
  const H = 844;                            // 124, 380, 717
  assert.equal(snapStop(130, 0, H), 'min'); assert.equal(snapStop(260, 0, H), 'half'); assert.equal(snapStop(240, 0, H), 'min');
  assert.equal(snapStop(560, 0, H), 'full'); assert.equal(snapStop(540, 0, H), 'half'); assert.equal(snapStop(717, 0, H), 'full');
  assert.equal(snapStop(424, FLING_V * 0.9, H), 'half', 'медленно — не взмах');
  assert.equal(snapStop(390, FLING_V * 2, H), 'full'); assert.equal(snapStop(380, FLING_V * 2, H), 'full');
  assert.equal(snapStop(200, FLING_V * 2, H), 'half'); assert.equal(snapStop(717, FLING_V * 2, H), 'full');
  assert.equal(snapStop(700, -FLING_V * 2, H), 'half'); assert.equal(snapStop(380, -FLING_V * 2, H), 'min');
  assert.equal(snapStop(124, -FLING_V * 2, H), 'min'); assert.equal(snapStop(600, -FLING_V * 2, H), 'half');
  assert.deepEqual(STOPS.map(s => nextStop(s)), ['half', 'full', 'min']);
  assert.deepEqual(STOPS.map(s => nextStop(s, 1)), ['half', 'full', 'full']);
  assert.deepEqual(STOPS.map(s => nextStop(s, -1)), ['min', 'min', 'half']);
});

test('режимы раскладки: layoutMode(w, h) и @media шторки в app.css', () => {
  const src = ['const BREAK', 'const LANDSCAPE_H', 'const layoutMode'].map(k => LAYOUT.split('\n').find(l => l.startsWith(k)));
  assert.ok(src.every(Boolean), 'BREAK, LANDSCAPE_H, layoutMode — по строке в layout.js');
  const { BREAK, LANDSCAPE_H, layoutMode } = new Function(src.join('\n') + '\nreturn { BREAK, LANDSCAPE_H, layoutMode };')();
  assert.equal(LANDSCAPE_H, 500);
  const cases = { '1440x900': 'desktop', '1100x400': 'desktop', '1280x480': 'desktop', '1024x768': 'tablet', '760x500': 'tablet',
    '1099x499': 'landscape', '844x390': 'landscape', '760x499': 'landscape', '667x375': 'landscape', '759x500': 'phone', '390x844': 'phone', '360x800': 'phone' };
  for (const [k, m] of Object.entries(cases)) { const [w, h] = k.split('x').map(Number); assert.equal(layoutMode(w, h), m, k); }
  assert.equal(layoutMode(390), 'phone', 'без высоты — по ширине, как до M-05c');
  const d = BREAK.desktop - 1, t = BREAK.tablet - 1, lh = LANDSCAPE_H - 1;
  assert.match(APP, new RegExp(`@media \\(max-width:${t}px\\), \\(max-width:${d}px\\) and \\(max-height:${lh}px\\)\\{`), 'общие правила шторки');
  assert.match(APP, new RegExp(`@media \\(max-width:${t}px\\) and \\(min-height:${LANDSCAPE_H}px\\)\\{`), 'портрет');
  assert.match(APP, new RegExp(`@media \\(max-width:${d}px\\) and \\(max-height:${lh}px\\)\\{`), 'альбом');
  for (const m of APP.matchAll(/@media[^{]*?(max|min)-height:(\d+)px/g)) assert.ok(+m[2] === lh || +m[2] === LANDSCAPE_H, m[0]);
});

// не переносятся в шторку: [id, почему]
const NOT_MOVED = {
  helpLink2: 'подсказки про мышь внизу левой панели; на телефоне справка — кнопка «?» верхней панели',
  infoClose: 'в карточке #infocard', btnFocus: 'в карточке', btnIsolate: 'в карточке',
};
test('перенос в шторку: селекторы MOVES, контейнеры, ничего не теряется и не переносится дважды', () => {
  const sel = s => s.startsWith('#') ? `id="${s.slice(1)}"` : s.match(/^\.sec\[data-sec="(\w+)"\]$/) ? `data-sec="${s.match(/"(\w+)"/)[1]}"` : `class="${s.slice(1)}"`;
  const sheet = block(BODY, 'sheet');
  const seen = new Set();
  for (const [s, to] of MOVES) {
    assert.equal(count(BODY, sel(s)), 1, s);
    assert.ok(!seen.has(s), 'дважды: ' + s); seen.add(s);
    assert.equal(count(sheet, `id="${to}"`), 1, `контейнер ${to} в шторке`);
    assert.equal(count(sheet, sel(s)), 0, `${s} не дублируется в разметке шторки`);
  }
  // каждый элемент управления боковых панелей и ленты уезжает со своим блоком
  const blocks = MOVES.map(([s]) => s.startsWith('#') ? block(BODY, s.slice(1)) : s.startsWith('.sec')
    ? BODY.slice(BODY.indexOf(sel(s)) - 30, BODY.indexOf('</section>', BODY.indexOf(sel(s))) + 10) : block(BODY, 'cycle').match(/<footer class="panel-foot"[\s\S]*?<\/footer>/)[0]);
  for (const panel of ['hud', 'cycle', 'timeline']) {
    for (const [, id] of block(BODY, panel).matchAll(/<(?:button|input)\b[^>]*\bid="(\w+)"/g)) {
      if (NOT_MOVED[id]) continue;
      assert.ok(blocks.some(b => b.includes(`id="${id}"`)), `${panel}: #${id} не попадает в шторку`);
    }
  }
  // кнопки верхней панели: переносятся, остаются (справка, изоляция) или заменены на телефоне
  const STAYS = ['helpLink', 'btnUnIso', 'sheetToggle'], REPLACED = { btnCam: 'кнопки #camSeg во вкладке «Вид»', btnReset: '#btnCamReset',
    drawerLeft: 'вкладки шторки', drawerRight: 'вкладки шторки', btnPanels: 'H и кнопка шторки' };
  for (const [, id] of block(BODY, 'appbar').matchAll(/<(?:button|input)\b[^>]*\bid="(\w+)"/g)) {
    if (STAYS.includes(id) || REPLACED[id]) continue;
    assert.ok(blocks.some(b => b.includes(`id="${id}"`)), `appbar: #${id} не попадает в шторку`);
  }
  assert.equal(count(sheet, 'data-preset='), 4); assert.equal(count(sheet, 'id="btnCamReset"'), 1);
  for (const p of ['front', 'side', 'top', 'iso']) assert.match(sheet, new RegExp(`data-preset="${p}" aria-keyshortcuts="${['front', 'side', 'top', 'iso'].indexOf(p) + 1}"`));
});

test('вкладки шторки: tablist, aria-controls ↔ tabpanel, выбрана первая', () => {
  const sheet = block(BODY, 'sheet');
  assert.match(sheet, /<aside id="sheet" class="panel sheet" aria-label="Панель управления" hidden>/);
  assert.match(sheet, /id="sheetTabs" role="tablist" aria-label="[^"]+"/);
  const tabs = [...sheet.matchAll(/<button type="button" role="tab" id="tab-(\w+)" data-tab="(\w+)" aria-controls="pane-(\w+)" aria-selected="(true|false)"( tabindex="-1")?>([^<]+)<\/button>/g)];
  assert.deepEqual(tabs.map(m => m[1]), TABS);
  assert.deepEqual(tabs.map(m => m[6]), ['Работа', 'Разборка', 'Вид', 'Детали']);
  tabs.forEach((m, i) => {
    assert.equal(m[1], m[2]); assert.equal(m[1], m[3]);
    assert.equal(m[4], String(i === 0)); assert.equal(!!m[5], i > 0);
    assert.match(sheet, new RegExp(`id="pane-${m[1]}" role="tabpanel" aria-labelledby="tab-${m[1]}"${i ? ' hidden' : ''}>`));
  });
  assert.match(sheet, /<button class="sheet-handle" id="sheetHandle" type="button" aria-controls="sheetBody" aria-expanded="false" aria-label="Развернуть шторку">/);
  assert.match(sheet, /id="fireMini" aria-hidden="true"><i data-c="0">1<\/i><i data-c="2">3<\/i><i data-c="3">4<\/i><i data-c="1">2<\/i><\/div>/);
  assert.match(BODY, /id="sheetToggle" aria-keyshortcuts="H" type="button" aria-controls="sheet" aria-pressed="true" aria-label="Панель управления"/);
});

test('стили шторки: --sheet-h, без backdrop-filter, безопасные зоны, без анимации при reduced motion', () => {
  assert.match(APP, new RegExp(`height:var\\(--sheet-h,${SHEET_MIN}px\\)`));
  assert.match(APP, /\.sheet\[hidden\]\{display:none\}/);
  assert.match(APP, /\.sheet-pane\[hidden\]\{display:none\}/);
  const common = APP.match(/@media \(max-width:759px\), \(max-width:1099px\) and \(max-height:499px\)\{([\s\S]*?)\n\}/)[1];
  assert.match(common, /\.panel\{backdrop-filter:none;-webkit-backdrop-filter:none\}/);
  for (const side of ['top', 'bottom', 'left', 'right']) assert.match(APP, new RegExp(`env\\(safe-area-inset-${side}\\)`), side);
  assert.match(INDEX, /<meta name="viewport" content="[^"]*viewport-fit=cover[^"]*" \/>/);
  assert.match(APP, /\.sheet\.dragging\{transition:none\}/);
  assert.match(APP, /\.sheet-head\{[^}]*touch-action:none/);
  assert.match(APP, /@media \(prefers-reduced-motion:reduce\)\{\n  \*,::before,::after\{transition-duration:0s!important;/);
});
