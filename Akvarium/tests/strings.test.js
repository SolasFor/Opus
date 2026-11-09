/**
 * Строки интерфейса и числа ru-RU (A-02, src/ui/strings.ru.js): Intl.NumberFormat('ru-RU') и Intl.PluralRules,
 * подписи и диапазоны ползунков (как в Aquarium.html), переключатели и D-12 (медузы — художественный элемент),
 * у кнопок панели — имена без глифов. Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FMT, JELLY_NOTE, JELLY_TIP, PANEL_HTML, S, SLIDERS, TOGGLES, VALUETEXT, fishCount } from '../src/ui/strings.ru.js';
import { LEGACY } from './_app.js';

const NB = '\u00a0';

test('числа ru-RU: запятая, «35 %» с неразрывным пробелом, «1,0×», пауза', () => {
  assert.equal(FMT.cur(0.6), '0,6'); assert.equal(FMT.cur(2), '2,0');
  assert.equal(FMT.night(0.35), '35' + NB + '%'); assert.equal(FMT.turb(1), '100' + NB + '%'); assert.equal(FMT.turb(0), '0' + NB + '%');
  assert.equal(FMT.spd(1), '1,0×'); assert.equal(FMT.spd(2.45), '2,5×'); assert.equal(FMT.spd(0), 'пауза');
  assert.equal(FMT.pop(26), '26');
});

test('для экранного диктора: число рыб со словом в нужной форме, скорость словами', () => {
  assert.deepEqual([1, 2, 4, 5, 11, 21, 22, 26, 101].map(fishCount),
    ['1 рыба', '2 рыбы', '4 рыбы', '5 рыб', '11 рыб', '21 рыба', '22 рыбы', '26 рыб', '101 рыба'].map(s => s.replace(' ', NB)));
  assert.equal(VALUETEXT.spd(1), 'скорость 1,0×'); assert.equal(VALUETEXT.spd(0), 'пауза');
  assert.equal(VALUETEXT.night(0.5), '50' + NB + '%'); assert.equal(VALUETEXT.pop, fishCount);
});

test('ползунки — те же, что в Aquarium.html; переключатели — прежние семь и «Медузы» (D-12)', () => {
  for (const [k, label, mn, mx, st] of SLIDERS) assert.ok(LEGACY.includes(`['${k}', '${label}', ${mn}, ${mx}, ${st}]`), `ползунок ${k} как в Aquarium.html`);
  assert.deepEqual(SLIDERS.map(s => s[0]), ['night', 'cur', 'turb', 'spd', 'pop']);
  const legacy = TOGGLES.filter(t => t[0] !== 'jelly');
  for (const [k, label, key] of legacy) assert.ok(LEGACY.includes(`['${k}', '${label}', '${key}']`), `переключатель ${k} как в Aquarium.html`);
  assert.equal(legacy.length, 7);
  assert.deepEqual(TOGGLES[1], ['jelly', 'Медузы', '']);
});

test('D-12: подпись медуз — художественный элемент, не рифовый вид', () => {
  assert.match(JELLY_NOTE, /^Художественный элемент: /);
  assert.match(JELLY_NOTE, /не вместе с рифовыми рыбами/);
  assert.match(JELLY_TIP, /^Медуза-аурелия<i>Aurelia aurita · художественный элемент<\/i>$/);
});

test('панель: у кнопок имена из слов, клавиши — в aria-keyshortcuts, глифы скрыты от диктора', () => {
  const buttons = [...PANEL_HTML.matchAll(/<button ([^>]*)>([\s\S]*?)<\/button>/g)];
  assert.equal(buttons.length, 7);
  for (const [, attrs, inner] of buttons) {
    const name = inner.replace(/<([a-z]+)[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, '').trim();
    assert.match(name, /^[А-ЯЁ][а-яё]+( [а-яё]+)*$/, `имя кнопки: «${name}»`);
    assert.match(attrs, /type="button"/);
  }
  for (const [p, k] of [['day', 1], ['sunset', 2], ['night', 3]]) assert.match(PANEL_HTML, new RegExp(`data-p="${p}" aria-keyshortcuts="${k}">[А-Я][а-я]+<b aria-hidden="true">${k}</b>`));
  assert.match(PANEL_HTML, /id="bFeed" aria-keyshortcuts="F">Покормить</);
  assert.match(PANEL_HTML, /id="bKnock" aria-keyshortcuts="K">Стук</);
  assert.match(PANEL_HTML, /<button type="button" id="grip" aria-controls="pbody" aria-expanded="false" aria-keyshortcuts="H">/);
  assert.match(PANEL_HTML, /<h3>Аквариум <span aria-hidden="true">H — скрыть<\/span><\/h3>/);
  for (const id of ['presets', 'sliders', 'toggles']) assert.match(PANEL_HTML, new RegExp(`id="${id}" role="group" aria-labelledby="sec\\w+"`));
  assert.match(PANEL_HTML, /<span class="k-mouse">[\s\S]*<kbd>ПКМ<\/kbd>[\s\S]*<\/span><span class="k-touch">[\s\S]*<kbd>касание<\/kbd>/);
  assert.ok(!PANEL_HTML.includes('☰'));
});

test('вид от рыбы и подписи: свой текст для мыши и для касания', () => {
  assert.match(S.follow('Рыба-клоун'), /^Камера следует: <b>Рыба-клоун<\/b><span class="k-mouse"> · C \/ Esc — выход, двойной клик — другая рыба<\/span><span class="k-touch"> · двойное касание — другая рыба<\/span>$/);
  assert.deepEqual(S.tipFollow, { mouse: ' · двойной клик — следить', touch: ' · двойное касание — следить' });
  assert.match(S.scene, /^Аквариум: /);
});
