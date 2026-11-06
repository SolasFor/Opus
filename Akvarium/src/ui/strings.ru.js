/**
 * Строки интерфейса аквариума и числа ru-RU (A-02): разметка панели, подписи рыб и медуз, вид от рыбы, имена для
 * экранного диктора. Числа — Intl.NumberFormat('ru-RU'): «0,6», «35 %», «1,0×»; «26 рыб» — Intl.PluralRules.
 * Подсказки для мыши и для касания — в элементах .k-mouse и .k-touch, видимость задаёт styles/app.css по
 * (hover: none) and (pointer: coarse). Без DOM и three.js; проверяет tests/strings.test.js.
 */
const NF0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const PCT = new Intl.NumberFormat('ru-RU', { style: 'percent', maximumFractionDigits: 0 });
const PLURAL = new Intl.PluralRules('ru-RU');
const FISH = { one: 'рыба', few: 'рыбы', many: 'рыб', other: 'рыбы' };
const fishCount = n => NF0.format(n) + '\u00a0' + FISH[PLURAL.select(n)];

// ползунки: [ключ K, подпись, min, max, шаг]; fmt — текст рядом с ползунком, valuetext — для экранного диктора
const SLIDERS = [['night', 'Ночь', 0, 1, 0.01], ['cur', 'Течение', 0, 2, 0.01], ['turb', 'Мутность', 0, 1, 0.01], ['spd', 'Время', 0, 2.5, 0.05], ['pop', 'Рыбы', 0.05, 1, 0.01]];
const FMT = {
  night: v => PCT.format(v), cur: v => NF1.format(v), turb: v => PCT.format(v),
  spd: v => v === 0 ? 'пауза' : NF1.format(v) + '×', pop: n => NF0.format(n),
};
const VALUETEXT = { ...FMT, spd: v => v === 0 ? 'пауза' : 'скорость ' + NF1.format(v) + '×', pop: fishCount };
// переключатели: [ключ K, подпись, клавиша]
const TOGGLES = [['air', 'Аэратор', ''], ['jelly', 'Медузы', ''], ['auto', 'Автокамера', ''], ['free', 'Свободная камера', ''], ['follow', 'Вид от рыбы', 'C'],
  ['torch', 'Фонарик у курсора', ''], ['flee', 'Рыбы боятся курсора', ''], ['sound', 'Звук', '']];
// D-12: медузы-аурелии остаются художественным элементом — с этой подписью и переключателем «Медузы»
const JELLY_NOTE = 'Художественный элемент: медуз-аурелий держат в отдельных круглых аквариумах, а не вместе с рифовыми рыбами.';
const JELLY_TIP = 'Медуза-аурелия<i>Aurelia aurita · художественный элемент</i>';

const PANEL_HTML = `<button type="button" id="grip" aria-controls="pbody" aria-expanded="false" aria-keyshortcuts="H"><span class="bar" aria-hidden="true"></span><span class="sr">Панель управления</span></button>
  <h3>Аквариум <span aria-hidden="true">H — скрыть</span></h3>
  <div id="pbody">
  <div class="sec" id="secLight">Освещение</div>
  <div class="seg" id="presets" role="group" aria-labelledby="secLight"><button type="button" data-p="day" aria-keyshortcuts="1">День<b aria-hidden="true">1</b></button><button type="button" data-p="sunset" aria-keyshortcuts="2">Закат<b aria-hidden="true">2</b></button><button type="button" data-p="night" aria-keyshortcuts="3">Ночь<b aria-hidden="true">3</b></button></div>
  <div class="sec" id="secWater">Вода</div><div id="sliders" role="group" aria-labelledby="secWater"></div>
  <div class="sec" id="secModes">Режимы</div><div id="toggles" role="group" aria-labelledby="secModes"></div>
  <div class="btns"><button type="button" id="bFeed" aria-keyshortcuts="F">Покормить</button><button type="button" id="bKnock" aria-keyshortcuts="K">Стук</button><button type="button" id="bShot">Снимок</button></div>
  <div id="keys"><span class="k-mouse"><kbd>клик</kbd> корм · <kbd>зажать</kbd> сыпать · <kbd>2×клик</kbd> по рыбе — следить · <kbd>ПКМ</kbd> стук по стеклу · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> свет · <kbd>C</kbd> камера-рыба · <kbd>Пробел</kbd> пауза · <kbd>F</kbd> корм · <kbd>K</kbd> стук · <kbd>H</kbd> панель</span><span class="k-touch"><kbd>касание</kbd> корм · <kbd>удержать</kbd> сыпать · <kbd>2×касание</kbd> по рыбе — следить · <kbd>щипок</kbd> ближе и дальше · «Стук» — стук по стеклу</span></div>
  </div>`;

const S = {
  scene: 'Аквариум: коралловый риф с рыбами. Корм — клавиша F, стук по стеклу — K, вид от рыбы — C, свет — 1, 2, 3, пауза — Пробел, панель — H.',
  follow: name => 'Камера следует: <b>' + name + '</b><span class="k-mouse"> · C / Esc — выход, двойной клик — другая рыба</span><span class="k-touch"> · двойное касание — другая рыба</span>',
  tipFollow: { mouse: ' · двойной клик — следить', touch: ' · двойное касание — следить' },
};

export { FMT, JELLY_NOTE, JELLY_TIP, PANEL_HTML, S, SLIDERS, TOGGLES, VALUETEXT, fishCount };
