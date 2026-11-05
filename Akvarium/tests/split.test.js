/**
 * A-01b (D-13): модульная версия Akvarium — механический перенос модуля однофайловой Aquarium.html в src/
 * (core → scenery → creatures → main). Алгоритмы, сцена и интерфейс не меняются.
 *   1) Тело каждого модуля — строки модуля Aquarium.html из таблицы SPLIT подряд. Отличия — только швы из таблицы
 *      SEAMS (строка Aquarium.html: было → стало): импортированную переменную другой модуль переназначить не может,
 *      поэтому seed, pixelRatio и ENV меняются через reseed(), storePixelRatio() и storeEnv(). Вместе тела покрывают
 *      модуль Aquarium.html целиком, без пропусков и повторов; первые три строки (импорт three и аддонов) заменены
 *      импортами модулей.
 *   2) Кроме тела, в модуле только комментарий-шапка, импорты, пустая строка, строки связки из таблицы WIRING
 *      и одна строка export { … } в конце.
 *   3) Импорты: только three, three/addons/….js и ./<модуль>.js из модулей раньше по порядку выполнения (циклов нет,
 *      main.js никто не импортирует). Импортированное имя экспортируется источником и используется импортирующим;
 *      каждое экспортированное имя объявлено в модуле и кто-то его импортирует.
 * С этапа A-02 модули меняются намеренно. Изменённый модуль вносится в CHANGED (модуль → этап): для него правило 1
 * проверяет только, что тело действительно отличается от опоры (так же Engine M-02, split-sync.test.js).
 * Без сторонних зависимостей.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEGACY, MODULES, ORDER } from './_app.js';

const SPLIT = { core: [156, 324], scenery: [325, 914], creatures: [915, 1186], main: [1187, 1962] };   // строки Aquarium.html
const SEAMS = {
  507: ['seed = sd;', 'reseed(sd);'], 602: ['seed = sd;', 'reseed(sd);'], 663: ['seed = 99;', 'reseed(99);'],
  681: ['seed = 321;', 'reseed(321);'], 732: ['seed = 77;', 'reseed(77);'], 766: ['seed = 555;', 'reseed(555);'],
  869: ['seed = 4242;', 'reseed(4242);'], 1055: ['seed = 2024;', 'reseed(2024);'],
  1853: ['pixelRatio = AD.s.pr;', 'storePixelRatio(AD.s.pr);'], 1946: ['ENV = makeEnv();', 'storeEnv(makeEnv());'],
};
const WIRING = {
  core: ['', '// связка A-01b: seed и pixelRatio меняются только здесь (импортированную переменную другой модуль переназначить не может)',
    'const reseed = s => { seed = s; };', 'const storePixelRatio = pr => { pixelRatio = pr; };'],
  creatures: ['', '// связка A-01b: после восстановления WebGL-контекста main.js строит окружение рыб заново',
    'const storeEnv = env => { ENV = env; };'],
};
const CHANGED = {};   // модуль → этап, например { main: 'A-02' }

const LEG = LEGACY.split('\n');
const MOD0 = LEG.indexOf('<script type="module" onerror="window.__aqModuleError()">') + 1;   // номер строки тега
const legacyLines = (a, b) => LEG.slice(a - 1, b);
// код без комментариев и текста строк (от шаблонных строк остаются выражения ${…})
const code = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
  .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, '""')
  .replace(/`(?:\\[\s\S]|[^`\\])*`/g, t => ' ' + [...t.matchAll(/\$\{([^{}]*)\}/g)].map(m => m[1]).join(' ') + ' ');
const esc = n => n.replace(/\$/g, '\\$');
const uses = (text, n) => (text.match(new RegExp(`(?<![\\w$.])${esc(n)}(?![\\w$])`, 'g')) || []).length;
const declares = (text, n) => new RegExp(`(?:^|[\\n;])\\s*(?:const|let|var|function|class)\\s+(?:[\\w$]+\\s*=[^\\n;]*?,\\s*)*${esc(n)}\\b`).test(text);

function parse(name) {
  const lines = MODULES[name].split('\n');
  assert.equal(lines.pop(), '', `${name}.js кончается переводом строки`);
  let i = 0;
  assert.equal(lines[i], '/**', `${name}.js: шапка-комментарий`);
  while (lines[i] !== ' */') { assert.ok(lines[i] === '/**' || lines[i].startsWith(' * '), `${name}.js:${i + 1}: шапка`); i++; }
  i++;
  const imports = [];
  while (lines[i].startsWith('import ')) imports.push(lines[i++]);
  assert.equal(lines[i++], '', `${name}.js: пустая строка после импортов`);
  const [a, b] = SPLIT[name], n = b - a + 1;
  const body = lines.slice(i, i + n), tail = lines.slice(i + n);
  return { lines, imports, body, tail };
}
const P = Object.fromEntries(ORDER.map(n => [n, parse(n)]));

test('порядок модулей и точка входа', () => {
  assert.deepEqual(Object.keys(SPLIT), ORDER);
  assert.equal(MOD0, 151);
  assert.deepEqual(legacyLines(MOD0 + 1, MOD0 + 4), ["import * as THREE from 'three';",
    "import { OrbitControls } from 'three/addons/controls/OrbitControls.js';",
    "import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';", '']);
  assert.equal(LEG[1962], '</script>');
});

test('тела модулей покрывают модуль Aquarium.html подряд, без пропусков и повторов', () => {
  let next = MOD0 + 5;
  for (const n of ORDER) { assert.equal(SPLIT[n][0], next, `${n}: начало`); next = SPLIT[n][1] + 1; }
  assert.equal(next, 1963, 'последняя строка модуля — 1962');
  for (const k of Object.keys(SEAMS).map(Number)) assert.ok(ORDER.some(n => k >= SPLIT[n][0] && k <= SPLIT[n][1]));
});

test('тело модуля — строки Aquarium.html без правок, кроме швов SEAMS', () => {
  for (const n of ORDER) {
    const [a, b] = SPLIT[n];
    const ref = legacyLines(a, b).map((s, j) => {
      const seam = SEAMS[a + j]; if (!seam) return s;
      assert.equal(s.split(seam[0]).length, 2, `Aquarium.html:${a + j}: «${seam[0]}» ровно один раз`);
      return s.replace(seam[0], () => seam[1]);
    });
    if (CHANGED[n]) { assert.notDeepEqual(P[n].body, ref, `${n}.js снова совпадает с опорой — убери его из CHANGED`); continue; }
    assert.deepEqual(P[n].body, ref, `${n}.js: тело отличается от строк ${a}–${b} Aquarium.html`);
  }
});

test('после тела — только связка WIRING и одна строка export', () => {
  for (const n of ORDER) {
    const { tail } = P[n], w = WIRING[n] || [];
    assert.deepEqual(tail.slice(0, w.length), w, `${n}.js: строки связки`);
    const rest = tail.slice(w.length);
    if (n === 'main') assert.deepEqual(rest, [], 'main.js ничего не экспортирует');
    else { assert.equal(rest.length, 1, `${n}.js: одна строка export в конце`); assert.match(rest[0], /^export \{ [\w$, ]+ \};$/); }
  }
});

test('импорты: three, аддоны и более ранние модули; имена экспортируются, используются и объявлены', () => {
  const exp = {}, imported = {};
  for (const n of ORDER) {
    const e = (P[n].tail.at(-1) || '').match(/^export \{ ([\w$, ]+) \};$/);
    exp[n] = e ? e[1].split(', ') : [];
    const decl = code(P[n].body.concat(WIRING[n] || []).join('\n'));
    for (const x of exp[n]) assert.ok(declares(decl, x), `${n}.js экспортирует ${x}, но не объявляет его`);
  }
  for (const n of ORDER) {
    const rest = code(P[n].body.concat(WIRING[n] || []).join('\n'));
    assert.equal(P[n].imports[0], "import * as THREE from 'three';", `${n}.js: первым — three`);
    for (const line of P[n].imports.slice(1)) {
      const m = line.match(/^import \{ ([\w$, ]+) \} from '([^']+)';$/);
      assert.ok(m, `${n}.js: импорт вида import { … } from '…': ${line}`);
      const names = m[1].split(', '), src = m[2];
      let from = null;
      if (src.startsWith('three/addons/')) assert.match(src, /^three\/addons\/[\w/]+\.js$/);
      else {
        from = (src.match(/^\.\/(\w+)\.js$/) || [])[1];
        assert.ok(ORDER.includes(from), `${n}.js: неизвестный модуль ${src}`);
        assert.ok(ORDER.indexOf(from) < ORDER.indexOf(n), `${n}.js импортирует ${from}.js, который выполняется позже (цикл)`);
      }
      for (const x of names) {
        assert.ok(uses(rest, x) > 0, `${n}.js: импорт ${x} из ${src} не используется`);
        if (from) { assert.ok(exp[from].includes(x), `${from}.js не экспортирует ${x}`); (imported[from] ||= new Set()).add(x); }
      }
    }
  }
  for (const n of ORDER) for (const x of exp[n]) assert.ok(imported[n] && imported[n].has(x), `${n}.js экспортирует ${x}, но его никто не импортирует`);
  assert.ok(!imported.main, 'main.js никто не импортирует');
});

test('main.js импортирует модули в порядке выполнения: core → scenery → creatures', () => {
  const order = P.main.imports.map(l => (l.match(/from '\.\/(\w+)\.js'/) || [])[1]).filter(Boolean);
  assert.deepEqual(order, ['core', 'scenery', 'creatures']);
  assert.deepEqual(P.creatures.imports.map(l => (l.match(/from '\.\/(\w+)\.js'/) || [])[1]).filter(Boolean), ['core', 'scenery']);
  assert.deepEqual(P.scenery.imports.map(l => (l.match(/from '\.\/(\w+)\.js'/) || [])[1]).filter(Boolean), ['core']);
});
