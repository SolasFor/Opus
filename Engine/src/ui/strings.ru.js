/* Строки интерфейса и числа по нормам ru-RU (П-12 в 14_M05; M-05d). Без DOM и three.js — проверяет tests/a11y.test.js.
 * Числа: десятичная запятая, минус «−» (U+2212), неразрывный пробел перед единицей: «18,5 бар», «0 %», «180 °C»;
 * угол — без пробела: «52°». Значения справочника деталей (config/parts.js) уже записаны с запятой: nb() ставит
 * в них неразрывный пробел после числа, чтобы «36 мм» не разрывалось при переносе строки.
 * Здесь — строки, которые выставляет код: кнопки, состояния, подписи для экранного диктора, уведомления. Статичная
 * разметка (заголовки, справка) — в index.html; названия и описания деталей — в config/parts.js, подписи строк блока
 * «Сейчас» — рядом с их формулами в ui/info.js.
 * TOAST — варианты уведомлений без упоминания клавиш для устройств без клавиатуры (pointer: coarse, §5 в 14_M05).
 */
const NB = '\u00a0', MINUS = '\u2212';

// x с d знаками после запятой; −0 и «−0,0» не бывает
function num(x, d = 0) {
  const r = +(+x).toFixed(d);
  const s = Math.abs(r).toFixed(d).replace('.', ',');
  return r < 0 ? MINUS + s : s;
}
const unit = (x, u, d = 0) => num(x, d) + NB + u;
const percent = (x, d = 0) => num(x, d) + NB + '%';
const degrees = (x, d = 0) => num(x, d) + '°';
const times = (x, d = 1) => '×' + num(x, d);
const nb = s => String(s).replace(/(\d) (?=\S)/g, '$1' + NB);
// 1 узел, 2 узла, 5 узлов, 21 узел, 12 узлов
function plural(n, [one, few, many]) {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
}
const speedText = (e, rpm) => times(e, e < 1 ? 2 : 1) + ' · ' + unit(rpm, 'об/мин', rpm < 10 ? 1 : 0);

const S = {
  run: 'Запустить', pause: 'Пауза', isolateBtn: 'Изолировать', showAll: 'Показать всё',
  hidePanels: 'Скрыть панели', showPanels: 'Показать панели',
  assembled: 'собран', exploded: 'разобран',
  stepShort: (i, n) => `шаг ${i}/${n}`, stepOf: (i, n) => `шаг ${i} из ${n}`, notStarted: 'не начата',
  stepDot: (i, title) => `Шаг ${i}: ${title}`,
  idleTitle: 'Двигатель собран',
  idleNote: 'Нажмите <b>Далее</b>: свечи → ремень ГРМ → распредвалы → коллекторы → ГБЦ → блок → поршни → коленвал.',
  nodeCount: n => `${n} ${plural(n, ['узел', 'узла', 'узлов'])}`,
  cycle: d => `цикл ${degrees(d)}`, cylStroke: (i, s) => `Ц${i} — ${s}`, angleText: (d, i, s) => `цикл ${degrees(d)}, цилиндр ${i}: ${s}`,
  phaseRow: (i, s) => `Цилиндр ${i}: ${s}`, phaseTitle: i => `Цилиндр ${i} — показать p–V`,
  pvTitle: i => `p–V · цилиндр ${i}`, pvLabel: i => `p–V диаграмма цилиндра ${i}: давление по объёму за цикл, точка — текущее состояние`,
  pvReading: (p, s) => unit(p, 'бар', 1) + ' · ' + s,
  cutAxis: 'по осям цилиндров', cutOff: mm => (mm > 0 ? '+' : MINUS) + unit(Math.abs(mm), 'мм от оси'),
  live: 'Сейчас', starNote: '* иллюстративное значение', modelNote: 'Учебная модель: справочные значения иллюстративные',
  hoverHint: 'клик — описание · двойной клик — изолировать',
  fps: (fps, pr, ao) => `${Math.round(fps)} fps · ${num(pr, 2).replace(/0$/, '')}×` + (ao ? ' · AO' : ''),
};
// уведомления: [с клавишами, без клавиш (pointer: coarse)]
const TOAST = {
  welcome: ['Клик по детали — описание · Space — запуск · ? — все клавиши', 'Коснитесь детали — описание · «?» — справка'],
  cutOn: ['Включил разрез, чтобы были видны такты. Вид меняется клавишей X', 'Включил разрез, чтобы были видны такты'],
  explodedRun: ['Механизм крутится и в разборке, а горение видно только в собранном двигателе'],
  soundRun: ['Звук включён: каждый «хлопок» — рабочий ход'],
  soundIdle: ['Звук включён — запустите двигатель (Space)', 'Звук включён — запустите двигатель'],
  noAudio: ['Браузер не поддерживает WebAudio'],
};
const toastText = (key, coarse) => { const t = TOAST[key]; return coarse && t[1] ? t[1] : t[0]; };
const shotSaved = file => 'Снимок сохранён: ' + file;

export { NB, MINUS, num, unit, percent, degrees, times, nb, plural, speedText, S, TOAST, toastText, shotSaved };
