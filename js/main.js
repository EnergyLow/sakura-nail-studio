/* =========================================================
   SAKURA • Nail Studio — main.js
   Vanilla JS, ES6+, модульная структура через IIFE
   ========================================================= */
'use strict';

/* ===== 1. UTILS ===== */
const Utils = (() => {
  /** $ и $$ — обёртки над querySelector/querySelectorAll */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /** throttle — ограничивает частоту вызова (по rAF) */
  const throttle = (fn) => {
    let raf = null;
    return (...args) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        fn(...args);
        raf = null;
      });
    };
  };

  /** debounce — откладывает вызов на wait мс */
  const debounce = (fn, wait = 150) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  return { $, $$, throttle, debounce };
})();

/* ===== 2. MOBILE MENU ===== */
(() => {
  const burger  = Utils.$('[data-burger]');
  const menu    = Utils.$('[data-mobile-menu]');
  const overlay = Utils.$('[data-overlay]');
  if (!burger || !menu || !overlay) return;

  const setState = (open) => {
    burger.classList.toggle('is-open', open);
    menu.classList.toggle('is-open', open);
    overlay.hidden = !open;
    requestAnimationFrame(() => overlay.classList.toggle('is-open', open));
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  };

  burger.addEventListener('click', () =>
    setState(!burger.classList.contains('is-open'))
  );
  overlay.addEventListener('click', () => setState(false));
  Utils.$$('a', menu).forEach(a => a.addEventListener('click', () => setState(false)));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') setState(false);
  });
})();

/* ===== 3. SMOOTH SCROLL ===== */
(() => {
  const HEADER_OFFSET = 84;
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href');
    if (!id || id === '#' || id.length < 2) return;

    // ссылки, открывающие модалку, обрабатываются отдельным модулем — пропускаем
    if (link.hasAttribute('data-modal-open')) return;

    const target = document.getElementById(id.slice(1));
    if (!target) return;

    e.preventDefault();
    const y = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top: y, behavior: 'smooth' });
  });
})();

/* ===== 4. HEADER ON SCROLL ===== */
(() => {
  const header = Utils.$('[data-header]');
  const toTop  = Utils.$('[data-to-top]');
  if (!header) return;

  const onScroll = Utils.throttle(() => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 50);
    if (toTop) toTop.classList.toggle('is-visible', y > 600);
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ===== 5. REVEAL ANIMATIONS ===== */
(() => {
  const items = Utils.$$('[data-reveal]');
  if (!items.length || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  items.forEach(el => io.observe(el));
})();

/* ===== 6. SERVICES TABS ===== */
(() => {
  const wrap = Utils.$('[data-tabs]');
  if (!wrap) return;
  const tabs   = Utils.$$('.tab', wrap);
  const panels = Utils.$$('[data-panel]');
  const STORAGE_KEY = 'sakura:activeTab';

  /** activate(name) — активирует панель и таб с совпадающим data-* именем */
  const activate = (name) => {
    tabs.forEach(t => {
      const on = t.dataset.tab === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    });
    panels.forEach(p => {
      const on = p.dataset.panel === name;
      p.classList.toggle('is-active', on);
      if (on) p.removeAttribute('hidden');
      else p.setAttribute('hidden', '');
    });
  };

  tabs.forEach(t => t.addEventListener('click', () => {
    const name = t.dataset.tab;
    activate(name);
    try { localStorage.setItem(STORAGE_KEY, name); } catch (_) {}
  }));

  // восстановление активного таба
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (_) {}
  if (saved && tabs.some(t => t.dataset.tab === saved)) activate(saved);
})();

/* ===== 7. PORTFOLIO FILTERS ===== */
(() => {
  const filtersBox = Utils.$('[data-filters]');
  const gallery    = Utils.$('[data-gallery]');
  if (!filtersBox || !gallery) return;

  const chips = Utils.$$('.chip', filtersBox);
  const items = Utils.$$('.gallery__item', gallery);

  /** applyFilter(name) — скрывает/показывает карточки по data-cat */
  const applyFilter = (name) => {
    items.forEach(item => {
      const match = name === 'all' || item.dataset.cat === name;
      item.classList.toggle('is-hidden', !match);
      item.setAttribute('aria-hidden', String(!match));
    });
  };

  // делегирование клика
  filtersBox.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    chips.forEach(c => c.classList.toggle('is-active', c === chip));
    applyFilter(chip.dataset.filter);
  });
})();

/* ===== 8. LIGHTBOX ===== */
(() => {
  const lb     = Utils.$('[data-lightbox]');
  const lbImg  = Utils.$('[data-lightbox-img]');
  const lbCap  = Utils.$('[data-lightbox-cap]');
  const gallery = Utils.$('[data-gallery]');
  if (!lb || !lbImg || !gallery) return;

  let visible = [];       // список видимых figure
  let index   = 0;
  let lastFocused = null;

  const collect = () =>
    Utils.$$('.gallery__item', gallery).filter(f => !f.classList.contains('is-hidden'));

  const render = () => {
    const fig = visible[index];
    if (!fig) return;
    const img = fig.querySelector('img');
    const cap = fig.querySelector('figcaption');
    lbImg.src = img.src.replace(/w=\d+/, 'w=1400');
    lbImg.alt = img.alt || '';
    lbCap.textContent = cap ? cap.innerText.replace(/\n+/, ' · ') : '';
  };

  const open = (fig) => {
    visible = collect();
    index = Math.max(0, visible.indexOf(fig));
    lastFocused = document.activeElement;
    render();
    lb.hidden = false;
    requestAnimationFrame(() => lb.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    Utils.$('[data-lightbox-close]', lb)?.focus();
  };

  const close = () => {
    lb.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { lb.hidden = true; }, 300);
    if (lastFocused) lastFocused.focus();
  };

  const step = (d) => {
    if (!visible.length) return;
    index = (index + d + visible.length) % visible.length;
    render();
  };

  // делегирование открытия
  gallery.addEventListener('click', (e) => {
    const fig = e.target.closest('.gallery__item');
    if (fig) open(fig);
  });
  gallery.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const fig = e.target.closest('.gallery__item');
    if (!fig) return;
    e.preventDefault();
    open(fig);
  });

  // навигация
  Utils.$('[data-lightbox-close]', lb)?.addEventListener('click', close);
  Utils.$('[data-lightbox-prev]',  lb)?.addEventListener('click', () => step(-1));
  Utils.$('[data-lightbox-next]',  lb)?.addEventListener('click', () => step(1));
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });

  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape')     close();
    if (e.key === 'ArrowLeft')  step(-1);
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'Tab') {
      // простой focus-trap
      const focusables = Utils.$$('button', lb);
      if (!focusables.length) return;
      const first = focusables[0];
      const last  = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
})();

/* ===== 9. REVIEWS SLIDER ===== */
(() => {
  const root  = Utils.$('[data-slider]');
  if (!root) return;
  const track = Utils.$('[data-slider-track]', root);
  const slides = Utils.$$('.review', track);
  const dotsBox = Utils.$('[data-slider-dots]', root);
  const prevBtn = Utils.$('[data-slider-prev]', root);
  const nextBtn = Utils.$('[data-slider-next]', root);
  if (!track || !slides.length) return;

  let index = 0;
  let autoplayId = null;
  const AUTOPLAY = 5000;

  const perView = () => window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1;
  const maxIndex = () => Math.max(0, slides.length - perView());

  const buildDots = () => {
    if (!dotsBox) return;
    dotsBox.innerHTML = '';
    for (let i = 0; i <= maxIndex(); i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Отзыв ${i + 1}`);
      b.addEventListener('click', () => goTo(i));
      dotsBox.appendChild(b);
    }
  };

  const goTo = (i) => {
    index = Math.max(0, Math.min(maxIndex(), i));
    track.style.transform = `translateX(-${index * (100 / perView())}%)`;
    if (dotsBox) Utils.$$('button', dotsBox).forEach((d, k) => d.classList.toggle('is-active', k === index));
  };

  const next = () => goTo(index >= maxIndex() ? 0 : index + 1);
  const prev = () => goTo(index <= 0 ? maxIndex() : index - 1);

  const startAutoplay = () => { stopAutoplay(); autoplayId = setInterval(next, AUTOPLAY); };
  const stopAutoplay  = () => { if (autoplayId) clearInterval(autoplayId); autoplayId = null; };

  prevBtn?.addEventListener('click', () => { goTo(index - 1); startAutoplay(); });
  nextBtn?.addEventListener('click', () => { goTo(index + 1); startAutoplay(); });
  root.addEventListener('mouseenter', stopAutoplay);
  root.addEventListener('mouseleave', startAutoplay);

  // свайпы
  let touchStartX = 0;
  let touchEndX   = 0;
  root.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
  root.addEventListener('touchend',   (e) => {
    touchEndX = e.changedTouches[0].clientX;
    const dx = touchEndX - touchStartX;
    if (Math.abs(dx) < 40) return;
    dx > 0 ? prev() : next();
    startAutoplay();
  });

  // пересчёт при ресайзе
  window.addEventListener('resize', Utils.debounce(() => {
    buildDots();
    goTo(Math.min(index, maxIndex()));
  }, 180));

  buildDots();
  goTo(0);
  startAutoplay();
})();

/* ===== 10. FAQ ACCORDION ===== */
(() => {
  const acc = Utils.$('[data-accordion]');
  if (!acc) return;
  const items = Utils.$$('.faq__item', acc);

  /** close(item) — плавно закрывает элемент */
  const close = (item) => {
    item.classList.remove('is-open');
    const body = Utils.$('.faq__a', item);
    const btn  = Utils.$('.faq__q', item);
    if (body) body.style.maxHeight = '0px';
    btn?.setAttribute('aria-expanded', 'false');
  };

  const open = (item) => {
    item.classList.add('is-open');
    const body = Utils.$('.faq__a', item);
    const btn  = Utils.$('.faq__q', item);
    if (body) body.style.maxHeight = body.scrollHeight + 'px';
    btn?.setAttribute('aria-expanded', 'true');
  };

  acc.addEventListener('click', (e) => {
    const btn = e.target.closest('.faq__q');
    if (!btn) return;
    const item = btn.closest('.faq__item');
    if (!item) return;
    const isOpen = item.classList.contains('is-open');
    items.forEach(close);
    if (!isOpen) open(item);
  });

  // пересчёт высоты при ресайзе
  window.addEventListener('resize', Utils.debounce(() => {
    items.filter(i => i.classList.contains('is-open')).forEach(i => {
      const body = Utils.$('.faq__a', i);
      if (body) body.style.maxHeight = body.scrollHeight + 'px';
    });
  }, 180));
})();

/* ===== 11. BOOKING FORM ===== */
(() => {
  /**
   * URL Edge Function для приёма заявок.
   * Замени project-ref на свой, если он отличается.
   */
  const SUPABASE_FUNCTION_URL = 'https://bkllrdtnzjfesebmbcoa.supabase.co/functions/v1/booking';

  const forms = Utils.$$('[data-booking-form]');
  if (!forms.length) return;

  /** Валидация одного поля, возвращает сообщение об ошибке или '' */
  const validateField = (input) => {
    const v = (input.value || '').trim();
    if (input.name === 'name') {
      if (v.length < 2) return 'Укажите имя (минимум 2 символа)';
    }
    if (input.name === 'phone') {
      const digits = v.replace(/\D/g, '');
      if (digits.length !== 11) return 'Введите телефон полностью';
    }
    if (input.name === 'service' && input.hasAttribute('required') && !v) {
      return 'Выберите услугу';
    }
    if (input.name === 'date' && v) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const chosen = new Date(v);
      if (isNaN(chosen.getTime())) return 'Некорректная дата';
      if (chosen < today) return 'Дата не может быть в прошлом';
    }
    return '';
  };

  /** Показывает ошибку под полем или очищает её */
  const setError = (input, message) => {
    const field = input.closest('.form__field');
    const err = field?.querySelector('.form__error');
    if (!field || !err) return;
    field.classList.toggle('is-invalid', !!message);
    err.textContent = message;
  };

  /** Toast-уведомление */
  const toast = Utils.$('[data-toast]');
  const toastText = Utils.$('[data-toast-text]');
  const showToast = (msg) => {
    if (!toast) return;
    if (toastText) toastText.textContent = msg;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => { toast.hidden = true; }, 400);
    }, 4200);
  };

  forms.forEach(form => {
    // запрет прошедших дат
    const dateInput = Utils.$('input[name="date"]', form);
    if (dateInput) {
      const now = new Date();
      const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      dateInput.min = iso;
    }

    // live-валидация
    Utils.$$('input, select', form).forEach(el => {
      el.addEventListener('blur', () => setError(el, validateField(el)));
      el.addEventListener('input', () => {
        if (el.closest('.form__field')?.classList.contains('is-invalid')) {
          setError(el, validateField(el));
        }
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let firstInvalid = null;

      Utils.$$('input, select', form).forEach(el => {
        const msg = validateField(el);
        setError(el, msg);
        if (msg && !firstInvalid) firstInvalid = el;
      });

      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      const payload = Object.fromEntries(new FormData(form).entries());
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn?.textContent || '';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправляем...';
      }

      try {
        const res = await fetch(SUPABASE_FUNCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(result.error || 'Не удалось отправить заявку');
        }

        showToast('Заявка отправлена! Администратор свяжется с вами.');
        form.reset();

        // сброс даты и времени после reset
        const d = Utils.$('input[name="date"]', form);
        const t = Utils.$('input[name="time"]', form);
        if (d) d.value = '';
        if (t) t.value = '';

        // закрыть модалку, если форма была внутри неё
        const modal = form.closest('[data-modal]');
        if (modal && window.ModalModule) window.ModalModule.closeAll();
      } catch (err) {
        console.error('[SAKURA] Booking error:', err);
        showToast(err.message || 'Ошибка отправки. Позвоните нам.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  });

  // экспортируем showToast глобально для других модулей
  window.SakuraToast = { show: showToast };
})();

/* ===== 12. PHONE MASK ===== */
(() => {
  const inputs = Utils.$$('input[type="tel"]');
  if (!inputs.length) return;

  /** Форматирует строку цифр в +7 (___) ___-__-__ */
  const format = (raw) => {
    let v = (raw || '').replace(/\D/g, '');
    if (!v) return '';
    if (v[0] === '8') v = '7' + v.slice(1);
    if (v[0] !== '7') v = '7' + v;
    v = v.slice(0, 11);

    const p1 = v.slice(1, 4);
    const p2 = v.slice(4, 7);
    const p3 = v.slice(7, 9);
    const p4 = v.slice(9, 11);

    let out = '+7';
    if (p1) out += ' (' + p1;
    if (p1.length === 3) out += ')';
    if (p2) out += ' ' + p2;
    if (p3) out += '-' + p3;
    if (p4) out += '-' + p4;
    return out;
  };

  inputs.forEach(input => {
    input.addEventListener('input', () => { input.value = format(input.value); });
    input.addEventListener('focus', () => { if (!input.value) input.value = '+7 ('; });
    input.addEventListener('blur',  () => {
      if (input.value.replace(/\D/g, '').length <= 1) input.value = '';
    });
  });
})();

/* ===== 13. BACK TO TOP ===== */
(() => {
  const btn = Utils.$('[data-to-top]');
  if (!btn) return;
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

/* ===== 14. FLOATING BOOKING BUTTON ===== */
(() => {
  // Кнопка уже ведёт на #booking, но если на странице есть модалка — открываем её.
  const fab = Utils.$('.fab-book');
  if (!fab) return;
  // ниже — лёгкая пульсация для привлечения внимания
  fab.style.animation = 'pulse 3.6s ease-in-out infinite';
})();

/* ===== 15. MODAL ===== */
(() => {
  const modal = Utils.$('[data-modal]');
  if (!modal) return;

  const openers = Utils.$$('[data-modal-open]');
  const closers = Utils.$$('[data-modal-close]', modal);
  let lastFocused = null;

  const open = () => {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    // фокус на первое поле
    const firstInput = Utils.$('input, select, textarea, button', modal);
    firstInput?.focus();
  };

  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
    lastFocused?.focus();
  };

  openers.forEach(btn => btn.addEventListener('click', (e) => {
    e.preventDefault();
    open();
  }));
  closers.forEach(el => el.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const focusables = Utils.$$('input, select, textarea, button, a[href]', modal)
        .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last  = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // экспорт наружу — для формы
  window.ModalModule = { open, close, closeAll: close };
})();

/* ===== 16. SAKURA PETALS ===== */
(() => {
  const box = Utils.$('[data-petals]');
  if (!box) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const COUNT = 9;
  const rand = (min, max) => Math.random() * (max - min) + min;

  for (let i = 0; i < COUNT; i++) {
    const p = document.createElement('span');
    p.className = 'petal';
    p.style.left = rand(2, 96).toFixed(2) + '%';
    p.style.width  = rand(9, 16).toFixed(1) + 'px';
    p.style.height = p.style.width;
    p.style.animationDuration = rand(12, 22).toFixed(1) + 's';
    p.style.animationDelay    = (-rand(0, 20)).toFixed(1) + 's';
    p.style.opacity = rand(.4, .85).toFixed(2);
    box.appendChild(p);
  }
})();

/* ===== 17. CURRENT YEAR IN FOOTER ===== */
(() => {
  const el = Utils.$('[data-year]');
  if (!el) return;
  el.textContent = String(new Date().getFullYear());
})();

/* ===== 18. BEFORE / AFTER SLIDER ===== */
(() => {
  const ba = Utils.$('[data-ba]');
  if (!ba) return;
  const after  = Utils.$('[data-ba-after]', ba);
  const handle = Utils.$('[data-ba-handle]', ba);
  if (!after || !handle) return;

  const knob = Utils.$('.ba__knob', ba);

  /**
   * Устанавливает положение разделителя.
   * @param {number} clientX — координата курсора/пальца по X
   */
  const setPos = (clientX) => {
    const r = ba.getBoundingClientRect();
    let p = ((clientX - r.left) / r.width) * 100;
    p = Math.max(0, Math.min(100, p));

    after.style.clipPath   = `inset(0 0 0 ${p}%)`;
    handle.style.left      = p + '%';
    if (knob) knob.style.left = p + '%';
  };

  let dragging = false;

  const onDown = (e) => {
    dragging = true;
    ba.classList.add('is-dragging');
    setPos(e.touches ? e.touches[0].clientX : e.clientX);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);
  };

  const onMove = (e) => {
    if (!dragging) return;
    if (e.cancelable) e.preventDefault();
    setPos(e.touches ? e.touches[0].clientX : e.clientX);
  };

  const onUp = () => {
    dragging = false;
    ba.classList.remove('is-dragging');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('touchend', onUp);
    window.removeEventListener('touchcancel', onUp);
  };

  ba.addEventListener('mousedown', onDown);
  ba.addEventListener('touchstart', onDown, { passive: true });

  // Доступность: клавиатура
  ba.setAttribute('tabindex', '0');
  ba.setAttribute('role', 'slider');
  ba.setAttribute('aria-valuemin', '0');
  ba.setAttribute('aria-valuemax', '100');
  ba.setAttribute('aria-valuenow', '50');
  ba.setAttribute('aria-label', 'Сравнение до и после — двигайте влево/вправо');

  ba.addEventListener('keydown', (e) => {
    const current = parseFloat(after.style.clipPath.match(/(\d+(\.\d+)?)%/)?.[1] ?? '50');
    let next = current;
    if (e.key === 'ArrowLeft')  next = Math.max(0,   current - 2);
    if (e.key === 'ArrowRight') next = Math.min(100, current + 2);
    if (e.key === 'Home')       next = 0;
    if (e.key === 'End')        next = 100;
    if (next !== current) {
      e.preventDefault();
      after.style.clipPath = `inset(0 0 0 ${next}%)`;
      handle.style.left    = next + '%';
      if (knob) knob.style.left = next + '%';
      ba.setAttribute('aria-valuenow', String(Math.round(next)));
    }
  });
})();

/* ===== 19. GIFT NOMINALS ===== */
(() => {
  const nominals = Utils.$$('.nominal');
  if (!nominals.length) return;
  nominals.forEach(n => n.addEventListener('click', () => {
    nominals.forEach(x => x.classList.remove('is-active'));
    n.classList.add('is-active');
  }));
})();

/* ===== 20. ACTIVE NAV LINK ===== */
(() => {
  const links = Utils.$$('.nav__link');
  const sections = links
    .map(a => document.getElementById(a.getAttribute('href').slice(1)))
    .filter(Boolean);
  if (!links.length || !sections.length) return;

  const onScroll = Utils.throttle(() => {
    const pos = window.scrollY + 120;
    let current = null;
    sections.forEach(s => { if (s.offsetTop <= pos) current = s.id; });
    links.forEach(a => {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + current);
    });
  });
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();