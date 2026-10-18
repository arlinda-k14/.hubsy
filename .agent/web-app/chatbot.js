/*!
 * Hubsy — Creative Hub Kosovo AI Brand Assistant
 * Standalone embeddable chat widget. Works two ways:
 *
 *  1. CLIENT-SIDE (default, no backend / no Blaze plan): the widget fetches
 *     knowledge-base.json from the same host as this script and answers
 *     directly from it with a local retrieval engine. Quoted facts only.
 *
 *  2. BACKEND (optional): set `endpoint` to the Firebase Function and the
 *     widget POSTs { message, history } to it instead.
 *
 * WordPress embed:
 *   <script>window.HUBSY_CONFIG = { endpoint: "" };</script>
 *   <script src="https://<your-host>/chatbot.js" defer></script>
 *
 * Expected reply shape from a backend endpoint: { reply } | { message } |
 * { text } | { choices:[{ message:{ content } }] }.
 */
(function (global) {
  "use strict";

  var DEFAULTS = {
    endpoint: "",
    knowledgeBaseUrl: "",
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
    applyUrl: "",
    maxHistory: 12,
    storageKey: "hubsy.chat.history.v1",
    greeting:
      "Përshëndetje! Unë jam Hubsy, asistenti AI i Creative Hub Kosovo. " +
      "Mund t'ju ndihmoj me pyetje rreth akademive tona: kurse, module, orare, " +
      "çmime, certifikime dhe aplikim. Si mund t'ju ndihmoj?"
  };

  // Generated messages are single-language: pick the variant that matches the user.
  var STRINGS = {
    greeting: {
      sq: DEFAULTS.greeting,
      en:
        "Hello! I'm Hubsy, the AI assistant for Creative Hub Kosovo. " +
        "I can help with questions about our academies: courses, modules, schedules, " +
        "pricing, certifications, and applying. How can I help you?"
    },
    thanks: {
      sq: "Me kënaqësi! Nëse keni pyetje të tjera për akademitë e Creative Hub Kosovo, jam këtu.",
      en: "You're welcome! If you have more questions about Creative Hub Kosovo academies, I'm here."
    }
  };

  // ---------------------------------------------------------------------------
  // Pure helpers (also exported for tests)
  // ---------------------------------------------------------------------------

  var STOPWORDS = {};
  (
    "e i të te se sa me në ne për per dhe a po jo jam je është eshte kjo ky këtë kete nga që qe një nje do mund kam ka më me shume shumë deri apo ose nuk kam kemi jeni janë jane " +
    "the a an is are of to in for and or what how much does do can i you your it this that my we on at be with about which who when where please"
  )
    .split(/\s+/)
    .forEach(function (w) {
      if (w) STOPWORDS[w] = true;
    });

  function tokenize(text) {
    return String(text)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(/\s+/)
      .filter(function (t) {
        return t.length >= 2 && !STOPWORDS[t];
      });
  }

  function stem(t) {
    return t.length <= 5 ? t : t.slice(0, 5);
  }

  function hasWord(text, word) {
    var i = -1;
    while ((i = text.indexOf(word, i + 1)) !== -1) {
      var before = i === 0 ? "" : text[i - 1];
      var after = i + word.length >= text.length ? "" : text[i + word.length];
      var bOk = before === "" || !/[\p{L}\p{N}]/u.test(before);
      var aOk = after === "" || !/[\p{L}\p{N}]/u.test(after);
      if (bOk && aOk) return true;
    }
    return false;
  }

  // Keyword match tolerant of Albanian/English suffixes: single-word keywords
  // match as a word prefix ("kontakt" matches "kontakti"); phrases match whole.
  function matchKeyword(text, kw) {
    if (kw.indexOf(" ") !== -1) return text.indexOf(kw) !== -1;
    var toks = text.split(/\s+/);
    for (var i = 0; i < toks.length; i++) {
      if (toks[i] === kw) return true;
      if (kw.length >= 3 && toks[i].indexOf(kw) === 0) return true;
    }
    return false;
  }

  var ACADEMIES = {
    dm: { name: "Digital Marketing & AI", keywords: ["digital marketing", "marketing", "meta ads", "google ads", "seo", "email marketing", "copywriting"] },
    ds: { name: "Data Science & Analytics", keywords: ["data science", "data analytics", "analytics", "machine learning", "power bi", "statistika"] },
    de: { name: "Data Engineering, Cloud & AI", keywords: ["data engineering", "engineering", "cloud", "pyspark", "databricks"] },
    fs: { name: "Full-stack Development", keywords: ["full-stack", "fullstack", "full stack", "web development", "frontend", "react", "django", "javascript"] },
    hr: { name: "Human Resources", keywords: ["human resources", "hr", "rekrutim", "recruitment", "performance management"] },
    pm: { name: "AI-powered Product & Project Management", keywords: ["product management", "project management", "product & project", "product and project", "scrum"] },
    vc: { name: "Vibe Coding & AI Agents", keywords: ["vibe coding", "vibe", "ai agents", "ai agent"] }
  };

  var GROUP_A = ["de", "vc", "pm", "fs"];

  var INTENTS = {
    price: ["kushton", "çmim", "cmim", "çmimet", "cmimet", "price", "cost", "tuition", "sa para", "fee"],
    payment: ["këste", "keste", "installment", "installments", "pagesa", "pagesë", "pagese", "mënyra e pagesës"],
    duration: ["zgjat", "kohëzgjatja", "kohezgjatja", "orari", "orar", "javë", "jave", "orë", "ore", "duration", "how long", "weeks", "hours"],
    start: ["fillojnë", "fillojne", "fillon", "data e fillimit", "kur fillon", "start", "when does"],
    modules: ["modulet", "moduli", "modul", "module", "kurrikula", "kurrikul", "curriculum", "syllabus", "programi", "program"],
    format: ["format", "online", "fizik", "zoom", "in-person", "live"],
    language: ["gjuhë", "gjuhe", "gjuha", "anglisht", "shqip", "language", "english", "albanian"],
    location: ["kampus", "lokacion", "adres", "adresa", "ku ndodhet", "where", "location", "prishtin", "zyra"],
    prerequisites: ["parakusht", "parakushtet", "kushtet", "pranimit", "requirements", "prerequisite", "aplikim", "apply", "aplikoj"],
    projects: ["projekte", "projekt", "portfolio", "projects", "project"],
    trainers: ["trajner", "trajneret", "trainer", "trainers", "instruktor", "profesor", "lecturer"],
    audience: ["audienca", "target", "profili", "profile", "kush mund", "për kë", "per ke", "audience"],
    certification: ["certifikatë", "certifikate", "certifikim", "diplom", "diplomë", "certification", "certificate", "cert"],
    contact: ["kontakt", "kontakto", "contact", "përgjegjës", "pergjegjes", "personi", "telefon", "telefoni", "email", "numri", "numero", "ndihmo", "ndihmë", "ndihme", "help", "assist", "këshill", "keshill", "bisedo"]
  };

  // Intents that only make sense when we know which academy is meant.
  var ACADEMY_SPECIFIC = {
    price: 1, payment: 1, duration: 1, modules: 1, projects: 1, trainers: 1, audience: 1, certification: 1
  };

  function detectAcademies(text) {
    var t = String(text).toLowerCase();
    var found = {};
    Object.keys(ACADEMIES).forEach(function (id) {
      var kws = ACADEMIES[id].keywords;
      for (var i = 0; i < kws.length; i++) {
        if (matchKeyword(t, kws[i])) {
          found[id] = true;
          break;
        }
      }
    });
    return found;
  }

  function detectIntents(text) {
    var t = String(text).toLowerCase();
    var found = {};
    Object.keys(INTENTS).forEach(function (id) {
      var kws = INTENTS[id];
      for (var i = 0; i < kws.length; i++) {
        if (matchKeyword(t, kws[i])) {
          found[id] = true;
          break;
        }
      }
    });
    return found;
  }

  function keys(obj) {
    return Object.keys(obj);
  }

  function overlapCount(a, b) {
    var n = 0;
    keys(a).forEach(function (k) {
      if (b[k]) n++;
    });
    return n;
  }

  function buildIndex(kb) {
    return kb
      .filter(function (e) {
        return e && e.topic && e.answer;
      })
      .map(function (e) {
        var topicLc = e.topic.toLowerCase();
        var topicStems = {};
        var topicTokens = {};
        tokenize(e.topic).forEach(function (t) {
          topicStems[stem(t)] = true;
          topicTokens[t] = true;
        });
        var answerStems = {};
        tokenize(e.answer).forEach(function (t) {
          answerStems[stem(t)] = true;
        });
        return {
          topic: e.topic,
          answer: e.answer,
          topicLc: topicLc,
          academies: detectAcademies(topicLc),
          intents: detectIntents(topicLc),
          isSummary: /modulet|module|kurrikul|programi/i.test(topicLc),
          topicStems: topicStems,
          topicTokens: topicTokens,
          answerStems: answerStems,
          isGeneral: keys(detectAcademies(topicLc)).length === 0
        };
      });
  }

  // Some intents map onto the same knowledge-base entries.
  var INTENT_ALIASES = { certification: ["price"] };

  function intentOverlap(qIntent, entryIntents) {
    var n = overlapCount(qIntent, entryIntents);
    keys(INTENT_ALIASES).forEach(function (src) {
      if (qIntent[src]) {
        INTENT_ALIASES[src].forEach(function (alt) {
          if (entryIntents[alt]) n++;
        });
      }
    });
    return n;
  }

  function scoreEntry(entry, qStems, qAcad, qIntent, qTokens) {
    var score = 0;

    var acadOverlap = overlapCount(qAcad, entry.academies);
    score += 1 * acadOverlap;
    if (keys(qAcad).length && keys(entry.academies).length && acadOverlap === 0) {
      score -= 2;
    }

    var iOverlap = intentOverlap(qIntent, entry.intents);
    score += 4 * iOverlap;
    if (keys(qIntent).length && keys(entry.intents).length && iOverlap === 0) {
      score -= 2;
    }

    var topicHits = 0;
    keys(qStems).forEach(function (s) {
      if (entry.topicStems[s]) topicHits++;
    });
    score += 2 * Math.min(topicHits, 8);

    var answerHits = 0;
    keys(qStems).forEach(function (s) {
      if (entry.answerStems[s]) answerHits++;
    });
    score += 0.5 * Math.min(answerHits, 3);

    if (qTokens) {
      var exactHits = 0;
      keys(qTokens).forEach(function (t) {
        if (entry.topicTokens[t]) exactHits++;
      });
      score += 1.5 * Math.min(exactHits, 6);
    }

    if (entry.isSummary && qIntent.modules) score += 2;

    return score;
  }

  function normalize(text) {
    return String(text).toLowerCase().replace(/\s+/g, " ").trim();
  }

  var AL_MARKERS = ["sa", "kushton", "është", "eshte", "mund", "jam", "për", "per", "dhe", "kam",
    "cila", "cili", "kur", "ku", "kush", "akademia", "akademi", "kursi", "orar", "çmimi", "cmimi",
    "pagesa", "pagese", "këste", "keste", "dua", "ju", "tuaj", "aplikim", "faleminderit",
    "përshëndetje", "pershendetje", "trajnim", "certifikata", "mënyra"];
  var EN_MARKERS = ["the", "how", "much", "does", "cost", "price", "academy", "when", "can", "you",
    "your", "what", "are", "and", "with", "about", "where", "tuition", "payment", "installments",
    "installment", "modules", "start", "duration", "hello", "hi", "thanks", "please", "apply",
    "certificate", "schedule"];

  // Best-effort language detection: Albanian by default, English when clearly English.
  function detectLanguage(text) {
    var raw = String(text || "");
    if (/[ëç]/i.test(raw)) return "sq";
    var padded = " " + raw.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ") + " ";
    var al = 0;
    var en = 0;
    AL_MARKERS.forEach(function (w) { if (padded.indexOf(" " + w + " ") !== -1) al++; });
    EN_MARKERS.forEach(function (w) { if (padded.indexOf(" " + w + " ") !== -1) en++; });
    if (en > al) return "en";
    if (al > 0) return "sq";
    if (en > 0) return "en";
    return "sq";
  }

  function parseAmount(s) {
    s = String(s).replace(/\s/g, "");
    if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    else s = s.replace(/,/g, ".");
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  // Pull priced tiers (label + total) out of a knowledge-base pricing answer.
  function parseTiers(answer) {
    var text = String(answer).replace(/[\u2013\u2014]/g, "-");
    var tiers = [];
    text.split(/\.\s+/).forEach(function (seg) {
      var m = seg.match(/Çmimi(?:\s+normal)?:\s*([\d.,]+)\s*€?/i);
      if (!m) return;
      var amount = parseAmount(m[1]);
      if (amount == null) return;
      var cut = seg.indexOf(m[0]);
      var label = seg.slice(0, cut).replace(/[,\s]+$/, "");
      label = label.split(/[,:]/).pop().trim();
      tiers.push({ label: label, total: amount });
    });
    return tiers;
  }

  var GREETINGS = ["pershendetje", "përshëndetje", "tung", "tungjatjeta", "miredita", "mirëdita", "dita e mire", "hello", "hi", "hey", "good morning", "good afternoon"];
  var THANKS = ["faleminderit", "flm", "thanks", "thank you", "rrofsh"];

  function createResponder(kb, cfg) {
    cfg = cfg || {};
    var index = buildIndex(kb);
    var contacts = cfg.contacts || DEFAULTS.contacts;
    var flaka = contacts.flaka;
    var leonita = contacts.leonita;

    var ACADEMY_LABELS = {
      dm: "Digital Marketing & AI",
      ds: "Data Science & Analytics + AI",
      de: "Data Engineering, Cloud & AI",
      fs: "Full-stack Development + AI",
      hr: "Human Resources + AI",
      pm: "AI-powered Product & Project Management",
      vc: "Vibe Coding & AI Agents"
    };

    function academyLabel(id) {
      return ACADEMY_LABELS[id] || (ACADEMIES[id] && ACADEMIES[id].name) || id;
    }

    function academyNames() {
      return keys(ACADEMIES).map(function (id) {
        return "• " + academyLabel(id);
      }).join("\n");
    }

    function telHref(p) {
      return "tel:" + String(p).replace(/[^\d+]/g, "");
    }

    function contactOne(c) {
      return c.name + ": " + c.phone + " · " + c.email;
    }

    // Route to Hubsy's human colleagues, in one language only.
    function routingBlock(qAcad, lang) {
      var ids = keys(qAcad);
      var hasA = false;
      var hasB = false;
      ids.forEach(function (id) {
        if (GROUP_A.indexOf(id) !== -1) hasA = true;
        else hasB = true;
      });
      var onlyA = hasA && !hasB;
      var onlyB = hasB && !hasA;
      if (lang === "en") {
        var intro = "My colleagues Flaka and Leonita will be happy to help you with any details.";
        if (onlyA) return intro + "\nFor this academy, Flaka can help: " + contactOne(flaka) + ".";
        if (onlyB) return intro + "\nFor this academy, Leonita can help: " + contactOne(leonita) + ".";
        return intro +
          "\n• Flaka (Data Engineering, Vibe Coding, Product & Project Management, Full-stack Development): " + contactOne(flaka) +
          "\n• Leonita (Data Science, Digital Marketing, HR): " + contactOne(leonita);
      }
      var introSq = "Kolegët e mi Flaka dhe Leonita do të jenë të lumtur t'ju ndihmojnë me çdo detaj.";
      if (onlyA) return introSq + "\nPër këtë akademi mund t'ju ndihmojë Flaka: " + contactOne(flaka) + ".";
      if (onlyB) return introSq + "\nPër këtë akademi mund t'ju ndihmojë Leonita: " + contactOne(leonita) + ".";
      return introSq +
        "\n• Flaka (Data Engineering, Vibe Coding, Product & Project Management, Full-stack Development): " + contactOne(flaka) +
        "\n• Leonita (Data Science, Digital Marketing, HR): " + contactOne(leonita);
    }

    function fallbackFor(qAcad, lang) {
      var reply = (lang === "en"
        ? "I don't have exact information for this question, so I won't guess.\n"
        : "Për këtë pyetje nuk kam informacion të saktë, prandaj nuk dua të hamendësoj.\n") +
        routingBlock(qAcad, lang);
      return { reply: reply, fallback: true, kind: "fallback", lang: lang };
    }

    function contactReply(qAcad, lang) {
      var reply = (lang === "en"
        ? "Happy to connect you with my colleagues.\n"
        : "Me kënaqësi t'ju lidh me kolegët e mi.\n") +
        routingBlock(qAcad, lang);
      return { reply: reply, fallback: true, kind: "contact", lang: lang };
    }

    function clarify(lang) {
      var reply = lang === "en"
        ? "I can help with that. Which academy do you mean?\n" + academyNames() + "\nLet me know which one."
        : "Mund t'ju ndihmoj. Për cilën akademi bëhet fjalë?\n" + academyNames() + "\nMë tregoni për cilën.";
      return { reply: reply, fallback: false, kind: "clarify", lang: lang };
    }

    function formatEuro(n) {
      return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function findPriceEntry(id) {
      for (var i = 0; i < index.length; i++) {
        if (index[i].academies[id] && index[i].intents.price) return index[i];
      }
      return null;
    }

    // Up to 15 monthly installments, with total / 15 estimated for each tier.
    function installmentReply(qAcad, lang) {
      var lines = [];
      keys(qAcad).forEach(function (id) {
        var e = findPriceEntry(id);
        if (!e) return;
        parseTiers(e.answer).forEach(function (t) {
          var monthly = Math.round(t.total / 15);
          var label = lang === "en" && t.label ? t.label.split(/\s*-\s*/)[0].trim() : t.label;
          lines.push("• " + academyLabel(id) + (label ? " (" + label + ")" : "") + ": €" + formatEuro(t.total) +
            (lang === "en" ? " total, about €" + monthly + " per month" : " gjithsej, rreth €" + monthly + " në muaj"));
        });
      });
      if (!lines.length) return null;
      var head = lang === "en"
        ? "Creative Hub Kosovo offers flexible payment plans of up to 15 monthly installments."
        : "Creative Hub Kosovo ofron plane fleksibile pagese deri në 15 këste mujore.";
      var tail = lang === "en"
        ? "These are estimates based on the total tuition, so the team can confirm the exact plan for you."
        : "Këto janë vlera të përllogaritura bazuar në çmimin total, ndaj ekipi mund t'ju konfirmojë planin e saktë.";
      return { reply: head + "\n" + lines.join("\n") + "\n" + tail, fallback: false, kind: "installments", lang: lang };
    }

    function inferAcademyFromHistory(history) {
      if (!Array.isArray(history)) return null;
      for (var i = history.length - 1; i >= 0; i--) {
        var m = history[i];
        if (!m || m.role !== "user" || typeof m.content !== "string") continue;
        var found = keys(detectAcademies(m.content));
        if (found.length) return found[0];
      }
      return null;
    }

    function respond(message, history) {
      var text = normalize(message);
      if (!text) return null;

      var lang = detectLanguage(message);
      var words = text.split(" ").filter(Boolean);
      var isGreeting = words.length <= 4 && GREETINGS.some(function (g) { return hasWord(text, g); });
      if (isGreeting) {
        return {
          reply: lang === "en" ? STRINGS.greeting.en : (cfg.greeting || STRINGS.greeting.sq),
          fallback: false, kind: "greeting", lang: lang
        };
      }
      if (words.length <= 3 && THANKS.some(function (g) { return hasWord(text, g); })) {
        return { reply: STRINGS.thanks[lang], fallback: false, kind: "thanks", lang: lang };
      }

      var qAcad = detectAcademies(text);
      if (!keys(qAcad).length) {
        var carried = inferAcademyFromHistory(history);
        if (carried) qAcad[carried] = true;
      }
      var qIntent = detectIntents(text);

      if (qIntent.contact && !keys(qAcad).length) {
        return contactReply(qAcad, lang);
      }

      var wantsSpecific = keys(qIntent).some(function (i) { return ACADEMY_SPECIFIC[i]; });
      if (wantsSpecific && keys(qAcad).length === 0) {
        return clarify(lang);
      }

      if (qIntent.payment && keys(qAcad).length) {
        var inst = installmentReply(qAcad, lang);
        if (inst) return inst;
      }

      var qStems = {};
      var qTokens = {};
      tokenize(text).forEach(function (t) {
        qStems[stem(t)] = true;
        qTokens[t] = true;
      });

      var best = null;
      var bestScore = -Infinity;
      for (var j = 0; j < index.length; j++) {
        var s = scoreEntry(index[j], qStems, qAcad, qIntent, qTokens);
        if (s > bestScore) {
          bestScore = s;
          best = index[j];
        }
      }

      var MIN = 2.6;
      if (best && bestScore >= MIN) {
        return { reply: best.answer, fallback: false, kind: "entry", topic: best.topic, score: bestScore, lang: lang };
      }
      return fallbackFor(qAcad, lang);
    }

    return {
      respond: respond,
      index: index,
      detectAcademies: detectAcademies,
      detectIntents: detectIntents,
      _score: scoreEntry
    };
  }

  var PURE = {
    tokenize: tokenize,
    stem: stem,
    hasWord: hasWord,
    detectAcademies: detectAcademies,
    detectIntents: detectIntents,
    detectLanguage: detectLanguage,
    parseAmount: parseAmount,
    parseTiers: parseTiers,
    buildIndex: buildIndex,
    scoreEntry: scoreEntry,
    createResponder: createResponder,
    DEFAULTS: DEFAULTS
  };

  // Node/CommonJS: export for tests and stop (no DOM here).
  if (typeof module !== "undefined" && module.exports) {
    module.exports = PURE;
    return;
  }
  if (typeof document === "undefined") return;

  // ---------------------------------------------------------------------------
  // Browser widget
  // ---------------------------------------------------------------------------

  var CFG = Object.assign({}, DEFAULTS, global.HUBSY_CONFIG || {});
  CFG.contacts = Object.assign({}, DEFAULTS.contacts, (global.HUBSY_CONFIG || {}).contacts || {});

  function scriptBase() {
    var s = document.currentScript;
    if (!s) {
      var all = document.getElementsByTagName("script");
      for (var i = all.length - 1; i >= 0; i--) {
        if (all[i].src && /chatbot\.js(\?|$)/.test(all[i].src)) { s = all[i]; break; }
      }
    }
    if (!s || !s.src) return "";
    return s.src.replace(/[^/]*$/, "");
  }

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  function bubbleText(container, text) {
    String(text).split(/\n{2,}/).forEach(function (block) {
      var p = el("p", "hubsy-p");
      block.split("\n").forEach(function (line, i) {
        if (i > 0) p.appendChild(document.createElement("br"));
        p.appendChild(document.createTextNode(line));
      });
      container.appendChild(p);
    });
  }

  function build() {
    if (document.getElementById("hubsy-root")) return null;

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
    launcher.innerHTML = '<span class="hubsy-avatar" aria-hidden="true">H</span><span class="hubsy-launcher-label"></span>';
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
  var responder = null;
  var kbPromise = null;

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

  function kbUrl() {
    if (CFG.knowledgeBaseUrl) return CFG.knowledgeBaseUrl;
    var base = scriptBase();
    return base ? base + "knowledge-base.json" : "knowledge-base.json";
  }

  function ensureResponder() {
    if (responder) return Promise.resolve(responder);
    if (!kbPromise) {
      kbPromise = fetch(kbUrl())
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (kb) {
          responder = createResponder(kb, CFG);
          return responder;
        });
    }
    return kbPromise;
  }

  function ctaBlock() {
    var wrap = el("div", "hubsy-cta");
    function link(label, href) {
      var a = el("a", null, label);
      a.href = href;
      if (/^https?:/i.test(href)) { a.target = "_blank"; a.rel = "noopener"; }
      wrap.appendChild(a);
    }
    var f = CFG.contacts.flaka;
    var l = CFG.contacts.leonita;
    link(f.name + ": " + f.phone, "tel:" + String(f.phone).replace(/[^\d+]/g, ""));
    link(l.name + ": " + l.phone, "tel:" + String(l.phone).replace(/[^\d+]/g, ""));
    link(f.email, "mailto:" + f.email);
    link(l.email, "mailto:" + l.email);
    if (CFG.applyUrl) link("Apliko / Apply", CFG.applyUrl);
    return wrap;
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
        typeof data.choices[0].message.content === "string") return data.choices[0].message.content;
    if (typeof data.output === "string") return data.output;
    return null;
  }

  function ask(message) {
    var lang = detectLanguage(message);
    if (CFG.endpoint) {
      return fetch(CFG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message, history: history.slice(-CFG.maxHistory), language: lang })
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          var reply = parseReply(data);
          if (!reply) throw new Error("Empty reply");
          return { reply: reply, fallback: !!data.fallback };
        })
        .catch(function (err) {
          if (global.console && console.warn) console.warn("[Hubsy] backend error, using local knowledge base:", err);
          return ensureResponder().then(function (r) { return r.respond(message); });
        });
    }
    return ensureResponder()
      .then(function (r) { return r.respond(message, history); })
      .catch(function (err) {
        if (global.console && console.warn) console.warn("[Hubsy] knowledge base error:", err);
        var head = lang === "en"
          ? "I can't load the information right now. My colleagues will be happy to help you with any details.\n"
          : "Nuk mund t'i ngarkoj një çast informacionet. Kolegët e mi do të jenë të lumtur t'ju ndihmojnë me çdo detaj.\n";
        return {
          reply: head +
            "• " + CFG.contacts.flaka.name + ": " + CFG.contacts.flaka.phone + " · " + CFG.contacts.flaka.email + "\n" +
            "• " + CFG.contacts.leonita.name + ": " + CFG.contacts.leonita.phone + " · " + CFG.contacts.leonita.email,
          fallback: true
        };
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

    ask(text).then(function (result) {
      typing.remove();
      if (!result) result = { reply: CFG.greeting, fallback: false };
      history.push({ role: "assistant", content: result.reply });
      addBubble("bot", result.reply, { withCta: !!result.fallback });
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
    if (!ui.log.childElementCount) addBubble("bot", CFG.greeting);
    else ui.log.scrollTop = ui.log.scrollHeight;
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
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && ui.root.classList.contains("hubsy-open")) closeChat();
  });

  global.Hubsy = {
    open: open,
    close: closeChat,
    toggle: toggle,
    ask: ask,
    config: CFG,
    ready: ensureResponder
  };
})(typeof window !== "undefined" ? window : globalThis);
