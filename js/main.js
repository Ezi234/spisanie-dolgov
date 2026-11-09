/* =========================================================
   «Чистый лист» — сценарии страницы.
   Без библиотек. Стили меняются только через CSSOM
   (classList и style.setProperty) — так их не блокирует CSP.
   ========================================================= */

/* ---------- НАСТРОЙКИ КОНТАКТОВ ----------
   maxProfile — ссылка на ваш профиль в МАКС вида https://max.ru/u/xxxxxxxx.
   Где взять: приложение МАКС → Профиль → значок QR-кода → «Поделиться ссылкой».
   Пока поле пустое, значок МАКС открывает окно с номером телефона. */
const CONTACTS = {
  phone: '+79009736005',
  phoneText: '+7 900 973-60-05',
  maxProfile: ''
};

(function () {
  'use strict';

  const root = document.documentElement;
  root.classList.add('js');

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (n) => Math.round(n).toLocaleString('ru-RU');

  /* ---------- Шапка, прогресс, кнопка «наверх» ---------- */
  const header = $('#header');
  const bar = $('#progressBar');
  const totop = $('#totop');
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    header.classList.toggle('is-scrolled', y > 8);
    bar.style.setProperty('transform', 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')');
    totop.classList.toggle('is-shown', y > 900);
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();
  totop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

  /* ---------- Мобильное меню ---------- */
  const burger = $('#burger');
  const nav = $('#nav');
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  }
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  $$('a', nav).forEach((a) => a.addEventListener('click', () => setMenu(false)));

  /* Подсветка текущего раздела в меню */
  const navLinks = $$('a[href^="#"]', nav);
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- Появление блоков при прокрутке ---------- */
  const reveals = $$('.reveal');
  // Соседние карточки появляются лесенкой
  reveals.forEach((el) => {
    const sibs = Array.from(el.parentElement.children).filter((c) => c.classList.contains('reveal'));
    const i = sibs.indexOf(el);
    if (i > 0) el.style.setProperty('--d', Math.min(i * 0.08, 0.48) + 's');
  });
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- Счётчики в цифрах ---------- */
  const counters = $$('[data-count]');
  function runCounter(el) {
    const to = Number(el.dataset.count);
    if (!to || reduceMotion) { el.textContent = fmt(to); return; }
    const dur = 1400;
    const t0 = performance.now();
    (function step(t) {
      const p = Math.min((t - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(to * eased);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  if ('IntersectionObserver' in window) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { runCounter(e.target); co.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => { if (Number(c.dataset.count)) c.textContent = '0'; co.observe(c); });
  }

  /* ---------- Живая карточка долгов на первом экране ----------
     Долги по очереди зачёркиваются, сумма тает до нуля,
     в конце ставится штамп «Долги списаны». Потом всё сначала. */
  const debt = $('#debt');
  const debtSum = $('#debtSum');
  const debtBar = $('#debtBar');
  const debtStatus = $('#debtStatus');
  const rows = $$('.debt__row', debt);
  const total = rows.reduce((s, r) => s + Number(r.dataset.amount), 0);
  let heroVisible = true;
  let wakeHero = null;

  function setSum(v) { debtSum.textContent = fmt(v); }
  function setBar(p) { debtBar.style.setProperty('transform', 'scaleX(' + p + ')'); }

  function tween(from, to, dur) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      (function step(t) {
        const p = Math.min((t - t0) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);
        setSum(from + (to - from) * e);
        if (p < 1) requestAnimationFrame(step); else resolve();
      })(t0);
    });
  }

  async function waitVisible() {
    while (!heroVisible || document.hidden) {
      await new Promise((r) => { wakeHero = r; setTimeout(r, 1500); });
    }
  }

  function heroFinal() {
    rows.forEach((r) => r.classList.add('is-off'));
    setSum(0); setBar(1);
    debt.classList.add('is-done');
    debtStatus.textContent = 'Процедура завершена';
  }

  async function heroLoop() {
    for (;;) {
      rows.forEach((r) => r.classList.remove('is-off'));
      debt.classList.remove('is-done');
      debtStatus.textContent = 'Идёт процедура';
      setSum(total); setBar(0);
      await sleep(1400);
      let left = total;
      for (const r of rows) {
        await waitVisible();
        const next = left - Number(r.dataset.amount);
        r.classList.add('is-off');
        setBar((total - next) / total);
        await tween(left, next, 750);
        left = next;
        await sleep(520);
      }
      debt.classList.add('is-done');
      debtStatus.textContent = 'Процедура завершена';
      await sleep(4200);
      await waitVisible();
    }
  }

  if (debt) {
    if (reduceMotion) {
      heroFinal();
    } else {
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
          heroVisible = entries[0].isIntersecting;
          if (heroVisible && wakeHero) wakeHero();
        }).observe(debt);
      }
      heroLoop();
    }
  }

  /* Лёгкий 3D-наклон карточки за курсором */
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const heroVisual = $('#heroVisual');
  if (fine && heroVisual && !reduceMotion) {
    heroVisual.addEventListener('pointermove', (e) => {
      const r = heroVisual.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      debt.style.setProperty('--ry', (x * 16).toFixed(2) + 'deg');
      debt.style.setProperty('--rx', (-y * 12).toFixed(2) + 'deg');
    });
    heroVisual.addEventListener('pointerleave', () => {
      debt.style.removeProperty('--ry');
      debt.style.removeProperty('--rx');
    });
  }

  /* Наклон карточек «какие долги» */
  if (fine && !reduceMotion) {
    $$('.debt-card').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (-y * 10).toFixed(2) + 'deg');
      });
      card.addEventListener('pointerleave', () => {
        card.style.removeProperty('--ry');
        card.style.removeProperty('--rx');
      });
    });
  }

  /* ---------- Вкладки ---------- */
  $$('[data-tabs]').forEach((box) => {
    const list = $('[role="tablist"]', box);
    const btns = $$('[role="tab"]', list);
    const ink = $('.tabs__ink', list);

    function moveInk() {
      const a = btns.find((b) => b.classList.contains('is-active'));
      if (!a || !ink) return;
      ink.style.setProperty('--x', a.offsetLeft + 'px');
      ink.style.setProperty('--w', a.offsetWidth + 'px');
    }
    function select(btn, focus) {
      btns.forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(b.getAttribute('aria-controls'));
        if (panel) { panel.hidden = !on; panel.classList.toggle('is-active', on); }
      });
      if (focus) btn.focus();
      moveInk();
    }
    btns.forEach((b, i) => {
      b.addEventListener('click', () => select(b));
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const n = btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length];
        select(n, true);
      });
    });
    moveInk();
    window.addEventListener('resize', moveInk);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveInk);
  });

  /* ---------- Вопросы и ответы ---------- */
  const faqItems = $$('.faq__item');
  faqItems.forEach((item) => {
    const q = $('.faq__q', item);
    q.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      faqItems.forEach((o) => {
        if (o !== item && o.classList.contains('is-open')) {
          o.classList.remove('is-open');
          $('.faq__q', o).setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.toggle('is-open', open);
      q.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------- Тест «Подходит ли банкротство» ---------- */
  const quiz = $('#quizBox');
  if (quiz) {
    const steps = $$('.quiz__step', quiz);
    const qBar = $('#quizBar');
    const qCount = $('#quizCount');
    const qBack = $('#quizBack');
    const result = $('#quizResult');
    const answers = {};
    let cur = 1;
    let busy = false;

    function show(n) {
      cur = n;
      steps.forEach((s) => {
        const on = Number(s.dataset.step) === n;
        s.hidden = !on;
        s.classList.toggle('is-active', on);
      });
      result.hidden = true;
      qBar.style.setProperty('transform', 'scaleX(' + (n / 4) + ')');
      qCount.textContent = 'Вопрос ' + n + ' из 4';
      qBack.hidden = n === 1;
    }

    function verdict(a) {
      const out = { title: '', text: '', note: '' };
      const closed = a.fssp === 'yes';
      if (a.sum === 'a') {
        out.title = 'Банкротство, скорее всего, не понадобится';
        out.text = 'При долге до 25 000 ₽ процедура обычно невыгодна. Подскажем, как договориться с кредиторами об отсрочке или реструктуризации.';
      } else if ((a.sum === 'b' || a.sum === 'c') && closed) {
        out.title = 'Вам может подойти бесплатное банкротство через МФЦ';
        out.text = 'Долг до 1 000 000 ₽ и закрытое приставами производство — главные условия внесудебной процедуры. Поможем собрать полный список кредиторов и подать заявление без ошибок.';
      } else if (a.sum === 'd') {
        out.title = 'Вам подходит судебное банкротство';
        out.text = 'При долге больше 1 000 000 ₽ списать его можно только через Арбитражный суд. Обычно это занимает 6–9 месяцев, и всё это время дело ведёт юрист.';
      } else if (a.sum === 'c') {
        out.title = 'Вам подходит судебное банкротство';
        out.text = a.late === 'long'
          ? 'При долге от 500 000 ₽ и просрочке больше 3 месяцев закон прямо обязывает подать на банкротство. Подготовим заявление и проведём процедуру под ключ.'
          : 'Если платить уже нечем, подать заявление можно, не дожидаясь просрочки в 3 месяца. Подготовим документы и проведём процедуру под ключ.';
      } else {
        out.title = 'Подойдёт судебная процедура, а возможно — и МФЦ';
        out.text = 'Судебное банкротство доступно и при такой сумме, если платить уже нечем. А если приставы закроют производство из-за отсутствия имущества, откроется бесплатный путь через МФЦ — проверим это вместе.';
      }
      if (a.sum !== 'a') {
        if (a.prop === 'car') out.note = 'Автомобиль могут продать на торгах в ходе процедуры. Заранее оценим риски именно в вашей ситуации.';
        if (a.prop === 'estate') out.note = 'Недвижимость, кроме единственного жилья, могут продать на торгах. Заранее оценим риски для вашего имущества.';
      }
      return out;
    }

    function finish() {
      const v = verdict(answers);
      steps.forEach((s) => { s.hidden = true; s.classList.remove('is-active'); });
      $('#quizTitle').textContent = v.title;
      $('#quizText').textContent = v.text;
      const note = $('#quizNote');
      note.textContent = v.note;
      note.hidden = !v.note;
      result.hidden = false;
      qBar.style.setProperty('transform', 'scaleX(1)');
      qCount.textContent = 'Готово — ваш результат';
      qBack.hidden = true;
    }

    $$('.opt', quiz).forEach((btn) => {
      btn.addEventListener('click', () => {
        if (busy) return;
        busy = true;
        const group = btn.closest('.quiz__step');
        $$('.opt', group).forEach((o) => o.classList.toggle('is-picked', o === btn));
        answers[btn.dataset.q] = btn.dataset.v;
        setTimeout(() => {
          busy = false;
          if (cur < 4) show(cur + 1); else finish();
        }, reduceMotion ? 0 : 320);
      });
    });
    qBack.addEventListener('click', () => { if (cur > 1) show(cur - 1); });
    $('#quizRestart').addEventListener('click', () => {
      Object.keys(answers).forEach((k) => delete answers[k]);
      $$('.opt', quiz).forEach((o) => o.classList.remove('is-picked'));
      show(1);
    });
  }

  /* ---------- Шаги работы загораются по очереди ---------- */
  const tItems = $$('.timeline__item');
  if ('IntersectionObserver' in window) {
    const to = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const i = tItems.indexOf(e.target);
        setTimeout(() => e.target.classList.add('is-lit'), reduceMotion ? 0 : 250 + (i % 3) * 180);
        to.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    tItems.forEach((t) => to.observe(t));
  } else {
    tItems.forEach((t) => t.classList.add('is-lit'));
  }

  /* ---------- Плавающая кнопка связи ---------- */
  const fab = $('#fab');
  const fabBtn = $('#fabBtn');
  const fabHint = $('#fabHint');
  function setFab(open) {
    fab.classList.toggle('is-open', open);
    fabBtn.setAttribute('aria-expanded', String(open));
    if (open) fabHint.classList.remove('is-shown');
  }
  fabBtn.addEventListener('click', (e) => { e.stopPropagation(); setFab(!fab.classList.contains('is-open')); });
  document.addEventListener('click', (e) => { if (!fab.contains(e.target)) setFab(false); });
  setTimeout(() => {
    if (!fab.classList.contains('is-open')) fabHint.classList.add('is-shown');
    setTimeout(() => fabHint.classList.remove('is-shown'), 6000);
  }, 5000);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    setFab(false);
    setMenu(false);
  });

  /* ---------- МАКС: ссылка на профиль или окно с номером ---------- */
  const maxLinks = $$('[data-contact="max"]');
  const modal = $('#maxModal');
  const toast = $('#toast');
  let toastTimer = 0;

  function say(text) {
    toast.textContent = text;
    toast.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-shown'), 2600);
  }

  if (CONTACTS.maxProfile) {
    maxLinks.forEach((a) => a.setAttribute('href', CONTACTS.maxProfile));
  } else if (modal && typeof modal.showModal === 'function') {
    maxLinks.forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      setFab(false);
      modal.showModal();
    }));
    $$('[data-close]', modal).forEach((b) => b.addEventListener('click', () => modal.close()));
    // Нажатие по затемнению вокруг окна закрывает его
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
    // На телефоне МАКС — приложение, на компьютере удобнее веб-версия
    if (!fine) $('#openMax').setAttribute('href', 'https://max.ru/');
  }

  async function copyPhone() {
    const text = CONTACTS.phone;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      const t = document.createElement('textarea');
      t.value = text;
      t.setAttribute('readonly', '');
      t.className = 'sprite';
      document.body.appendChild(t);
      t.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      t.remove();
      return ok;
    }
  }
  const copyBtn = $('#copyPhone');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const ok = await copyPhone();
      $('span', copyBtn).textContent = ok ? 'Номер скопирован' : CONTACTS.phoneText;
      say(ok ? 'Номер скопирован — вставьте его в поиск МАКС' : 'Скопируйте номер вручную: ' + CONTACTS.phoneText);
      setTimeout(() => { $('span', copyBtn).textContent = 'Скопировать номер'; }, 2600);
    });
  }

  /* ---------- Год в подвале ---------- */
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
