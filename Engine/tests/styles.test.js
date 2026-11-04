/**
 * M-05a: стили модульной версии вынесены из встроенного <style> Engine/index.html в Engine/styles/ (П-1, 14_M05).
 *   1) В index.html нет <style>. В <head> подключён styles/app.css, до встроенного скрипта экрана запуска.
 *   2) app.css — встроенный <style> из index.html@17c9834 (строки 8–222 без отступа в 2 пробела) плюс правки
 *      из таблицы EDITS. Если в app.css вернуть каждую правку назад (новый текст → старый) и снять шапку-комментарий,
 *      sha256 совпадёт с BASE. Проверка вручную:
 *      git show 17c9834:Engine/index.html | sed -n '8,222p' | sed 's/^  //' | sha256sum
 * Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const INDEX = read('../index.html'), APP = read('../styles/app.css');
const HEAD = INDEX.slice(0, INDEX.indexOf('</head>'));
const BASE = 'fa3e6ca5548882e0ff817bc0f4a4feac8983f6381397103648e8dfdb0e3e45b0';
// правки после переноса: [старый текст, новый текст, сколько раз встречается]
const EDITS = [];
const sha = s => createHash('sha256').update(s, 'utf8').digest('hex');
const count = (s, t) => s.split(t).length - 1;

test('index.html: нет <style>, styles/app.css подключён в <head> до скрипта экрана запуска', () => {
  assert.doesNotMatch(INDEX, /<style[\s>]/);
  assert.ok(INDEX.indexOf('</head>') > 0 && INDEX.indexOf('</head>') < INDEX.indexOf('<script>'), '<head> до встроенного скрипта');
  assert.equal(count(INDEX, 'rel="stylesheet"'), 1);
  assert.equal(count(HEAD, '<link rel="stylesheet" href="./styles/app.css" />'), 1);
});

test('app.css: перенесённый <style> из index.html@17c9834 плюс правки из EDITS', () => {
  assert.ok(APP.startsWith('/*'), 'шапка-комментарий');
  let body = APP.slice(APP.indexOf('*/\n') + 3);
  for (const [was, now, n] of [...EDITS].reverse()) {
    assert.equal(count(body, now), n, `«${now}» встречается ${n} раз`);
    assert.equal(count(body, was), 0, `«${was}» осталось в app.css`);
    body = body.split(now).join(was);
  }
  assert.equal(sha(body), BASE);
});
