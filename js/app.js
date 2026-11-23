/* ==========================================================
   Точка входа: подпись «Страницу собрали N курсоров», рой, сборка, клавиши R и S.
   ========================================================== */

import { createAssembly } from "./assemble.js";
import { createSwarm } from "./swarm.js";
import { createMenu } from "./menu.js";

const mobileQuery = window.matchMedia("(max-width: 700px)");
const stillQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function isMobile() {
  return mobileQuery.matches;
}

/* Подпись внизу: на телефоне страницу собирают 8 курсоров, на ПК — 18 */
const caption = document.getElementById("buildCaption");
function updateCaption() {
  if (caption) {
    caption.textContent = caption.textContent.replace(/\d+/, String(isMobile() ? 8 : 18));
  }
}
updateCaption();
mobileQuery.addEventListener("change", updateCaption);

// Меню на телефоне; с 720 px видны обычные пункты в шапке
const menu = createMenu(
  document.getElementById("menuButton"),
  document.getElementById("mobileMenu"),
  window.matchMedia("(min-width: 720px)")
);

const canvas = document.getElementById("swarmCanvas");
const swarm = canvas && canvas.getContext ? createSwarm(canvas, { still: stillQuery.matches }) : null;

const crew = document.getElementById("crew");
const assembly = createAssembly({
  crew: crew,
  isMobile: isMobile,
  onState: function (mode) {
    document.documentElement.dataset.assembly = mode;
  }
});

if (document.documentElement.classList.contains("assembling")) {
  assembly.start(false);
} else {
  document.documentElement.dataset.assembly = "done";
}

// R — собрать ещё раз, S — собрать медленно (по коду клавиши: работает и в русской раскладке)
window.addEventListener("keydown", function (event) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
    return;
  }
  const target = event.target instanceof Element ? event.target : null;
  if (target && target.closest("input, textarea, select, [contenteditable]")) {
    return;
  }
  if (event.code === "KeyR") {
    assembly.start(false);
  } else if (event.code === "KeyS") {
    assembly.start(true);
  }
});

// Для проверок (Playwright): состояние сборки и роя
window.__portfolio = {
  assembly: assembly,
  swarm: swarm,
  menu: menu
};
