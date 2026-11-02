/**
 * Заморозка legacy Engine/Engine.html (D-17, с X-01) и шов модели модульной версии.
 *
 * Однофайловая Engine.html остаётся по своему адресу для запуска через file:// (D-15), но больше не меняется:
 * улучшения идут только в модульную версию (Engine/index.html + Engine/src/). Этот тест заменил entry-sync.test.js
 * (M-01b), который требовал побайтного и построчного совпадения двух версий.
 *   1) sha256 Engine.html равен зафиксированному. Правка Engine.html — только по отдельному решению владельца;
 *      новый хэш фиксируется вместе с этим решением.
 *   2) Каждое имя, которое main.js импортирует из ./config и ./sim, экспортируется модулем и используется в main.js.
 *   3) Каждое имя из этих модулей, которое упоминает main.js, импортировано или объявлено в main.js
 *      (иначе ReferenceError в редкой ветке кода).
 * Тождество модели с копиями внутри Engine.html проверяют legacy-parity.test.js и spec-sync.test.js.
 * Без сторонних зависимостей. Node 20.19+ или 22.7+ (см. legacy-parity.test.js).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ENGINE_HTML_SHA256 = '9ef82c29c9e136d73c64f5734dfa3291e8ecd03c58fb198351ef831c8841b01d';   // blob 5af13a9, main@6ab6149
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const MAIN = read('../src/main.js').split('\n');
const IMPORTS = MAIN.filter(l => /^import .* from '\.\//.test(l));
const REST = MAIN.filter(l => !l.startsWith('import ')).join('\n');
const uses = n => (REST.match(new RegExp(`(?<![\\w$.])${n.replace(/\$/g, '\\$')}(?![\\w$])`, 'g')) || []).length;
const declares = n => new RegExp(`(?:\\b(?:const|let|var|function|class)\\s+|,\\s*)${n.replace(/\$/g, '\\$')}\\s*[=(]`).test(REST);
const parse = line => {
  const m = line.match(/^import \{([^}]*)\} from '\.\/([^']+)';$/);
  assert.ok(m, `импорт модели только в виде import { … } from './…': ${line}`);
  return { names: m[1].split(',').map(s => s.trim()).filter(Boolean), path: m[2] };
};

test('Engine.html заморожен (D-17): sha256 совпадает с зафиксированным', () => {
  const text = read('../Engine.html').replace(/\r\n/g, '\n');   // checkout с autocrlf не считается правкой
  const sha = createHash('sha256').update(text, 'utf8').digest('hex');
  assert.equal(sha, ENGINE_HTML_SHA256,
    'Engine.html изменился. По D-17 он заморожен: правки — только в Engine/index.html и Engine/src/, ' +
    'изменение Engine.html — по отдельному решению владельца вместе с новым хэшем.');
});

test('импорты модели в main.js: имя экспортируется модулем и используется', async () => {
  assert.ok(IMPORTS.length > 0, 'main.js импортирует модель из ./config и ./sim');
  for (const line of IMPORTS) {
    const { names, path } = parse(line);
    const ns = await import(new URL(`../src/${path}`, import.meta.url));
    for (const n of names) {
      assert.ok(n in ns, `${path} не экспортирует ${n}`);
      assert.ok(uses(n) > 0, `импорт ${n} из ${path} не используется`);
    }
  }
});

test('имена модели, которые упоминает main.js, импортированы', async () => {
  const imported = new Set(IMPORTS.flatMap(l => parse(l).names));
  const files = ['config', 'sim'].flatMap(d => readdirSync(new URL(`../src/${d}/`, import.meta.url)).filter(f => f.endsWith('.js')).map(f => `${d}/${f}`));
  assert.ok(files.length >= 6, 'модули модели в src/config и src/sim');
  for (const f of files) {
    const ns = await import(new URL(`../src/${f}`, import.meta.url));
    for (const n of Object.keys(ns))
      if (uses(n) > 0 && !imported.has(n)) assert.ok(declares(n), `${n} из ${f} используется в main.js, но не импортирован`);
  }
});
