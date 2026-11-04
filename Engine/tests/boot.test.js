/**
 * Экран запуска модульной версии (M-03): встроенный классический скрипт Engine/index.html в node:vm с поддельным DOM.
 * Состояния (data-boot у <html>): booting → ready | failed; slow — мягкое уведомление через 15 с, не ошибка;
 * lost — потерян WebGL-контекст после запуска. Первая причина сбоя побеждает, после ready сбой запуска не объявляется,
 * ошибка загрузки модуля объясняется сразу: file:// — нужен сервер; иначе пробный запрос к CDN отличает CDN от файлов
 * приложения. Плюс статические проверки разметки и кода: main.js и модулей, вынесенных из него (M-02).
 * Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const INDEX = read('../index.html'), MAIN = read('../src/main.js');
const SRC = new URL('../src/', import.meta.url);
const walk = d => readdirSync(new URL(d, SRC), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(`${d}${e.name}/`) : e.name.endsWith('.js') ? [d + e.name] : []);
// весь код модульной версии, кроме модели (config, sim): main.js и вынесенные из него модули
const APP = ['main.js', ...['anim/', 'audio/', 'render/', 'ui/'].filter(d => existsSync(new URL(d, SRC))).flatMap(walk)]
  .map(f => read(`../src/${f}`)).join('\n');
const scripts = [...INDEX.matchAll(/<script>\n([\s\S]*?)<\/script>/g)].map(m => m[1]);
const IMPORTMAP = INDEX.match(/<script type="importmap">\n([\s\S]*?)<\/script>/)[1];
const THREE_URL = JSON.parse(IMPORTMAP).imports.three;

function el() {
  const cls = new Set();
  return { hidden: false, className: '', innerHTML: '', classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) } };
}
// Загружает экран запуска: поддельные таймеры (tick), fetch под управлением теста, location с протоколом.
function boot({ protocol = 'https:', fetchResult = 'pending' } = {}) {
  let now = 0, seq = 0; const timers = new Map(), listeners = {}, fetches = [], attrs = {};
  const spinner = el(), loader = el(), msg = el(), act = el();
  act.hidden = true; loader.querySelector = s => (s === '.spinner' ? spinner : null);
  const byId = { loader, loaderMsg: msg, loaderAct: act };
  const g = {
    document: {
      documentElement: { setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: k => attrs[k] ?? null },
      getElementById: id => byId[id] || null,
      querySelector: s => (s === 'script[type="importmap"]' ? { textContent: IMPORTMAP } : null),
    },
    location: { protocol, reload() {} },
    setTimeout: (fn, ms) => { timers.set(++seq, { at: now + ms, fn }); return seq; },
    clearTimeout: id => { timers.delete(id); },
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    fetch: (url, opts) => {
      fetches.push({ url, opts });
      return fetchResult === 'ok' ? Promise.resolve({}) : fetchResult === 'fail' ? Promise.reject(new TypeError('Failed to fetch')) : new Promise(() => {});
    },
    String, JSON, Promise, TypeError,
  };
  g.window = g;
  vm.createContext(g);
  for (const s of scripts) vm.runInContext(s, g);
  const tick = ms => {
    const end = now + ms;
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      timers.delete(due[0]); now = due[1].at; due[1].fn();
    }
    now = end;
  };
  const flush = () => new Promise(r => setImmediate(r));
  const view = () => ({
    state: attrs['data-boot'], shown: !loader.hidden && !loader.classList.contains('hide'), hidden: loader.hidden,
    spinner: !spinner.hidden, err: msg.className === 'err', msg: msg.innerHTML, act: act.hidden ? '' : act.innerHTML,
  });
  return { g, tick, flush, view, fetches, error: message => listeners.error.forEach(fn => fn({ message })) };
}

test('index.html: один встроенный скрипт экрана запуска, onerror у модуля main.js', () => {
  assert.equal(scripts.length, 1, 'встроенный классический <script>');
  assert.match(INDEX, /<script type="module" src="\.\/src\/main\.js" onerror="__engModuleError\(\)"><\/script>/);
  assert.match(INDEX, /<div id="loaderAct" hidden><\/div>/);
});

test('запуск: booting, спиннер, без кнопок', () => {
  const b = boot();
  assert.deepEqual(b.view(), { state: 'booting', shown: true, hidden: false, spinner: true, err: false, msg: '', act: '' });
});

test('медленная загрузка: через 15 с мягкое уведомление, ошибка по таймеру не объявляется, затем ready', () => {
  const b = boot();
  b.tick(14999); assert.equal(b.view().state, 'booting');
  b.tick(1);
  let v = b.view();
  assert.equal(v.state, 'slow'); assert.ok(v.spinner && !v.err); assert.match(v.msg, /дольше обычного/); assert.match(v.act, />Обновить</);
  b.tick(120000);
  assert.equal(b.view().state, 'slow'); assert.equal(b.g.__engFailed, undefined);
  b.g.__engOk = true; b.g.__engScreen('ready');
  v = b.view(); assert.equal(v.state, 'ready'); assert.equal(v.shown, false); assert.equal(v.hidden, false);
  b.tick(800); assert.equal(b.view().hidden, true);
});

test('ready до 15 с: уведомление не появляется', () => {
  const b = boot();
  b.tick(5000); b.g.__engOk = true; b.g.__engScreen('ready');
  b.tick(60000);
  assert.equal(b.view().state, 'ready'); assert.equal(b.view().hidden, true);
});

test('первая причина сбоя побеждает; после ready сбой запуска игнорируется', () => {
  const b = boot();
  b.g.__engFail('Первая причина', ['reload']); b.g.__engFail('Вторая причина');
  const v = b.view();
  assert.equal(v.state, 'failed'); assert.ok(v.err && !v.spinner);
  assert.match(v.msg, /Не удалось запустить 3D-модель\.<\/b><br>Первая причина$/); assert.match(v.act, />Перезагрузить</);
  b.tick(20000); assert.match(b.view().msg, /Первая причина$/);
  const r = boot(); r.g.__engOk = true; r.g.__engScreen('ready'); r.g.__engFail('Поздно');
  assert.equal(r.view().state, 'ready');
});

test('file:// — сразу «нужен веб-сервер» и ссылка на Engine.html, без пробного запроса', () => {
  const b = boot({ protocol: 'file:' });
  b.g.__engModuleError();
  const v = b.view();
  assert.equal(v.state, 'failed'); assert.match(v.msg, /только через веб-сервер/); assert.match(v.msg, /python3 -m http\.server/);
  assert.match(v.act, /<a class="btn accent" href="Engine\.html">Открыть Engine\.html<\/a>/);
  assert.equal(b.fetches.length, 0);
});

test('CDN недоступен: пробный HEAD к three из importmap отклонён — «CDN» и «Повторить»', async () => {
  const b = boot({ fetchResult: 'fail' });
  b.g.__engModuleError(); await b.flush();
  assert.equal(b.fetches.length, 1);
  assert.equal(b.fetches[0].url, THREE_URL);
  assert.equal(b.fetches[0].opts.method, 'HEAD'); assert.equal(b.fetches[0].opts.mode, 'no-cors');
  const v = b.view();
  assert.equal(v.state, 'failed'); assert.match(v.msg, /Three\.js не загрузилась с CDN \(unpkg\.com\)/);
  assert.match(v.act, /class="btn accent"[^>]*>Повторить</); assert.doesNotMatch(v.act, /Engine\.html/);
});

test('CDN доступен: «не загрузились файлы приложения», «Повторить» и Engine.html', async () => {
  const b = boot({ fetchResult: 'ok' });
  b.g.__engModuleError(); await b.flush();
  const v = b.view();
  assert.match(v.msg, /Не загрузились файлы приложения/); assert.match(v.act, />Повторить</); assert.match(v.act, /href="Engine\.html"/);
  b.tick(10000); assert.match(b.view().msg, /файлы приложения/);
});

test('пробный запрос завис: через 8 с — сообщение о CDN', () => {
  const b = boot();
  b.g.__engModuleError();
  b.tick(7999); assert.equal(b.view().state, 'booting');
  b.tick(1); assert.match(b.view().msg, /не загрузилась с CDN/);
});

test('ошибка скрипта до ready: текст ошибки экранирован; после ready не показывается', () => {
  const b = boot();
  b.error('Unexpected token <img src=x onerror=alert(1)>');
  const v = b.view();
  assert.equal(v.state, 'failed');
  assert.match(v.msg, /Ошибка при запуске: Unexpected token &#60;img src=x onerror=alert\(1\)&#62;$/);
  assert.match(v.act, />Перезагрузить</);
  const r = boot(); r.g.__engOk = true; r.g.__engScreen('ready'); r.error('поздняя ошибка');
  assert.equal(r.view().state, 'ready');
});

test('после запуска: lost показывает экран со спиннером, ready скрывает; повторный lost отменяет скрытие', () => {
  const b = boot();
  b.g.__engOk = true; b.g.__engScreen('ready'); b.tick(800);
  b.g.__engScreen('lost', 'Восстанавливаю…');
  let v = b.view(); assert.equal(v.state, 'lost'); assert.ok(v.shown && v.spinner && !v.err); assert.equal(v.act, '');
  b.g.__engScreen('ready'); b.tick(500); b.g.__engScreen('lost', 'Снова');
  b.tick(1000); v = b.view(); assert.equal(v.state, 'lost'); assert.equal(v.hidden, false); assert.equal(v.msg, 'Снова');
  b.g.__engScreen('failed', 'Не удалось', ['reload']);
  v = b.view(); assert.ok(v.err && !v.spinner); assert.match(v.act, />Перезагрузить</);
});

test('__engEsc экранирует & < > " \'', () => {
  assert.equal(boot().g.__engEsc(`a&b<c>"d'`), 'a&#38;b&#60;c&#62;&#34;d&#39;');
});

test('main.js и модули: готовность и сбои идут через экран запуска; слушатели window/document снимаются в dispose()', () => {
  assert.match(MAIN, /window\.__engOk = true;\n\s+if \(!run\.lost\) window\.__engScreen\('ready'\);/);
  assert.doesNotMatch(APP, /loader\.remove\(\)/);
  const global = APP.split('\n').filter(l => /\b(?:window|document)\.addEventListener\(/.test(l));
  assert.ok(global.length >= 4, 'слушатели window/document');
  for (const l of global) assert.match(l, /\{ signal: life\.signal \}\);/, l.trim());
  for (const ev of ['webglcontextlost', 'webglcontextrestored']) assert.match(APP, new RegExp(`canvas\\.addEventListener\\('${ev}', \\w+, \\{ signal: life\\.signal \\}\\)`));
  assert.match(MAIN, /\bdispose,/, 'engine.dispose');
});
