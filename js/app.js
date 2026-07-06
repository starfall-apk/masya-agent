/* =====================================================================
 * Masya Agent — логика сайта.
 * Лендинг + чат с SSE-стримингом токенов из Hugging Face Space.
 * Ссылка на Space задаётся ОДИН раз в js/config.js (HF_SPACE_URL).
 * ===================================================================== */
"use strict";

(function () {
  var CFG = window.MASYA_CONFIG;
  var API = CFG.HF_SPACE_URL.replace(/\/+$/, "");

  // ---------------- тема ----------------
  var themeBtn = document.getElementById("theme-btn");
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("masya-theme", t); } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#0d0c0a" : "#f5f1e9");
  }
  (function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem("masya-theme"); } catch (e) {}
    if (saved === "dark" || saved === "light") { applyTheme(saved); return; }
    var prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    applyTheme(prefersLight ? "light" : "dark");
  })();
  themeBtn.addEventListener("click", function () {
    var cur = document.documentElement.getAttribute("data-theme");
    applyTheme(cur === "dark" ? "light" : "dark");
  });

  // ---------------- reveal-анимации ----------------
  (function initReveal() {
    var els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el, i) {
      el.style.setProperty("--reveal-delay", (Math.min(i % 4, 3) * 0.08) + "s");
      io.observe(el);
    });
  })();

  // ---------------- статус сервера ----------------
  var serverOnline = false;
  var dots = [document.getElementById("server-dot"), document.getElementById("server-dot-2")];
  var serverLabel = document.getElementById("server-label");

  function setServerState(state, label) {
    dots.forEach(function (d) {
      if (!d) return;
      d.classList.remove("online", "offline");
      if (state) d.classList.add(state);
    });
    if (serverLabel) serverLabel.textContent = label;
  }

  function checkHealth() {
    var ctrl = new AbortController();
    var to = setTimeout(function () { ctrl.abort(); }, 8000);
    fetch(API + CFG.endpoints.health, { signal: ctrl.signal })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function () {
        serverOnline = true;
        setServerState("online", "модели онлайн");
      })
      .catch(function () {
        serverOnline = false;
        setServerState("offline", "сервер спит");
      })
      .finally(function () { clearTimeout(to); });
  }
  checkHealth();
  setInterval(checkHealth, 60000);

  // ---------------- карточки моделей на лендинге ----------------
  var modelCardsEl = document.getElementById("model-cards");
  CFG.models.forEach(function (m, i) {
    var card = document.createElement("article");
    card.className = "model-card reveal";
    card.style.setProperty("--reveal-delay", (i * 0.1) + "s");
    card.innerHTML =
      '<span class="model-badge">' + m.badge + "</span>" +
      "<h3>" + m.name + " <small>" + m.tag + "</small></h3>" +
      "<p>" + m.desc + "</p>" +
      '<span class="model-meta">' + m.params + "</span>" +
      '<button class="btn btn-ghost btn-sm" type="button">Попробовать</button>';
    card.querySelector("button").addEventListener("click", function () {
      openChat(m.id);
    });
    modelCardsEl.appendChild(card);
    // карточки добавлены после initReveal — наблюдаем отдельно
    requestAnimationFrame(function () { card.classList.add("in"); });
  });

  // ---------------- переход лендинг <-> чат ----------------
  var landing = document.getElementById("landing");
  var chatApp = document.getElementById("chat-app");
  var topbar = document.getElementById("topbar");

  function openChat(modelId) {
    if (modelId) selectModel(modelId, true);
    landing.hidden = true;
    topbar.style.display = "none";
    chatApp.hidden = false;
    document.body.classList.add("chat-open");
    if (history.state !== "chat") history.pushState("chat", "");
    inputEl.focus();
  }
  function closeChat() {
    chatApp.hidden = true;
    landing.hidden = false;
    topbar.style.display = "";
    document.body.classList.remove("chat-open");
  }
  window.addEventListener("popstate", function () {
    if (!chatApp.hidden) closeChat();
  });

  document.getElementById("open-chat-btn").addEventListener("click", function () { openChat(); });
  document.getElementById("hero-chat-btn").addEventListener("click", function () { openChat(); });
  document.getElementById("back-btn").addEventListener("click", function () {
    if (history.state === "chat") history.back(); else closeChat();
  });
  document.getElementById("brand-home").addEventListener("click", function (e) {
    e.preventDefault();
    if (!chatApp.hidden) { if (history.state === "chat") history.back(); else closeChat(); }
    window.scrollTo({ top: 0 });
  });

  // ---------------- состояние чата ----------------
  var currentModelId = CFG.defaultModel;
  var histories = {}; // modelId -> [{role, content}]
  CFG.models.forEach(function (m) { histories[m.id] = []; });

  var scrollEl = document.getElementById("chat-scroll");
  var innerEl = document.getElementById("chat-inner");
  var inputEl = document.getElementById("chat-input");
  var sendBtn = document.getElementById("send-btn");
  var hintsEl = document.getElementById("chat-hints");
  var nameEl = document.getElementById("chat-model-name");
  var tagEl = document.getElementById("chat-model-tag");

  var generating = false;
  var abortCtrl = null;

  var HINTS = {
    palma: ["Привет! Кто ты?", "Объясни, что такое нейросеть", "Расскажи про чёрные дыры", "Как справиться со стрессом?", "Придумай идею для выходных"],
    quaero: ["Какие новости в мире ИИ?", "Найди информацию про Qwen", "Что такое Hugging Face Spaces?", "Свежие релизы open-source моделей"],
    code: ["Напиши hello world на Rust", "Функция сортировки на Python", "Как сделать fetch в JS?", "SQL-запрос с JOIN", "Объясни рекурсию с примером"],
  };

  function getModel(id) {
    for (var i = 0; i < CFG.models.length; i++) if (CFG.models[i].id === id) return CFG.models[i];
    return CFG.models[0];
  }

  function scrollDown() { scrollEl.scrollTop = scrollEl.scrollHeight; }

  // ---------------- боковая панель ----------------
  var sideEl = document.getElementById("chat-side");
  var sideBackdrop = document.getElementById("side-backdrop");
  var sideModelsEl = document.getElementById("side-models");

  function openSide() { sideEl.classList.add("open"); sideBackdrop.hidden = false; }
  function closeSide() { sideEl.classList.remove("open"); sideBackdrop.hidden = true; }
  document.getElementById("side-open-btn").addEventListener("click", openSide);
  document.getElementById("side-close-btn").addEventListener("click", closeSide);
  sideBackdrop.addEventListener("click", closeSide);

  function renderSideModels() {
    sideModelsEl.innerHTML = "";
    CFG.models.forEach(function (m) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "side-model" + (m.id === currentModelId ? " active" : "");
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", m.id === currentModelId ? "true" : "false");
      btn.innerHTML =
        '<span class="side-model-top">' +
        '<span class="side-model-name">' + m.name + "</span>" +
        '<span class="side-model-tag">' + m.tag + "</span>" +
        '<svg class="side-model-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>' +
        "</span>" +
        '<span class="side-model-desc">' + m.desc + "</span>" +
        '<span class="side-model-params">' + m.params + "</span>";
      btn.addEventListener("click", function () {
        selectModel(m.id, false);
        closeSide();
      });
      sideModelsEl.appendChild(btn);
    });
  }

  function selectModel(id, silent) {
    if (generating) stopGeneration();
    var changed = id !== currentModelId;
    currentModelId = id;
    var m = getModel(id);
    nameEl.textContent = m.name;
    tagEl.textContent = m.tag;
    renderSideModels();
    renderHints();
    renderHistory();
    if (changed && !silent && histories[id].length) {
      // история сохранена — просто показываем
    }
  }

  function renderHints() {
    hintsEl.innerHTML = "";
    (HINTS[currentModelId] || []).forEach(function (h) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "hint";
      b.textContent = h;
      b.addEventListener("click", function () {
        if (generating) return;
        sendMessage(h);
      });
      hintsEl.appendChild(b);
    });
  }

  // ---------------- рендер сообщений ----------------
  function renderMarkdownLite(text) {
    // безопасный мини-рендер: экранируем HTML, потом ```код``` и `код`
    var esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    esc = esc.replace(/```(\w*)\n?([\s\S]*?)```/g, function (_, lang, code) {
      return "<pre><code>" + code.replace(/\n$/, "") + "</code></pre>";
    });
    esc = esc.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    return esc;
  }

  function addBubble(role, text, tag, isError) {
    var msg = document.createElement("div");
    msg.className = "msg " + role + (isError ? " msg-error" : "");
    var b = document.createElement("div");
    b.className = "bubble";
    if (role === "bot") b.innerHTML = renderMarkdownLite(text);
    else b.textContent = text;
    msg.appendChild(b);
    if (tag) {
      var t = document.createElement("div");
      t.className = "msg-tag";
      t.textContent = tag;
      msg.appendChild(t);
    }
    innerEl.appendChild(msg);
    scrollDown();
    return b;
  }

  function addWelcome() {
    var m = getModel(currentModelId);
    var d = document.createElement("div");
    d.className = "chat-welcome";
    d.innerHTML =
      '<div class="chat-welcome-logo"><img src="./assets/logo.png" alt="" /></div>' +
      "<h2>" + m.name + " " + m.tag + "</h2>" +
      "<p>" + m.desc + "</p>";
    innerEl.appendChild(d);
  }

  function renderHistory() {
    innerEl.innerHTML = "";
    var h = histories[currentModelId];
    if (!h.length) { addWelcome(); return; }
    var m = getModel(currentModelId);
    h.forEach(function (msg) {
      addBubble(msg.role === "user" ? "user" : "bot", msg.content,
        msg.role === "assistant" ? m.short : null, msg.error);
    });
    scrollDown();
  }

  // ---------------- отправка / стриминг ----------------
  function setGenerating(v) {
    generating = v;
    sendBtn.classList.toggle("generating", v);
    sendBtn.setAttribute("aria-label", v ? "Остановить" : "Отправить");
  }

  function stopGeneration() {
    if (abortCtrl) { abortCtrl.abort(); abortCtrl = null; }
    setGenerating(false);
  }

  function sendMessage(text) {
    text = (text || "").trim();
    if (!text || generating) return;

    // убрать приветствие
    var wc = innerEl.querySelector(".chat-welcome");
    if (wc) wc.remove();

    var m = getModel(currentModelId);
    var hist = histories[currentModelId];

    addBubble("user", text);
    hist.push({ role: "user", content: text });
    inputEl.value = "";
    autoGrow();

    setGenerating(true);

    // «думает»
    var botBubble = addBubble("bot", "", m.short);
    botBubble.innerHTML = '<span class="thinking"><i></i><i></i><i></i></span>';

    abortCtrl = new AbortController();
    var acc = "";
    var gotFirst = false;

    fetch(API + CFG.endpoints.chat, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: currentModelId,
        messages: hist.slice(-12), // ограничиваем контекст
      }),
      signal: abortCtrl.signal,
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        if (!res.body) throw new Error("no-stream");
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buf = "";

        function pump() {
          return reader.read().then(function (r) {
            if (r.done) return;
            buf += decoder.decode(r.value, { stream: true });
            var lines = buf.split("\n");
            buf = lines.pop();
            lines.forEach(function (line) {
              line = line.trim();
              if (!line.startsWith("data:")) return;
              var data = line.slice(5).trim();
              if (data === "[DONE]") return;
              try {
                var obj = JSON.parse(data);
                if (obj.token) {
                  acc += obj.token;
                  gotFirst = true;
                  botBubble.innerHTML = renderMarkdownLite(acc) + '<span class="caret"></span>';
                  scrollDown();
                }
                if (obj.sources && obj.sources.length) {
                  acc += "\n\nИсточники:\n" + obj.sources.map(function (s, i) {
                    return (i + 1) + ". " + s;
                  }).join("\n");
                }
                if (obj.error) throw new Error(obj.error);
              } catch (e) {
                if (e instanceof SyntaxError) return; // неполный JSON — пропускаем
                throw e;
              }
            });
            return pump();
          });
        }
        return pump();
      })
      .then(function () {
        finishBot(acc || "…", false);
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") {
          finishBot(acc || "(остановлено)", false);
          return;
        }
        var msg = serverOnline
          ? "Не удалось получить ответ от модели. Попробуй ещё раз."
          : "Сервер моделей сейчас недоступен. Space на Hugging Face мог уснуть — открой его страницу, чтобы разбудить, и попробуй снова. Проверь также HF_SPACE_URL в js/config.js.";
        if (gotFirst) msg = acc + "\n\n(соединение прервалось)";
        finishBot(msg, !gotFirst);
        checkHealth();
      });

    function finishBot(content, isError) {
      botBubble.innerHTML = renderMarkdownLite(content);
      if (isError) botBubble.parentElement.classList.add("msg-error");
      hist.push({ role: "assistant", content: content, error: isError });
      setGenerating(false);
      abortCtrl = null;
      scrollDown();
    }
  }

  sendBtn.addEventListener("click", function () {
    if (generating) { stopGeneration(); return; }
    sendMessage(inputEl.value);
  });

  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.nativeEvent ? e.nativeEvent.isComposing : e.isComposing) return;
      if (e.keyCode === 229) return; // Safari IME
      e.preventDefault();
      if (!generating) sendMessage(inputEl.value);
    }
  });

  function autoGrow() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + "px";
  }
  inputEl.addEventListener("input", autoGrow);

  document.getElementById("clear-btn").addEventListener("click", function () {
    if (generating) stopGeneration();
    histories[currentModelId] = [];
    renderHistory();
    closeSide();
  });

  // ---------------- init ----------------
  renderSideModels();
  renderHints();
  renderHistory();
  selectModel(CFG.defaultModel, true);
  closeChat(); // стартуем на лендинге
})();
