/* ==========================================================
   Портфолио — интерактив: меню на весь экран, шапка при прокрутке,
   появление блоков, счётчики, подсветка карточек, наклон витрины,
   ссылки кейса Look Star. Чистый JS, без библиотек.
   ========================================================== */

(function () {
  "use strict";

  /* ---- Адрес сайта Look Star — единственное место, которое меняем при привязке домена ---- */
  var LOOKSTAR_URL = "https://bestedaniil.github.io/salon-site/";

  // Ссылки с data-lookstar="путь" получают полный адрес; в HTML у них запасной href на сам кейс
  document.querySelectorAll("[data-lookstar]").forEach(function (link) {
    link.href = LOOKSTAR_URL + link.getAttribute("data-lookstar");
  });

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---- Меню на весь экран ---- */
  var burger = document.getElementById("burger");
  var nav = document.getElementById("nav");
  if (burger && nav) {
    var toggleMenu = function (open) {
      var isOpen = open === undefined ? !nav.classList.contains("open") : open;
      nav.classList.toggle("open", isOpen);
      burger.classList.toggle("open", isOpen);
      burger.setAttribute("aria-expanded", String(isOpen));
      burger.setAttribute("aria-label", isOpen ? "Закрыть меню" : "Открыть меню");
      // Блокировка на html: блок на body ломает липкую шапку
      root.classList.toggle("menu-open", isOpen);
      root.style.overflow = isOpen ? "hidden" : "";
    };
    burger.addEventListener("click", function () {
      toggleMenu();
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        toggleMenu(false);
      });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("open")) {
        toggleMenu(false);
        burger.focus();
      }
    });
    // Повернули телефон или растянули окно до десктопа — меню закрываем
    window.matchMedia("(min-width: 901px)").addEventListener("change", function (event) {
      if (event.matches) {
        toggleMenu(false);
      }
    });
  }

  /* ---- Шапка: фон появляется после начала прокрутки ---- */
  var header = document.querySelector(".header");
  var updateHeader = function () {
    if (header) {
      header.classList.toggle("scrolled", window.scrollY > 10);
    }
  };
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  /* ---- Счётчики в цифрах ---- */
  var countUp = function (element) {
    var target = parseInt(element.getAttribute("data-count"), 10);
    if (reduceMotion || !target) {
      return;
    }
    var start = null;
    var duration = 900;
    var step = function (time) {
      if (start === null) {
        start = time;
      }
      var progress = Math.min((time - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = String(Math.round(target * eased));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    element.textContent = "0";
    requestAnimationFrame(step);
  };

  /* ---- Появление при скролле ---- */
  var reveals = document.querySelectorAll(".reveal");
  var show = function (element) {
    if (element.classList.contains("is-visible")) {
      return;
    }
    element.classList.add("is-visible");
    element.querySelectorAll("[data-count]").forEach(countUp);
  };
  if ("IntersectionObserver" in window && reveals.length) {
    // Запуск заранее (за 15% экрана), чтобы при быстрой прокрутке не было пустоты
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          show(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: "0px 0px 15% 0px" });
    reveals.forEach(function (element) {
      observer.observe(element);
    });
    // Страховка при рывке прокрутки или переходе по якорю
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) {
        return;
      }
      ticking = true;
      requestAnimationFrame(function () {
        reveals.forEach(function (element) {
          if (!element.classList.contains("is-visible") && element.getBoundingClientRect().top < window.innerHeight) {
            show(element);
            observer.unobserve(element);
          }
        });
        ticking = false;
      });
    }, { passive: true });
  } else {
    reveals.forEach(show);
  }

  /* ---- Подсветка карточек за курсором ---- */
  if (finePointer) {
    document.querySelectorAll(".spot").forEach(function (card) {
      card.addEventListener("pointermove", function (event) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", (event.clientX - rect.left) + "px");
        card.style.setProperty("--my", (event.clientY - rect.top) + "px");
      });
    });
  }

  /* ---- Наклон витрины за курсором ---- */
  var showcase = document.getElementById("showcase");
  if (showcase && finePointer && !reduceMotion) {
    var stage = showcase.querySelector(".showcase__stage");
    var hero = document.getElementById("hero");
    hero.addEventListener("pointermove", function (event) {
      var rect = hero.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width - 0.5;
      var y = (event.clientY - rect.top) / rect.height - 0.5;
      stage.style.setProperty("--tilt-y", (-10 + x * 12).toFixed(2) + "deg");
      stage.style.setProperty("--tilt-x", (6 - y * 8).toFixed(2) + "deg");
    });
    hero.addEventListener("pointerleave", function () {
      stage.style.removeProperty("--tilt-y");
      stage.style.removeProperty("--tilt-x");
    });
  }
})();
