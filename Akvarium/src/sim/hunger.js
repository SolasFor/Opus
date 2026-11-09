/**
 * A-04 — голод и сытость рыб (стилизованная модель, aquarium-ecosystem → ecosystem-models §6.1).
 * Без three и DOM: модуль работает в Node и проверяется отдельно (tests/hunger.test.js).
 * У рыбы h ∈ [0, 1] (1 — голодна) и флаг sat (сыта, корм не замечает). Голод растёт на rate в секунду, укус
 * снимает bite. Ниже sated рыба перестаёт реагировать на корм и возвращается к нему только выше resume
 * (гистерезис: интерес не мерцает). Чем меньше голод, тем меньше радиус поиска корма и прибавка скорости
 * к нему; при h = 1 оба равны прежним значениям, поэтому голодные рыбы ведут себя как до A-04.
 * Это стилизация, а не физиология: смерти от голода нет, числа подобраны так, чтобы кормление имело видимый конец.
 * Шаг без выделения памяти: функции меняют поля переданной рыбы и возвращают её же.
 * Параметры HUNGER — в config/ecosystem.js (A-04, шаг 2), рядом с параметрами ночного отдыха.
 */
import { HUNGER, REMAINS } from '../config/ecosystem.js';

function hungerInit(f, rnd) {
  const a = HUNGER.start[0], b = HUNGER.start[1];
  f.h = a + (b - a) * rnd();
  f.sat = false;
  return f;
}

// новичок при setPopulation копирует состояние участника стаи, как p и v
function hungerCopy(f, src) {
  f.h = src.h;
  f.sat = src.sat;
  return f;
}

function hungerStep(f, dt) {
  if (!(dt > 0)) return f;   // пауза («Время» = 0) и некорректный dt ничего не меняют
  f.h = Math.min(1, f.h + HUNGER.rate * dt);
  if (f.sat && f.h >= HUNGER.resume) f.sat = false;
  return f;
}

function hungerBite(f) {
  f.h = Math.max(0, f.h - HUNGER.bite);
  if (f.h < HUNGER.sated) f.sat = true;
  return f;
}

// интерес к корму 0…1: 0 у сытой рыбы и на пороге сытости, 1 при полном голоде
function foodInterest(f) {
  if (f.sat) return 0;
  const k = (f.h - HUNGER.sated) / (1 - HUNGER.sated);
  return k <= 0 ? 0 : k >= 1 ? 1 : k;
}

// радиус поиска корма: прежний r при h = 1, 0 у сытой рыбы (nearestFood ничего не найдёт)
function foodReach(f, r) {
  if (f.sat) return 0;
  return r * (HUNGER.reachMin + (1 - HUNGER.reachMin) * foodInterest(f));
}

// множитель скорости к корму: прежний b при h = 1, 1 у сытой рыбы
function foodBoost(f, b) {
  if (f.sat) return 1;
  return 1 + (b - 1) * (HUNGER.boostMin + (1 - HUNGER.boostMin) * foodInterest(f));
}

// остатки на песке (A-04, шаг 3). ages — возрасты лежащих хлопьев (первые n). Порог возраста, с которого хлопья растворяются быстрее:
// Infinity, пока лежит не больше REMAINS.cap; иначе ускоряются n - cap самых старых. Сортирует ages на месте.
function remainsCut(ages, n) {
  if (!(n > REMAINS.cap)) return Infinity;
  return ages.subarray(0, n).sort()[REMAINS.cap];
}
// возраст хлопья на песке после шага dt
function remainsAge(ground, dt, cut) {
  return ground + dt * (ground >= cut ? REMAINS.rush : 1);
}
function remainsGone(ground) {
  return ground > REMAINS.life;
}
// множитель размера: 1, пока до конца жизни больше fade секунд, затем линейно до 0
function remainsScale(ground) {
  const k = (REMAINS.life - ground) / REMAINS.fade;
  return k >= 1 ? 1 : k > 0 ? k : 0;
}

export { hungerInit, hungerCopy, hungerStep, hungerBite, foodInterest, foodReach, foodBoost, remainsCut, remainsAge, remainsGone, remainsScale };
