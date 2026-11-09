/**
 * Адаптивное разрешение аквариума (A-01): чистая функция adaptStep из модульной версии Akvarium (index.html, styles/app.css, src/main.js).
 * Тест вырезает блок между метками «// @pure adaptStep begin» и «// @pure adaptStep end» и выполняет его в node:vm —
 * поэтому в блоке не должно быть DOM, three.js и состояния страницы. Прежнее поведение (только вниз: fps < LOW два окна
 * подряд — pixelRatio −0.25, не ниже 0.75) сохранено, порог LOW — 55 (Р-A13, A-05; было 45); новое — подъём обратно с гистерезисом. Плюс статические проверки
 * встраивания: ?noadapt, разогрев по реальному времени, сброс окна после фоновой вкладки, window.__aq.
 * Р-A14 (A-05b): доля долгих кадров за окно (jank, кадр дольше 25 мс): больше 5 % — окно медленное и при fps ≥ LOW,
 * подъём — только при доле ≤ 2 %; jank = 0 (по умолчанию) — поведение A-05.
 * Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { HTML } from './_app.js';   // модульная версия, собранная в один текст (A-01b)

const BEGIN = '// @pure adaptStep begin\n', END = '// @pure adaptStep end\n';
const BLOCK = HTML.slice(HTML.indexOf(BEGIN) + BEGIN.length, HTML.indexOf(END));
const { ADAPT, ADAPT0, adaptStep } = vm.runInNewContext(`${BLOCK}\n;({ ADAPT, ADAPT0, adaptStep })`, { Math, Infinity });

// прогон: fps и jank (Р-A14) — число или функция от pr; без jank — как до A-05b; возвращает историю pr после каждого окна
function runSeq(fpsOf, windows, maxPR = 1.75, pr = maxPR, jankOf) {
  let s = { ...ADAPT0, pr };
  const hist = [];
  for (let i = 0; i < windows; i++) {
    const fps = typeof fpsOf === 'function' ? fpsOf(s.pr, i) : fpsOf;
    s = jankOf === undefined ? adaptStep(s, fps, maxPR) : adaptStep(s, fps, maxPR, typeof jankOf === 'function' ? jankOf(s.pr, i) : jankOf);
    hist.push(s.pr);
  }
  return { s, hist };
}
// прежний код (main@4b8d33a, конец frame()): slowCount++ при ft > 1/45 и pixelRatio > 0.75, иначе сброс; порог — параметр low (прежний — 45, сейчас ADAPT.LOW)
function legacySeq(fpsOf, windows, pr = 1.75, low = 45) {
  let slow = 0; const hist = [];
  for (let i = 0; i < windows; i++) {
    const ft = 1 / fpsOf(pr, i);
    if (ft > 1 / low && pr > 0.75) { slow++; if (slow >= 2) { pr = Math.max(0.75, pr - 0.25); slow = 0; } } else slow = 0;
    hist.push(pr);
  }
  return hist;
}

test('блок @pure найден, без DOM, three.js и состояния страницы', () => {
  assert.ok(HTML.indexOf(BEGIN) > 0 && HTML.indexOf(END) > HTML.indexOf(BEGIN));
  assert.equal(HTML.split(BEGIN).length, 2);
  assert.doesNotMatch(BLOCK.replace(/\/\*[\s\S]*?\*\//g, ''), /\b(window|document|THREE|renderer|performance|location|U\.|pixelRatio|MAXPR)\b/);
});

test('параметры', () => {
  assert.deepEqual({ ...ADAPT }, { WIN: 2, WARM: 5, LOW: 55, HIGH: 58, STEP: 0.25, MIN: 0.75, SLOW: 2, HOLD: 3, HOLD_MAX: 24, TRIAL: 5, LONG: 0.025, JANK: 0.05, JANK_UP: 0.02 });
  assert.deepEqual({ ...ADAPT0 }, { pr: 1, slow: 0, good: 0, hold: 3, since: Infinity });
});

test('вниз — как раньше: два медленных окна подряд, шаг 0.25, не ниже 0.75', () => {
  const { hist } = runSeq(30, 12);
  assert.deepEqual(hist, [1.75, 1.5, 1.5, 1.25, 1.25, 1, 1, 0.75, 0.75, 0.75, 0.75, 0.75]);
  // одно медленное окно между быстрыми ничего не меняет
  assert.deepEqual(runSeq((pr, i) => (i % 2 ? 60 : 30), 10).hist, Array(10).fill(1.75));
});

test('совпадает с прежним кодом, пока подниматься некуда', () => {
  for (const f of [() => 30, () => 50, () => 56, (pr, i) => (i % 3 ? 30 : 56), (pr, i) => (i < 4 ? 20 : 57)]) {
    assert.deepEqual(runSeq(f, 40).hist, legacySeq(f, 40, 1.75, ADAPT.LOW));
  }
});

test('ровно на порогах: 55 — не медленно, 54 — медленно, 58 — ещё не быстро (Р-A13)', () => {
  assert.deepEqual(runSeq(55, 6).hist, Array(6).fill(1.75));
  assert.deepEqual(runSeq(54, 4).hist, [1.75, 1.5, 1.5, 1.25]);
  assert.deepEqual(runSeq(58, 20, 1.75, 1).hist, Array(20).fill(1));
});

test('вверх: HOLD быстрых окон подряд — +0.25, не выше maxPR', () => {
  const { hist } = runSeq(60, 12, 1.75, 1);
  assert.deepEqual(hist, [1, 1, 1.25, 1.25, 1.25, 1.5, 1.5, 1.5, 1.75, 1.75, 1.75, 1.75]);
  assert.deepEqual(runSeq(60, 6, 1, 1).hist, Array(6).fill(1));            // maxPR = 1 (экран 1×): выше не поднимаемся
  assert.equal(runSeq(60, 30, 1.6, 0.75).s.pr, 1.6);                       // maxPR не кратен шагу
  // среднее окно (55…58) прерывает серию
  assert.deepEqual(runSeq((pr, i) => (i === 1 ? 56 : 60), 5, 1.75, 1).hist, [1, 1, 1, 1, 1.25]);
});

test('гистерезис: неудачный подъём удваивает ожидание 3 → 6 → 12 → 24 окна (не больше)', () => {
  // на 1.25 и выше — медленно, на 1 — быстро: подъём каждый раз не удаётся
  const fps = pr => (pr > 1 ? 30 : 60);
  let s = { ...ADAPT0, pr: 1 };
  const ups = [];
  for (let i = 0; i < 120; i++) {
    const prev = s.pr;
    s = adaptStep(s, fps(s.pr), 1.75);
    if (s.pr > prev) ups.push(i);
  }
  const gaps = ups.slice(1).map((u, i) => u - ups[i]);
  // между подъёмами: 2 окна вниз + ожидание hold; hold растёт 6, 12, 24, 24, …
  assert.equal(ups[0], 2);
  assert.deepEqual(gaps.slice(0, 4), [2 + 6, 2 + 12, 2 + 24, 2 + 24]);
  assert.equal(s.hold, 24);
  // за 120 окон (4 мин) — 6 подъёмов, без гистерезиса было бы 24
  assert.equal(ups.length, 6);
});

test('удачный подъём (продержался TRIAL окон) возвращает ожидание к HOLD', () => {
  let s = { ...ADAPT0, pr: 1, hold: 24 };
  for (let i = 0; i < 24; i++) s = adaptStep(s, 60, 1.75);
  assert.equal(s.pr, 1.25);
  assert.equal(s.since, 0);
  for (let i = 0; i < ADAPT.TRIAL; i++) s = adaptStep(s, 56, 1.75);    // TRIAL окон без падения
  assert.equal(s.hold, 24);
  s = adaptStep(s, 56, 1.75);
  assert.equal(s.hold, ADAPT.HOLD);
  // а падение позже TRIAL окон не удваивает ожидание
  s = adaptStep(adaptStep(s, 30, 1.75), 30, 1.75);
  assert.equal(s.pr, 1);
  assert.equal(s.hold, ADAPT.HOLD);
});

test('нагрузка на границе уровней не качает разрешение: за 10 минут 28 смен вместо 120', () => {
  // 1.5 — медленно (40 fps), 1.25 — быстро (60 fps); без гистерезиса цикл «3 окна ждём, 2 окна падаем» — 120 смен
  const { hist } = runSeq(pr => (pr >= 1.5 ? 40 : 60), 300);
  const changes = hist.filter((p, i) => i && p !== hist[i - 1]).length;
  assert.equal(changes, 28);
  // доля окон на медленном уровне после выхода на режим — меньше 10 %
  const slow = hist.slice(30).filter(p => p >= 1.5).length / hist.slice(30).length;
  assert.ok(slow < 0.1, String(slow));
  assert.ok(hist.every(p => p >= 1.25 && p <= 1.75));
});

test('Р-A14: доля долгих кадров выше 5 % два окна подряд снижает разрешение и при fps ≥ 55', () => {
  assert.deepEqual(runSeq(57, 4, 1.75, 1.75, 0.08).hist, [1.75, 1.5, 1.5, 1.25]);
  // одно окно с рывками между ровными ничего не меняет
  assert.deepEqual(runSeq(57, 10, 1.75, 1.75, (pr, i) => (i % 2 ? 0 : 0.2)).hist, Array(10).fill(1.75));
  // не ниже MIN
  assert.equal(runSeq(60, 40, 1.75, 1.75, 0.5).s.pr, ADAPT.MIN);
});

test('Р-A14: ровно 5 % — не медленно, больше — медленно; подъём — только при доле ≤ 2 %', () => {
  assert.deepEqual(runSeq(57, 6, 1.75, 1.75, 0.05).hist, Array(6).fill(1.75));
  assert.deepEqual(runSeq(57, 4, 1.75, 1.75, 0.051).hist, [1.75, 1.5, 1.5, 1.25]);
  assert.deepEqual(runSeq(60, 20, 1.75, 1, 0.03).hist, Array(20).fill(1));          // 3 % — разрешение держится
  assert.deepEqual(runSeq(60, 12, 1.75, 1, 0.02).hist, [1, 1, 1.25, 1.25, 1.25, 1.5, 1.5, 1.5, 1.75, 1.75, 1.75, 1.75]);   // 2 % — как без рывков
  // средняя доля (2…5 %) прерывает серию быстрых окон
  assert.deepEqual(runSeq(60, 5, 1.75, 1, (pr, i) => (i === 1 ? 0.04 : 0)).hist, [1, 1, 1, 1, 1.25]);
});

test('Р-A14: jank = 0 — то же, что без аргумента (поведение A-05)', () => {
  for (const f of [() => 30, () => 54, () => 56, () => 60, (pr, i) => (i % 3 ? 30 : 60), pr => (pr >= 1.5 ? 40 : 60)]) {
    for (const pr0 of [1, 1.75]) assert.deepEqual(runSeq(f, 200, 1.75, pr0, 0).hist, runSeq(f, 200, 1.75, pr0).hist);
  }
});

test('Р-A14: модель замеров iGPU (9 ноября 2026 г.) — на 1.5 и выше 56.5 fps и 6,2 % долгих кадров, на 1.25 — ровно', () => {
  const fps = pr => (pr >= 1.5 ? 56.5 : 60), jank = pr => (pr >= 1.5 ? 0.062 : 0.005);
  // A-05 (только средний fps): 56.5 ≥ LOW — разрешение остаётся 1.75, бюджет p95 нарушен всё время
  assert.deepEqual(runSeq(fps, 300).hist, Array(300).fill(1.75));
  // с Р-A14: уходит на 1.25, пробы 1.5 с гистерезисом редкие — на медленном уровне меньше 10 % окон
  const { hist } = runSeq(fps, 300, 1.75, 1.75, jank);
  assert.deepEqual(hist.slice(0, 4), [1.75, 1.5, 1.5, 1.25]);
  const hi = hist.slice(30).filter(p => p >= 1.5).length / hist.slice(30).length;
  assert.ok(hi < 0.1, String(hi));
  assert.ok(hist.every(p => p >= 1.25 && p <= 1.75));
});

test('шаг не меняет переданное состояние', () => {
  const s = Object.freeze({ ...ADAPT0, pr: 1.5 });
  assert.doesNotThrow(() => adaptStep(s, 30, 1.75));
  assert.equal(s.pr, 1.5);
});

// --- статические проверки встраивания
test('встраивание: ?noadapt, разогрев по performance.now, окно WIN, долгие кадры (Р-A14), сброс после фоновой вкладки, window.__aq', () => {
  const html = HTML.slice(HTML.indexOf(END));
  assert.match(html, /const NOADAPT = new URLSearchParams\(location\.search\)\.has\('noadapt'\);/);
  assert.match(html, /const AD = \{ s: \{ \.\.\.ADAPT0, pr: pixelRatio \}, frames: 0, acc: 0, t0: 0, long: 0 \};/);
  const fn = html.match(/function adaptFrame\(rawDt\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(fn, /AD\.frames\+\+; AD\.acc \+= rawDt; if \(rawDt > ADAPT\.LONG\) AD\.long\+\+;/);
  assert.match(fn, /if \(AD\.acc <= ADAPT\.WIN\) return;/);
  assert.match(fn, /const ft = AD\.acc \/ AD\.frames, jank = AD\.long \/ AD\.frames;/);
  assert.match(fn, /if \(!NOADAPT && performance\.now\(\) - AD\.t0 > ADAPT\.WARM \* 1000\)/);
  assert.match(fn, /AD\.s = adaptStep\(AD\.s, 1 \/ ft, MAXPR, jank\);/);
  assert.match(fn, /renderer\.setPixelRatio\(pixelRatio\); U\.uPR\.value = pixelRatio;/);
  assert.match(fn, /window\.__aq = \{ ft, pixelRatio, calls: renderer\.info\.render\.calls, tris: renderer\.info\.render\.triangles, msaa: MSAA, programs: renderer\.info\.programs\.length, geometries: renderer\.info\.memory\.geometries, textures: renderer\.info\.memory\.textures, jank \};/);
  assert.match(fn, /AD\.frames = 0; AD\.acc = 0; AD\.long = 0;\n\}/);
  assert.match(html, /function adaptReset\(\) \{ AD\.frames = 0; AD\.acc = 0; AD\.long = 0; clock\.getDelta\(\); \}/);
  assert.match(html, /document\.addEventListener\('visibilitychange', adaptReset\);/);
  assert.match(html, /AD\.t0 = performance\.now\(\); window\.__aqScreen\('ready'\);/);
  assert.match(HTML, /const MAXPR = Math\.min\(window\.devicePixelRatio \|\| 1, 1\.75\);/);
  // прежнего кода в frame() нет
  assert.doesNotMatch(HTML, /slowCount/);
  assert.doesNotMatch(HTML, /rt > 5 && ft > 1 \/ 45/);
});
