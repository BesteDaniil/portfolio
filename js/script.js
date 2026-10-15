/* ==========================================================
   Портфолио — интерактив: мобильное меню + появление при скролле
   Чистый JS, без библиотек.
   ========================================================== */

(function () {
  'use strict';

  /* ---- Мобильное меню ---- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
  if (burger && nav) {
    var toggle = function (open) {
      var isOpen = open === undefined ? !nav.classList.contains('open') : open;
      nav.classList.toggle('open', isOpen);
      burger.classList.toggle('open', isOpen);
      burger.setAttribute('aria-expanded', String(isOpen));
      document.documentElement.style.overflow = isOpen ? 'hidden' : '';  // на html: блок на body ломает липкую шапку
    };
    burger.addEventListener('click', function () { toggle(); });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { toggle(false); });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggle(false); });
  }

  /* ---- Появление при скролле ---- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var show = function (el) { el.classList.add('is-visible'); io.unobserve(el); };
    // Запуск заранее (за 15% экрана), чтобы при быстрой прокрутке не было пустоты
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) show(en.target); });
    }, { threshold: 0, rootMargin: '0px 0px 15% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
    // Страховка при рывке прокрутки или переходе по якорю
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        reveals.forEach(function (el) {
          if (!el.classList.contains('is-visible') && el.getBoundingClientRect().top < window.innerHeight) show(el);
        });
        ticking = false;
      });
    }, { passive: true });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }
})();
