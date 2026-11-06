/**
 * Однофайловая Akvarium/Aquarium.html и модульная версия (A-01b, D-13 утверждено владельцем 6 ноября 2026 г.).
 * Модульная версия — Akvarium/index.html, styles/app.css и модули src/ — перенесена из Aquarium.html механически
 * (как Engine M-01b и M-02, правила переноса — split.test.js) и с этапа A-02 меняется одна. Aquarium.html остаётся по своему адресу для запуска через file://
 * и заморожена (как Engine.html по D-17).
 *   1) sha256 Aquarium.html равен зафиксированному. Правка Aquarium.html — только по отдельному решению владельца;
 *      новый хэш фиксируется вместе с этим решением.
 *   2) Модульная версия загружает three.js так же, как однофайловая: тот же importmap (three 0.160.0 с unpkg),
 *      один модуль-точка входа с onerror (сообщение о CDN и «Повторить»), стили — одним файлом.
 *   3) styles/app.css — стили Aquarium.html с правками STYLE_EDITS (строка: было → стало) и новыми правилами в конце,
 *      каждый блок новых правил начинается с комментария этапа. A-02: контраст мелкого текста и ширина столбца чисел.
 * Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { INDEX, LEGACY, MAIN, ENTRY, LINK, CSS } from './_app.js';

const AQUARIUM_HTML_SHA256 = '70daa73c923d98ecdd4b56be2b6414f572e0fbab7cdac24f9b877ee486d445e8';   // blob 31ec654, main@0852980 (A-01, PR #19)
const STYLE_EDITS = {   // A-02: контраст мелкого текста не ниже 4,5 : 1 и место для «100 %» в ru-RU
  12: ['color:rgba(205,238,255,.62)', 'color:rgba(205,238,255,.85)'], 30: ['color:rgba(190,230,250,.55)', 'color:rgba(190,230,250,.8)'],
  31: ['color:rgba(170,220,240,.5)', 'color:rgba(170,220,240,.95)'], 37: ['opacity:.45', 'opacity:.85'], 38: ['1fr 30px', '1fr 40px'],
  39: ['color:rgba(200,235,250,.6);font-size:11px', 'color:rgba(200,235,250,.8);font-size:11px;white-space:nowrap'],
  46: ['opacity:.45', 'opacity:.85'], 48: ['color:rgba(180,225,245,.5)', 'color:rgba(180,225,245,.8)'],
};
const importmap = h => JSON.parse(h.match(/<script type="importmap">\n([\s\S]*?)<\/script>/)[1]);

test('Aquarium.html заморожена: sha256 совпадает с зафиксированным', () => {
  const sha = createHash('sha256').update(LEGACY, 'utf8').digest('hex');
  assert.equal(sha, AQUARIUM_HTML_SHA256,
    'Aquarium.html изменилась. Она заморожена: правки — только в Akvarium/index.html, styles/ и src/, ' +
    'изменение Aquarium.html — по отдельному решению владельца вместе с новым хэшем.');
});

test('модульная версия: тот же importmap, одна точка входа с onerror, стили одним файлом', () => {
  assert.deepEqual(importmap(INDEX), importmap(LEGACY));
  assert.deepEqual(importmap(INDEX).imports, {
    three: 'https://unpkg.com/three@0.160.0/build/three.module.js',
    'three/addons/': 'https://unpkg.com/three@0.160.0/examples/jsm/' });
  assert.equal(INDEX.split(ENTRY).length, 2, 'одна строка точки входа');
  assert.equal(INDEX.split(LINK).length, 2, 'одна ссылка на стили');
  assert.equal((INDEX.match(/^<script type="module"/gm) || []).length, 1, 'один модуль в index.html');
  assert.ok(!/<style[\s>]/.test(INDEX), 'в index.html нет встроенных стилей');
  assert.ok(/^import \* as THREE from 'three';$/m.test(MAIN), 'main.js импортирует three через importmap');
  assert.ok(!/from '\.\.?\/[^']*\.css'/.test(MAIN));
});

test('styles/app.css — стили Aquarium.html с правками STYLE_EDITS, новые правила — в конце', () => {
  const legacy = LEGACY.match(/<style>\n([\s\S]*?)<\/style>\n/)[1].split('\n');
  assert.equal(legacy.pop(), '');
  const ref = legacy.map((s, j) => {
    const e = STYLE_EDITS[j + 1]; if (!e) return s;
    assert.equal(s.split(e[0]).length, 2, `стили Aquarium.html, строка ${j + 1}: «${e[0]}» ровно один раз`);
    return s.replace(e[0], () => e[1]);
  });
  const css = CSS.split('\n');
  assert.deepEqual(css.slice(0, ref.length), ref, 'начало styles/app.css — стили Aquarium.html с правками STYLE_EDITS');
  assert.match(css[ref.length], /^  \/\* A-\d\d[a-z]?: /, 'новые правила начинаются с комментария этапа');
});
