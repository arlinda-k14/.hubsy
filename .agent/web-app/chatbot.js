/*!
 * Hubsy — Creative Hub Kosovo AI Assistant
 * Standalone embeddable chat widget.
 *
 * Usage:
 *   <script>
 *     window.HUBSY_CONFIG = {
 *       endpoint: "https://<region>-<project>.cloudfunctions.net/hubsyChat",
 *       // optional overrides:
 *       applyUrl: "https://creativehubkos.com/apply",
 *       contacts: {
 *         flaka:   { name: "Flakë",   phone: "+383 49 334 437", email: "flaka@creativehubkos.com" },
 *         leonita: { name: "Leonita", phone: "+383 49 334 438", email: "leonita@creativehubkos.com" }
 *       }
 *     };
 *   </script>
 *   <script src="chatbot.js" defer></script>
 *
 * The widget POSTs JSON { message, history } to `endpoint` and expects a JSON
 * reply shaped as one of: { reply } | { message } | { text } |
 * { choices: [{ message: { content } }] }.
 *
 * Brand palette: creativehubkos.com — navy #051238, accent green #00E087/#00FF94.
 */
(function () {
  "use strict";

  var DEFAULTS = {
    endpoint: "",
    title: "Hubsy | Creative Hub Kosovo",
    subtitle: "Asistenti AI · Përgjigjet në shqip ose anglisht",
    launcherLabel: "Hubsy",
    // creativehubkos.com brand colors
    navy: "#051238",
    navy2: "#1A2240",
    accent: "#00E087",
    accentBright: "#00FF94",
    accentDark: "#00B26B",
    soft: "#E9FBF3",
    logBg: "#F6F8FB",
    border: "#E6EAF2",
    muted: "#5A647E",
    mutedLight: "#8891AE",
    languageDefault: "sq",
    contacts: {
      flaka: { name: "Flakë", phone: "+383 49 334 437", email: "flaka@creativehubkos.com" },
      leonita: { name: "Leonita", phone: "+383 49 334 438", email: "leonita@creativehubkos.com" }
    },
    // Academy → responsible contact (Group A: Flakë, Group B: Leonita)
    academyGroups: {
      A: ["Data Engineering, Cloud & AI", "Vibe Coding & AI Agents",
          "AI-powered Product & Project Management", "Full-stack Development"],
      B: ["Data Science & Analytics", "Digital Marketing", "Human Resources"]
    },
    applyUrl: "",
    maxHistory: 12,
    storageKey: "hubsy.chat.history.v1",
    greeting:
      "Përshëndetje! Unë jam Hubsy, asistenti AI i Creative Hub Kosovo. " +
      "Mund t'ju ndihmoj me pyetje rreth akademive tona: kurse, module, orare, " +
      "çmime, certifikime dhe aplikim. Si mund t'ju ndihmoj?"
  };

  var CFG = Object.assign({}, DEFAULTS, window.HUBSY_CONFIG || {});
  CFG.contacts = Object.assign({}, DEFAULTS.contacts, (window.HUBSY_CONFIG || {}).contacts || {});

  var FLAKA = CFG.contacts.flaka;
  var LEONITA = CFG.contacts.leonita;

  function telHref(phone) {
    return "tel:" + String(phone).replace(/[^\d+]/g, "");
  }

  var FALLBACK =
    "Për këtë pyetje nuk kam informacion të saktë, prandaj nuk dua të hamendësoj. " +
    "Kontaktoni Creative Hub Kosovo direkt:\n" +
    "• Data Engineering, Vibe Coding, Product & Project Management, Full-stack Development: " +
    FLAKA.phone + " · " + FLAKA.email + "\n" +
    "• Data Science, Digital Marketing, HR: " +
    LEONITA.phone + " · " + LEONITA.email + "\n" +
    "\nFor this question I don't have exact information, so I won't guess. " +
    "Please contact Creative Hub Kosovo directly:\n" +
    "• Data Engineering, Vibe Coding, Product & Project Management, Full-stack Development: " +
    FLAKA.phone + " · " + FLAKA.email + "\n" +
    "• Data Science, Digital Marketing, HR: " +
    LEONITA.phone + " · " + LEONITA.email;

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

  function build() {
    if (document.getElementById("hubsy-root")) return;

    var root = el("div");
    root.id = "hubsy-root";

    var style = document.createElement("style");
    style.textContent = [
      "#hubsy-root,#hubsy-root *{box-sizing:border-box;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}",
      "#hubsy-root{position:fixed;right:20px;bottom:20px;z-index:2147483000}",
      "#hubsy-root .hubsy-launcher{display:flex;align-items:center;gap:10px;border:0;cursor:pointer;padding:12px 18px 12px 12px;border-radius:999px;background:" + CFG.navy + ";color:#fff;font-weight:600;font-size:15px;box-shadow:0 10px 30px rgba(5,18,56,.34);transition:transform .18s ease,box-shadow .18s ease}",
      "#hubsy-root .hubsy-launcher:hover{transform:translateY(-2px);box-shadow:0 14px 36px rgba(5,18,56,.42),0 0 0 3px rgba(0,224,135,.35)}",
      "#hubsy-root .hubsy-launcher:focus-visible{outline:3px solid " + CFG.accent + ";outline-offset:2px}",
      "#hubsy-root .hubsy-launcher .hubsy-avatar{width:30px;height:30px;border-radius:50%;background:" + CFG.accentBright + ";color:" + CFG.navy + ";display:grid;place-items:center;font-weight:800;font-size:15px}",
      "#hubsy-root .hubsy-launcher.hubsy-hidden{display:none}",
      "#hubsy-root .hubsy-window{position:absolute;right:0;bottom:74px;width:380px;max-width:calc(100vw - 32px);height:600px;max-height:calc(100vh - 120px);background:#fff;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(5,18,56,.28);opacity:0;transform:translateY(12px) scale(.98);pointer-events:none;transition:opacity .2s ease,transform .2s ease}",
      "#hubsy-root.hubsy-open .hubsy-window{opacity:1;transform:none;pointer-events:auto}",
      "#hubsy-root .hubsy-head{background:" + CFG.navy + ";color:#FFFFFF;padding:16px 18px;display:flex;align-items:center;gap:12px}",
      "#hubsy-root .hubsy-head .hubsy-avatar{width:38px;height:38px;border-radius:50%;background:" + CFG.accentBright + ";color:" + CFG.navy + ";display:grid;place-items:center;font-weight:800;font-size:16px;flex:none}",
      "#hubsy-root .hubsy-head-txt{min-width:0;flex:1}",
      "#hubsy-root .hubsy-title{font-weight:700;font-size:15px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "#hubsy-root .hubsy-sub{font-size:12px;color:" + CFG.mutedLight + ";margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "#hubsy-root .hubsy-close{background:transparent;border:0;color:" + CFG.mutedLight + ";cursor:pointer;font-size:22px;line-height:1;padding:4px 6px;border-radius:8px}",
      "#hubsy-root .hubsy-close:hover{color:#fff;background:rgba(255,255,255,.1)}",
      "#hubsy-root .hubsy-log{flex:1;overflow-y:auto;padding:18px;background:" + CFG.logBg + ";display:flex;flex-direction:column;gap:12px}",
      "#hubsy-root .hubsy-msg{max-width:84%;padding:11px 14px;border-radius:16px;font-size:14.5px;line-height:1.5}",
      "#hubsy-root .hubsy-msg.hubsy-bot{background:" + CFG.soft + ";color:" + CFG.navy + ";border:1px solid #D6F2E5;border-bottom-left-radius:6px;align-self:flex-start}",
      "#hubsy-root .hubsy-msg.hubsy-user{background:#FFFFFF;color:" + CFG.navy + ";border:1px solid " + CFG.border + ";border-bottom-right-radius:6px;align-self:flex-end;box-shadow:0 1px 2px rgba(5,18,56,.06)}",
      "#hubsy-root .hubsy-p{margin:0 0 8px}",
      "#hubsy-root .hubsy-msg .hubsy-p:last-child{margin-bottom:0}",
      "#hubsy-root .hubsy-typing{align-self:flex-start;display:flex;gap:5px;background:" + CFG.soft + ";border:1px solid #D6F2E5;padding:12px 14px;border-radius:16px;border-bottom-left-radius:6px}",
      "#hubsy-root .hubsy-dot{width:7px;height:7px;border-radius:50%;background:" + CFG.accentDark + ";animation:hubsy-bounce 1.2s infinite ease-in-out}",
      "#hubsy-root .hubsy-dot:nth-child(2){animation-delay:.15s}",
      "#hubsy-root .hubsy-dot:nth-child(3){animation-delay:.3s}",
      "@keyframes hubsy-bounce{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-5px);opacity:1}}",
      "#hubsy-root .hubsy-foot{border-top:1px solid " + CFG.border + ";padding:12px;background:#fff;display:flex;gap:8px;align-items:flex-end}",
      "#hubsy-root .hubsy-input{flex:1;resize:none;border:1px solid " + CFG.border + ";border-radius:12px;padding:11px 12px;font-size:14.5px;line-height:1.4;max-height:120px;min-height:44px;color:" + CFG.navy + ";outline:none;background:#fff}",
      "#hubsy-root .hubsy-input::placeholder{color:" + CFG.mutedLight + "}",
      "#hubsy-root .hubsy-input:focus{border-color:" + CFG.accent + ";box-shadow:0 0 0 3px rgba(0,224,135,.18)}",
      "#hubsy-root .hubsy-send{border:0;cursor:pointer;width:44px;height:44px;flex:none;border-radius:12px;background:" + CFG.accent + ";color:" + CFG.navy + ";font-size:17px;display:grid;place-items:center;transition:background .15s ease}",
      "#hubsy-root .hubsy-send:hover{background:" + CFG.accentDark + ";color:#fff}",
      "#hubsy-root .hubsy-send:disabled{opacity:.5;cursor:not-allowed}",
      "#hubsy-root .hubsy-cta{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}",
      "#hubsy-root .hubsy-cta a{font-size:12.5px;font-weight:600;text-decoration:none;color:" + CFG.navy + ";background:#FFFFFF;border:1px solid #CDEFDF;padding:7px 11px;border-radius:999px}",
      "#hubsy-root .hubsy-cta a:hover{border-color:" + CFG.accentDark + ";background:" + CFG.soft + "}",
      "@media(max-width:480px){#hubsy-root{right:12px;bottom:12px;left:12px}#hubsy-root .hubsy-window{right:0;left:0;bottom:68px;width:auto;height:calc(100vh - 100px);max-height:none}#hubsy-root .hubsy-launcher{width:100%;justify-content:center}}"
    ].join("\n");

    var launcher = el("button", "hubsy-launcher");
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Hap bisedën me Hubsy");
    launcher.innerHTML =
      '<span class="hubsy-avatar" aria-hidden="true">H</span>' +
      '<span class="hubsy-launcher-label"></span>';
    launcher.querySelector(".hubsy-launcher-label").textContent = CFG.launcherLabel;

    var win = el("div", "hubsy-window");
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-modal", "false");
    win.setAttribute("aria-label", "Bisedë me Hubsy");

    var head = el("div", "hubsy-head");
    var hAvatar = el("div", "hubsy-avatar", "H");
    hAvatar.setAttribute("aria-hidden", "true");
    var headTxt = el("div", "hubsy-head-txt");
    headTxt.appendChild(el("div", "hubsy-title", CFG.title));
    headTxt.appendChild(el("div", "hubsy-sub", CFG.subtitle));
    var close = el("button", "hubsy-close", "\u00D7");
    close.type = "button";
    close.setAttribute("aria-label", "Mbyll bisedën");
    head.appendChild(hAvatar);
    head.appendChild(headTxt);
    head.appendChild(close);

    var log = el("div", "hubsy-log");
    log.setAttribute("role", "log");
    log.setAttribute("aria-live", "polite");

    var foot = el("div", "hubsy-foot");
    var input = el("textarea", "hubsy-input");
    input.setAttribute("rows", "1");
    input.setAttribute("placeholder", "Shkruani një mesazh… (Type a message…)");
    input.setAttribute("aria-label", "Mesazh për Hubsy");
    var send = el("button", "hubsy-send", "\u27A4");
    send.type = "button";
    send.setAttribute("aria-label", "Dërgo mesazhin");
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

  function addBubble(role, text, opts) {
    opts = opts || {};
    var b = el("div", "hubsy-msg hubsy-" + (role === "user" ? "user" : "bot"));
    bubbleText(b, text);
    if (role !== "user" && opts.withCta) b.appendChild(ctaBlock());
    ui.log.appendChild(b);
    ui.log.scrollTop = ui.log.scrollHeight;
    return b;
  }

  function ctaBlock() {
    var wrap = el("div", "hubsy-cta");

    function link(label, href) {
      var a = el("a", null, label);
      a.href = href;
      if (/^https?:/i.test(href)) {
        a.target = "_blank";
        a.rel = "noopener";
      }
      wrap.appendChild(a);
      return a;
    }

    link(FLAKA.name + ": " + FLAKA.phone, telHref(FLAKA.phone));
    link(LEONITA.name + ": " + LEONITA.phone, telHref(LEONITA.phone));
    link(FLAKA.email, "mailto:" + FLAKA.email);
    link(LEONITA.email, "mailto:" + LEONITA.email);
    if (CFG.applyUrl) link("Apliko / Apply", CFG.applyUrl);
    return wrap;
  }

  function showTyping() {
    var t = el("div", "hubsy-typing");
    t.appendChild(el("span", "hubsy-dot"));
    t.appendChild(el("span", "hubsy-dot"));
    t.appendChild(el("span", "hubsy-dot"));
    t.setAttribute("aria-label", "Hubsy po shkruan");
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
      history: history.slice(-CFG.maxHistory),
      language: CFG.languageDefault
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
      return { reply: reply, fallback: !!data.fallback };
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
      addBubble("bot", result.reply, { withCta: result.fallback });
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
    ui.launcher.setAttribute("aria-label", "Mbyll bisedën me Hubsy");
    if (!ui.log.childElementCount) {
      addBubble("bot", CFG.greeting);
    } else {
      ui.log.scrollTop = ui.log.scrollHeight;
    }
    ui.input.focus();
  }

  function closeChat() {
    ui.root.classList.remove("hubsy-open");
    ui.launcher.setAttribute("aria-label", "Hap bisedën me Hubsy");
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
