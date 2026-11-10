/* =========================================================
   Окно чата с помощником. Ответы даёт js/chat-brain.js,
   здесь — только отрисовка: сообщения, «печатает…», кнопки
   быстрых ответов и карточка «сообщение юристу».
   Текст выводится через textContent и созданные узлы —
   то, что пишет посетитель, никогда не попадает в HTML.
   ========================================================= */
(function () {
  'use strict';

  const chat = document.getElementById('chat');
  if (!chat || !window.ChatBrain) return;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const kit = window.SiteKit || {};
  const log = $('#chatLog');
  const quickBox = $('#chatQuick');
  const form = $('#chatForm');
  const input = $('#chatInput');
  const statusEl = $('#chatStatus');
  const fab = $('#fab');
  const fabBtn = $('#fabBtn');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = !kit.fine;
  const KEY = 'bankrot-chat-v1';

  /* ---------- Переписка живёт, пока открыта вкладка ---------- */
  function load() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function save() {
    try { sessionStorage.setItem(KEY, JSON.stringify({ history, state: bot.state })); } catch (e) { /* приватный режим — просто не сохраняем */ }
  }
  const saved = load();
  const history = saved && Array.isArray(saved.history) ? saved.history : [];
  const bot = window.ChatBrain.create(saved && saved.state ? { state: saved.state } : {});
  let busy = false;

  /* ---------- Текст бота: абзацы, списки «• », **жирный**, телефоны ---------- */
  function inline(el, s) {
    const re = /\*\*(.+?)\*\*|(\+7 \d{3} \d{3}-\d{2}-\d{2})/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) el.append(s.slice(last, m.index));
      if (m[1]) {
        const b = document.createElement('b');
        inline(b, m[1]);
        el.append(b);
      } else {
        const a = document.createElement('a');
        a.href = 'tel:' + m[2].replace(/[^\d+]/g, '');
        a.textContent = m[2];
        el.append(a);
      }
      last = re.lastIndex;
    }
    if (last < s.length) el.append(s.slice(last));
  }
  function rich(el, text) {
    let ul = null;
    text.split('\n').forEach((line) => {
      if (line.startsWith('• ')) {
        if (!ul) { ul = document.createElement('ul'); el.append(ul); }
        const li = document.createElement('li');
        inline(li, line.slice(2));
        ul.append(li);
        return;
      }
      ul = null;
      if (!line.trim()) return;
      const p = document.createElement('p');
      inline(p, line);
      el.append(p);
    });
  }

  /* ---------- Карточка «сообщение юристу» ---------- */
  function svgUse(id) {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS(ns, 'use');
    u.setAttribute('href', '#' + id);
    s.append(u);
    return s;
  }
  function cardEl(message) {
    const phone = (kit.contacts && kit.contacts.phone) || '+79009736005';
    const box = document.createElement('div');
    box.className = 'chat__card';
    const label = document.createElement('p');
    label.className = 'chat__card-label';
    label.textContent = 'Сообщение юристу';
    const pre = document.createElement('div');
    pre.className = 'chat__card-text';
    pre.textContent = message;
    const row = document.createElement('div');
    row.className = 'chat__card-btns';

    const copy = () => (kit.copySync && kit.copySync(message)) || (kit.copyText && kit.copyText(message));

    const max = document.createElement('a');
    max.className = 'chat__btn chat__btn--max';
    max.href = (kit.contacts && kit.contacts.maxProfile) || 'https://max.ru/';
    max.target = '_blank';
    max.rel = 'noopener';
    max.append(svgUse('i-max'), 'МАКС');
    max.addEventListener('click', (e) => {
      copy();
      if (!(kit.contacts && kit.contacts.maxProfile) && kit.openMaxModal && kit.openMaxModal(true)) e.preventDefault();
      else if (kit.say) kit.say('Текст скопирован — вставьте его в чат');
    });

    const vk = document.createElement('a');
    vk.className = 'chat__btn chat__btn--vk';
    vk.href = 'https://vk.ru/koksana22';
    vk.target = '_blank';
    vk.rel = 'noopener';
    vk.append(svgUse('i-vk'), 'ВКонтакте');
    vk.addEventListener('click', () => { copy(); if (kit.say) kit.say('Текст скопирован — вставьте его в сообщение'); });

    row.append(max, vk);

    if (touch) {
      const sms = document.createElement('a');
      sms.className = 'chat__btn chat__btn--sms';
      sms.href = 'sms:' + phone + '?body=' + encodeURIComponent(message);
      sms.append(svgUse('i-chat'), 'SMS');
      row.append(sms);
    }
    const cp = document.createElement('button');
    cp.type = 'button';
    cp.className = 'chat__btn chat__btn--copy';
    cp.append(svgUse('i-copy'), 'Скопировать');
    cp.addEventListener('click', async () => {
      const ok = kit.copyText ? await kit.copyText(message) : false;
      if (kit.say) kit.say(ok ? 'Сообщение скопировано' : 'Не получилось скопировать — выделите текст вручную');
    });
    row.append(cp);

    box.append(label, pre, row);
    return box;
  }

  /* ---------- Сообщения ---------- */
  function bubble(m, animate) {
    const wrap = document.createElement('div');
    wrap.className = 'chat__msg chat__msg--' + (m.from === 'me' ? 'me' : 'bot') + (animate && !reduce ? ' is-new' : '');
    const b = document.createElement('div');
    b.className = 'chat__bubble';
    if (m.from === 'me') b.textContent = m.text;
    else rich(b, m.text);
    wrap.append(b);
    if (m.card) wrap.append(cardEl(m.card.message));
    log.append(wrap);
  }
  function scrollDown() {
    log.scrollTop = log.scrollHeight;
  }
  function setQuick(list) {
    quickBox.textContent = '';
    (list || []).forEach((q) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chat__chip';
      btn.textContent = q;
      btn.addEventListener('click', () => send(q));
      quickBox.append(btn);
    });
    quickBox.hidden = !(list && list.length);
  }
  function typing(on) {
    let t = $('.chat__typing', log);
    if (on && !t) {
      t = document.createElement('div');
      t.className = 'chat__msg chat__msg--bot chat__typing';
      t.setAttribute('aria-label', 'Помощник печатает');
      const b = document.createElement('div');
      b.className = 'chat__bubble';
      for (let i = 0; i < 3; i++) b.append(document.createElement('i'));
      t.append(b);
      log.append(t);
      scrollDown();
    } else if (!on && t) t.remove();
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function botSay(list) {
    for (const m of list) {
      typing(true);
      await wait(reduce ? 150 : Math.min(1400, 380 + m.text.length * 4));
      typing(false);
      const rec = { from: 'bot', text: m.text, quick: m.quick || [], card: m.card || null };
      history.push(rec);
      bubble(rec, true);
      setQuick(rec.quick);
      scrollDown();
    }
    save();
  }

  async function send(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    busy = true;
    setQuick([]);
    const rec = { from: 'me', text };
    history.push(rec);
    bubble(rec, true);
    scrollDown();
    save();
    try { await botSay(bot.reply(text)); } finally { busy = false; }
  }

  /* ---------- Строка состояния: часы приёма ---------- */
  function status() {
    const w = bot.work();
    statusEl.textContent = w.open ? 'Отвечает сразу · юристы на связи до ' + window.ChatBrain.CFG.workEnd + ':00' : 'Отвечает сразу · юрист — ' + w.next;
    statusEl.classList.toggle('is-off', !w.open);
  }

  /* ---------- Открыть / закрыть ---------- */
  let started = false;
  let lastFocus = null;
  function open() {
    if (!chat.hidden) return;
    lastFocus = document.activeElement;
    status();
    chat.hidden = false;
    document.documentElement.classList.add('chat-open');
    if (fab) fab.classList.add('is-chat');
    if (fabBtn) fabBtn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => chat.classList.add('is-open'));
    if (!started) {
      started = true;
      if (history.length) {
        history.forEach((m) => bubble(m, false));
        const lastBot = history.slice().reverse().find((m) => m.from === 'bot');
        setQuick(lastBot ? lastBot.quick : []);
        scrollDown();
      } else {
        botSay(bot.start());
      }
    }
    requestAnimationFrame(scrollDown);     // при повторном открытии — к последнему сообщению
    if (!touch) setTimeout(() => input.focus(), 50);
  }
  function close() {
    if (chat.hidden) return;
    chat.classList.remove('is-open');
    document.documentElement.classList.remove('chat-open');
    if (fab) fab.classList.remove('is-chat');
    if (fabBtn) fabBtn.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (!chat.classList.contains('is-open')) chat.hidden = true; }, reduce ? 0 : 250);
    if (lastFocus && lastFocus.focus && !touch) lastFocus.focus();
  }
  const toggle = () => (chat.hidden ? open() : close());

  $('#chatClose').addEventListener('click', close);
  $$('[data-chat-open]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); open(); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !chat.hidden && !document.querySelector('dialog[open]')) close(); });

  /* ---------- Ввод ---------- */
  function grow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }
  input.addEventListener('input', grow);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = input.value;
    if (!t.trim() || busy) return;
    input.value = '';
    grow();
    send(t);
  });

  window.ChatUI = { open, close, toggle, send };
})();
