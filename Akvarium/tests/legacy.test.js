/**
 * Однофайловая Akvarium/Aquarium.html и модульная версия (A-01b, D-13 утверждено владельцем 6 ноября 2026 г.).
 * Модульная версия — Akvarium/index.html, styles/app.css и модули src/ — перенесена из Aquarium.html механически
 * (как Engine M-01b и M-02, правила переноса — split.test.js) и с этапа A-02 меняется одна. Aquarium.html остаётся по своему адресу для запуска через file://
 * и заморожена (как Engine.html по D-17).
 *   1) sha256 Aquarium.html равен зафиксированному. Правка Aquarium.html — только по отдельному решению владельца;
 *      новый хэш фиксируется вместе с этим решением.
 *   2) Модульная версия загружает three.js так же, как однофайловая: тот же importmap (three 0.160.0 с unpkg),
 *      один модуль-точка входа с onerror (сообщение о CDN и «Повторить»), стили — одним файлом.
 * Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { INDEX, LEGACY, MAIN, ENTRY, LINK, CSS } from './_app.js';

const AQUARIUM_HTML_SHA256 = '70daa73c923d98ecdd4b56be2b6414f572e0fbab7cdac24f9b877ee486d445e8';   // blob 31ec654, main@0852980 (A-01, PR #19)
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
  assert.ok(LEGACY.includes('<style>\n' + CSS + '</style>\n'), 'styles/app.css — стили Aquarium.html дословно');
});
