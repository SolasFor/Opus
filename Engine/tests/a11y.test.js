/**
 * M-05d: доступность и ввод (§7 в 14_M05, T-24), строки и числа ru-RU (П-12), индикатор fps только с ?debug (П-13).
 * Проверяется без браузера; поведение на странице (дерево доступности, проход E-xx с клавиатуры, рамка фокуса,
 * reduced motion, контраст) проверяет браузерный прогон, его итог — в PR.
 *   1) ui/strings.ru.js: десятичная запятая, минус «−», неразрывный пробел перед единицей, угол без пробела, склонение;
 *      уведомления для устройств без клавиатуры не упоминают клавиш.
 *   2) Числа в интерфейсе выводятся только через strings.ru.js: toFixed() — только там и в CSS-значениях (labels.js,
 *      phase-scale.js); в строках кода src/ui/ и main.js нет «число + обычный пробел + единица».
 *   3) Разметка: <kbd> в кнопках скрыт от диктора, у кнопок с клавишей — aria-keyshortcuts; у холста — роль, имя
 *      и описание управления; декоративные слои скрыты; в радиогруппе «Вид» в порядке Tab только выбранный вид;
 *      у p–V — роль img и имя; блок «Сейчас» без aria-live; справка описывает сцену с клавиатуры; fps скрыт.
 *   4) Фокус (ui/focus.js): после указателя кнопки и ползунки теряют фокус, после клавиатуры — нет; фокус из скрываемого
 *      блока переносится, только если пришёл с клавиатуры. В input.js: фокус снимается только после мыши (e.detail > 0),
 *      Space и Enter на элементе управления не запускают двигатель, клавиши, уже обработанные меню или радиогруппой,
 *      не обрабатываются второй раз.
 *   5) Сниженное движение (ui/motion.js): не дольше 150 мс и без задержек; камера, разборка и шаги берут длительность
 *      из motion(), пролёт при старте и вспышка снимка выключаются; в app.css переходы — 0 с.
 *   6) app.css: рамка фокуса, рамка сцены по свободной области, цели 44 px на pointer: coarse, .sr-only.
 * Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { NB, MINUS, num, unit, percent, degrees, times, nb, plural, speedText, S, TOAST, toastText } from '../src/ui/strings.ru.js';
import { trackInput, viaKeyboard, blurAfterPointer, moveFocusOut } from '../src/ui/focus.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const INDEX = read('../index.html'), APP = read('../styles/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
const SRC = new URL('../src/', import.meta.url);
const walk = d => readdirSync(new URL(d, SRC), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(`${d}${e.name}/`) : e.name.endsWith('.js') ? [d + e.name] : []);
const JS = Object.fromEntries(walk('').map(f => [f, read(`../src/${f}`)]));
const code = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
const BODY = INDEX.slice(INDEX.indexOf('<body>'), INDEX.indexOf('<div id="loader">'));

test('strings.ru.js: запятая, минус, неразрывный пробел, угол без пробела', () => {
  assert.equal(NB, '\u00a0'); assert.equal(MINUS, '\u2212');
  assert.equal(num(18.46, 1), '18,5'); assert.equal(num(-3.14159, 2), MINUS + '3,14'); assert.equal(num(-0.04, 1), '0,0'); assert.equal(num(-0.4), '0');
  assert.equal(num(1634), '1634'); assert.equal(num(0.92, 2), '0,92');
  assert.equal(unit(18.46, 'бар', 1), '18,5\u00a0бар'); assert.equal(unit(180, '°C'), '180\u00a0°C');
  assert.equal(percent(0), '0\u00a0%'); assert.equal(percent(35), '35\u00a0%');
  assert.equal(degrees(52), '52°'); assert.equal(degrees(-12.34, 1), MINUS + '12,3°');
  assert.equal(times(2.6154, 2), '×2,62');
  assert.equal(nb('36 мм (½ хода)'), '36\u00a0мм (½ хода)'); assert.equal(nb('20 / 40 / 40 зубьев'), '20\u00a0/ 40\u00a0/ 40\u00a0зубьев');
  assert.equal(nb('Ø 60 мм, электронный'), 'Ø 60\u00a0мм, электронный');
  assert.deepEqual([1, 2, 4, 5, 10, 11, 12, 21, 22, 25, 101, 111].map(n => plural(n, ['узел', 'узла', 'узлов'])),
    ['узел', 'узла', 'узла', 'узлов', 'узлов', 'узлов', 'узлов', 'узел', 'узла', 'узлов', 'узел', 'узлов']);
  assert.equal(S.nodeCount(10), '10 узлов');
  assert.equal(S.cutOff(12), '+12\u00a0мм от оси'); assert.equal(S.cutOff(-30), MINUS + '30\u00a0мм от оси');
  assert.equal(S.pvReading(1.04, 'впуск'), '1,0\u00a0бар · впуск');
  assert.equal(S.angleText(52, 1, 'рабочий ход'), 'цикл 52°, цилиндр 1: рабочий ход');
  assert.equal(S.fps(59.6, 1.5, true), '60 fps · 1,5× · AO'); assert.equal(S.fps(30, 1, false), '30 fps · 1,0×');
});

test('strings.ru.js: скорость «×1,0 · 31 об/мин» на всём ходе ползунка', () => {
  const BASE_RPM = +JS['render/world.js'].match(/const BASE_RPM = ([\d.]+);/)[1];
  for (let v = 0; v <= 100; v++) {
    const e = 0.05 * Math.pow(200, v / 100);            // speedFromSlider() из ui/controls.js
    for (const k of [1, 0.2]) {
      const s = speedText(e * k, e * k * BASE_RPM);
      assert.match(s, /^×\d+,\d{1,2} · \d+(,\d)?\u00a0об\/мин$/, s);
      assert.doesNotMatch(s, /\./, s);
    }
  }
  assert.equal(speedText(1, BASE_RPM), `×1,0 · ${Math.round(BASE_RPM)}\u00a0об/мин`);
  assert.match(JS['ui/controls.js'], /function speedFromSlider\(v\) \{ return 0\.05 \* Math\.pow\(200, v \/ 100\); \}/);
});

test('уведомления: на устройствах без клавиатуры без упоминания клавиш', () => {
  const KEY = /\b(Space|Esc|Shift|[A-Z])\b|клавиш/;
  for (const [k, v] of Object.entries(TOAST)) {
    assert.ok(Array.isArray(v) && v.length >= 1 && v.length <= 2, k);
    assert.doesNotMatch(toastText(k, true), KEY, `${k}: «${toastText(k, true)}»`);
    if (KEY.test(v[0])) assert.equal(v.length, 2, `${k}: нужен вариант без клавиш`);
  }
  assert.equal(toastText('welcome', false), TOAST.welcome[0]);
  assert.match(JS['main.js'], /toast\(toastText\('welcome', touch\(\)\), 5200\)/);
  assert.match(JS['ui/controls.js'], /const touch = \(\) => matchMedia\('\(pointer: coarse\)'\)\.matches;/);
});

test('числа выводятся через strings.ru.js: toFixed() — только там и в CSS-значениях', () => {
  const ALLOWED = ['ui/strings.ru.js', 'ui/labels.js', 'ui/phase-scale.js'];
  for (const f of ['main.js', ...Object.keys(JS).filter(f => f.startsWith('ui/'))]) {
    const c = code(JS[f]);
    if (!ALLOWED.includes(f)) assert.doesNotMatch(c, /\.toFixed\(/, `${f}: toFixed() вне strings.ru.js`);
    if (f !== 'ui/strings.ru.js') {
      assert.doesNotMatch(c, /['`][^'`\n]*[\d}] (мм|бар|см³|об\/мин|°C|%)[^'`\n]*['`]/, `${f}: единица после обычного пробела в строке`);
      assert.doesNotMatch(c, /\+ ['`](?: (?:мм|бар|см³|об\/мин|°C|%)|(?:мм|бар|см³|об\/мин|°C))['`]/, `${f}: число + единица без unit()`);
    }
  }
  // labels.js и phase-scale.js: toFixed — только в CSS (px и %)
  assert.match(JS['ui/labels.js'], /translate\(\$\{x\.toFixed\(1\)\}px,\$\{y\.toFixed\(1\)\}px\)/);
  assert.match(JS['ui/phase-scale.js'], /const pctOf = d => \+\(d \/ 7\.2\)\.toFixed\(3\) \+ '%';/);
  for (const t of ['×0.2', '1.0 бар', '×1.0', '0%']) assert.ok(!BODY.includes(t), `index.html: «${t}»`);
  assert.ok(BODY.includes('×0,2'));
});

test('разметка: <kbd> в кнопках скрыт от диктора, у кнопок с клавишей — aria-keyshortcuts', () => {
  const buttons = [...BODY.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
  for (const [, attrs, inner] of buttons) {
    for (const [k] of inner.matchAll(/<kbd\b[^>]*>/g)) assert.equal(k, '<kbd aria-hidden="true">', attrs);
    if (inner.includes('<kbd')) assert.match(attrs, /aria-keyshortcuts="[^"]+"/, `кнопка с клавишей: ${attrs}`);
  }
  assert.match(JS['ui/icons.js'], /const KBD = k => ` <kbd aria-hidden="true">\$\{k\}<\/kbd>`;/);
  const KEYS = { btnRun: 'Space', btnSlow: 'S', btnExplode: 'E', btnPrev: 'ArrowLeft', btnNext: 'ArrowRight', btnReset: 'R', btnLabels: 'L',
    btnRotate: 'A', btnSound: 'M', btnShot: 'P', btnPanels: 'H', helpLink: '?', helpLink2: '?', btnFocus: 'F', btnIsolate: 'I',
    btnDegBack: ',', btnDegFwd: '.', infoClose: 'Escape', btnUnIso: 'Escape', helpClose: 'Escape' };
  for (const [id, k] of Object.entries(KEYS)) assert.match(BODY, new RegExp(`id="${id}" aria-keyshortcuts="${k.replace(/[.?]/g, '\\$&')}"`), id);
  for (const [m, k] of [['solid', 'X'], ['xray', 'X'], ['cut', 'X']]) assert.match(BODY, new RegExp(`data-mode="${m}" aria-keyshortcuts="${k}"`));
  ['front', 'side', 'top', 'iso'].forEach((c, i) => assert.match(BODY, new RegExp(`data-cam="${c}" aria-keyshortcuts="${i + 1}"`)));
});

test('разметка: холст, декоративные слои, «Вид», p–V, «Сейчас», справка, fps', () => {
  const cv = BODY.match(/<canvas id="scene"[^>]*>/)[0];
  for (const a of ['tabindex="0"', 'role="application"', 'aria-roledescription="3D-сцена"', 'aria-label="Модель двигателя"', 'aria-describedby="sceneKeys"']) assert.ok(cv.includes(a), a);
  assert.match(BODY, /<p id="sceneKeys" class="sr-only">Стрелки вращают камеру, Shift и стрелки сдвигают её, PgUp и PgDn приближают и отдаляют\./);
  assert.match(BODY, /<canvas id="scene"[^>]*><\/canvas>\n<div class="vignette" aria-hidden="true"><\/div>\n<div class="scene-ring" aria-hidden="true">/);
  for (const id of ['labels', 'tooltip', 'flash']) assert.match(BODY, new RegExp(`<div id="${id}" aria-hidden="true"></div>`), id);
  const radios = [...BODY.matchAll(/<button data-mode="(\w+)"[^>]*role="radio" aria-checked="(true|false)"([^>]*)>/g)];
  assert.deepEqual(radios.map(m => [m[1], m[2], /tabindex="-1"/.test(m[3])]), [['solid', 'true', false], ['xray', 'false', true], ['cut', 'false', true]]);
  assert.match(JS['ui/view.js'], /b\.setAttribute\('aria-checked', on\); b\.tabIndex = on \? 0 : -1;/);
  assert.match(BODY, /<canvas id="pv" class="chart" height="128" role="img" aria-label="p–V диаграмма цилиндра 1"/);
  assert.match(JS['ui/input.js'], /el\.pv\.setAttribute\('aria-label', S\.pvLabel\(i \+ 1\)\);/);
  assert.match(BODY, /<div id="infoLive" aria-live="off"><\/div>/);
  assert.match(JS['ui/info.js'], /if \(html !== liveHtml\) \{ el\.infoLive\.innerHTML = html; liveHtml = html; \}/);
  assert.match(JS['ui/info.js'], /if \(!force && now - liveTimer < 120\) return;/);
  assert.match(BODY, /<div id="toast" role="status"><\/div>/);
  const help = BODY.slice(BODY.indexOf('<dialog id="help"'));
  for (const h of ['Мышь', 'Сенсорный экран', 'Сцена с клавиатуры', 'Клавиши']) assert.ok(help.includes(`<h3>${h}</h3>`), h);
  for (const k of ['Tab', 'PgUp', 'PgDn', 'Shift']) assert.ok(help.includes(`<kbd>${k}</kbd>`), k);
  assert.match(BODY, /<footer class="panel-foot" hidden><span id="fps">/);
  assert.match(JS['main.js'], /const DEBUG = params\.has\('debug'\);/);
  assert.match(JS['main.js'], /el\.fps\.closest\('\.panel-foot'\)\.hidden = !DEBUG;/);
  assert.match(JS['main.js'], /if \(DEBUG\) el\.fps\.textContent = S\.fps\(perf\.fps, pixelRatio, aoOn\(\)\);/);
  assert.match(APP, /\.panel-foot\[hidden\]\{display:none\}/);
});

test('фокус: после указателя снимается, после клавиатуры остаётся; перенос из скрываемого блока — только с клавиатуры', () => {
  const ls = {}; let active = null;
  const node = name => ({ name, focused: 0, blur() { if (active === this) active = null; }, focus() { active = this; this.focused++; }, contains(n) { return n && n.parent === this; } });
  globalThis.document = { addEventListener: (t, fn, o) => { assert.ok(o && o.signal === life.signal, 'signal'); assert.ok(!o.capture); ls[t] = fn; }, get activeElement() { return active; } };
  const life = new AbortController();
  try {
    trackInput(life);
    const box = node('panel'), btn = node('btn'), to = node('drawer'); btn.parent = box;
    ls.pointerdown(); assert.equal(viaKeyboard(), false);
    active = btn; blurAfterPointer(btn); assert.equal(active, null, 'после указателя фокус снят');
    ls.keydown(); assert.equal(viaKeyboard(), true);
    active = btn; blurAfterPointer(btn); assert.equal(active, btn, 'после клавиатуры фокус остаётся');
    moveFocusOut(box, to); assert.equal(active, to, 'с клавиатуры — на кнопку панели');
    ls.pointerdown(); active = btn; moveFocusOut(box, to); assert.equal(active, btn, 'после указателя не переносится');
    ls.keydown(); active = to; moveFocusOut(box, btn); assert.equal(active, to, 'фокус не в блоке — не трогаем');
  } finally { delete globalThis.document; }
  const IN = code(JS['ui/input.js']);
  assert.match(IN, /trackInput\(life\);\n  document\.addEventListener\('click', e => \{ const b = e\.target\.closest\('button'\); if \(b && e\.detail > 0\) b\.blur\(\); \}/);
  assert.doesNotMatch(IN, /el\.\w+Slider\.blur\(\)/, 'ползунки теряют фокус только после указателя');
  const onKey = IN.slice(IN.indexOf('function onKey(e)'));
  const order = ['if (e.defaultPrevented) return;', "if (k === 'Escape')", 'if (el.help.open)', "if ((k === ' ' || k === 'Enter') && onControl(t)) return;",
    "if (t === el.canvas && sceneKeys && /^(Arrow|Page(Up|Down)$)/.test(k)) { sceneKey(e); return; }", "if (k === ' ') { toggleRun(); e.preventDefault(); }"];
  let at = -1;
  for (const s of order) { const i = onKey.indexOf(s); assert.ok(i > at, `onKey: «${s}» на своём месте`); at = i; }
  assert.match(IN, /const CONTROL = 'button, input, a\[href\], \[role=radio\], \[role=tab\], \[role\^=menuitem\]';/);
  assert.match(IN, /cv\.addEventListener\('focus', \(\) => setSceneKeys\(viaKeyboard\(\)\)\);/);
  assert.match(IN, /btn\.addEventListener\('click', e => \{ if \(e\.detail === 0\) nudgeCrank\(\(e\.shiftKey \? 1 : 5\) \* sign\); \}\);/, '±5° с клавиатуры');
  assert.match(code(JS['ui/menus.js']), /e\.preventDefault\(\);\s+\}\nfunction initMenu/);
});

test('сниженное движение: не дольше 150 мс, без задержек; камера, разборка, шаги, старт, вспышка, CSS', async () => {
  const plain = await import('../src/ui/motion.js');
  assert.equal(plain.reducedMotion(), false);
  assert.deepEqual(plain.motion(1.3, 0.2), { dur: 1.3, delay: 0.2 });
  globalThis.matchMedia = q => ({ matches: q === '(prefers-reduced-motion: reduce)' });
  try {
    const m = await import('../src/ui/motion.js?reduce');
    assert.equal(m.REDUCED_MAX, 0.15); assert.equal(m.reducedMotion(), true);
    assert.deepEqual(m.motion(1.3, 0.2), { dur: 0.15, delay: 0 }); assert.deepEqual(m.motion(0.1, 0.5), { dur: 0.1, delay: 0 });
  } finally { delete globalThis.matchMedia; }
  assert.match(JS['ui/camera.js'], /const m = motion\(dur, delay\);\n  ui\.camTw = tween\(\{ dur: m\.dur, delay: m\.delay,/);
  assert.match(JS['ui/camera.js'], /if \(!animate \|\| reducedMotion\(\)\) \{ setShift\(to\.x, to\.y\); return; \}/);
  assert.match(JS['ui/steps.js'], /const m = motion\(1\.3\);\n  ui\.explodeTw = tweenTo\(ui, 'explode', v, \{ dur: m\.dur,/);
  assert.match(JS['ui/steps.js'], /const m = motion\(0\.95, 0\.07 \* clamp\(order, 0, 6\)\);\n    ud\.tw = tweenTo\(ud, 'progress', target, \{ dur: m\.dur, delay: m\.delay,/);
  assert.match(JS['ui/explode.js'], /const k = reducedMotion\(\) \? 1 : 1 - Math\.exp\(-dt \* 9\);/);
  assert.match(JS['main.js'], /if \(reducedMotion\(\)\) camera\.position\.copy\(homePosition\(\)\);\n  else camera\.position\.copy\(TGT_HOME\)\.addScaledVector\(dir, 34\);/);
  assert.match(JS['main.js'], /if \(!reducedMotion\(\)\) tweenCamera\(homePosition\(\), TGT_HOME\.clone\(\), 2\.3, 0\.1\);/);
  assert.match(JS['ui/controls.js'], /if \(!reducedMotion\(\)\) \{[^\n]*\n\s+el\.flash\.style\.transition = 'none';/);
  // Сдвиг вида (applyViewShift) при сниженном движении не анимируется вовсе — проверено выше.
  for (const f of ['ui/camera.js', 'ui/steps.js']) assert.doesNotMatch(code(JS[f]).replace('shift.tw = tween({ dur: 0.35,', ''), /tween(To)?\([^)]*\{ dur: [\d.]/, `${f}: длительность без motion()`);
  const rm = APP.match(/@media \(prefers-reduced-motion:reduce\)\{([\s\S]*?)\n\}/);
  assert.ok(rm, '@media (prefers-reduced-motion:reduce)');
  assert.match(rm[1], /\*,::before,::after\{transition-duration:0s!important;transition-delay:0s!important;animation-duration:0s!important;/);
});

test('app.css: рамка фокуса, рамка сцены, цели 44 px на pointer: coarse, .sr-only', () => {
  assert.match(APP, /button:focus-visible,a\[href\]:focus-visible\{outline:2px solid var\(--opus-accent\);outline-offset:2px\}/);
  assert.match(APP, /input\[type=range\]:focus-visible::-webkit-slider-thumb\{box-shadow:var\(--focus-ring\)\}/);
  assert.match(APP, /#scene\.kbd ~ \.scene-ring\{display:block\}/);
  assert.match(APP, /\.scene-ring\{display:none;position:fixed;z-index:2;left:var\(--free-l\);top:var\(--free-t\);width:calc\(var\(--free-r\) - var\(--free-l\)\);\s*height:calc\(var\(--free-b\) - var\(--free-t\)\);[^}]*pointer-events:none/);
  assert.match(JS['ui/layout.js'], /for \(const k of \['l', 't', 'r', 'b'\]\) root\.style\.setProperty\('--free-' \+ k, lay\.free\[k\] \+ 'px'\);/);
  assert.match(APP, /\.sr-only\{position:absolute;width:1px;height:1px;[^}]*clip:rect\(0 0 0 0\)/);
  const coarse = APP.match(/@media \(pointer:coarse\)\{([\s\S]*?)\n\}/)[1];
  for (const s of ['.btn.sm,.chip,.fire .chip{height:var(--hit);min-width:var(--hit)}', '.seg button,.menu button,.ph-row{height:var(--hit)}',
    '.iso-chip .btn.icon{height:var(--hit);width:var(--hit);min-width:var(--hit)}', '.dot,.dot.now{flex:1;width:auto;height:var(--hit)}',
    'input[type=range]{height:var(--hit);padding:19px 0}', '.link{min-height:var(--hit);display:inline-flex;align-items:center}']) assert.ok(coarse.includes(s), s);
  assert.match(APP, /\.dot::after\{content:"";position:absolute;inset:-10px -3px\}/, 'точка шага: цель 28×36 без сдвига раскладки');
});
