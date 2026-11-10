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
  // Ссылки — только https и только на официальные сайты из ответов (ссылки из чужого текста не делаем)
  const SAFE_HOST = /^(?:[a-z0-9-]+\.)*(fssp\.gov\.ru|gosuslugi\.ru|nbki\.ru|bki-okb\.ru|nalog\.ru|sudrf\.ru|arbitr\.ru|fedresurs\.ru|cbr\.ru|vk\.ru|max\.ru)$/i;
  function inline(el, s, fromUser) {
    const re = /\*\*(.+?)\*\*|(\+7 \d{3} \d{3}-\d{2}-\d{2})|(https:\/\/[^\s)]+[^\s).,;:!?»])/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) el.append(s.slice(last, m.index));
      if (m[1]) {
        const b = document.createElement('b');
        inline(b, m[1], fromUser);
        el.append(b);
      } else if (m[2]) {
        const a = document.createElement('a');
        a.href = 'tel:' + m[2].replace(/[^\d+]/g, '');
        a.textContent = m[2];
        el.append(a);
      } else {
        let host = '';
        try { host = new URL(m[3]).hostname; } catch (e) { host = ''; }
        if (!fromUser && SAFE_HOST.test(host)) {
          const a = document.createElement('a');
          a.href = m[3];
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.className = 'chat__link';
          a.textContent = m[3].replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '');
          el.append(a);
        } else {
          el.append(m[3]);
        }
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

  async function botSay(list, instant) {
    for (const m of list) {
      typing(true);
      await wait(instant || reduce ? 120 : Math.min(1400, 380 + m.text.length * 4));
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
    try {
      // Сначала отвечает свой «мозг»: кнопки, сценарии, передача юристу — это быстро и бесплатно.
      // Вопросы своими словами уходят ИИ; если он молчит — показываем ответ из базы.
      const local = bot.reply(text);
      if (aiOn() && wantsAi(local, text)) {
        typing(true);
        const ai = await askAi();
        typing(false);
        if (ai) {
          bot.noteAi();
          await botSay([{ text: ai, quick: aiQuick(local) }], true);
          return;
        }
      }
      await botSay(local);
    } finally { busy = false; }
  }

  /* ---------- ИИ (YandexGPT через облачную функцию) ----------
     Адрес функции — ChatBrain.CFG.aiEndpoint. Пока он пустой, чат работает без ИИ. */
  const CFG = window.ChatBrain.CFG;
  let aiFails = 0;
  const aiOn = () => !!CFG.aiEndpoint && aiFails < 3;
  function wantsAi(local, text) {
    const m = local[local.length - 1] || {};
    if (local.some((x) => x.card)) return false;
    if (m.kind === 'kb' || m.kind === 'miss' || m.kind === 'offtopic') return true;
    if (m.kind === 'route') return text.length > 60;     // длинное описание ситуации — ИИ разберёт лучше
    return false;                                         // кнопки, сценарии, привет/спасибо — сами
  }
  function aiQuick(local) {
    const m = local[local.length - 1] || {};
    const lawyer = 'Задать вопрос юристу';
    const list = m.kind === 'kb' ? (m.quick || []).filter((q) => !/^(да|нет)/i.test(q)).slice(0, 2) : [];
    if (list.indexOf(lawyer) < 0) list.push(lawyer);
    return list;
  }
  async function askAi() {
    const messages = history
      .filter((m) => m.text)
      .slice(-10)
      .map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', text: m.text.replace(/\*\*/g, '').slice(0, 1200) }));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    try {
      // text/plain — «простой» запрос: браузер не делает лишний предварительный запрос OPTIONS
      const res = await fetch(CFG.aiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ messages }),
        credentials: 'omit',
        signal: ctrl.signal
      });
      if (res.status === 429) { aiFails = 3; return null; }   // лимит — до конца визита отвечает база
      if (!res.ok) { aiFails++; return null; }
      const data = await res.json();
      const t = String((data && data.text) || '').replace(/^\s*[-*]\s+/gm, '• ').trim();
      if (!t) { aiFails++; return null; }
      aiFails = 0;
      return t.slice(0, 2500);
    } catch (e) {
      aiFails++;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  const foot = $('.chat__foot', chat);
  if (CFG.aiEndpoint && foot) foot.textContent = 'Отвечает ИИ-помощник — он может ошибаться. Вашу ситуацию юрист разберёт бесплатно. Не пишите в чат паспортные данные.';

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
