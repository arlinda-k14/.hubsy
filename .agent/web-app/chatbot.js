/*!
 * Hubsy — Creative Hub Kosovo AI Assistant
 * Standalone embeddable chat widget.
 *
 * Usage:
 *   <script>
 *     window.HUBSY_CONFIG = {
 *       endpoint: "https://<region>-<project>.cloudfunctions.net/hubsyChat",
 *       // optional overrides:
 *       whatsapp: "+38349334437",
 *       phone: "+383 49 334 437",
 *       applyUrl: "https://creativehubkos.com/apply"
 *     };
 *   </script>
 *   <script src="chatbot.js" defer></script>
 *
 * The widget POSTs JSON { message, history } to `endpoint` and expects a JSON
 * reply shaped as one of: { reply } | { message } | { text } |
 * { choices: [{ message: { content } }] }.
 */
(function () {
  "use strict";

  var DEFAULTS = {
    endpoint: "",
    title: "Hubsy | Creative Hub Kosovo",
    subtitle: "AI Assistant · Zakonisht përgjigjet menjëherë",
    launcherLabel: "Hubsy",
    accent: "#5B3DF5",
    accentDark: "#4A2EDB",
    ink: "#16141F",
    whatsapp: "+38349334437",
    phone: "+383 49 334 437",
    applyUrl: "",
    maxHistory: 12,
    storageKey: "hubsy.chat.history.v1",
    greeting:
      "Përshëndetje! Unë jam Hubsy, asistenti AI i Creative Hub Kosovo. " +
      "Mund t'ju ndihmoj me pyetje rreth akademive tona: kurse, module, orare, " +
      "çmime dhe certifikime. Si mund t'ju ndihmoj?\n\n" +
      "Hi! I'm Hubsy, Creative Hub Kosovo's AI assistant. Ask me about our " +
      "academies — courses, modules, schedules, tuition and certifications."
  };

  var CFG = Object.assign({}, DEFAULTS, window.HUBSY_CONFIG || {});

  var FALLBACK =
    "Për këtë pyetje nuk kam informacion të saktë, prandaj nuk dua të hamendësoj. " +
    "Ju lutem kontaktoni Creative Hub Kosovo direkt:\n" +
    "• WhatsApp / telefon: " + CFG.phone + "\n" +
    (CFG.applyUrl ? "• Formulari i aplikimit: " + CFG.applyUrl + "\n" : "") +
    "\nFor this question I don't have exact information, so I won't guess. " +
    "Please contact Creative Hub Kosovo directly via WhatsApp/phone (" + CFG.phone + ")" +
    (CFG.applyUrl ? " or the application form." : ".");

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  function bubbleText(container, text) {
    // Render plain text with paragraph breaks; never inject raw HTML.
    var parts = String(text).split(/\n{2,}/);
    parts.forEach(function (block) {
      var p = el("p", "hubsy-p");
      block.split("\n").forEach(function (line, i) {
        if (i > 0) p.appendChild(document.createElement("br"));
        p.appendChild(document.createTextNode(line));
      });
      container.appendChild(p);
    });
  }

  function waLink() {
    var digits = String(CFG.whatsapp).replace(/[^\d]/g, "");
    return "https://wa.me/" + digits;
  }

  function build() {
    if (document.getElementById("hubsy-root")) return;

    var root = el("div");
    root.id = "hubsy-root";

    var style = document.createElement("style");
    style.textContent = [
      "#hubsy-root,#hubsy-root *{box-sizing:border-box;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}",
      "#hubsy-root{position:fixed;right:20px;bottom:20px;z-index:2147483000}",
      "#hubsy-root .hubsy-launcher{display:flex;align-items:center;gap:10px;border:0;cursor:pointer;padding:12px 18px 12px 12px;border-radius:999px;background:linear-gradient(135deg,#6D51F7," + CFG.accentDark + ");color:#fff;font-weight:600;font-size:15px;box-shadow:0 10px 30px rgba(74,46,219,.38);transition:transform .18s ease,box-shadow .18s ease}",
      "#hubsy-root .hubsy-launcher:hover{transform:translateY(-2px);box-shadow:0 14px 36px rgba(74,46,219,.46)}",
      "#hubsy-root .hubsy-launcher:focus-visible{outline:3px solid #A893FF;outline-offset:2px}",
      "#hubsy-root .hubsy-launcher .hubsy-avatar{width:30px;height:30px;border-radius:50%;background:#fff;color:" + CFG.accentDark + ";display:grid;place-items:center;font-weight:800;font-size:15px}",
      "#hubsy-root .hubsy-launcher.hubsy-hidden{display:none}",
      "#hubsy-root .hubsy-window{position:absolute;right:0;bottom:74px;width:380px;max-width:calc(100vw - 32px);height:600px;max-height:calc(100vh - 120px);background:#fff;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(22,20,31,.28);opacity:0;transform:translateY(12px) scale(.98);pointer-events:none;transition:opacity .2s ease,transform .2s ease}",
      "#hubsy-root.hubsy-open .hubsy-window{opacity:1;transform:none;pointer-events:auto}",
      "#hubsy-root .hubsy-head{background:" + CFG.ink + ";color:#F7F5F0;padding:16px 18px;display:flex;align-items:center;gap:12px}",
      "#hubsy-root .hubsy-head .hubsy-avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#6D51F7," + CFG.accentDark + ");color:#fff;display:grid;place-items:center;font-weight:800;font-size:16px;flex:none}",
      "#hubsy-root .hubsy-head-txt{min-width:0;flex:1}",
      "#hubsy-root .hubsy-title{font-weight:700;font-size:15px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "#hubsy-root .hubsy-sub{font-size:12px;color:#B9B3C7;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "#hubsy-root .hubsy-close{background:transparent;border:0;color:#B9B3C7;cursor:pointer;font-size:22px;line-height:1;padding:4px 6px;border-radius:8px}",
      "#hubsy-root .hubsy-close:hover{color:#fff;background:rgba(255,255,255,.08)}",
      "#hubsy-root .hubsy-log{flex:1;overflow-y:auto;padding:18px;background:#F7F5F0;display:flex;flex-direction:column;gap:12px}",
      "#hubsy-root .hubsy-msg{max-width:84%;padding:11px 14px;border-radius:16px;font-size:14.5px;line-height:1.5}",
      "#hubsy-root .hubsy-msg.hubsy-bot{background:#fff;color:#1A1725;border:1px solid #ECE8F5;border-bottom-left-radius:6px;align-self:flex-start;box-shadow:0 1px 2px rgba(22,20,31,.05)}",
      "#hubsy-root .hubsy-msg.hubsy-user{background:linear-gradient(135deg,#6D51F7," + CFG.accentDark + ");color:#fff;border-bottom-right-radius:6px;align-self:flex-end}",
      "#hubsy-root .hubsy-p{margin:0 0 8px}",
      "#hubsy-root .hubsy-msg .hubsy-p:last-child{margin-bottom:0}",
      "#hubsy-root .hubsy-typing{align-self:flex-start;display:flex;gap:5px;background:#fff;border:1px solid #ECE8F5;padding:12px 14px;border-radius:16px;border-bottom-left-radius:6px}",
      "#hubsy-root .hubsy-dot{width:7px;height:7px;border-radius:50%;background:#A893FF;animation:hubsy-bounce 1.2s infinite ease-in-out}",
      "#hubsy-root .hubsy-dot:nth-child(2){animation-delay:.15s}",
      "#hubsy-root .hubsy-dot:nth-child(3){animation-delay:.3s}",
      "@keyframes hubsy-bounce{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-5px);opacity:1}}",
      "#hubsy-root .hubsy-foot{border-top:1px solid #ECE8F5;padding:12px;background:#fff;display:flex;gap:8px;align-items:flex-end}",
      "#hubsy-root .hubsy-input{flex:1;resize:none;border:1px solid #DCD6EC;border-radius:12px;padding:11px 12px;font-size:14.5px;line-height:1.4;max-height:120px;min-height:44px;color:#1A1725;outline:none}",
      "#hubsy-root .hubsy-input:focus{border-color:" + CFG.accent + ";box-shadow:0 0 0 3px rgba(91,61,245,.14)}",
      "#hubsy-root .hubsy-send{border:0;cursor:pointer;width:44px;height:44px;flex:none;border-radius:12px;background:" + CFG.accent + ";color:#fff;font-size:17px;display:grid;place-items:center;transition:background .15s ease}",
      "#hubsy-root .hubsy-send:hover{background:" + CFG.accentDark + "}",
      "#hubsy-root .hubsy-send:disabled{opacity:.5;cursor:not-allowed}",
      "#hubsy-root .hubsy-cta{display:inline-flex;flex-wrap:wrap;gap:8px;margin-top:10px}",
      "#hubsy-root .hubsy-cta a{font-size:13px;font-weight:600;text-decoration:none;color:" + CFG.accentDark + ";background:#EDE9FF;padding:7px 11px;border-radius:999px}",
      "#hubsy-root .hubsy-cta a:hover{background:#E1DAFF}",
      "@media(max-width:480px){#hubsy-root{right:12px;bottom:12px;left:12px}#hubsy-root .hubsy-window{right:0;left:0;bottom:68px;width:auto;height:calc(100vh - 100px);max-height:none}#hubsy-root .hubsy-launcher{width:100%;justify-content:center}}"
    ].join("\n");

    var launcher = el("button", "hubsy-launcher");
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Open Hubsy chat");
    launcher.innerHTML =
      '<span class="hubsy-avatar" aria-hidden="true">H</span>' +
      '<span class="hubsy-launcher-label"></span>';
    launcher.querySelector(".hubsy-launcher-label").textContent = CFG.launcherLabel;

    var win = el("div", "hubsy-window");
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-modal", "false");
    win.setAttribute("aria-label", "Hubsy chat");

    var head = el("div", "hubsy-head");
    var hAvatar = el("div", "hubsy-avatar", "H");
    hAvatar.setAttribute("aria-hidden", "true");
    var headTxt = el("div", "hubsy-head-txt");
    headTxt.appendChild(el("div", "hubsy-title", CFG.title));
    headTxt.appendChild(el("div", "hubsy-sub", CFG.subtitle));
    var close = el("button", "hubsy-close", "\u00D7");
    close.type = "button";
    close.setAttribute("aria-label", "Close chat");
    head.appendChild(hAvatar);
    head.appendChild(headTxt);
    head.appendChild(close);

    var log = el("div", "hubsy-log");
    log.setAttribute("role", "log");
    log.setAttribute("aria-live", "polite");

    var foot = el("div", "hubsy-foot");
    var input = el("textarea", "hubsy-input");
    input.setAttribute("rows", "1");
    input.setAttribute("placeholder", "Shkruani një mesazh… / Type a message…");
    input.setAttribute("aria-label", "Message Hubsy");
    var send = el("button", "hubsy-send", "\u27A4");
    send.type = "button";
    send.setAttribute("aria-label", "Send message");
    foot.appendChild(input);
    foot.appendChild(send);

    win.appendChild(head);
    win.appendChild(log);
    win.appendChild(foot);
    root.appendChild(win);
    root.appendChild(launcher);
    var mount = document.body || document.documentElement;
    mount.appendChild(root);
    mount.appendChild(style);

    return { root: root, launcher: launcher, win: win, log: log, input: input, send: send, close: close };
  }

  var ui = build();
  if (!ui) return;

  var history = loadHistory();
  var busy = false;

  function loadHistory() {
    try {
      var raw = sessionStorage.getItem(CFG.storageKey);
      var parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
    return [];
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(CFG.storageKey, JSON.stringify(history.slice(-CFG.maxHistory)));
    } catch (e) {}
  }

  function addBubble(role, text) {
    var b = el("div", "hubsy-msg hubsy-" + (role === "user" ? "user" : "bot"));
    bubbleText(b, text);
    if (role !== "user") b.appendChild(ctaBlock());
    ui.log.appendChild(b);
    ui.log.scrollTop = ui.log.scrollHeight;
    return b;
  }

  function ctaBlock() {
    var wrap = el("div", "hubsy-cta");
    var wa = el("a", null, "WhatsApp " + CFG.phone);
    wa.href = waLink();
    wa.target = "_blank";
    wa.rel = "noopener";
    wrap.appendChild(wa);
    if (CFG.applyUrl) {
      var ap = el("a", null, "Apliko / Apply");
      ap.href = CFG.applyUrl;
      ap.target = "_blank";
      ap.rel = "noopener";
      wrap.appendChild(ap);
    }
    return wrap;
  }

  function showTyping() {
    var t = el("div", "hubsy-typing");
    t.appendChild(el("span", "hubsy-dot"));
    t.appendChild(el("span", "hubsy-dot"));
    t.appendChild(el("span", "hubsy-dot"));
    t.setAttribute("aria-label", "Hubsy is typing");
    ui.log.appendChild(t);
    ui.log.scrollTop = ui.log.scrollHeight;
    return t;
  }

  function parseReply(data) {
    if (!data) return null;
    if (typeof data === "string") return data;
    if (typeof data.reply === "string") return data.reply;
    if (typeof data.message === "string") return data.message;
    if (typeof data.text === "string") return data.text;
    if (data.message && typeof data.message.content === "string") return data.message.content;
    if (Array.isArray(data.choices) && data.choices[0] && data.choices[0].message &&
        typeof data.choices[0].message.content === "string") {
      return data.choices[0].message.content;
    }
    if (typeof data.output === "string") return data.output;
    return null;
  }

  function requestReply(message) {
    if (!CFG.endpoint) {
      return Promise.resolve({ reply: FALLBACK, fallback: true });
    }
    var body = {
      message: message,
      history: history.slice(-CFG.maxHistory)
    };
    return fetch(CFG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (data) {
      var reply = parseReply(data);
      if (!reply) throw new Error("Empty reply");
      return { reply: reply };
    }).catch(function (err) {
      if (window.console && console.warn) console.warn("[Hubsy] backend error:", err);
      return { reply: FALLBACK, fallback: true };
    });
  }

  function sendMessage() {
    var text = ui.input.value.trim();
    if (!text || busy) return;
    busy = true;
    ui.send.disabled = true;
    ui.input.value = "";
    autoGrow();

    history.push({ role: "user", content: text });
    addBubble("user", text);
    var typing = showTyping();

    requestReply(text).then(function (result) {
      typing.remove();
      history.push({ role: "assistant", content: result.reply });
      addBubble("bot", result.reply);
      saveHistory();
    }).finally(function () {
      busy = false;
      ui.send.disabled = false;
      ui.input.focus();
    });
  }

  function autoGrow() {
    ui.input.style.height = "auto";
    ui.input.style.height = Math.min(ui.input.scrollHeight, 120) + "px";
  }

  function open() {
    ui.root.classList.add("hubsy-open");
    ui.launcher.setAttribute("aria-label", "Close Hubsy chat");
    if (!ui.log.childElementCount) {
      addBubble("bot", CFG.greeting);
    } else {
      ui.log.scrollTop = ui.log.scrollHeight;
    }
    ui.input.focus();
  }

  function closeChat() {
    ui.root.classList.remove("hubsy-open");
    ui.launcher.setAttribute("aria-label", "Open Hubsy chat");
    ui.launcher.focus();
  }

  function toggle() {
    if (ui.root.classList.contains("hubsy-open")) closeChat();
    else open();
  }

  // Restore prior messages in this session.
  if (history.length) {
    history.forEach(function (m) {
      var b = el("div", "hubsy-msg hubsy-" + (m.role === "user" ? "user" : "bot"));
      bubbleText(b, m.content);
      ui.log.appendChild(b);
    });
  }

  ui.launcher.addEventListener("click", toggle);
  ui.close.addEventListener("click", closeChat);
  ui.send.addEventListener("click", sendMessage);
  ui.input.addEventListener("input", autoGrow);
  ui.input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && ui.root.classList.contains("hubsy-open")) closeChat();
  });

  window.Hubsy = {
    open: open,
    close: closeChat,
    toggle: toggle,
    config: CFG
  };
})();
