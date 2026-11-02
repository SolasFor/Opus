/**
 * M-02: разделение Engine/src/main.js на модули — механический перенос. Условие владельца: алгоритмы, формулы,
 * поведение двигателя и интерфейс не меняются.
 *   1) Каждый вынесенный блок побайтно совпадает с тем же блоком замороженной Engine.html (D-17): до M-02a он стоял
 *      в main.js дословно. В main.js этого блока больше нет.
 *   2) Кроме блока, в модуле только комментарии и export { … } с объявленными в блоке именами. Исключение — звук:
 *      две строки, через которые main.js передаёт audio.fire() функцию текущей скорости effSpeed.
 *   3) Вынесенные модули ничего не импортируют (ни three, ни DOM-слой, ни main.js), поэтому циклов импорта нет.
 *   4) main.js импортирует из них каждое имя, которое использует, и только такие имена; effSpeed передаётся звуку
 *      сразу после объявления.
 * Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const HTML = read('../Engine.html'), MAIN = read('../src/main.js');
const SECTION = n => `\n/* ----------------------------------------------------------------------------\n * ${n}. `;
// модуль → [начало блока, конец блока (не входит)] в Engine.html
const MOVED = {
  'anim/tween.js':         ['const Ease = {', SECTION(3)],
  'config/parts.js':       ['const NODE_INFO = {', '\n/* порядок разборки'],
  'config/steps.js':       ['/* порядок разборки', SECTION(4)],
  'audio/engine-audio.js': ['const audio = {', SECTION(10)]
};
const WIRING = { 'audio/engine-audio.js': ['let effSpeed;\nconst setSpeedSource = fn => { effSpeed = fn; };\n', ['setSpeedSource']] };
const cut = (s, a, b) => {
  const i = s.indexOf(a); assert.ok(i >= 0, `нет «${a}»`); assert.equal(s.indexOf(a, i + 1), -1, `«${a}» встречается дважды`);
  const j = s.indexOf(b, i); assert.ok(j > i, `нет конца блока «${a}»`); return s.slice(i, j);
};
const noComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
const CODE = noComments(MAIN.split('\n').filter(l => !l.startsWith('import ')).join('\n'));
const uses = n => new RegExp(`(?<![\\w$.])${n.replace(/\$/g, '\\$')}(?![\\w$])`).test(CODE);

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

test('вынесенные модули ничего не импортируют: ни three, ни DOM-слой, ни main.js', () => {
  for (const file of Object.keys(MOVED)) assert.doesNotMatch(read(`../src/${file}`), /^\s*import\b|\bimport\s*\(/m, file);
});

test('main.js импортирует из вынесенных модулей ровно то, что использует; effSpeed передаётся звуку', async () => {
  const lines = MAIN.split('\n');
  for (const file of Object.keys(MOVED)) {
    const line = lines.find(l => l.startsWith('import {') && l.endsWith(` from './${file}';`));
    assert.ok(line, `main.js не импортирует ./${file}`);
    const names = line.slice(8, line.indexOf('}')).split(',').map(s => s.trim());
    const ns = await import(new URL(`../src/${file}`, import.meta.url));
    for (const n of names) assert.ok(n in ns, `${file} не экспортирует ${n}`);
    for (const n of Object.keys(ns)) assert.equal(names.includes(n), uses(n), `${n} из ${file}: ${uses(n) ? 'используется, но не импортирован' : 'импортирован, но не используется'}`);
  }
  assert.match(MAIN, /^const effSpeed = .*\nsetSpeedSource\(effSpeed\);/m);
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
