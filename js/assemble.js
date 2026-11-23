/* ==========================================================
   Сборка страницы курсорами — слой поверх готового HTML.
   Весь контент уже в разметке; до сборки его прячет только класс html.assembling
   (ставит скрипт в <head>). Курсоры, рамки и галочки — div с aria-hidden в слое #crew,
   двигаются только через transform. Размеры блоков замеряются один раз перед стартом секции.

   Расписание строит js/timeline.js (чистая функция); здесь — только проигрывание.
   Печать: текст остаётся на месте, ещё не «напечатанная» часть лежит в span.ghost
   с прозрачным цветом — вёрстка не прыгает, а в конце узлы возвращаются как были.
   ========================================================== */

import { buildTimeline, createCursors } from "./timeline.js";
import { easeInOutCubic, easeOutCubic, progress } from "./easing.js";

const SESSION_KEY = "portfolio:assembled";
const TRAVEL = 220;
const EXIT_MS = 650;
const CHECK_HOLD_MS = 700;
const SLOW_RATE = 1 / 3;
const LIMITS = {
  desktop: { first: 4500, section: 3000 },
  mobile: { first: 3000, section: 2000 }
};
const SVG_NS = "http://www.w3.org/2000/svg";
const STATE_CLASSES = ["b-on", "b-color", "b-image"];

function createCursorElement(cursor) {
  const element = document.createElement("div");
  element.className = "cursor";
  element.dataset.role = cursor.role;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 22");
  svg.setAttribute("class", "cursor__arrow");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M1 1v17l4.6-4 3.3 7.2 3.2-1.4-3.3-7.1H15Z");
  svg.append(path);
  const label = document.createElement("span");
  label.className = "cursor__label";
  label.textContent = cursor.label;
  element.append(svg, label);
  return element;
}

/* Текст элемента → «призрак»: видимая часть + прозрачный остаток */
function ghostText(element) {
  const parts = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest("svg") || node.data.trim() === "") {
      continue;
    }
    // Текст вложенного блока со своей печатью печатает его курсор
    const owner = parent.closest("[data-build~=\"text\"]");
    if (owner !== element) {
      continue;
    }
    const hidden = document.createElement("span");
    hidden.className = "ghost";
    hidden.textContent = node.data;
    parts.push({ node: node, hidden: hidden, full: node.data });
    node.data = "";
    node.after(hidden);
  }
  let total = 0;
  for (const part of parts) {
    total += part.full.length;
  }
  return { parts: parts, total: total, shown: 0 };
}

function setTyped(ghost, count) {
  if (ghost.shown === count) {
    return;
  }
  ghost.shown = count;
  let left = count;
  for (const part of ghost.parts) {
    const visible = Math.max(0, Math.min(left, part.full.length));
    part.node.data = part.full.slice(0, visible);
    part.hidden.textContent = part.full.slice(visible);
    left -= visible;
  }
}

function unghost(ghost) {
  for (const part of ghost.parts) {
    part.node.data = part.full;
    part.hidden.remove();
  }
  ghost.parts = [];
}

/* options: { crew: HTMLElement, isMobile(): boolean, onState(mode) } */
export function createAssembly(options) {
  const crewLayer = options.crew;
  const root = document.documentElement;
  const sectionElements = Array.from(document.querySelectorAll("[data-section]"));
  const header = document.querySelector(".top");

  let mode = root.classList.contains("assembling") ? "pending" : "done";
  let rate = 1;
  let frame = 0;
  let clock = 0;
  let lastTime = 0;
  let run = null;
  let queue = [];
  let crew = [];
  let observer = null;
  let startGeneration = 0;
  const prepared = new Set();
  const stats = { runs: 0, firstScreenMs: 0, startedAt: 0 };

  function profile() {
    return options.isMobile() ? LIMITS.mobile : LIMITS.desktop;
  }

  function ensureCrew() {
    const count = options.isMobile() ? 8 : 18;
    if (crew.length === count) {
      return;
    }
    for (const member of crew) {
      member.element.remove();
    }
    crew = createCursors(count).map(function (cursor, index) {
      const element = createCursorElement(cursor);
      crewLayer.append(element);
      return { cursor: cursor, element: element, index: index, x: 0, y: 0 };
    });
  }

  /* Откуда курсор влетает и куда улетает: по краям экрана, у каждого своё место */
  function spawnPoint(member) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const side = member.index % 4;
    const along = ((member.index * 0.618) % 1) * (side % 2 === 0 ? width : height);
    const top = window.scrollY;
    if (side === 0) {
      return { x: along, y: top - 40 };
    }
    if (side === 1) {
      return { x: width + 40, y: top + along };
    }
    if (side === 2) {
      return { x: along, y: top + height + 40 };
    }
    return { x: -60, y: top + along };
  }

  function sectionBlocks(section) {
    const scope = section === sectionElements[0] && header ? [header, section] : [section];
    const list = [];
    for (const container of scope) {
      if (container.hasAttribute("data-build")) {
        list.push(container);
      }
      for (const element of container.querySelectorAll("[data-build]")) {
        list.push(element);
      }
    }
    return list;
  }

  /* Замер один раз перед стартом секции: координаты страницы, высота строки, призраки текста */
  function prepare(section) {
    const elements = sectionBlocks(section);
    const scrollY = window.scrollY;
    const blocks = elements.map(function (element, index) {
      const rect = element.getBoundingClientRect();
      const actions = element.dataset.build.split(/\s+/);
      const block = {
        id: "b" + index,
        element: element,
        actions: actions,
        rect: { x: rect.left, y: rect.top + scrollY, w: rect.width, h: rect.height },
        lineHeight: 0,
        ghost: null,
        chars: 0,
        frameBox: null,
        label: null,
        check: null
      };
      if (actions.includes("text")) {
        const style = window.getComputedStyle(element);
        block.lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.3 || 20;
        block.ghost = ghostText(element);
        block.chars = block.ghost.total;
      }
      return block;
    });
    prepared.add(blocks);
    return blocks;
  }

  function startSection(section, limit) {
    ensureCrew();
    const blocks = prepare(section);
    const byId = new Map(blocks.map(function (block) {
      return [block.id, block];
    }));
    const timeline = buildTimeline(blocks, crew.map(function (member) {
      return member.cursor;
    }), { limit: limit, travel: TRAVEL });
    const steps = timeline.steps.map(function (step) {
      return { ...step, block: byId.get(step.element), started: false, ended: false };
    });
    // Последний шаг каждого блока — после него рамка и галочка убираются
    const lastEnd = new Map();
    for (const step of steps) {
      lastEnd.set(step.block, Math.max(lastEnd.get(step.block) || 0, step.start + step.duration));
    }
    const perCursor = new Map();
    for (const member of crew) {
      const start = spawnPoint(member);
      member.x = start.x;
      member.y = start.y;
      perCursor.set(member.cursor.id, steps.filter(function (step) {
        return step.cursor === member.cursor.id;
      }).map(function (step) {
        return { step: step, from: null };
      }));
    }
    run = { section: section, blocks: blocks, steps: steps, perCursor: perCursor, lastEnd: lastEnd, total: timeline.total, startClock: clock };
    stats.runs++;
  }

  // ===== Эффекты шагов =====
  function makeBox(block) {
    const box = document.createElement("div");
    box.className = "f-box";
    const label = document.createElement("div");
    label.className = "f-label";
    label.textContent = Math.round(block.rect.w) + "×" + Math.round(block.rect.h);
    crewLayer.append(box, label);
    block.frameBox = box;
    block.label = label;
  }

  function makeCheck(block) {
    const check = document.createElement("div");
    check.className = "f-check";
    check.textContent = "✓";
    crewLayer.append(check);
    block.check = check;
  }

  function removeOverlays(block) {
    for (const key of ["frameBox", "label", "check"]) {
      if (block[key]) {
        block[key].remove();
        block[key] = null;
      }
    }
  }

  function placeOverlays(block, scrollY, frameShare) {
    const rect = block.rect;
    const y = rect.y - scrollY;
    if (block.frameBox) {
      block.frameBox.style.transform = "translate3d(" + rect.x + "px," + y + "px,0) scale(" + frameShare + ")";
      block.frameBox.style.width = rect.w + "px";
      block.frameBox.style.height = rect.h + "px";
    }
    if (block.label) {
      block.label.style.transform = "translate3d(" + rect.x + "px," + (y - 18) + "px,0)";
    }
    if (block.check) {
      block.check.style.transform = "translate3d(" + (rect.x + rect.w - 12) + "px," + (y - 10) + "px,0)";
    }
  }

  function applyStep(step, local) {
    const block = step.block;
    const element = block.element;
    if (!step.started && local >= 0) {
      step.started = true;
      if (step.action === "frame") {
        makeBox(block);
      } else if (step.action === "reveal") {
        element.classList.add("b-on");
      } else if (step.action === "text" || step.action === "color" || step.action === "image") {
        if (!block.actions.includes("frame") && !block.actions.includes("reveal")) {
          element.classList.add("b-on");
        }
        if (step.action === "color") {
          element.classList.add("b-color");
        }
        if (step.action === "image") {
          element.classList.add("b-image");
        }
      } else if (step.action === "check") {
        makeCheck(block);
      }
    }
    if (step.action === "text" && block.ghost && local >= 0) {
      const share = step.duration > 0 ? Math.min(1, local / step.duration) : 1;
      setTyped(block.ghost, Math.round(share * block.ghost.total));
    }
    if (!step.ended && local >= step.duration) {
      step.ended = true;
      if (step.action === "frame" && !block.actions.includes("reveal")) {
        element.classList.add("b-on");
      }
      if (step.action === "text" && block.ghost) {
        setTyped(block.ghost, block.ghost.total);
      }
    }
  }

  /* Где курсор во время действия: рамку ведёт по диагонали, текст — строками, цвет — мазком */
  function actionPoint(step, share) {
    const rect = step.block.rect;
    const eased = easeOutCubic(share);
    if (step.action === "frame") {
      return { x: rect.x + rect.w * eased, y: rect.y + rect.h * eased };
    }
    if (step.action === "text") {
      const lines = Math.max(1, Math.round(rect.h / (step.block.lineHeight || rect.h)));
      const position = Math.min(lines - 1e-6, share * lines);
      const line = Math.floor(position);
      return { x: rect.x + rect.w * (position - line), y: rect.y + (line + 0.75) * (rect.h / lines) };
    }
    if (step.action === "color") {
      return { x: rect.x + rect.w * (0.2 + 0.6 * eased), y: rect.y + rect.h * 0.55 };
    }
    if (step.action === "image") {
      return { x: rect.x + rect.w * eased, y: rect.y + rect.h * (0.3 + 0.4 * eased) };
    }
    if (step.action === "check") {
      return { x: rect.x + rect.w - 8, y: rect.y + 6 };
    }
    return { x: rect.x + rect.w * 0.5 + Math.cos(share * 6.3) * 14, y: rect.y + rect.h * 0.5 + Math.sin(share * 6.3) * 10 };
  }

  function startPoint(step) {
    return actionPoint(step, 0);
  }

  function endPoint(step) {
    return actionPoint(step, 1);
  }

  /* Положение курсора в момент t (мс от начала прогона) */
  function cursorPoint(member, t) {
    const own = run.perCursor.get(member.cursor.id);
    let previousEnd = { x: member.x, y: member.y };
    let previousTime = -TRAVEL * 2;
    for (const entry of own) {
      const step = entry.step;
      if (t < step.start) {
        const from = previousEnd;
        const to = startPoint(step);
        const span = Math.max(1, step.start - Math.max(previousTime, step.start - TRAVEL * 2));
        const share = easeInOutCubic(progress(t, step.start - span, span));
        return { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share, visible: true };
      }
      if (t <= step.start + step.duration) {
        const point = actionPoint(step, progress(t, step.start, step.duration));
        return { x: point.x, y: point.y, visible: true };
      }
      previousEnd = endPoint(step);
      previousTime = step.start + step.duration;
    }
    // Дела кончились — улетает к своему краю и гаснет
    const exit = spawnPoint(member);
    const share = easeInOutCubic(progress(t, previousTime, EXIT_MS));
    if (own.length === 0) {
      return { x: exit.x, y: exit.y, visible: false };
    }
    return { x: previousEnd.x + (exit.x - previousEnd.x) * share, y: previousEnd.y + (exit.y - previousEnd.y) * share, visible: share < 1 };
  }

  function render() {
    const t = clock - run.startClock;
    const scrollY = window.scrollY;
    for (const step of run.steps) {
      applyStep(step, t - step.start);
    }
    for (const block of run.blocks) {
      const frameStep = run.steps.find(function (step) {
        return step.block === block && step.action === "frame";
      });
      const share = frameStep ? easeOutCubic(progress(t, frameStep.start, frameStep.duration)) : 1;
      if (block.frameBox && t > run.lastEnd.get(block) + CHECK_HOLD_MS) {
        removeOverlays(block);
      }
      placeOverlays(block, scrollY, share);
    }
    for (const member of crew) {
      const point = cursorPoint(member, t);
      member.element.style.transform = "translate3d(" + point.x + "px," + (point.y - scrollY) + "px,0)";
      member.element.classList.toggle("is-hidden", !point.visible);
    }
    return t >= run.total + Math.max(EXIT_MS, CHECK_HOLD_MS);
  }

  function finishRun() {
    for (const block of run.blocks) {
      if (block.ghost) {
        unghost(block.ghost);
      }
      removeOverlays(block);
      block.element.classList.add("b-on", "b-color", "b-image");
    }
    prepared.delete(run.blocks);
    run.section.dataset.built = "1";
    if (run.section === sectionElements[0]) {
      stats.firstScreenMs = performance.now() - stats.startedAt;
    }
    run = null;
    for (const member of crew) {
      member.element.classList.add("is-hidden");
    }
  }

  function tick(time) {
    frame = 0;
    const dt = lastTime ? Math.min(64, time - lastTime) : 16;
    lastTime = time;
    clock += dt * rate;
    if (!run && queue.length > 0) {
      const next = queue.shift();
      // Пролистали сразу несколько секций — каждая собирается быстрее
      startSection(next, queue.length > 0 ? profile().section * 0.5 : profile().section);
    }
    if (run && render()) {
      finishRun();
    }
    if (sectionElements.every(function (section) {
      return section.dataset.built === "1";
    })) {
      finishAll();
      return;
    }
    if (run || queue.length > 0) {
      frame = requestAnimationFrame(tick);
    } else {
      lastTime = 0;
      mode = "waiting";
      options.onState(mode);
    }
  }

  function loop() {
    if (!frame) {
      frame = requestAnimationFrame(tick);
    }
  }

  /* Готовая страница сразу: всё на своих местах, слой курсоров пуст */
  function finishAll() {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    for (const blocks of prepared) {
      for (const block of blocks) {
        if (block.ghost) {
          unghost(block.ghost);
        }
        removeOverlays(block);
      }
    }
    prepared.clear();
    run = null;
    queue = [];
    for (const member of crew) {
      member.element.remove();
    }
    crew = [];
    crewLayer.textContent = "";
    for (const element of document.querySelectorAll("[data-build]")) {
      element.classList.remove(...STATE_CLASSES);
    }
    for (const section of sectionElements) {
      delete section.dataset.built;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    root.classList.remove("assembling");
    lastTime = 0;
    if (mode !== "done") {
      mode = "done";
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch (error) {
        // Не запомнилось — при следующем визите в этой вкладке соберётся ещё раз
      }
      options.onState(mode);
    }
  }

  function watchSections() {
    observer = new IntersectionObserver(function (entries) {
      for (const entry of entries) {
        const section = entry.target;
        if (entry.isIntersecting && section.dataset.built !== "1" && !queue.includes(section) && (!run || run.section !== section)) {
          queue.push(section);
          mode = "running";
          options.onState(mode);
          loop();
        }
      }
    }, { rootMargin: "0px 0px -15% 0px", threshold: 0.05 });
    for (const section of sectionElements.slice(1)) {
      observer.observe(section);
    }
  }

  /* Старт с первого экрана; slow — в три раза медленнее (клавиша S) */
  function start(slow) {
    if (mode !== "done" && mode !== "pending") {
      finishAll();
    }
    rate = slow ? SLOW_RATE : 1;
    root.classList.add("assembling");
    window.scrollTo({ top: 0, behavior: "instant" });
    mode = "running";
    options.onState(mode);
    stats.startedAt = performance.now();
    clock = 0;
    lastTime = 0;
    // Секции, которые уже на экране (первый экран и то, что влезло), собираются по очереди
    queue = [sectionElements[0]];
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    // Быстрое двойное R/S: устаревший запуск не должен подключать второй наблюдатель
    const generation = ++startGeneration;
    // Замер — после шрифтов, иначе рамки разойдутся с текстом; ждём не дольше 800 мс
    Promise.race([fonts, new Promise(function (resolve) {
      setTimeout(resolve, 800);
    })]).then(function () {
      if (mode !== "running" || generation !== startGeneration) {
        return;
      }
      watchSections();
      loop();
    });
  }

  // ===== Пропустить: любая клавиша (кроме R и S) или клик мышью =====
  // Прокрутка сборку НЕ прерывает: листаешь — секции собираются по мере появления.
  // Касание пальцем тоже не прерывает: на телефоне это начало прокрутки.
  function interrupt() {
    if (mode !== "done" && mode !== "pending") {
      finishAll();
    }
  }
  window.addEventListener("pointerdown", function (event) {
    // Клик по полосе прокрутки — это прокрутка, а не «пропустить»
    if (event.pointerType === "mouse" && event.clientX < document.documentElement.clientWidth) {
      interrupt();
    }
  }, { passive: true });
  window.addEventListener("keydown", function (event) {
    if ((event.code === "KeyR" || event.code === "KeyS") && !event.ctrlKey && !event.metaKey && !event.altKey) {
      return;
    }
    interrupt();
  });

  return {
    start: start,
    finish: finishAll,
    getMode: function () {
      return mode;
    },
    getRate: function () {
      return rate;
    },
    getStats: function () {
      return { ...stats, crew: crew.length || (options.isMobile() ? 8 : 18) };
    }
  };
}
