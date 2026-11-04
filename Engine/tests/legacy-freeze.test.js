/**
 * Заморозка legacy Engine/Engine.html (D-17, с X-01) и шов модели модульной версии.
 *
 * Однофайловая Engine.html остаётся по своему адресу для запуска через file:// (D-15), но больше не меняется:
 * улучшения идут только в модульную версию (Engine/index.html + Engine/src/). Этот тест заменил entry-sync.test.js
 * (M-01b), который требовал побайтного и построчного совпадения двух версий.
 *   1) sha256 Engine.html равен зафиксированному. Правка Engine.html — только по отдельному решению владельца;
 *      новый хэш фиксируется вместе с этим решением.
 *   2) Каждое имя, которое main.js и вынесенные из него модули (anim, audio, render, ui — M-02) импортируют из ./config
 *      и ./sim, экспортируется модулем и используется в импортирующем модуле.
 *   3) Каждое имя из этих модулей, которое упоминает такой модуль, импортировано или объявлено в нём
 *      (иначе ReferenceError в редкой ветке кода). Имена в комментариях и строках не считаются.
 * Тождество модели с копиями внутри Engine.html проверяют legacy-parity.test.js и spec-sync.test.js.
 * Без сторонних зависимостей. Node 20.19+ или 22.7+ (см. legacy-parity.test.js).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ENGINE_HTML_SHA256 = '9ef82c29c9e136d73c64f5734dfa3291e8ecd03c58fb198351ef831c8841b01d';   // blob 5af13a9, main@6ab6149
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const SRC = new URL('../src/', import.meta.url);
const walk = d => readdirSync(new URL(d, SRC), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(`${d}${e.name}/`) : e.name.endsWith('.js') ? [d + e.name] : []);
// код без комментариев и текста строк (от шаблонных строк остаются выражения ${…})
const code = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
  .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, '""')
  .replace(/`(?:\\[\s\S]|[^`\\])*`/g, t => ' ' + [...t.matchAll(/\$\{([^{}]*)\}/g)].map(m => m[1]).join(' ') + ' ');
// main.js и вынесенные из него модули; импорты модели — из ./config и ./sim (из любой глубины)
const FILES = ['main.js', ...['anim/', 'audio/', 'render/', 'ui/'].filter(d => existsSync(new URL(d, SRC))).flatMap(walk)].map(f => {
  const lines = read(`../src/${f}`).split('\n');
  return { f, imports: lines.filter(l => /^import .* from '(?:\.\.?\/)+(?:config|sim)\//.test(l)),
    rest: code(lines.filter(l => !l.startsWith('import ')).join('\n')) };
});
const uses = (rest, n) => (rest.match(new RegExp(`(?<![\\w$.])${n.replace(/\$/g, '\\$')}(?![\\w$])`, 'g')) || []).length;
const declares = (rest, n) => { const e = n.replace(/\$/g, '\\$');
  return new RegExp(`\\b(?:const|let|var|function|class)\\s+${e}\\s*[=({]|,\\s*${e}\\s*=(?!=)`).test(rest); };
const parse = (f, line) => {
  const m = line.match(/^import \{([^}]*)\} from '((?:\.\.?\/)+[^']+)';$/);
  assert.ok(m, `${f}: импорт модели только в виде import { … } from './…': ${line}`);
  return { names: m[1].split(',').map(s => s.trim()).filter(Boolean), path: m[2], url: new URL(m[2], new URL(f, SRC)) };
};

test('Engine.html заморожен (D-17): sha256 совпадает с зафиксированным', () => {
  const text = read('../Engine.html').replace(/\r\n/g, '\n');   // checkout с autocrlf не считается правкой
  const sha = createHash('sha256').update(text, 'utf8').digest('hex');
  assert.equal(sha, ENGINE_HTML_SHA256,
    'Engine.html изменился. По D-17 он заморожен: правки — только в Engine/index.html и Engine/src/, ' +
    'изменение Engine.html — по отдельному решению владельца вместе с новым хэшем.');
});

test('импорты модели в main.js и модулях: имя экспортируется модулем и используется', async () => {
  assert.ok(FILES[0].imports.length > 0, 'main.js импортирует модель из ./config и ./sim');
  for (const { f, imports, rest } of FILES) for (const line of imports) {
    const { names, path, url } = parse(f, line);
    const ns = await import(url);
    for (const n of names) {
      assert.ok(n in ns, `${path} не экспортирует ${n}`);
      assert.ok(uses(rest, n) > 0, `${f}: импорт ${n} из ${path} не используется`);
    }
  }
});

test('имена модели, которые упоминают main.js и модули, импортированы', async () => {
  const files = ['config', 'sim'].flatMap(d => readdirSync(new URL(`../src/${d}/`, import.meta.url)).filter(f => f.endsWith('.js')).map(f => `${d}/${f}`));
  assert.ok(files.length >= 6, 'модули модели в src/config и src/sim');
  const model = [];
  for (const mf of files) for (const n of Object.keys(await import(new URL(`../src/${mf}`, import.meta.url)))) model.push([n, mf]);
  for (const { f, imports, rest } of FILES) {
    const imported = new Set(imports.flatMap(l => parse(f, l).names));
    for (const [n, mf] of model)
      if (uses(rest, n) > 0 && !imported.has(n)) assert.ok(declares(rest, n), `${n} из ${mf} используется в ${f}, но не импортирован`);
  }
});
