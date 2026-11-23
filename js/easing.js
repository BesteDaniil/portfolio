/* ==========================================================
   Плавность движения. Чистые функции t ∈ [0, 1] → [0, 1], f(0) = 0, f(1) = 1.
   Значения вне отрезка прижимаются к краям — анимация не «перелетает» цель.
   ========================================================== */

function clamp01(t) {
  if (!(t > 0)) {
    return 0;
  }
  return t >= 1 ? 1 : t;
}

export function linear(t) {
  return clamp01(t);
}

/* Разгон и торможение — полёт курсора от блока к блоку */
export function easeInOutCubic(t) {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/* Быстрый старт, мягкая остановка — рамка, печать, проявление */
export function easeOutCubic(t) {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

/* Точка на квадратичной кривой Безье: курсоры роя летят по дуге, а не по прямой */
export function quadraticPoint(from, control, to, t) {
  const x = clamp01(t);
  const a = (1 - x) * (1 - x);
  const b = 2 * (1 - x) * x;
  const c = x * x;
  return {
    x: a * from.x + b * control.x + c * to.x,
    y: a * from.y + b * control.y + c * to.y
  };
}

/* Доля пройденного на отрезке [start, start + duration] к моменту now */
export function progress(now, start, duration) {
  if (duration <= 0) {
    return now >= start ? 1 : 0;
  }
  return clamp01((now - start) / duration);
}
