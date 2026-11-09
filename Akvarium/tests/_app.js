/**
 * Источник аквариума для тестов (A-01b, D-13). Модульная версия — Akvarium/index.html, styles/app.css и модули src/
 * (core → scenery → creatures → adapt → ui/… → main, в порядке выполнения) — собирается в один текст в формате однофайловой
 * Aquarium.html: стили — во встроенный <style>, модули подряд — во встроенный <script type="module">. Тесты экрана
 * запуска, адаптивного разрешения и хуков проверяют модульную версию: дальше меняется только она. Замороженную
 * Aquarium.html сторожит legacy.test.js, перенос модулей — split.test.js. Без сторонних зависимостей.
 */
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');   // checkout с autocrlf
export const INDEX = read('../index.html');
export const CSS = read('../styles/app.css');
export const ORDER = ['perf/quality', 'core', 'scenery', 'creatures', 'adapt', 'config/ecosystem', 'sim/hunger', 'sim/rest', 'ui/strings.ru', 'ui/gestures', 'ui/sheet', 'main'];   // порядок выполнения: main.js импортирует остальные по порядку (с A-02 — и модули ui/)
export const MODULES = Object.fromEntries(ORDER.map(n => [n, read(`../src/${n}.js`)]));
export const MAIN = MODULES.main;
export const CODE = ORDER.map(n => MODULES[n]).join('');
export const LEGACY = read('../Aquarium.html');
export const LINK = '<link rel="stylesheet" href="./styles/app.css">\n';
export const ENTRY = '<script type="module" src="./src/main.js" onerror="window.__aqModuleError()"></script>\n';

export function assemble(index = INDEX, css = CSS, code = CODE) {
  for (const [s, what] of [[LINK, 'ссылка на styles/app.css'], [ENTRY, 'точка входа src/main.js с onerror']])
    if (index.split(s).length !== 2) throw new Error(`index.html: ровно одна строка «${what}»`);
  return index.replace(LINK, () => `<style>\n${css}</style>\n`)
    .replace(ENTRY, () => `<script type="module" onerror="window.__aqModuleError()">\n${code}</script>\n`);
}
export const HTML = assemble();
