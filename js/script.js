/* ==========================================================
   Портфолио — интерактив: мобильное меню, появление при скролле,
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

  /* ---- Мобильное меню ---- */
  var burger = document.getElementById("burger");
  var nav = document.getElementById("nav");
  if (burger && nav) {
    var toggleMenu = function (open) {
      var isOpen = open === undefined ? !nav.classList.contains("open") : open;
      nav.classList.toggle("open", isOpen);
      burger.classList.toggle("open", isOpen);
      burger.setAttribute("aria-expanded", String(isOpen));
      // Блокировка на html: блок на body ломает липкую шапку
      document.documentElement.style.overflow = isOpen ? "hidden" : "";
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
      if (event.key === "Escape") {
        toggleMenu(false);
      }
    });
  }

  /* ---- Появление при скролле ---- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var observer = null;
    var show = function (element) {
      element.classList.add("is-visible");
      observer.unobserve(element);
    };
    // Запуск заранее (за 15% экрана), чтобы при быстрой прокрутке не было пустоты
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          show(entry.target);
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
          }
        });
        ticking = false;
      });
    }, { passive: true });
  } else {
    reveals.forEach(function (element) {
      element.classList.add("is-visible");
    });
  }
})();
