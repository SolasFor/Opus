/**
 * Стили модульной версии: Engine/styles/tokens.css и app.css (П-1, 14_M05).
 * M-05a вынес встроенный <style> index.html в styles/ без изменения вида; дословность переноса проверялась здесь до M-05b
 * (sha256 опоры index.html@17c9834, коммит 0894940). M-05b заменил разметку и app.css целиком (П-3, П-5, П-8, П-11, П-15),
 * поэтому проверяются свойства, а не текст:
 *   1) В index.html нет <style>. В <head> подключены styles/tokens.css и затем styles/app.css, до встроенного скрипта
 *      экрана запуска; если файл стилей не загрузился, onerror сообщает об этом экрану запуска (boot.test.js).
 *   2) tokens.css — один блок :root с токенами design-system: имена из таблицы DESIGN, каждый один раз, значения ключевых
 *      токенов — как в design-system. Каждый токен используется в app.css. Каждый var(--…) без запасного значения
 *      в app.css ссылается на токен или на своё свойство, объявленное в app.css или в атрибуте style разметки.
 *   3) Панели с текстом, верхняя панель и меню — на --opus-surface-strong (0,92, П-11).
 *   4) Шрифт интерфейса — системный (--font-ui, П-2, T-27): Inter нигде не упоминается, в том числе в шрифтах canvas.
 *   5) Значок вкладки — встроенный SVG «4Т» (data URI, П-14, T-26).
 *   6) Разметка: каждый id из списка initUI() есть в index.html ровно один раз, id не повторяются, id в селекторах кода
 *      существуют. Значки — встроенный SVG с aria-hidden; у кнопки без текста есть aria-label; глифов ☰ ⚙ ▶ ⏸ нет.
 *      У каждого раздела .sec[data-sec] заголовок — кнопка с aria-expanded и aria-controls на тело раздела.
 *   7) Границы режимов в src/ui/layout.js (BREAK) совпадают с @media в app.css.
 * Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const INDEX = read('../index.html'), APP = read('../styles/app.css'), TOKENS = read('../styles/tokens.css');
const SRC = new URL('../src/', import.meta.url);
const walk = d => readdirSync(new URL(d, SRC), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(`${d}${e.name}/`) : e.name.endsWith('.js') ? [d + e.name] : []);
const JS = Object.fromEntries(walk('').map(f => [f, read(`../src/${f}`)]));
const HEAD = INDEX.slice(0, INDEX.indexOf('</head>'));
const BODY = INDEX.slice(INDEX.indexOf('<body>'), INDEX.indexOf('<div id="loader">'));
// ошибка загрузки стилей: экран ошибки (boot.test.js); обработчик может сработать раньше встроенного скрипта — тогда флаг
const ONERROR = 'window.__engStyleError ? __engStyleError() : (window.__engStyleFailed = true)';
// токены design-system: имя → значение (null — значение не проверяется)
const DESIGN = {
  '--opus-bg': '#0b0e13', '--opus-surface': 'rgb(16 20 28 / .74)', '--opus-surface-strong': 'rgb(16 20 28 / .92)',
  '--opus-surface-raised': 'rgb(255 255 255 / .05)', '--opus-line': 'rgb(255 255 255 / .10)', '--opus-line-strong': 'rgb(255 255 255 / .18)',
  '--opus-text': '#e9eef6', '--opus-text-muted': '#9aa6b6', '--opus-accent': '#4da3ff', '--opus-accent-2': '#ffb454',
  '--opus-danger': '#ff6b6b', '--opus-ok': '#5fd39a',
  '--stroke-intake': '#4da3ff', '--stroke-compression': '#a78bfa', '--stroke-power': '#ff8a3d', '--stroke-exhaust': '#9aa3ad',
  '--font-ui': null, '--font-mono': null,
  '--fs-xs': '.75rem', '--fs-sm': '.8125rem', '--fs-md': '.9375rem', '--fs-lg': '1.125rem', '--fs-xl': '1.5rem',
  '--sp-1': '4px', '--sp-2': '8px', '--sp-3': '12px', '--sp-4': '16px', '--sp-5': '24px', '--sp-6': '32px',
  '--radius-sm': '8px', '--radius-md': '12px', '--radius-lg': '18px',
  '--shadow-panel': null, '--dur-fast': '120ms', '--dur-base': '220ms', '--ease': null, '--hit': '44px', '--focus-ring': null,
};
const count = (s, t) => s.split(t).length - 1;
const body = css => css.slice(css.indexOf('*/\n') + 3);
const noComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
const CSS = noComments(body(APP));
const TOK = (() => {
  const m = noComments(TOKENS).trim().match(/^:root\{([\s\S]*)\}$/);
  assert.ok(m, 'tokens.css: один блок :root{…}');
  const map = new Map();
  for (const d of m[1].split(';').map(s => s.trim()).filter(Boolean)) {
    const [, k, v] = d.match(/^(--[\w-]+):(.+)$/s) || [];
    assert.ok(k, `tokens.css: не объявление токена: «${d}»`); assert.ok(!map.has(k), `${k} объявлен дважды`);
    map.set(k, v.trim());
  }
  return map;
})();
// правила app.css: селектор → объявления (вложенные @media разворачиваются)
const RULES = [...CSS.replace(/@(?:media|container)[^{]*\{/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => [m[1].trim(), m[2]]);

test('index.html: нет <style>, tokens.css и app.css подключены в <head> до скрипта экрана запуска', () => {
  assert.doesNotMatch(INDEX, /<style[\s>]/);
  assert.ok(INDEX.indexOf('</head>') > 0 && INDEX.indexOf('</head>') < INDEX.indexOf('<script>'), '<head> до встроенного скрипта');
  assert.equal(count(INDEX, 'rel="stylesheet"'), 2);
  const link = f => `<link rel="stylesheet" href="./styles/${f}" onerror="${ONERROR}" />`;
  const t = HEAD.indexOf(link('tokens.css')), a = HEAD.indexOf(link('app.css'));
  assert.ok(t > 0 && a > t, 'сначала tokens.css, затем app.css, у обоих onerror');
});

test('tokens.css: токены design-system, каждый используется; каждый var() в app.css определён', () => {
  assert.deepEqual([...TOK.keys()], Object.keys(DESIGN));
  for (const [k, v] of Object.entries(DESIGN)) if (v !== null) assert.equal(TOK.get(k), v, k);
  // свои свойства: объявленные в app.css и в атрибутах style="--…" разметки; var(--x, запасное значение) не проверяется
  const own = new Set([...(CSS + INDEX).matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]).filter(k => !TOK.has(k)));
  for (const [, k] of (CSS + TOKENS).matchAll(/var\((--[\w-]+)\s*\)/g)) assert.ok(TOK.has(k) || own.has(k), `${k} не определён`);
  for (const k of TOK.keys()) assert.ok(CSS.includes(`var(${k})`), `${k} не используется в app.css`);
  for (const k of own) assert.doesNotMatch(k, /^--(?:opus|stroke|fs|sp|radius|dur)-/, `${k}: своё свойство с именем токена`);
});

test('П-11: панели, верхняя панель и меню — на --opus-surface-strong', () => {
  for (const sel of ['.panel', '.appbar', '.menu']) {
    const rule = RULES.find(([s]) => s === sel);
    assert.ok(rule, `нет правила ${sel}`);
    assert.match(rule[1], /background:[^;]*var\(--opus-surface-strong\)/, sel);
  }
  for (const id of ['hud', 'cycle', 'timeline']) assert.match(INDEX, new RegExp(`id="${id}" class="panel `), `#${id} — .panel`);
  assert.match(INDEX, /<dialog id="help" class="panel /);
});

test('шрифт: системный --font-ui, Inter нигде не упоминается', () => {
  assert.match(noComments(body(APP)), /^html,body\{[^}]*font-family:var\(--font-ui\);/m);
  assert.match(TOK.get('--font-ui'), /^system-ui,/);
  for (const [name, text] of [['index.html', INDEX], ['styles/app.css', APP], ['styles/tokens.css', TOKENS],
    ...walk('').map(f => [`src/${f}`, read(`../src/${f}`)])]) assert.doesNotMatch(text, /\bInter\b/, name);
});

test('значок вкладки: встроенный SVG «4Т», без внешних файлов', () => {
  const icons = [...HEAD.matchAll(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,([^"]+)" \/>/g)];
  assert.equal(icons.length, 1); assert.equal(count(INDEX, 'rel="icon"'), 1);
  const svg = decodeURIComponent(icons[0][1]);
  assert.match(svg, /^<svg xmlns='http:\/\/www\.w3\.org\/2000\/svg' viewBox='0 0 32 32'>[\s\S]*<\/svg>$/);
  assert.match(svg, />4Т<\/text>/);
  assert.doesNotMatch(svg.replace("xmlns='http://www.w3.org/2000/svg'", ''), /https?:|href|url\(|<script|<image/i);
});

test('разметка: id из initUI() есть ровно один раз, id не повторяются, id в селекторах кода существуют', () => {
  const ids = [...INDEX.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, `повторяются: ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
  const list = JS['ui/input.js'].match(/\[('[\w]+'(?:,\s*'[\w]+')*)\]\.forEach\(id => \{ el\[id\] = \$\(id\); \}\)/);
  assert.ok(list, 'ui/input.js: список элементов в initUI()');
  for (const id of list[1].match(/[\w]+/g)) assert.equal(count(INDEX, ` id="${id}"`), 1, `#${id}`);
  for (const [f, text] of Object.entries(JS)) for (const [, sel] of text.matchAll(/querySelector(?:All)?\(['`]([^'`]+)['`]\)/g))
    for (const [, id] of sel.matchAll(/#([\w-]+)/g)) assert.ok(ids.includes(id), `${f}: «${sel}» — нет #${id}`);
  for (const [, id] of INDEX.matchAll(/aria-(?:controls|labelledby)="([^"]+)"/g)) assert.ok(ids.includes(id), `aria-* → #${id}`);
});

test('разметка: значки — SVG с aria-hidden, у кнопки без текста есть aria-label, глифов ☰ ⚙ ▶ ⏸ нет', () => {
  for (const [, tag] of BODY.matchAll(/(<svg\b[^>]*>)/g)) assert.match(tag, /aria-hidden="true"/, tag);
  const buttons = [...BODY.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
  assert.ok(buttons.length > 30, 'кнопки разметки');
  for (const [, attrs, inner] of buttons) {
    assert.match(attrs, /type="button"/, attrs);
    const text = inner.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<kbd>[^<]*<\/kbd>/g, '').replace(/<[^>]+>/g, '').trim();
    if (!text) assert.match(attrs, /aria-label="[^"]+"/, `кнопка без текста: ${attrs}`);
  }
  for (const [name, text] of [['index.html', INDEX], ...Object.entries(JS).map(([f, t]) => [`src/${f}`, t])])
    assert.doesNotMatch(text, /[☰⚙▶⏸]/, name);
  for (const t of ['icons.js']) assert.match(JS[`ui/${t}`], /aria-hidden="true"/);
});

test('разметка: разделы панелей сворачиваются кнопкой-заголовком', () => {
  const secs = [...BODY.matchAll(/<section class="sec" data-sec="(\w+)"[^>]*>\s*<h2 class="sec-hd"><button class="sec-h" type="button" aria-expanded="true" aria-controls="sec-(\w+)">/g)];
  assert.deepEqual(secs.map(m => m[1]), ['explode', 'parts', 'card', 'phases', 'pv']);
  for (const [, key, ctl] of secs) { assert.equal(key, ctl); assert.equal(count(BODY, `<div class="sec-b" id="sec-${key}">`), 1, key); }
  assert.equal(count(BODY, 'class="sec"'), secs.length, 'каждый раздел — с заголовком-кнопкой');
});

test('границы режимов: BREAK в src/ui/layout.js совпадают с @media в app.css', () => {
  const m = JS['ui/layout.js'].match(/const BREAK = \{ desktop: (\d+), tablet: (\d+) \};/);
  assert.ok(m, 'layout.js: BREAK');
  const [desktop, tablet] = [+m[1], +m[2]];
  const media = [...CSS.matchAll(/@media \((max|min)-width:(\d+)px\)/g)].map(x => [x[1], +x[2]]);
  assert.ok(media.some(([k, v]) => k === 'max' && v === desktop - 1), `@media (max-width:${desktop - 1}px)`);
  assert.ok(media.some(([k, v]) => k === 'max' && v === tablet - 1), `@media (max-width:${tablet - 1}px)`);
  for (const [k, v] of media) assert.ok(k === 'max' && v < 1500, `@media (${k}-width:${v}px): только max-width`);
});
