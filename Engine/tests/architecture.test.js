/**
 * Границы слоёв архитектуры V12 и чистота модульного графа:
 *   1) config/ ничего не импортирует (без Three.js, без DOM, без изменяемого состояния);
 *   2) sim/ импортирует только config/ или sim/;
 *   3) render/ не импортирует ui/;
 *   4) все относительные импорты в Engine/src/ ведут на существующие .js файлы;
 *   5) устаревшие однофайловые артефакты (Engine.html, Engine BigPickle.html) удалены.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = dirname(fileURLToPath(new URL('../src/main.js', import.meta.url)));
const ENGINE_DIR = resolve(SRC_DIR, '..');

function walk(dir, base = '') {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(resolve(dir, e.name), rel));
    else if (e.name.endsWith('.js')) out.push(rel);
  }
  return out;
}

const FILES = walk(SRC_DIR);
const IMPORTS_RE = /^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm;

function importsOf(rel) {
  const txt = readFileSync(resolve(SRC_DIR, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  return [...txt.matchAll(IMPORTS_RE)].map(m => m[1]);
}

test('слой config/ не содержит импортов, Three.js и DOM', () => {
  const cfgs = FILES.filter(f => f.startsWith('config/'));
  assert.ok(cfgs.length >= 3);
  for (const f of cfgs) {
    assert.deepEqual(importsOf(f), [], `${f} не должен импортировать другие модули`);
    const txt = readFileSync(resolve(SRC_DIR, f), 'utf8');
    assert.doesNotMatch(txt, /\b(THREE|document|window)\b/, `${f}: без THREE/DOM`);
  }
});

test('слой sim/ импортирует только config/ или sim/, без Three.js и DOM', () => {
  const sims = FILES.filter(f => f.startsWith('sim/'));
  assert.ok(sims.length >= 4);
  for (const f of sims) {
    for (const spec of importsOf(f)) {
      assert.ok(spec.startsWith('./') || spec.startsWith('../config/') || spec.startsWith('../sim/'),
        `${f}: недопустимый импорт "${spec}"`);
    }
    const txt = readFileSync(resolve(SRC_DIR, f), 'utf8');
    assert.doesNotMatch(txt, /\b(THREE|document|window)\b/, `${f}: без THREE/DOM`);
  }
});

test('слой render/ не зависит от ui/, анимаций вне графа нет', () => {
  const renders = FILES.filter(f => f.startsWith('render/'));
  assert.ok(renders.length >= 10);
  for (const f of renders) {
    for (const spec of importsOf(f)) {
      assert.doesNotMatch(spec, /\/ui\//, `${f}: render/ не должен импортировать ui/ ("${spec}")`);
    }
  }
});

test('все относительные импорты в Engine/src/ ведут на существующие файлы, а именованные импорты соответствуют экспортам', () => {
  const exportsOf = filePath => {
    const txt = readFileSync(filePath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const s = new Set();
    for (const m of txt.matchAll(/^\s*export\s+(?:const|let|var|function|class)\s+([\w$]+)/gm)) s.add(m[1]);
    for (const m of txt.matchAll(/^\s*export\s*\{([^}]+)\}/gm)) {
      for (const part of m[1].split(',')) {
        const a = part.trim().split(/\s+as\s+/);
        const name = (a[1] || a[0]).trim();
        if (name) s.add(name);
      }
    }
    return s;
  };
  for (const f of FILES) {
    const abs = resolve(SRC_DIR, f), dir = dirname(abs);
    const stripped = readFileSync(abs, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const spec of importsOf(f)) {
      if (!spec.startsWith('.')) continue;
      const target = resolve(dir, spec);
      assert.ok(existsSync(target), `${f}: не найден импорт ${spec} -> ${target}`);
    }
    for (const m of stripped.matchAll(/^\s*import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/gm)) {
      const target = resolve(dir, m[2]);
      const exps = exportsOf(target);
      for (const part of m[1].split(',')) {
        const orig = part.trim().split(/\s+as\s+/)[0].trim();
        if (orig) assert.ok(exps.has(orig), `${f}: модуль ${m[2]} не экспортирует «${orig}»`);
      }
    }
  }
});

test('устаревшие однофайловые HTML-артефакты в Engine/ удалены', () => {
  assert.equal(existsSync(resolve(ENGINE_DIR, 'Engine.html')), false, 'Engine/Engine.html удалён');
  assert.equal(existsSync(resolve(ENGINE_DIR, 'Engine BigPickle.html')), false, 'Engine/Engine BigPickle.html удалён');
});

test('каждая подгруппа THREE.Group() в render/parts/ прикрепляется в граф сцены через .add()', () => {
  const parts = FILES.filter(f => f.startsWith('render/parts/') && !['render/parts/geometry.js', 'render/parts/nodes.js'].includes(f));
  assert.ok(parts.length >= 10);
  for (const f of parts) {
    const txt = readFileSync(resolve(SRC_DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const m of txt.matchAll(/\b(?:const|let)\s+([\w$]+)\s*=\s*new THREE\.Group\(\)/g)) {
      const varName = m[1];
      assert.match(txt, new RegExp(`\\.add\\([^)]*\\b${varName}\\b[^)]*\\)`), `${f}: группа ${varName} должна быть добавлена через .add(${varName})`);
    }
  }
});
