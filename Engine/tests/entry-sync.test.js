/**
 * Синхронность модульного входа Engine/index.html + Engine/src/main.js с legacy Engine/Engine.html (M-01b).
 *
 * По D-15 Engine.html остаётся рабочим через file:// и поэтому держит встроенный модуль со своими копиями модели.
 * Модульный вход (только HTTP) — те же разметка, CSS, загрузчик и importmap в index.html и тот же код в main.js,
 * но модель импортируется из ./config и ./sim. Тест не даёт входам разойтись:
 *   1) index.html побайтно равен Engine.html, в котором встроенный модуль заменён строкой SCRIPT_SRC;
 *   2) main.js построчно равен телу встроенного модуля после шва модели:
 *      — удалены объявления MODEL_CONSTS и MODEL_FUNCS (с начала строки, каждое ровно одно) и комментарии MODEL_COMMENTS;
 *        если после удаления рядом оказались две пустые строки, вторая тоже удаляется;
 *      — строки REPLACED заменены (CAM_LIFT убран из объявления; cycDeg и phaseOf — обёртки над cycle.js);
 *      — после импортов three вставлены IMPORTS; шапка main.js (первый блочный комментарий) не сравнивается;
 *   3) каждое импортированное имя экспортируется модулем и используется в main.js; каждое удалённое имя,
 *      которое main.js упоминает, импортировано (иначе ReferenceError в редкой ветке кода).
 * Тождество удалённых объявлений с модулями проверяют legacy-parity.test.js (значения и текст функций)
 * и spec-sync.test.js (константы). Правка кода вне шва вносится в оба файла одновременно.
 * Без сторонних зависимостей. Node 20.19+ или 22.7+ (см. legacy-parity.test.js).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const ENGINE = read('../Engine.html').split('\n'), INDEX = read('../index.html').split('\n'), MAIN = read('../src/main.js').split('\n');

const SCRIPT_SRC = '<script type="module" src="./src/main.js"></script>';
const THREE_LAST_IMPORT = "import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';";
const IMPORTS = [
  "import { DEG, FIRE_DEG, CRANK_Y, CRANK_R, ROD_L, PIN_TOP, BORE_R, VALVE_TILT, CAM_LIFT, SPARK_ADV, VS, VC } from './config/engine-spec.js';",
  "import { clamp, clamp01, mod, smooth } from './sim/math.js';",
  "import { cycleDeg, cylinderPhaseDeg, strokeOf } from './sim/cycle.js';",
  "import { PIN_TDC } from './sim/kinematics.js';",
  "import { camProfileLift, valveDownAngle, lobeAngle } from './sim/valvetrain.js';",
  "import { volumeAt, pressureAt } from './sim/thermo.js';",
];
// Объявления const с начала строки (по одному имени из строки; остальные имена строки тоже должны быть именами модели).
const MODEL_CONSTS = ['FIRE_DEG', 'CRANK_Y', 'PIN_TOP', 'BORE_R', 'VALVE_TILT', 'CAM_HALF', 'IN_MID', 'SPARK_ADV', 'DEG',
  'clamp', 'clamp01', 'mod', 'lerp', 'smooth', 'strokeOf', 'PIN_TDC', 'VS'];
const MODEL_NAMES = new Set([...MODEL_CONSTS, 'CRANK_R', 'ROD_L', 'EX_MID', 'PIN_BDC', 'VC']);
const MODEL_FUNCS = ['camProfileLift', 'valveDownAngle', 'lobeAngle', 'pistonPinY', 'volumeAt', 'pClosed', 'pressureAt'];
const MODEL_COMMENTS = [
  '                                               // ⇒ порядок работы 1-3-4-2; фаза цилиндра φi = θ − FIRE_DEG[i]',
  '/* direction angle (rotation.x convention) the lobe nose must point to for max lift on a valve */',
  '/* exact slider-crank position for a phase (deg) → wrist-pin height */',
  '/* ---------- p–V model (Otto cycle with Wiebe heat release & blowdown) ---------- */',
];
const REPLACED = [
  ['const TAPPET_TOP = 1.12, CAM_RB = 0.11, CAM_LIFT = 0.092;', 'const TAPPET_TOP = 1.12, CAM_RB = 0.11;'],
  ['const cycDeg = () => mod(sim.theta / DEG, 720);', 'const cycDeg = () => cycleDeg(sim.theta);'],
  ['const phaseOf = i => mod(sim.theta / DEG - FIRE_DEG[i], 720);          // 0 = TDC, start of power stroke',
   'const phaseOf = i => cylinderPhaseDeg(sim.theta, i);                   // 0 = TDC, start of power stroke'],
];

// ---------- помощники ----------
const code = line => line.replace(/\/\/.*$/, '');
function only(lines, pred, what) {
  const found = []; lines.forEach((l, i) => { if (pred(l)) found.push(i); });
  assert.equal(found.length, 1, `${what}: найдено ${found.length}, ожидается 1`);
  return found[0];
}
function sameLines(actual, expected, what) {
  const n = Math.max(actual.length, expected.length);
  for (let i = 0; i < n; i++) if (actual[i] !== expected[i])
    assert.fail(`${what}: первое расхождение в строке ${i + 1}\n  есть:      ${JSON.stringify(actual[i])}\n  ожидается: ${JSON.stringify(expected[i])}`);
}
const declaredNames = line => [...code(line).matchAll(/(?:^const\s+|,\s*)([A-Za-z_$][\w$]*)\s*=(?!=)/g)].map(m => m[1]);
function functionEnd(lines, i) {
  let depth = 0;
  for (let j = i; j < lines.length; j++) {
    for (const ch of code(lines[j])) depth += ch === '{' ? 1 : ch === '}' ? -1 : 0;
    if (depth === 0 && code(lines[j]).includes('}')) return j;
  }
  assert.fail(`конец функции в строке ${i + 1}`);
}

const open = only(ENGINE, l => l === '<script type="module">', 'встроенных модулей в Engine.html');
const close = ENGINE.indexOf('</script>', open);
assert.ok(close > open, 'конец встроенного модуля');
const BODY = ENGINE.slice(open + 1, close);

// ---------- тесты ----------
test('index.html — оболочка Engine.html: встроенный модуль заменён на src/main.js', () => {
  sameLines(INDEX, [...ENGINE.slice(0, open), SCRIPT_SRC, ...ENGINE.slice(close + 1)], 'index.html');
});

test('main.js — код встроенного модуля Engine.html с швом модели', () => {
  const drop = new Set(), removedNames = new Set(MODEL_FUNCS);
  for (const name of MODEL_CONSTS) {
    const i = only(BODY, l => new RegExp(`^const\\s(?:.*[\\s,])?${name}\\s*=(?!=)`).test(code(l)), `объявлений const ${name} в Engine.html`);
    for (const n of declaredNames(BODY[i])) { assert.ok(MODEL_NAMES.has(n), `строка ${open + 2 + i} объявляет не только модель: ${n}`); removedNames.add(n); }
    drop.add(i);
  }
  for (const name of MODEL_FUNCS) {
    const i = only(BODY, l => l.startsWith(`function ${name}(`), `объявлений function ${name} в Engine.html`);
    for (let j = i; j <= functionEnd(BODY, i); j++) drop.add(j);
  }
  for (const c of MODEL_COMMENTS) {
    const i = only(BODY, l => l === c, `комментария ${JSON.stringify(c.trim().slice(0, 40))}`);
    assert.ok(drop.has(i - 1) || drop.has(i + 1), `комментарий в строке ${open + 2 + i} не примыкает к удаляемому объявлению`);
    drop.add(i);
  }
  const replaced = new Map(REPLACED.map(([from, to]) => [only(BODY, l => l === from, `строки ${JSON.stringify(from.slice(0, 40))}`), to]));
  const expected = [];
  BODY.forEach((line, i) => {
    if (drop.has(i)) return;
    if (line === '' && drop.has(i - 1) && expected[expected.length - 1] === '') return;   // не оставлять две пустые строки подряд
    expected.push(replaced.has(i) ? replaced.get(i) : line);
    if (line === THREE_LAST_IMPORT) expected.push(...IMPORTS);
  });
  assert.ok(expected.includes(IMPORTS[0]), 'импорты three в Engine.html');
  const head = MAIN[0].startsWith('/*') ? MAIN.findIndex(l => l.includes('*/')) + 1 : 0;
  assert.equal(MAIN.slice(0, head).join('\n').replace(/^\/\*[\s\S]*?\*\//, '').trim(), '', 'шапка main.js — только один блочный комментарий');
  sameLines(MAIN.slice(head), [...expected, ''], 'src/main.js');
  // удалённые имена: если main.js их упоминает, они должны быть импортированы
  const imported = new Set(IMPORTS.flatMap(l => l.match(/\{([^}]*)\}/)[1].split(',').map(s => s.trim())));
  const rest = MAIN.slice(head).filter(l => !l.startsWith('import ')).join('\n');
  const uses = n => (rest.match(new RegExp(`(?<![\\w$.])${n.replace('$', '\\$')}(?![\\w$])`, 'g')) || []).length;
  for (const n of removedNames) if (uses(n) > 0) assert.ok(imported.has(n), `${n} используется в main.js, но не импортирован`);
  for (const n of imported) assert.ok(uses(n) > 0, `импорт ${n} не используется`);
});

test('импорты main.js существуют в модулях', async () => {
  for (const line of IMPORTS) {
    const [, names, path] = line.match(/^import \{([^}]*)\} from '\.\/([^']+)';$/);
    const ns = await import(new URL(`../src/${path}`, import.meta.url));
    for (const n of names.split(',').map(s => s.trim())) assert.ok(n in ns, `${path} не экспортирует ${n}`);
  }
});
