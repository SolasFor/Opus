/**
 * M-05a: стили модульной версии вынесены из встроенного <style> Engine/index.html в Engine/styles/ (П-1, 14_M05).
 *   1) В index.html нет <style>. В <head> подключены styles/tokens.css и затем styles/app.css, до встроенного скрипта
 *      экрана запуска.
 *   2) app.css — встроенный <style> из index.html@17c9834 (строки 8–222 без отступа в 2 пробела) плюс правки
 *      из таблицы EDITS. Если в app.css вернуть каждую правку назад (новый текст → старый) и снять шапку-комментарий,
 *      sha256 совпадёт с BASE. Проверка вручную:
 *      git show 17c9834:Engine/index.html | sed -n '8,222p' | sed 's/^  //' | sha256sum
 *   3) tokens.css — только объявления токенов в :root, каждый токен один раз, и каждый используется в app.css. Каждый
 *      var(--…) без запасного значения в app.css ссылается на токен или на свойство, объявленное в app.css или в атрибуте
 *      style разметки. Правки без причины в EDITS не меняют значений: если подставить в новый текст значения токенов,
 *      получится старый текст. Правки с причиной меняют вид намеренно.
 *   4) Старые переменные в :root app.css (--bg, --glass, --stroke, --txt, --muted, --accent, --accent-2, --c-*,
 *      --radius) — псевдонимы токенов.
 * Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const INDEX = read('../index.html'), APP = read('../styles/app.css'), TOKENS = read('../styles/tokens.css');
const HEAD = INDEX.slice(0, INDEX.indexOf('</head>'));
const BASE = 'fa3e6ca5548882e0ff817bc0f4a4feac8983f6381397103648e8dfdb0e3e45b0';
// правки после переноса: [старый текст, новый текст, сколько раз встречается, причина — если вид меняется намеренно]
const EDITS = [
  ['--bg:#0f1115;', '--bg:var(--opus-bg);', 1],
  ['--glass:rgba(19,23,30,.62);', '--glass:var(--opus-surface);', 1],
  ['--stroke:rgba(255,255,255,.09);', '--stroke:var(--opus-line);', 1],
  ['--txt:#e8edf5;', '--txt:var(--opus-text);', 1],
  ['--muted:#93a0b1;', '--muted:var(--opus-text-muted);', 1],
  ['--accent:#4da3ff;', '--accent:var(--opus-accent);', 1],
  ['--accent-2:#ffb454;', '--accent-2:var(--opus-accent-2);', 1],
  ['--c-in:#4da3ff; --c-comp:#a78bfa; --c-pow:#ff8a3d; --c-ex:#9aa3ad;',
    '--c-in:var(--stroke-intake); --c-comp:var(--stroke-compression); --c-pow:var(--stroke-power); --c-ex:var(--stroke-exhaust);', 1],
  ['--radius:16px;', '--radius:var(--radius-lg);', 1],
  ['ui-monospace,Menlo,Consolas,monospace', 'var(--font-mono)', 4],
];
const ALIASES = ['--bg', '--glass', '--stroke', '--txt', '--muted', '--accent', '--accent-2', '--c-in', '--c-comp', '--c-pow', '--c-ex', '--radius'];
const sha = s => createHash('sha256').update(s, 'utf8').digest('hex');
const count = (s, t) => s.split(t).length - 1;
const body = css => css.slice(css.indexOf('*/\n') + 3);
const noComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
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
const resolve = s => s.replace(/var\((--[\w-]+)\)/g, (m, k) => TOK.has(k) ? TOK.get(k) : m);

test('index.html: нет <style>, tokens.css и app.css подключены в <head> до скрипта экрана запуска', () => {
  assert.doesNotMatch(INDEX, /<style[\s>]/);
  assert.ok(INDEX.indexOf('</head>') > 0 && INDEX.indexOf('</head>') < INDEX.indexOf('<script>'), '<head> до встроенного скрипта');
  assert.equal(count(INDEX, 'rel="stylesheet"'), 2);
  const t = HEAD.indexOf('<link rel="stylesheet" href="./styles/tokens.css" />'), a = HEAD.indexOf('<link rel="stylesheet" href="./styles/app.css" />');
  assert.ok(t > 0 && a > t, 'сначала tokens.css, затем app.css');
});

test('app.css: перенесённый <style> из index.html@17c9834 плюс правки из EDITS', () => {
  assert.ok(APP.startsWith('/*'), 'шапка-комментарий');
  let css = body(APP);
  for (const [was, now, n] of [...EDITS].reverse()) {
    assert.equal(count(css, now), n, `«${now}» встречается ${n} раз`);
    assert.equal(count(css, was), 0, `«${was}» осталось в app.css`);
    css = css.split(now).join(was);
  }
  assert.equal(sha(css), BASE);
});

test('tokens.css: каждый var() в app.css определён; правки без причины не меняют значений', () => {
  // свои свойства: объявленные в app.css и в атрибутах style="--…" разметки; var(--x, запасное значение) не проверяется
  const css = noComments(body(APP)), own = new Set([...(css + INDEX).matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  for (const [, k] of css.matchAll(/var\((--[\w-]+)\s*\)/g)) assert.ok(TOK.has(k) || own.has(k), `${k} не определён`);
  for (const [was, now, , why] of EDITS) if (!why) assert.equal(resolve(now), was, `«${now}» меняет значение`);
  for (const k of TOK.keys()) assert.ok(css.includes(`var(${k})`), `${k} не используется в app.css`);
});

test('app.css: старые переменные — псевдонимы токенов', () => {
  const root = noComments(body(APP)).match(/^:root\{([^}]*)\}/)[1];
  const decl = new Map(root.split(';').map(s => s.trim()).filter(Boolean).map(d => d.split(/:(.*)/s).slice(0, 2).map(x => x.trim())));
  assert.deepEqual([...decl.keys()], ALIASES);
  for (const [k, v] of decl) { const m = v.match(/^var\((--[\w-]+)\)$/); assert.ok(m && TOK.has(m[1]), `${k}: ${v}`); }
});
