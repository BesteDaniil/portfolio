/* ==========================================================
   Рой курсоров над «Есть задача?» — <canvas>, не DOM.
   Маленькие белые курсоры перетекают: слово → сердце → слово…
   Форма держится 2 с, переход 1 с; каждый летит по своей дуге со своей задержкой
   и «дышит» на месте. Вокруг кружат несколько цветных курсоров с подписями.

   Иконка курсора рисуется один раз во вспомогательный canvas и копируется drawImage.
   Кадры идут, только когда рой виден (IntersectionObserver) и вкладка активна
   (visibilitychange): вне экрана — ни одного кадра. «Уменьшить движение» — статичное слово.
   ========================================================== */

import { sampleTextPoints, heartPoints, matchPoints } from "./shapes.js";
import { easeInOutCubic, quadraticPoint } from "./easing.js";
import { createRandom } from "./random.js";

const HOLD_MS = 2000;
const MOVE_MS = 1000;
const PERIOD_MS = 2 * (HOLD_MS + MOVE_MS);
/* Разброс старта перехода: доля от MOVE_MS */
const SPREAD = 0.25;
const ORBITERS = [
  { role: "layout", label: "вёрстка" },
  { role: "text", label: "текст" },
  { role: "color", label: "цвет" },
  { role: "images", label: "картинки" },
  { role: "tests", label: "тесты" }
];

export function getSwarmCount(width) {
  return width < 700 ? 150 : 420;
}

/* Стрелка курсора: путь в системе 16×22 */
function drawArrow(context, scale, fill, stroke) {
  context.save();
  context.scale(scale, scale);
  context.beginPath();
  context.moveTo(1, 1);
  context.lineTo(1, 18);
  context.lineTo(5.6, 14);
  context.lineTo(8.9, 21.2);
  context.lineTo(12.1, 19.8);
  context.lineTo(8.8, 12.7);
  context.lineTo(15, 12.7);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.lineWidth = 1.2;
    context.strokeStyle = stroke;
    context.stroke();
  }
  context.restore();
}

function makeSprite(dpr, size, fill, stroke) {
  const sprite = document.createElement("canvas");
  const scale = size / 22;
  sprite.width = Math.ceil(16 * scale * dpr) + 2;
  sprite.height = Math.ceil(22 * scale * dpr) + 2;
  const context = sprite.getContext("2d");
  context.translate(1, 1);
  drawArrow(context, scale * dpr, fill, stroke);
  return sprite;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/* Цветной курсор с подписью — тоже один раз во вспомогательный canvas */
function makeLabelSprite(dpr, color, ink, text, font) {
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = "600 12px " + font;
  const textWidth = Math.ceil(measure.measureText(text).width);
  const width = 16 + 2 + textWidth + 14;
  const height = 34;
  const sprite = document.createElement("canvas");
  sprite.width = Math.ceil(width * dpr);
  sprite.height = Math.ceil(height * dpr);
  const context = sprite.getContext("2d");
  context.scale(dpr, dpr);
  drawArrow(context, 1, color, ink);
  context.fillStyle = color;
  const left = 18;
  const top = 14;
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(left, top, textWidth + 14, 19, 6);
  } else {
    context.rect(left, top, textWidth + 14, 19);
  }
  context.fill();
  context.fillStyle = ink;
  context.font = "600 12px " + font;
  context.textBaseline = "middle";
  context.fillText(text, left + 7, top + 10);
  return { canvas: sprite, width: width, height: height };
}

/* options: { still: boolean } */
export function createSwarm(canvas, options) {
  const context = canvas.getContext("2d");
  const still = Boolean(options && options.still);
  const style = window.getComputedStyle(document.documentElement);
  const colors = {
    dot: style.getPropertyValue("--text").trim() || "#fff",
    bg: style.getPropertyValue("--bg").trim() || "#000"
  };
  const font = window.getComputedStyle(document.body).fontFamily || "sans-serif";

  let width = 0;
  let height = 0;
  let dpr = 1;
  let particles = [];
  let sprite = null;
  let labels = [];
  let frame = 0;
  let visible = false;
  let startTime = 0;
  const stats = { frames: 0, count: 0, running: false };

  function layout() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const count = getSwarmCount(width);
    stats.count = count;

    // Слово — во всю ширину (с полями), сердце — квадрат по высоте, оба по центру
    const wordWidth = width * 0.9;
    const wordHeight = height * 0.62;
    const word = sampleTextPoints(canvas.dataset.word || "ДЛЯ ВАС", wordWidth, wordHeight, count).map(function (point) {
      return { x: point.x + (width - wordWidth) / 2, y: point.y + (height - wordHeight) / 2 };
    });
    const side = height * 0.86;
    const heart = heartPoints(count).map(function (point) {
      return { x: width / 2 - side / 2 + point.x * side, y: (height - side) / 2 + point.y * side };
    });
    const mapping = matchPoints(word, heart);
    const random = createRandom(20261122);
    particles = word.map(function (point, index) {
      const target = heart[mapping[index]];
      const dx = target.x - point.x;
      const dy = target.y - point.y;
      // Дуга: вбок от прямой на долю расстояния, у каждого в свою сторону
      const bend = (random() - 0.5) * 0.6;
      return {
        word: point,
        heart: target,
        control: { x: (point.x + target.x) / 2 - dy * bend, y: (point.y + target.y) / 2 + dx * bend },
        delay: random() * SPREAD,
        phase: random() * Math.PI * 2,
        breath: 0.6 + random() * 0.9
      };
    });
    const size = width < 700 ? 9 : 11;
    sprite = makeSprite(dpr, size, colors.dot, null);
    labels = ORBITERS.map(function (item, index) {
      const color = style.getPropertyValue("--role-" + item.role).trim() || "#8ea2ff";
      return { sprite: makeLabelSprite(dpr, color, colors.bg, item.label, font), phase: index / ORBITERS.length, speed: 0.07 + index * 0.012 };
    });
  }

  /* Доля перехода [0, 1] слово → сердце в момент cycle (мс внутри периода) у частицы с задержкой delay */
  function shareFor(cycle, delay) {
    const moveShare = 1 - SPREAD;
    if (cycle < HOLD_MS) {
      return 0;
    }
    if (cycle < HOLD_MS + MOVE_MS) {
      return easeInOutCubic(((cycle - HOLD_MS) / MOVE_MS - delay) / moveShare);
    }
    if (cycle < 2 * HOLD_MS + MOVE_MS) {
      return 1;
    }
    return 1 - easeInOutCubic(((cycle - 2 * HOLD_MS - MOVE_MS) / MOVE_MS - delay) / moveShare);
  }

  function draw(time) {
    const elapsed = still ? 0 : time - startTime;
    const cycle = elapsed % PERIOD_MS;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const spriteWidth = sprite.width / dpr;
    const spriteHeight = sprite.height / dpr;
    const seconds = elapsed / 1000;
    for (const particle of particles) {
      const share = still ? 0 : shareFor(cycle, particle.delay);
      const point = share <= 0 ? particle.word : share >= 1 ? particle.heart : quadraticPoint(particle.word, particle.control, particle.heart, share);
      // «Дыхание» — маленький круг на месте
      const x = point.x + (still ? 0 : Math.sin(seconds * 1.6 * particle.breath + particle.phase) * 1.3);
      const y = point.y + (still ? 0 : Math.cos(seconds * 1.3 * particle.breath + particle.phase) * 1.3);
      context.drawImage(sprite, (x - 1) * dpr, (y - 1) * dpr, spriteWidth * dpr, spriteHeight * dpr);
    }
    // Цветные курсоры с подписями — по эллипсу вокруг роя
    for (const label of labels) {
      const angle = (label.phase + seconds * label.speed) * Math.PI * 2;
      // Подпись целиком в холсте: на узком экране эллипс шире, чем место для неё
      const x = clamp(width / 2 + Math.cos(angle) * (width * 0.44) - label.sprite.width / 2, 0, width - label.sprite.width);
      const y = clamp(height / 2 + Math.sin(angle) * (height * 0.4) - label.sprite.height / 2, 0, height - label.sprite.height);
      context.drawImage(label.sprite.canvas, x * dpr, y * dpr, label.sprite.width * dpr, label.sprite.height * dpr);
    }
    stats.frames++;
  }

  function tick(time) {
    frame = 0;
    if (!visible || document.hidden) {
      stats.running = false;
      return;
    }
    draw(time);
    frame = requestAnimationFrame(tick);
  }

  function resume() {
    if (still || frame || !visible || document.hidden) {
      return;
    }
    stats.running = true;
    frame = requestAnimationFrame(tick);
  }

  function pause() {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    stats.running = false;
  }

  layout();
  startTime = performance.now();
  // Подписи цветных курсоров рисуются шрифтом страницы: если Inter ещё грузится —
  // спрайты пересобираются после загрузки, а статичное слово рисуется один раз, уже с ним
  const fontsPending = Boolean(document.fonts && document.fonts.status !== "loaded");
  if (still && !fontsPending) {
    // Один кадр — статичное слово
    draw(startTime);
  }
  if (fontsPending) {
    document.fonts.ready.then(function () {
      layout();
      if (still) {
        draw(performance.now());
      }
    });
  }

  const observer = new IntersectionObserver(function (entries) {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) {
      resume();
    } else {
      pause();
    }
  });
  observer.observe(canvas);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      pause();
    } else {
      resume();
    }
  });

  let resizeTimer = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      const before = width;
      const rect = canvas.getBoundingClientRect();
      if (Math.round(rect.width) === before) {
        return;
      }
      layout();
      if (still) {
        draw(performance.now());
      }
    }, 150);
  });

  return stats;
}
