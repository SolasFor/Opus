/**
 * M-02: разделение Engine/src/main.js на модули — механический перенос. Условие владельца: алгоритмы, формулы,
 * поведение двигателя и интерфейс не меняются.
 * M-02a — разделы 2, 3 и 9 (src/anim/tween.js, src/config/parts.js и steps.js, src/audio/engine-audio.js):
 *   1) Каждый вынесенный блок побайтно совпадает с тем же блоком замороженной Engine.html (D-17): до M-02a он стоял
 *      в main.js дословно. В main.js этого блока больше нет.
 *   2) Кроме блока, в модуле только комментарии и export { … } с объявленными в блоке именами. Исключение — звук:
 *      две строки, через которые main.js передаёт audio.fire() функцию текущей скорости effSpeed.
 *   3) Эти модули ничего не импортируют: ни three, ни DOM-слой, ни main.js.
 * M-02b — разделы 1 и 4–8 (src/render/). Часть этих блоков отличается от Engine.html швами M-01b и M-03, поэтому
 * опора — main.js@ac34ff3, последний коммит до M-02b:
 *   4) Тело модуля — строки main.js@ac34ff3 из таблицы RENDER, подряд и без правок: sha256 тела равен sha256 этих строк.
 *      Проверка вручную: git show ac34ff3:Engine/src/main.js | sed -n '46,69p' | sha256sum. Кроме тела, в модуле
 *      только комментарий-шапка, импорты, строки связки из таблицы WIRING_B и одна строка export { … } в конце.
 *      Объявлений из тела в main.js больше нет.
 * Импорты main.js и вынесенных из него модулей (anim, audio, render):
 *   5) только three, three/addons/….js и пути внутри src/ с .js; main.js никто не импортирует; anim/ и audio/
 *      не импортируют render/, render/ не импортирует ui/; циклов нет;
 *   6) импортированное имя модуль экспортирует, а импортирующий использует; имя, которое экспортирует другой модуль,
 *      используется только импортированным (или своим объявлением). Модель (config, sim) проверяет legacy-freeze.test.js;
 *   7) связка: что осталось в main.js (effSpeed, ui, life, обработчики потери контекста), main.js передаёт модулям при
 *      загрузке, а pixelRatio меняет через storePixelRatio().
 * Имена в комментариях, строках и шейдерах использованием не считаются. Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const HTML = read('../Engine.html'), MAIN = read('../src/main.js');
const SECTION = n => `\n/* ----------------------------------------------------------------------------\n * ${n}. `;
// M-02a: модуль → [начало блока, конец блока (не входит)] в Engine.html
const MOVED = {
  'anim/tween.js':         ['const Ease = {', SECTION(3)],
  'config/parts.js':       ['const NODE_INFO = {', '\n/* порядок разборки'],
  'config/steps.js':       ['/* порядок разборки', SECTION(4)],
  'audio/engine-audio.js': ['const audio = {', SECTION(10)]
};
const WIRING = { 'audio/engine-audio.js': ['let effSpeed;\nconst setSpeedSource = fn => { effSpeed = fn; };\n', ['setSpeedSource']] };
// M-02b: модуль → [строки main.js@ac34ff3 (как в sed -n), sha256 этих строк]
const RENDER = {
  'render/world.js': ['46,69p', 'a4a65094624d5e0a473d89d9fe3633866178adf2a67b575012ed002d0b4df754'],
  'render/scene.js': ['82,226p', 'eb7662256fc3893fb3bfc67dd365a4e66827141102caf7cb30c7576d7f40b4a9'],
  'render/materials.js': ['231,310p', '92b68aba9354fc29ff87ad24dff78b3b431815796a282e9552f709bc294d6f42'],
  'render/parts/geometry.js': ['315,397p;412,425p', '87aa1545224f9e56891fa9e666664552af3e47944284470b025e3e637dbcaad2'],
  'render/parts/nodes.js': ['398,411p;826,845p', '9c3e5c82887112bc31d10cd2c9850c7d49f229cbbb050197a1b98e6f9738ff50'],
  'render/parts/block.js': ['427,466p', 'e6bb68100311b5617af0601366b37fbd22ae210941d0a964ea3d632d07cc7d42'],
  'render/parts/crankshaft.js': ['468,508p', '67147a159f8a99588ecef8d88e6eb756ef52e72b1621e126be78841abb05d517'],
  'render/parts/rods.js': ['510,526p', 'b6e3308bacb09ee24caf2182ff0f43a4e84c903a7c7f1a2e65cec1d2717adb12'],
  'render/parts/pistons.js': ['528,544p', '6a3993cd67bd60a685dd88cdfcd6866c6b405c183e96e73b8e3af4bb5edc5d6d'],
  'render/parts/head.js': ['546,588p', 'ec1bf9749270a7c80afc16fb850158ab5ccd3de05d5c7b993ef265eb07bd3186'],
  'render/parts/valvetrain.js': ['590,654p', '23b8f8cae7945fa322c4ece2fc3f89a73fbbfa97373e292cb19ca9df4872e04c'],
  'render/parts/sparks.js': ['656,670p', '817ff20c3ae4d31c189fe33413e8ffdf94575839516ce0501a8910fa4608731e'],
  'render/parts/intake.js': ['672,699p', '17dbaff08c8f679e7ae745e9f419ba3c8fa6f1866886e1a359521acae81c81c4'],
  'render/parts/exhaust.js': ['701,727p', '980e70b88fcf40862722b713f0e38ad2820d5e7234d82472c92a6a5d58b84283'],
  'render/parts/belt.js': ['729,825p', '5be95eb5e6595846d5b16ff7eab88e3244635e8efc5f5572f261f482de8c676a'],
  'render/kinematics.js': ['850,896p', 'fb4fe8d7e49956c1192e912b08fc4ace867f31085d0874637ff01f89c1412a17'],
  'render/effects/strokes.js': ['901,1132p', '84bcab2b11b6ad7bcb5d195e2424d8720f1714791c0624493e82abd6dcb0835c'],
};
// M-02b: строки связки сразу после импортов модуля → строка main.js, которая передаёт значения
const WIRING_B = {
  'render/scene.js': ['let life, onContextLost, onContextRestored;\nconst setLifecycle = (ctl, lost, restored) => { life = ctl; onContextLost = lost; onContextRestored = restored; };\nconst storePixelRatio = pr => { pixelRatio = pr; };\n', [/^const life = new AbortController\(\);.*\nsetLifecycle\(life, onContextLost, onContextRestored\);/m, /^ +storePixelRatio\(pr\);/m]],
  'render/effects/strokes.js': ['let ui, effSpeed;\nconst setEffectsSource = (state, speed) => { ui = state; effSpeed = speed; };\n', [/^setSpeedSource\(effSpeed\);.*\nsetEffectsSource\(ui, effSpeed\);/m]],
};
const cut = (s, a, b) => {
  const i = s.indexOf(a); assert.ok(i >= 0, `нет «${a}»`); assert.equal(s.indexOf(a, i + 1), -1, `«${a}» встречается дважды`);
  const j = s.indexOf(b, i); assert.ok(j > i, `нет конца блока «${a}»`); return s.slice(i, j);
};
const noComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
// код без комментариев и текста строк (от шаблонных строк остаются выражения ${…})
const code = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
  .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, '""')
  .replace(/`(?:\\[\s\S]|[^`\\])*`/g, t => ' ' + [...t.matchAll(/\$\{([^{}]*)\}/g)].map(m => m[1]).join(' ') + ' ');
const esc = n => n.replace(/\$/g, '\\$');
const uses = (c, n) => new RegExp(`(?<![\\w$.])${esc(n)}(?![\\w$])`).test(c);
const declares = (c, n) => new RegExp(`\\b(?:const|let|var|function|class)\\s+${esc(n)}\\s*[=({]|,\\s*${esc(n)}\\s*=(?!=)`).test(c);
const sha = s => createHash('sha256').update(s, 'utf8').digest('hex');
// имена верхнего уровня: function/class X и все имена в строках const/let/var (скобки, строки и инициализаторы убираются)
const topNames = c => c.split('\n').flatMap(l => {
  const f = l.match(/^(?:async\s+)?(?:function\*?|class)\s+([\w$]+)/); if (f) return [f[1]];
  if (!/^(?:const|let|var)\s/.test(l)) return [];
  let s = l.replace(/\/\/.*$/, ''), t;
  do { t = s; s = s.replace(/'[^'\n]*'|"[^"\n]*"|\([^()]*\)|\[[^[\]]*\]|\{[^{}]*\}/g, ''); } while (s !== t);
  return s.split(';').flatMap(st => { const m = st.match(/^\s*(?:const|let|var)\s+(.*)$/); return m ? m[1].split(',').map(d => (d.match(/^\s*([\w$]+)/) || [])[1]).filter(Boolean) : []; });
});

for (const [file, [a, b]] of Object.entries(MOVED)) {
  test(`${file}: блок перенесён дословно — совпадает с Engine.html, в main.js его нет`, () => {
    const block = cut(HTML, a, b), mod = read(`../src/${file}`), at = mod.indexOf(block);
    assert.ok(at >= 0, `${file}: блок отличается от того же блока в Engine.html`);
    assert.ok(!MAIN.includes(a), `main.js всё ещё содержит «${a}»`);
    let rest = mod.slice(0, at) + mod.slice(at + block.length);
    const [wiring, extra] = WIRING[file] || ['', []];
    if (wiring) { assert.ok(rest.includes(wiring), `${file}: нет подключения effSpeed`); rest = rest.replace(wiring, ''); }
    const names = [...block.matchAll(/^(?:const|let|function)\s+([\w$]+)/gm)].map(m => m[1]).concat(extra);
    const exp = `export { ${names.join(', ')} };`;
    assert.equal(noComments(rest).replace(exp, '').trim(), '', `${file}: кроме блока — только комментарии и ${exp}`);
  });
}

test('модули M-02a ничего не импортируют: ни three, ни DOM-слой, ни main.js', () => {
  for (const file of Object.keys(MOVED)) assert.doesNotMatch(read(`../src/${file}`), /^\s*import\b|\bimport\s*\(/m, file);
});

for (const [file, [lines, hash]] of Object.entries(RENDER)) {
  test(`${file}: строки main.js@ac34ff3 ${lines} перенесены дословно, в main.js их нет`, () => {
    const text = read(`../src/${file}`);
    const head = text.match(/^\/\*[\s\S]*?\n \*\/\n(?:import [^\n]*\n)+\n/);
    assert.ok(head, `${file}: в начале комментарий-шапка, импорты и пустая строка`);
    let rest = text.slice(head[0].length);
    const [wiring] = WIRING_B[file] || [];
    if (wiring) { assert.ok(rest.startsWith(wiring + '\n'), `${file}: нет строк связки`); rest = rest.slice(wiring.length + 1); }
    const exp = rest.match(/\nexport \{ ([\w$]+(?:, [\w$]+)*) \};\n$/);
    assert.ok(exp, `${file}: в конце одна строка export { … }`);
    const body = rest.slice(0, exp.index);
    assert.equal(sha(body), hash, `${file}: тело отличается от строк ${lines} main.js@ac34ff3`);
    const own = new Set(topNames((wiring || '') + body));
    for (const n of exp[1].split(', ')) assert.ok(own.has(n), `${file}: export ${n} — не объявлен в модуле`);
    const main = new Set(MAIN.split('\n'));
    for (const l of body.split('\n')) if (/^(?:const|let|var|function|class) /.test(l)) assert.ok(!main.has(l), `main.js всё ещё содержит «${l}»`);
  });
}

// ---------- импорты main.js и вынесенных модулей ----------
const SRC = new URL('../src/', import.meta.url);
const walk = d => readdirSync(new URL(d, SRC), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(`${d}${e.name}/`) : e.name.endsWith('.js') ? [d + e.name] : []);
const APP = ['main.js', ...['anim/', 'audio/', 'render/'].filter(d => existsSync(new URL(d, SRC))).flatMap(walk)];
const TEXT = Object.fromEntries(APP.map(f => [f, read(`../src/${f}`)]));
const CODE = Object.fromEntries(APP.map(f => [f, code(TEXT[f].split('\n').filter(l => !l.startsWith('import ')).join('\n'))]));
const EXPORTS = Object.fromEntries(APP.map(f => [f, (TEXT[f].match(/^export \{ ([\w$]+(?:, [\w$]+)*) \};$/m) || [, ''])[1].split(', ').filter(Boolean)]));
const IMPORTS = Object.fromEntries(APP.map(f => [f, TEXT[f].split('\n').filter(l => /^\s*import\b/.test(l)).map(l => {
  const m = l.match(/^import (?:\* as ([\w$]+)|\{ ([\w$]+(?:, [\w$]+)*) \}) from '([^']+)';$/);
  assert.ok(m, `${f}: импорт только в виде import { a, b } from '…' или import * as X from '…': ${l}`);
  const url = m[3].startsWith('.') ? new URL(m[3], new URL(f, SRC)).href : null;
  return { names: m[1] ? [m[1]] : m[2].split(', '), spec: m[3], to: url && url.startsWith(SRC.href) ? url.slice(SRC.href.length) : url };
})]));

test('импорты: three, three/addons или файл внутри src; main.js никто не импортирует; слои; циклов нет', () => {
  for (const f of APP) {
    assert.doesNotMatch(TEXT[f], /\bimport\s*\(/, `${f}: динамический import()`);
    assert.equal((TEXT[f].match(/^\s*export\b/gm) || []).length, f === 'main.js' ? 0 : 1, `${f}: export — одна строка export { … }`);
    for (const { spec, to } of IMPORTS[f]) {
      if (to === null) { assert.match(spec, /^three(?:\/addons\/[\w/.-]+\.js)?$/, `${f}: внешний импорт ${spec}`); continue; }
      assert.ok(spec.endsWith('.js') && !to.includes(':') && existsSync(new URL(to, SRC)), `${f}: ${spec} — нет такого файла в src`);
      assert.notEqual(to, 'main.js', `${f} импортирует main.js`);
      if (/^(?:anim|audio)\//.test(f)) assert.doesNotMatch(to, /^render\//, `${f} импортирует ${to}`);
      if (f.startsWith('render/')) assert.doesNotMatch(to, /^ui\//, `${f} импортирует ${to}`);
    }
  }
  const done = new Set();
  const visit = (f, trail) => {
    assert.ok(!trail.includes(f), `цикл импортов: ${[...trail, f].join(' → ')}`);
    if (done.has(f)) return;
    for (const { to } of IMPORTS[f] || []) if (APP.includes(to)) visit(to, [...trail, f]);
    done.add(f);
  };
  APP.forEach(f => visit(f, []));
});

test('импорты: имя экспортируется модулем и используется; имена других модулей используются только импортированными', () => {
  for (const f of APP) {
    const imported = new Set();
    for (const { names, to } of IMPORTS[f]) for (const n of names) {
      assert.ok(!imported.has(n), `${f}: ${n} импортирован дважды`);
      imported.add(n);
      assert.ok(uses(CODE[f], n), `${f}: импорт ${n} не используется`);
      if (APP.includes(to)) assert.ok(EXPORTS[to].includes(n), `${to} не экспортирует ${n} (импорт в ${f})`);
    }
    for (const t of APP) if (t !== f) for (const n of EXPORTS[t])
      if (uses(CODE[f], n) && !imported.has(n)) assert.ok(declares(CODE[f], n), `${f}: ${n} из ${t} используется, но не импортирован`);
  }
});

test('связка: main.js передаёт модулям то, что осталось в нём, при загрузке; pixelRatio меняет через storePixelRatio()', () => {
  assert.match(MAIN, /^const effSpeed = .*\nsetSpeedSource\(effSpeed\);/m);   // M-02a
  for (const [file, [, calls]] of Object.entries(WIRING_B)) for (const c of calls) assert.match(MAIN, c, `main.js: нет связки с ${file}`);
  if ('render/scene.js' in RENDER) assert.doesNotMatch(CODE['main.js'], /(?<![\w$.])pixelRatio\s*=(?!=)/, 'main.js присваивает pixelRatio');
});

test('звук: audio.fire() берёт скорость из функции, переданной через setSpeedSource()', async () => {
  const { audio, setSpeedSource } = await import('../src/audio/engine-audio.js');
  const ramps = [], param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime(v, t) { ramps.push(t); } });
  const node = () => ({ connect() {}, start() {}, stop() {}, frequency: param(), gain: param(), Q: param() });
  Object.assign(audio, { on: true, master: node(), noise: {},
    ctx: { state: 'running', currentTime: 0, createOscillator: node, createGain: node, createBufferSource: node, createBiquadFilter: node } });
  try {
    for (const speed of [1, 4, 25]) {
      ramps.length = 0; setSpeedSource(() => speed); audio.fire(0);
      const dec = 0.22 / (1 + Math.min(speed, 10) * 0.18);
      assert.equal(ramps[0], 0.005 + dec, `скорость ${speed}: спад частоты`);
    }
  } finally { Object.assign(audio, { on: false, master: null, noise: null, ctx: null }); }
});
