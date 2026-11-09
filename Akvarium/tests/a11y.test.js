/**
 * Телефон, касание и доступность (A-02): статические проверки разметки index.html, стилей styles/app.css и модулей
 * src/main.js, src/ui/strings.ru.js. Кнопка панели — SVG с именем вместо глифа ☰; панель — область с именем;
 * подсказки для мыши и для пальца; баннер «Камера следует» — role=status и кнопка «Выйти»; видимый фокус;
 * prefers-reduced-motion; Пробел и Enter на элементах управления; порядок Esc; долгое касание не стучит; холст —
 * с ролью и именем; счётчик кадров — только с ?debug; D-12 — переключатель «Медузы»; viewport-fit=cover.
 * Поведение в браузере проверяется отдельно (отчёт в PR). Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CSS, INDEX, MAIN, MODULES } from './_app.js';

const STR = MODULES['ui/strings.ru'];
const fn = (src, head) => { const i = src.indexOf(head); assert.ok(i >= 0, head); return src.slice(i, src.indexOf('\n}\n', i) + 2); };
const listener = (type) => { const m = MAIN.match(new RegExp(`cv\\.addEventListener\\('${type}', [^\\n]*(?:\\n(?!cv\\.addEventListener)[^\\n]*)*`)); assert.ok(m, type); return m[0]; };

test('viewport: viewport-fit=cover (безопасные зоны), масштаб не запрещён', () => {
  const m = INDEX.match(/<meta name="viewport" content="([^"]+)">/);
  assert.ok(m);
  assert.match(m[1], /width=device-width/); assert.match(m[1], /initial-scale=1/); assert.match(m[1], /viewport-fit=cover/);
  assert.doesNotMatch(m[1], /user-scalable=no|maximum-scale=1(?![.\d])/);
});

test('кнопка панели: SVG вместо глифа ☰, имя, aria-controls, aria-expanded, клавиша H', () => {
  const m = INDEX.match(/<button type="button" id="open" ([^>]*)>(<svg [^>]*>[\s\S]*?<\/svg>)<\/button>/);
  assert.ok(m, 'кнопка #open с встроенным SVG');
  for (const a of ['aria-label="Показать панель"', 'aria-controls="panel"', 'aria-expanded="true"', 'aria-keyshortcuts="H"']) assert.ok(m[1].includes(a), a);
  assert.match(m[2], /aria-hidden="true" focusable="false"/);
  assert.ok(!INDEX.includes('☰') && !MAIN.includes('☰'), 'глифа ☰ нет');
  assert.match(INDEX, /<div id="panel" role="region" aria-label="Панель управления"><\/div>/);
});

test('подсказки: для мыши и для пальца, видимость — по (hover: none) and (pointer: coarse)', () => {
  const hint = INDEX.match(/<div id="hint">([\s\S]*?)<\/div>/)[1];
  assert.match(hint, /^<span class="k-mouse">клик — корм[^<]*<b[^>]*>H<\/b> — панель<\/span><span class="k-touch">касание — корм · удерживайте — сыпать · двойное касание по рыбе — следить · «Стук» — в панели внизу<\/span>$/);
  assert.ok(CSS.includes('.k-touch{display:none}'));
  assert.ok(CSS.includes('@media (hover: none) and (pointer: coarse){.k-mouse{display:none}.k-touch{display:inline}}'));
  assert.match(STR, /<div id="keys"><span class="k-mouse">[\s\S]*?<\/span><span class="k-touch">[\s\S]*?<\/span><\/div>/);
});

test('«Камера следует»: текст — role=status, кнопка «Выйти» (Esc); перед новым текстом баннер снимает inert', () => {
  assert.match(INDEX, /<div id="follow"><span id="followTxt" role="status"><\/span><button type="button" id="followExit" aria-keyshortcuts="Escape">Выйти<\/button><\/div>/);
  assert.match(MAIN, /followEl\.inert = false; followTxt\.innerHTML = S\.follow\(target\.sp\.name\);/);
  assert.match(MAIN, /document\.getElementById\('followExit'\)\.onclick = \(\) => stopFollow\(\);/);
});

test('видимый фокус: холст, панель, кнопка панели, баннер и ссылка экрана запуска', () => {
  assert.ok(CSS.includes('canvas:focus-visible{outline:2px solid #9fe6ff'));
  assert.ok(CSS.includes('#panel button:focus-visible,#panel input:focus-visible,#open:focus-visible,#follow button:focus-visible,#bootact a:focus-visible{outline:2px solid #9fe6ff'));
  // outline:none — только у холста без фокуса с клавиатуры (щелчок мышью), :focus-visible выше его перекрывает
  assert.deepEqual([...CSS.matchAll(/([^{}\n]+)\{[^}]*outline:\s*(?:none|0)\b/g)].map(m => m[1].trim()), ['canvas']);
});

test('prefers-reduced-motion: без пролёта, автокамеры, тряски, вспышки, зерна и переходов', () => {
  assert.match(MAIN, /const RM = matchMedia\('\(prefers-reduced-motion: reduce\)'\);\nif \(RM\.matches\) K\.auto = false;/);
  assert.match(MAIN, /if \(RM\.matches\) introT = 0\.999;/);
  assert.match(MAIN, /if \(!K\.follow && !RM\.matches\) shake = 1;/);
  assert.match(MAIN, /if \(!RM\.matches\) \{ fl\.style\.transition = 'none'; fl\.style\.opacity = '0\.5';/);
  const rm = CSS.match(/@media \(prefers-reduced-motion: reduce\)\{([\s\S]*?)\n  \}/);
  assert.ok(rm);
  assert.match(rm[1], /#grain\{display:none\}/); assert.match(rm[1], /#boot \.b\{animation:none\}/);
  assert.match(rm[1], /#panel,#hint,#follow,#tip,#open,#boot,html\.sheet #panel\{transition:none\}/);
});

test('клавиши: Пробел и Enter на кнопке, переключателе, ползунке и ссылке — им, а не паузе; Esc — сначала шторка', () => {
  const kd = MAIN.match(/addEventListener\('keydown', \(e\) => \{[\s\S]*?\n\}\);/)[0];
  const rule = kd.indexOf("if ((c === 'Space' || c === 'Enter') && e.target.closest && e.target.closest('button, input, a[href]')) return;");
  assert.ok(rule > 0 && rule < kd.indexOf("if (c === 'Space') { e.preventDefault(); togglePause(); }"));
  assert.match(kd, /else if \(c === 'Escape'\) \{ if \(SHEET\.on && SHEET\.stop !== 'min'\) setStop\('min'\); else stopFollow\(\); \}/);
  assert.match(kd, /if \(e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey\) return;/);
});

test('холст: в порядке Tab, role=img и имя с клавишами; касание — жесты ui/gestures.js, без dblclick', () => {
  assert.match(MAIN, /cv\.tabIndex = 0; cv\.setAttribute\('role', 'img'\); cv\.setAttribute\('aria-label', S\.scene\);/);
  assert.match(STR, /scene: 'Аквариум: коралловый риф с рыбами\. Корм — клавиша F, стук по стеклу — K, вид от рыбы — C, свет — 1, 2, 3, пауза — Пробел, панель — H\.'/);
  // время события, а не обработчика: долгий кадр не превращает двойное касание в два одиночных
  assert.match(listener('pointerdown'), /GS\.down\(e\.pointerId, e\.clientX, e\.clientY, e\.timeStamp, ptrType\);/);
  assert.match(listener('pointerup'), /const g = GS\.up\(e\.pointerId, e\.clientX, e\.clientY, e\.timeStamp\);/);
  assert.match(MAIN, /if \(GS\.hold\(performance\.now\(\)\)\)/);
  // допуск пальца при выборе рыбы; у мыши pickAt — как раньше
  assert.match(listener('pointerup'), /const hit = pickAt\(nx, ny, KIND\[e\.pointerType === 'mouse' \? 'mouse' : 'touch'\]\.pickPx\);/);
  assert.match(MAIN, /function showTouchTip\(nx, ny, x, y\) \{\n  const hit = pickAt\(nx, ny, KIND\.touch\.pickPx\);/);
  assert.match(MAIN, /sc = px \? d2 \/ \(r \* r\) : t;\n      if \(d2 < r \* r && sc < bt\)/);
  assert.match(listener('pointercancel'), /GS\.cancel\(e\.pointerId\)/);
  assert.match(listener('dblclick'), /e\.preventDefault\(\)/);
  assert.doesNotMatch(MAIN, /addEventListener\('dblclick', \(e\) => \{[^}]*startFollow/);
  assert.match(CSS, /canvas\{-webkit-touch-callout:none\}/);
});

test('долгое касание: контекстное меню подавлено и стука нет; правый клик мышью — стук, как раньше', () => {
  assert.match(listener('contextmenu'), /^cv\.addEventListener\('contextmenu', \(e\) => \{ e\.preventDefault\(\); if \(ptrType === 'touch'\) return; ndcOf\(e, NDC\); knockAt\(NDC\.x, NDC\.y\); hideHint\(\); \}\);$/);
});

test('счётчик кадров — только с ?debug', () => {
  assert.match(MAIN, /const DEBUG = new URLSearchParams\(location\.search\)\.has\('debug'\);/);
  assert.match(MAIN, /fpsEl\.hidden = !DEBUG;/);
});

test('D-12: «Медузы» выключаются целиком — не видны, не выбираются, не обновляются; подпись связана с переключателем', () => {
  assert.match(MAIN, /const K = \{[^}]*sound: false, jelly: true \};/);
  assert.match(MAIN, /if \(k === 'jelly'\) for \(const j of jellies\) \{ j\.m\.visible = !!v; j\.lines\.visible = !!v; \}/);
  assert.match(MAIN, /if \(K\.jelly\) for \(const j of jellies\) \{   \/\/ D-12: выключенные медузы не выбираются/);
  assert.match(MAIN, /if \(K\.jelly\) for \(const j of jellies\) \{ j\.v\.y \+= 0\.35;/);
  assert.match(fn(MAIN, 'function updateJellies('), /^function updateJellies\([^)]*\) \{\n  if \(!K\.jelly\) return;/);
  assert.match(MAIN, /inp\.setAttribute\('aria-describedby', 'jellyNote'\); row\.after\(note\);/);
});

test('панель: шторка на телефоне — ручка с именем; кнопки с aria-pressed, переключатели — role=switch, ползунки — aria-valuetext', () => {
  assert.match(STR, /<button type="button" id="grip" aria-controls="pbody" aria-expanded="false" aria-keyshortcuts="H"><span class="bar" aria-hidden="true"><\/span><span class="sr">Панель управления<\/span><\/button>/);
  assert.match(MAIN, /<input type="checkbox" role="switch"/);
  assert.match(MAIN, /aria-pressed/);
  assert.match(MAIN, /aria-valuetext/);
  assert.match(MAIN, /initSheet\(\{ panel, grip: document\.getElementById\('grip'\), body: document\.getElementById\('pbody'\), btns: panel\.querySelector\('\.btns'\), keys: document\.getElementById\('keys'\) \}, syncPanel\);/);
  assert.match(CSS, /html\.sheet #panel \.btns button,html\.sheet \.seg button\{min-height:44px\}/);
  assert.match(CSS, /html\.sheet \.row\{min-height:44px;/); assert.match(CSS, /html\.sheet \.tog\{min-height:44px;/);
});
