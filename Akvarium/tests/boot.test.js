/**
 * Экран запуска аквариума (A-01): встроенный классический скрипт модульной версии Akvarium (index.html, styles/app.css, src/main.js) в node:vm с поддельным DOM.
 * Состояния (data-boot у <html>): booting → ready | failed; slow — мягкое уведомление через 15 с, не ошибка;
 * lost — потерян WebGL-контекст после запуска. Первая причина сбоя побеждает, после ready сбой запуска не объявляется.
 * Модуль не загрузился (onerror) — сразу сообщение о CDN и кнопка «Повторить». Плюс статические проверки разметки
 * и модуля: цикл кадров, потеря контекста, фавиконка, three.js только с unpkg (D-07 отклонено владельцем).
 * A-02: страница, открытая как файл (file://), сразу объясняет, что нужен веб-сервер, и ведёт на Aquarium.html.
 * Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { HTML } from './_app.js';   // модульная версия, собранная в один текст (A-01b)

const scripts = [...HTML.matchAll(/<script>\n([\s\S]*?)<\/script>/g)].map(m => m[1]);
const MODULE = HTML.match(/<script type="module"[^>]*>\n([\s\S]*?)<\/script>/)[1];
const IMPORTMAP = JSON.parse(HTML.match(/<script type="importmap">\n([\s\S]*?)<\/script>/)[1]);

function el() {
  const cls = new Set();
  return { hidden: false, className: '', innerHTML: '', classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) } };
}
// Загружает экран запуска: поддельные таймеры (tick) и window с addEventListener; dispatch('error', {message}) — ошибка скрипта
function boot(protocol = 'https:') {
  let now = 0, seq = 0; const timers = new Map(), listeners = {}, attrs = {};
  const bubs = el(), box = el(), msg = el(), act = el();
  act.hidden = true; box.querySelector = s => (s === '.bubs' ? bubs : null);
  const byId = { boot: box, bootmsg: msg, bootact: act };
  const g = {
    document: {
      documentElement: { setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: k => attrs[k] ?? null },
      getElementById: id => byId[id] || null,
    },
    location: { protocol, reload() {} },
    setTimeout: (fn, ms) => { timers.set(++seq, { at: now + ms, fn }); return seq; },
    clearTimeout: id => { timers.delete(id); },
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    String,
  };
  g.window = g;
  vm.createContext(g);
  for (const s of scripts) vm.runInContext(s, g);
  const tick = ms => {
    const end = now + ms;
    for (;;) {
      const next = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      timers.delete(next[0]); now = next[1].at; next[1].fn();
    }
    now = end;
  };
  const dispatch = (type, e) => (listeners[type] || []).forEach(fn => fn(e));
  const state = () => attrs['data-boot'];
  const buttons = () => [...act.innerHTML.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map(m => m[1]);
  // как модуль на первом кадре
  const ready = () => { g.__ok = 1; g.__aqScreen('ready'); };
  return { g, box, msg, act, bubs, tick, dispatch, state, buttons, ready };
}

test('встроенный классический скрипт один и он до importmap и модуля', () => {
  assert.equal(scripts.length, 1);
  const iScript = HTML.indexOf('<script>\n'), iMap = HTML.indexOf('<script type="importmap">'), iMod = HTML.indexOf('<script type="module" onerror');
  assert.ok(iScript > 0 && iScript < iMap && iMap < iMod);
  assert.match(HTML, /<div id="boot"><div class="bubs" aria-hidden="true">/);
  assert.match(HTML, /<div id="bootmsg" aria-live="polite">Наполняем аквариум…<\/div><div id="bootact" hidden><\/div>/);
});

test('booting сразу, ready на первом кадре: экран плавно гаснет, потом hidden', () => {
  const b = boot();
  assert.equal(b.state(), 'booting');
  assert.equal(b.box.hidden, false);
  b.tick(3000);
  b.ready();
  assert.equal(b.state(), 'ready');
  assert.ok(b.box.classList.contains('gone'));
  assert.equal(b.box.hidden, false);
  b.tick(1500);
  assert.equal(b.box.hidden, true);
  b.tick(60000);                            // уведомление о медленной загрузке после ready не появляется
  assert.equal(b.state(), 'ready');
});

test('через 15 с — мягкое уведомление slow с кнопкой «Обновить», это не сбой; потом ready', () => {
  const b = boot();
  b.tick(14999);
  assert.equal(b.state(), 'booting');
  b.tick(1);
  assert.equal(b.state(), 'slow');
  assert.match(b.msg.innerHTML, /дольше обычного/);
  assert.deepEqual(b.buttons(), ['Обновить']);
  assert.equal(b.act.hidden, false);
  assert.equal(b.box.classList.contains('err'), false);
  assert.equal(b.bubs.hidden, false);
  assert.notEqual(b.g.__aqFailed, true);
  b.tick(120000);
  assert.equal(b.state(), 'slow');          // ждёт дальше, сбоя не объявляет
  b.ready();
  assert.equal(b.state(), 'ready');
});

test('модуль не загрузился (onerror) — сразу failed: CDN и «Повторить»', () => {
  const b = boot();
  b.tick(200);
  b.g.__aqModuleError();
  assert.equal(b.state(), 'failed');
  assert.match(b.msg.innerHTML, /Не удалось запустить аквариум/);
  assert.match(b.msg.innerHTML, /CDN \(unpkg\.com\)/);
  assert.deepEqual(b.buttons(), ['Повторить']);
  assert.match(b.act.innerHTML, /onclick="location\.reload\(\)"/);
  assert.ok(b.box.classList.contains('err'));
  assert.equal(b.bubs.hidden, true);
  b.tick(20000);
  assert.equal(b.state(), 'failed');        // slow не перекрывает сбой
});

test('__aqFail без причины — как раньше: сообщение о CDN; с причиной и кнопками — их', () => {
  const a = boot();
  a.g.__aqFail();
  assert.equal(a.state(), 'failed');
  assert.match(a.msg.innerHTML, /Three\.js не загрузилась с CDN/);
  assert.deepEqual(a.buttons(), ['Повторить']);
  const b = boot();
  b.g.__aqFail('Браузер не смог включить 3D-графику (WebGL)', ['reload']);
  assert.match(b.msg.innerHTML, /WebGL/);
  assert.deepEqual(b.buttons(), ['Перезагрузить']);
});

test('A-02: открыто как файл (file://) — сразу failed: нужен веб-сервер, ссылка на однофайловую Aquarium.html', () => {
  const b = boot('file:');
  assert.equal(b.state(), 'failed');
  assert.match(b.msg.innerHTML, /Не удалось запустить аквариум/);
  assert.match(b.msg.innerHTML, /работает через веб-сервер/);
  assert.match(b.msg.innerHTML, /<code>python3 -m http\.server<\/code>/);
  assert.equal(b.act.innerHTML, '<a href="./Aquarium.html">Открыть Aquarium.html</a>');
  assert.deepEqual(b.buttons(), []);
  assert.equal(b.act.hidden, false);
  b.g.__aqModuleError();                    // модуль из file:// не загрузится — причина остаётся прежней
  b.tick(20000);
  assert.equal(b.state(), 'failed');
  assert.match(b.msg.innerHTML, /веб-сервер/);
  assert.equal(boot('http:').state(), 'booting');
});

test('ошибка скрипта до ready — «Ошибка при запуске» с экранированием и «Перезагрузить»', () => {
  const b = boot();
  b.dispatch('error', { message: 'TypeError: x <b>is</b> "bad"' });
  assert.equal(b.state(), 'failed');
  assert.match(b.msg.innerHTML, /Ошибка при запуске: TypeError: x &#60;b&#62;is&#60;\/b&#62; &#34;bad&#34;/);
  assert.deepEqual(b.buttons(), ['Перезагрузить']);
});

test('первая причина сбоя побеждает', () => {
  const b = boot();
  b.g.__aqFail('Браузер не смог включить 3D-графику (WebGL)', ['reload']);
  b.dispatch('error', { message: 'Error creating WebGL context.' });   // модуль бросает исключение после __aqFail
  b.g.__aqModuleError();
  assert.match(b.msg.innerHTML, /3D-графику/);
  assert.doesNotMatch(b.msg.innerHTML, /Ошибка при запуске/);
  assert.deepEqual(b.buttons(), ['Перезагрузить']);
});

test('после ready сбой запуска не объявляется; события без message игнорируются', () => {
  const b = boot();
  b.dispatch('error', {});                  // например, ошибка загрузки ресурса без текста
  assert.equal(b.state(), 'booting');
  b.ready();
  b.dispatch('error', { message: 'later' });
  b.g.__aqModuleError();
  b.g.__aqFail('x');
  assert.equal(b.state(), 'ready');
});

test('посторонняя ошибка до запуска: экран сбоя, но если первый кадр отрисован — ready его скрывает', () => {
  const b = boot();
  b.dispatch('error', { message: 'extension.js: boom' });
  assert.equal(b.state(), 'failed');
  b.ready();
  assert.equal(b.state(), 'ready');
  assert.ok(b.box.classList.contains('gone'));
});

test('lost после запуска показывает экран снова, ready после восстановления скрывает', () => {
  const b = boot();
  b.ready(); b.tick(2000);
  assert.equal(b.box.hidden, true);
  b.g.__aqScreen('lost', 'Графика временно недоступна');
  assert.equal(b.state(), 'lost');
  assert.equal(b.box.hidden, false);
  assert.equal(b.box.classList.contains('gone'), false);
  assert.equal(b.act.hidden, true);
  assert.equal(b.bubs.hidden, false);
  b.g.__aqScreen('ready');
  assert.equal(b.state(), 'ready');
  b.tick(1500);
  assert.equal(b.box.hidden, true);
});

test('slow не перекрывает lost во время запуска; booting без текста — исходная надпись', () => {
  const b = boot();
  b.tick(1000);
  b.g.__aqScreen('lost', 'Графика временно недоступна');
  b.tick(20000);
  assert.equal(b.state(), 'lost');
  b.g.__aqScreen('booting');
  assert.equal(b.msg.innerHTML, 'Наполняем аквариум…');
});

// --- статические проверки модуля
test('onerror у модуля — __aqModuleError; WebGL — своё сообщение и «Перезагрузить»', () => {
  assert.match(HTML, /<script type="module" onerror="window\.__aqModuleError\(\)">/);
  assert.match(MODULE, /catch \(e\) \{\n  window\.__aqFail\('Браузер не смог включить 3D-графику \(WebGL\)[\s\S]*?\['reload'\]\);\n  throw e;\n\}/);
  assert.doesNotMatch(HTML, /setTimeout\(function \(\) \{ if \(!window\.__ok\) window\.__aqFail\(\); \}, 15000\)/);   // прежний «сбой» через 15 с
});

test('цикл: setAnimationLoop(loop), пауза при lost, 30 ошибок подряд — остановка с сообщением', () => {
  assert.match(MODULE, /renderer\.setAnimationLoop\(loop\);/);
  assert.doesNotMatch(MODULE, /setAnimationLoop\(frame\)/);
  const loop = MODULE.match(/function loop\(\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(loop, /if \(run\.lost\) \{ clock\.getDelta\(\); return; \}/);
  assert.match(loop, /try \{\n    frame\(\);\n    run\.errors = 0;/);
  assert.match(loop, /if \(\+\+run\.errors === 1\) console\.error\(err\);/);
  assert.match(loop, /run\.errors >= 30[\s\S]*renderer\.setAnimationLoop\(null\)[\s\S]*__aqScreen\('failed'[\s\S]*\['reload'\]/);
  // ready — на первом кадре, после renderer.render
  const frame = MODULE.match(/function frame\(\) \{[\s\S]*?\n\}\n/)[0];
  assert.ok(frame.indexOf("window.__aqScreen('ready')") > frame.indexOf('renderer.render(scene, camera)'));
  assert.match(frame, /window\.__ok = 1;/);
});

test('потеря контекста: lost, через 10 с failed; restore — новое окружение PMREM для материалов рыб', () => {
  const lost = MODULE.match(/addEventListener\('webglcontextlost', \(\) => \{[\s\S]*?\n\}\);/)[0];
  assert.match(lost, /run\.lost = true;/);
  assert.match(lost, /__aqScreen\('lost'/);
  assert.match(lost, /setTimeout\([\s\S]*__aqScreen\('failed'[\s\S]*\['reload'\]\), 10000\)/);
  const rest = MODULE.match(/addEventListener\('webglcontextrestored', \(\) => \{[\s\S]*?\n\}\);/)[0];
  assert.match(rest, /clearTimeout\(run\.timer\)/);
  assert.match(rest, /storeEnv\(makeEnv\(\)\);/);   // шов A-01b: ENV объявлен в creatures.js
  assert.match(rest, /for \(const m of FISH_MATS\) m\.envMap = ENV;/);
  assert.match(rest, /run\.lost = false;/);
  assert.match(rest, /__aqScreen\(booted \? 'ready' : 'booting'\)/);
  assert.match(MODULE, /let ENV = makeEnv\(\);/);
  assert.equal((MODULE.match(/envMap: ENV/g) || []).length, 1);   // окружение берут только материалы рыб (FISH_MATS)
});

test('three.js 0.160.0 только с unpkg, без резервного CDN (D-07 отклонено владельцем)', () => {
  assert.deepEqual(IMPORTMAP.imports, {
    three: 'https://unpkg.com/three@0.160.0/build/three.module.js',
    'three/addons/': 'https://unpkg.com/three@0.160.0/examples/jsm/',
  });
  assert.equal((HTML.match(/https?:\/\/(?!unpkg\.com|www\.w3\.org)[a-z0-9.-]+\//gi) || []).length, 0);
});

test('фавиконка — встроенный SVG (нет запроса favicon.ico)', () => {
  const m = HTML.match(/<link rel="icon" type="image\/svg\+xml" href="(data:image\/svg\+xml,[^"]+)">/);
  assert.ok(m);
  assert.match(decodeURIComponent(m[1].slice('data:image/svg+xml,'.length)), /^<svg xmlns='http:\/\/www\.w3\.org\/2000\/svg'[\s\S]*<\/svg>$/);
});
