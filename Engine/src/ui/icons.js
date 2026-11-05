/* Значки для кнопок, текст которых меняет код (M-05b): встроенный SVG с aria-hidden, имя кнопки — её текст.
 * Остальные значки стоят прямо в разметке index.html. runLabel() — «Запустить» и «Пауза», isolateLabel() — «Изолировать»
 * и «Показать всё».
 * M-05d: строки — из ui/strings.ru.js; буква клавиши <kbd> скрыта от экранного диктора (aria-hidden): имя кнопки —
 * «Запустить», клавиша — в aria-keyshortcuts разметки.
 */
import { S } from './strings.ru.js';

const svg = d => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const PLAY = svg('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>');
const PAUSE = svg('<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="3"/>');
const ISOLATE = svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/>');
const KBD = k => ` <kbd aria-hidden="true">${k}</kbd>`;
const runLabel = running => (running ? PAUSE + S.pause : PLAY + S.run) + KBD('Space');
const isolateLabel = all => ISOLATE + (all ? S.showAll : S.isolateBtn) + KBD('I');

export { runLabel, isolateLabel };
