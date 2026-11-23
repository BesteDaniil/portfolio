/* ==========================================================
   Меню на телефоне: кнопка в шапке раскрывает список «Работы / Цены / Контакты».
   Кнопка — обычный <button>: Enter и пробел работают сами. aria-expanded — открыто ли.
   Закрывается: Esc (фокус возвращается на кнопку), клик или касание мимо меню,
   выбор пункта, уход фокуса из меню (Tab дальше), переход на широкий экран.
   ========================================================== */

export function createMenu(button, panel, wideQuery) {
  if (!button || !panel) {
    return null;
  }
  button.hidden = false;

  function isOpen() {
    return button.getAttribute("aria-expanded") === "true";
  }

  function open() {
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
  }

  function close(returnFocus) {
    if (!isOpen()) {
      return;
    }
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (returnFocus) {
      button.focus();
    }
  }

  button.addEventListener("click", function () {
    if (isOpen()) {
      close(false);
    } else {
      open();
    }
  });

  // Выбрал пункт — меню закрывается, страница едет к разделу
  panel.addEventListener("click", function (event) {
    if (event.target instanceof Element && event.target.closest("a")) {
      close(false);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && isOpen()) {
      close(true);
    }
  });

  // Клик или касание мимо кнопки и меню
  document.addEventListener("pointerdown", function (event) {
    const target = event.target instanceof Node ? event.target : null;
    if (isOpen() && target && !panel.contains(target) && !button.contains(target)) {
      close(false);
    }
  });

  // Tab увёл фокус за пределы меню — закрываем, чтобы список не висел поверх страницы
  // (и Shift+Tab с кнопки назад — тоже)
  function onFocusOut(event) {
    const next = event.relatedTarget;
    if (isOpen() && next instanceof Node && !panel.contains(next) && !button.contains(next)) {
      close(false);
    }
  }
  panel.addEventListener("focusout", onFocusOut);
  button.addEventListener("focusout", onFocusOut);

  if (wideQuery) {
    wideQuery.addEventListener("change", function () {
      if (wideQuery.matches) {
        close(false);
      }
    });
  }

  return { open: open, close: close, isOpen: isOpen };
}
