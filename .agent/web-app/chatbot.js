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
    subtitle: "Asistenti AI për Creative Hub",
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
    // Avatar image, resolved next to chatbot.js when left empty.
    avatarUrl: "",
    contacts: {
      flaka: {
        name: "Flaka",
        phone: "+383 49 334 437",
        email: "flaka@creativehubkos.com",
        calendly: "https://calendly.com/flaka-creativehub/30min"
      },
      leonita: {
        name: "Leonita",
        phone: "+383 49 334 438",
        email: "leonita@creativehubkos.com",
        calendly: "https://calendly.com/leonita-creativehubkos/30min"
      }
    },
    applyUrl: "",
    maxHistory: 12,
    storageKey: "hubsy.chat.history.v1",
    greeting:
      "Përshëndetje! ✌️ Unë jam Hubsy, asistenti AI në Creative Hub Kosovo. " +
      "Jam këtu për t'ju ndihmuar të gjeni akademinë ideale, planet e pagesës me këste, " +
      "apo t'ju lidh me koleget e mia, Flakën dhe Leonitën. Si mund t'ju ndihmoj sot?"
  };

  // Hubsy always answers in Albanian, whatever language the visitor writes in.
  var STRINGS = {
    greeting: DEFAULTS.greeting,
    thanks: "Me kënaqësi! Nëse keni pyetje të tjera për akademitë e Creative Hub Kosovo, jam këtu."
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
  // Tokens are stripped of punctuation first, so "HR?" still matches "hr".
  function matchKeyword(text, kw) {
    if (kw.indexOf(" ") !== -1) return text.indexOf(kw) !== -1;
    var toks = text.split(/\s+/);
    for (var i = 0; i < toks.length; i++) {
      var tok = toks[i].replace(/[^\p{L}\p{N}]+/gu, "");
      if (tok === kw) return true;
      if (kw.length >= 3 && tok.indexOf(kw) === 0) return true;
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
    people: ["ligjerues", "trajner", "trainer", "instruktor", "instructor", "profesor", "professor", "professors", "mentor", "lecturer", "mësues", "mesues", "who teaches", "kush mëson", "Kush meson", "ekip", "team", "staff", "people"],
    audience: ["audienca", "target", "profili", "profile", "Kush mund", "për kë", "per ke", "audience"],
    certification: ["certifikatë", "certifikate", "certifikim", "diplom", "diplomë", "certification", "certificate", "cert", "licencë", "licence", "license"],
    contact: ["kontakt", "kontakto", "contact", "përgjegjës", "pergjegjes", "person", "personi", "telefon", "telefoni", "email", "numri", "numero", "flas", "njeri", "takim", "cakto", "ndihmo", "ndihmë", "ndihme", "help", "assist", "këshill", "keshill", "bisedo", "talk", "speak"],
    // A question about a whole academy, not about one aspect of it.
    overview: ["dua te di per", "dua me dite per", "dua di per", "duan me dit", "duan te dit",
      "dëshiroj me dit", "deshiroj me dit", "dua me shume info", "dua te shume info",
      "me trego per", "më trego për", "trego per", "trego akademine", "trego akademinë",
      "info per", "informacion per", "informacion mbi", "me shume informacion", "më shumë informacion",
      "gjej me shume", "gjej info", "gjej gjithçka", "gjej gjithcka", "çdo gjë rreth", "gjej per",
      "per akademine", "per akademinë", "mbi akademine", "mbi akademinë", "rreth akademine", "rreth akademinë",
      "na intereson", "me intereson", "kam interes", "tell me about", "about the academy", "info about",
      "overview of", "summary of", "overview", "rreth kësaj akademie", "rreth kesaj akademie"]
  };

  // Intents that answer one specific aspect of an academy. When one of these
  // is present the question is not a general academy overview.
  var SPECIFIC_INTENTS = ["price", "payment", "duration", "start", "modules", "format",
    "language", "location", "prerequisites", "projects", "people", "audience",
    "certification", "contact"];

  function hasSpecificIntent(qIntent) {
    for (var i = 0; i < SPECIFIC_INTENTS.length; i++) {
      if (qIntent[SPECIFIC_INTENTS[i]]) return true;
    }
    return false;
  }


  // Explicit contact requests: these always route to a coordinator, even when an
  // academy is mentioned in the same message.
  var CONTACT_STRONG = ["kontakt", "kontakto", "contact", "flas", "person", "njeri",
    "telefon", "telefoni", "numri", "numero", "email", "takim", "cakto", "talk", "speak", "lidh"];

  // Intents that only make sense when we know which academy is meant.
  var ACADEMY_SPECIFIC = {
    price: 1, payment: 1, duration: 1, modules: 1, projects: 1, people: 1, audience: 1, certification: 1, overview: 1
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
        var people = null;
        if (Array.isArray(e.lecturers)) {
          var named = e.lecturers.filter(function (l) {
            return l && l.name && l.title;
          });
          if (named.length) people = named;
        }
        var academies = detectAcademies(topicLc);
        var kind = e.kind || null;
        // Explicit academy id from the knowledge base, otherwise infer it from
        // the entry title.
        var academyId = e.academy || keys(academies)[0] || null;
        return {
          topic: e.topic,
          answer: e.answer,
          topicLc: topicLc,
          academies: academies,
          academyId: academyId,
          kind: kind,
          overview: e.overview || null,
          isOverview: kind === "overview" && !!academyId,
          isModule: kind === "module",
          isPerson: kind === "person",
          intents: detectIntents(topicLc),
          isSummary: /modulet|module|kurrikul|programi/i.test(topicLc),
          isPeople: /trajner|ligjerues|lecturer|mentor|instruktor|profesor/i.test(topicLc),
          people: people,
          topicStems: topicStems,
          topicTokens: topicTokens,
          answerStems: answerStems,
          isGeneral: keys(academies).length === 0
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

    // A question about a whole academy must land on the academy overview
    // entry, never on one of its modules or on the coordinator card.
    if (entry.isOverview && keys(qAcad).length) {
      if (qIntent.overview) score += 5;
      else if (!hasSpecificIntent(qIntent)) score += 4;
    }
    if (entry.isModule && !qIntent.modules) score -= 3;
    if (entry.isPerson && !qIntent.contact) score -= 2;

    return score;
  }

  function normalize(text) {
    return String(text).toLowerCase().replace(/\s+/g, " ").trim();
  }

  // Hubsy answers in Albanian only, whatever language the visitor writes in.
  // English wording is still understood (it is part of the intent keywords),
  // it is only never used in a reply.
  var REPLY_LANG = "sq";

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

  // People entries in the knowledge base are stored as one dense paragraph:
  // "Name - Title: Bio. Name - Title: Bio." This matches a capitalised name
  // of two to four words followed by " - ".
  var PERSON_RE = /((?:\p{Lu}[\p{L}'’-]*)(?:\s+(?:\p{Lu}[\p{L}'’-]*)){1,3})\s+-\s+/gu;

  // Split a dense people paragraph into structured people.
  function parsePeople(answer) {
    if (!answer) return [];
    PERSON_RE.lastIndex = 0;
    var marks = [];
    var m;
    while ((m = PERSON_RE.exec(answer)) !== null) {
      marks.push({ name: m[1].trim(), nameAt: m.index, bodyAt: m.index + m[0].length });
    }
    var people = [];
    for (var i = 0; i < marks.length; i++) {
      var end = i + 1 < marks.length ? marks[i + 1].nameAt : answer.length;
      var body = answer.slice(marks[i].bodyAt, end).trim();
      var cut = body.indexOf(":");
      var title = (cut === -1 ? body : body.slice(0, cut)).trim();
      var bio = cut === -1 ? "" : body.slice(cut + 1).trim();
      if (!title) continue;
      people.push({ name: marks[i].name, title: title, bio: bio });
    }
    return people;
  }

  // Render people as the bullet list the widget shows:
  // "• **Name** — Title" with the bio on the indented line below.
  function formatPeopleBullets(people) {
    return people
      .map(function (p) {
        var line = "• **" + p.name + "** — " + p.title;
        if (p.bio) line += "\n  " + p.bio;
        return line;
      })
      .join("\n\n");
  }

  // Parse the bullet layout back into structured people.
  function parsePeopleBullets(answer) {
    var people = [];
    var current = null;
    String(answer || "")
      .split("\n")
      .forEach(function (line) {
        var head = line.match(/^\s*[•\-\*]\s+\*\*(.+?)\*\*\s+—\s+(.+?)\s*$/);
        if (head) {
          current = { name: head[1].trim(), title: head[2].trim(), bio: "" };
          people.push(current);
          return;
        }
        var cont = line.match(/^\s{2,}(\S.*)$/);
        if (cont && current) {
          current.bio = (current.bio ? current.bio + " " : "") + cont[1].trim();
        }
      });
    return people;
  }

  // The people of a knowledge-base entry: the lecturers schema when present,
  // otherwise the answer parsed back into people.
  function peopleOf(entry) {
    if (!entry) return [];
    if (entry.people && entry.people.length) return entry.people;
    var dense = parsePeople(entry.answer);
    if (dense.length) return dense;
    return parsePeopleBullets(entry.answer);
  }

  // Roles that can mentor a student: people development, recruiting, coaching.
  var MENTOR_TITLE_RE = /recruit|talent|people|culture|learning|business partner|coach|mentor|leadership/i;

  function isMentor(p) {
    if (!p) return false;
    if (p.mentor === true) return true;
    return MENTOR_TITLE_RE.test(p.title || "");
  }

  function formatPeopleList(answer) {
    var people = parsePeople(answer);
    return people.length ? formatPeopleBullets(people) : null;
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

    // Short labels used in the people-list header ("Ligjëruesit në Akademinë e HR:").
    var PEOPLE_LABELS = {
      dm: "Digital Marketing & AI",
      ds: "Data Science & Analytics + AI",
      de: "Data Engineering, Cloud & AI",
      fs: "Full-stack Development + AI",
      hr: "HR",
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

    // Which colleague should answer, based on the academies mentioned.
    function routingTargets(qAcad) {
      var ids = keys(qAcad);
      var hasA = false;
      var hasB = false;
      ids.forEach(function (id) {
        if (GROUP_A.indexOf(id) !== -1) hasA = true;
        else hasB = true;
      });
      if (hasA && !hasB) return { flaka: true, leonita: false, single: "flaka" };
      if (hasB && !hasA) return { flaka: false, leonita: true, single: "leonita" };
      return { flaka: true, leonita: true, single: "both" };
    }

    var COLLEAGUE_GROUP = {
      flaka: "Data Engineering, Vibe Coding, Full-stack dhe Project Management",
      leonita: "Data Science, Digital Marketing dhe HR"
    };

    // Warm name-only introduction. Contact details live in the clickable buttons,
    // so the text never repeats a phone number or email.
    function routingText(qAcad) {
      var t = routingTargets(qAcad);
      if (t.single === "flaka") return "Këtë e di më së miri kolegia ime Flaka, dhe ajo do të jetë e lumtur t'ju ndihmojë me çdo detaj.";
      if (t.single === "leonita") return "Këtë e di më së miri kolegia ime Leonita, dhe ajo do të jetë e lumtur t'ju ndihmojë me çdo detaj.";
      return "Koleget e mia Flaka dhe Leonita do të jenë të lumtur t'ju ndihmojnë me çdo detaj.";
    }

    // Exact coordinator introductions used when a user asks to talk to a person.
    var CONTACT_INTRO = {
      flaka:
        "Patjetër! Flaka është Koordinatorja e Akademisë. Ti mund të caktosh një takim fizikisht në kampusin tonë në Prishtinë ose online.",
      leonita:
        "Patjetër! Leonita është Koordinatorja e Akademisë se Data Science & Analytics + AI (dhe Akademive të tjera si Digital Marketing & HR). Ti mund të caktosh një takim fizikisht në kampusin tonë në Prishtinë ose online.",
      both:
        "Patjetër! Koleget e mia Flaka dhe Leonita janë koordinatoret tona. Ti mund të caktosh një takim fizikisht në kampusin tonë në Prishtinë ose online për të biseduar mbi programet tona."
    };

    function mentionTarget(text) {
      var f = hasWord(text, "flaka") || text.indexOf("flakë") !== -1;
      var l = hasWord(text, "leonita");
      if (f && !l) return { flaka: true, leonita: false, single: "flaka" };
      if (l && !f) return { flaka: false, leonita: true, single: "leonita" };
      return null;
    }

    function contactTargets(text, qAcad) {
      return mentionTarget(text) || routingTargets(qAcad);
    }

    function contactIntro(single) {
      return CONTACT_INTRO[single];
    }

    function bios() {
      return {
        leonita:
          "Leonita Krasniqi është kolegia ime dhe koordinatore për akademitë si " + COLLEAGUE_GROUP.leonita +
            ". Ajo do të jetë e lumtur t'ju ndihmojë me çdo detaj!",
        flaka:
          "Flaka Dermaku është kolegia ime dhe koordinatore për akademitë si " + COLLEAGUE_GROUP.flaka +
            ". Ajo do të jetë e lumtur t'ju ndihmojë me çdo detaj!"
      };
    }

    function detectBioTarget(text) {
      var hasFlaka = hasWord(text, "flaka") || text.indexOf("flakë") !== -1;
      var hasLeonita = hasWord(text, "leonita");
      if (!hasFlaka && !hasLeonita) return null;
      var asks = hasWord(text, "kush") || hasWord(text, "who") || hasWord(text, "është") ||
        hasWord(text, "eshte") || hasWord(text, "is") || hasWord(text, "rreth") ||
        hasWord(text, "about") || hasWord(text, "koordinatore") || hasWord(text, "koordinator");
      if (!asks) return null;
      if (hasFlaka && !hasLeonita) return "flaka";
      if (hasLeonita && !hasFlaka) return "leonita";
      return null;
    }

    function bioReply(who) {
      return {
        reply: bios()[who],
        fallback: false,
        kind: "bio",
        cta: who === "flaka" ? { flaka: true, leonita: false, single: "flaka" } : { flaka: false, leonita: true, single: "leonita" }
      };
    }

    function fallbackFor(qAcad) {
      return { reply: routingText(qAcad), fallback: true, kind: "fallback", cta: routingTargets(qAcad) };
    }

    function contactReply(text, qAcad) {
      var t = contactTargets(text, qAcad);
      return { reply: contactIntro(t.single), fallback: true, kind: "contact", cta: t };
    }

    function clarify() {
      return {
        reply: "Mund t'ju ndihmoj. Për cilën akademi bëhet fjalë?\n" + academyNames() + "\nMë tregoni për cilën.",
        fallback: false,
        kind: "clarify"
      };
    }

    // The people entry (lecturers / mentors / trainers) of one academy.
    function peopleEntryFor(id) {
      for (var i = 0; i < index.length; i++) {
        if (index[i].isPeople && index[i].academies[id]) return index[i];
      }
      return null;
    }

    // Mentor-style profiles available for an academy: its own first, then the
    // ones from the other academies.
    function mentorProfiles(id) {
      var out = [];
      var seen = {};
      function push(p) {
        if (!p || !p.name) return;
        var key = p.name.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        out.push(p);
      }
      var order = id ? [id] : [];
      keys(ACADEMIES).forEach(function (a) {
        if (a !== id) order.push(a);
      });
      order.forEach(function (a) {
        var e = peopleEntryFor(a);
        if (!e) return;
        peopleOf(e).forEach(function (p) {
          if (isMentor(p)) push(p);
        });
      });
      return out.slice(0, 5);
    }

    // People questions always resolve to that academy's lecturer list, never
    // to module hours or course blurbs. When an academy has no named lecturer
    // mapped, answer with the available mentor profiles instead.
    function peopleReply(qAcad) {
      var ids = keys(qAcad);
      var entry = null;
      var id = null;
      for (var i = 0; i < ids.length && !entry; i++) {
        var cand = peopleEntryFor(ids[i]);
        if (cand) {
          entry = cand;
          id = ids[i];
        }
      }
      if (!id) id = ids[0];

      if (entry && entry.people && entry.people.length) {
        var head = "Ligjëruesit në Akademinë e " + (PEOPLE_LABELS[id] || "këtë akademi") + ":";
        return {
          reply: head + "\n\n" + formatPeopleBullets(entry.people),
          fallback: false,
          kind: "people"
        };
      }

      var body = "Ligjëruesit tanë për këtë akademi janë ekspertë të industrisë, " +
        "me përvojë të verifikuar dhe praktika reale në fusha të ndryshme.";
      var mentors = mentorProfiles(id);
      if (mentors.length) {
        body += "\n\nProfilet e mentorëve në dispozicion:\n\n" + formatPeopleBullets(mentors);
      }
      body += "\n\n" + routingText(qAcad);
      return { reply: body, fallback: true, kind: "people", cta: routingTargets(qAcad) };
    }

    function formatEuro(n) {
      return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    // A general question about an academy ("dua te di per HR") must resolve to
    // the structured overview of that academy, never to one of its modules.
    function overviewEntryFor(id) {
      for (var i = 0; i < index.length; i++) {
        if (index[i].isOverview && index[i].academyId === id) return index[i];
      }
      return null;
    }

    function formatOverview(o, fallbackAnswer) {
      var lines = [];
      lines.push("**" + (o.title || "") + "**");
      lines.push("");
      lines.push(o.summary || fallbackAnswer || "");
      lines.push("");
      lines.push("• **Kohëzgjatja:** " + (o.duration || "—"));
      lines.push("• **Modulet Kryesore:** " +
        (Array.isArray(o.modules) && o.modules.length ? o.modules.join(", ") : "—"));
      lines.push("• **Çertifikimi:** " +
        (o.certification || "Çertifikatë e njohur ndërkombëtarisht"));
      lines.push("• **Ligjëruesit:** " +
        (o.lecturers || "Ekspertë të industrisë nga kompani udhëheqëse"));
      return lines.join("\n");
    }

    function overviewReply(qAcad) {
      var ids = keys(qAcad);
      var blocks = [];
      for (var i = 0; i < ids.length; i++) {
        var e = overviewEntryFor(ids[i]);
        if (!e) continue;
        blocks.push(formatOverview(e.overview || {}, e.answer));
      }
      if (!blocks.length) return null;
      var tail = "A dëshironi të shihni syllabus-in e plotë apo të flisni me një këshilltar karriere?";
      return {
        reply: blocks.join("\n\n") + "\n\n" + tail,
        fallback: false,
        kind: "overview"
      };
    }

    function findPriceEntry(id) {
      for (var i = 0; i < index.length; i++) {
        if (index[i].academies[id] && index[i].intents.price) return index[i];
      }
      return null;
    }

    // Up to 15 monthly installments, with total / 15 estimated for each tier.
    function installmentReply(qAcad) {
      var lines = [];
      keys(qAcad).forEach(function (id) {
        var e = findPriceEntry(id);
        if (!e) return;
        parseTiers(e.answer).forEach(function (t) {
          var monthly = Math.round(t.total / 15);
          var label = t.label;
          lines.push("• " + academyLabel(id) + (label ? " (" + label + ")" : "") + ": €" + formatEuro(t.total) +
            " gjithsej, rreth €" + monthly + " në muaj");
        });
      });
      if (!lines.length) return null;
      var head = "Creative Hub Kosovo ofron plane fleksibile pagese deri në 15 këste mujore.";
      var tail = "Këto janë vlera të përllogaritura bazuar në çmimin total, ndaj ekipi mund t'ju konfirmojë planin e saktë.";
      return { reply: head + "\n" + lines.join("\n") + "\n" + tail, fallback: false, kind: "installments" };
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

      var words = text.split(" ").filter(Boolean);
      var isGreeting = words.length <= 4 && GREETINGS.some(function (g) { return hasWord(text, g); });
      if (isGreeting) {
        return {
          reply: cfg.greeting || STRINGS.greeting,
          fallback: false, kind: "greeting"
        };
      }
      if (words.length <= 3 && THANKS.some(function (g) { return hasWord(text, g); })) {
        return { reply: STRINGS.thanks, fallback: false, kind: "thanks" };
      }

      var bioWho = detectBioTarget(text);
      if (bioWho) return bioReply(bioWho);

      var qAcad = detectAcademies(text);
      if (!keys(qAcad).length) {
        var carried = inferAcademyFromHistory(history);
        if (carried) qAcad[carried] = true;
      }
      var qIntent = detectIntents(text);

      var strongContact = CONTACT_STRONG.some(function (k) { return matchKeyword(text, k); });
      if (strongContact || (qIntent.contact && !keys(qAcad).length)) {
        return contactReply(text, qAcad);
      }

      var wantsSpecific = keys(qIntent).some(function (i) { return ACADEMY_SPECIFIC[i]; });
      if (wantsSpecific && keys(qAcad).length === 0) {
        return clarify();
      }

      // "Kush janë ligjeruesit e ..." -> the lecturer list of that academy.
      if (qIntent.people && keys(qAcad).length) {
        return peopleReply(qAcad);
      }

      // "Dua te di per HR" / "tell me about the Data Science academy" ->
      // the structured overview of that academy.
      var wantsOverview = keys(qAcad).length &&
        (qIntent.overview || !hasSpecificIntent(qIntent));
      if (wantsOverview) {
        var ov = overviewReply(qAcad);
        if (ov) return ov;
      }

      if (qIntent.payment && keys(qAcad).length) {
        var inst = installmentReply(qAcad);
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
        var reply = best.answer;
        // A people entry without the lecturers schema still comes back as one
        // dense paragraph: split it into the same bullet layout.
        if (best.isPeople && !best.people) {
          var people = formatPeopleList(best.answer);
          if (people) reply = people;
        }
        return { reply: reply, fallback: false, kind: "entry", topic: best.topic, score: bestScore };
      }
      return fallbackFor(qAcad);
    }

    return {
      respond: respond,
      index: index,
      detectAcademies: detectAcademies,
      detectIntents: detectIntents,
      peopleReply: peopleReply,
      overviewReply: overviewReply,
      overviewEntryFor: overviewEntryFor,
      mentorProfiles: mentorProfiles,
      _score: scoreEntry
    };
  }

  var PURE = {
    tokenize: tokenize,
    stem: stem,
    hasWord: hasWord,
    detectAcademies: detectAcademies,
    detectIntents: detectIntents,
    parseAmount: parseAmount,
    parseTiers: parseTiers,
    parsePeople: parsePeople,
    parsePeopleBullets: parsePeopleBullets,
    formatPeopleList: formatPeopleList,
    formatPeopleBullets: formatPeopleBullets,
    isMentor: isMentor,
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

  // Absolute URL of the avatar image. Injected <style> rules resolve relative
  // URLs against the host page, not against chatbot.js, so this must be absolute.
  function avatarSrc() {
    if (CFG.avatarUrl) return CFG.avatarUrl;
    return scriptBase() + "assets/hubsy-avatar.jpg";
  }

  // Photo card shown inside the thread, above the first greeting bubble.
  function avatarCard() {
    var fig = el("figure", "hubsy-card");
    var img = document.createElement("img");
    img.className = "hubsy-card-img";
    img.src = avatarSrc();
    img.alt = "Hubsy, asistenti AI i Creative Hub Kosovo";
    img.decoding = "async";
    img.addEventListener("error", function () {
      fig.remove();
    });
    fig.appendChild(img);
    return fig;
  }

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  // Avatar as a real <img> so it shows on the very first bubble without waiting
  // for a probe; the "H" letter is the fallback if the photo fails to load.
  function makeAvatar(extraClass) {
    var a = el("div", "hubsy-avatar" + (extraClass ? " " + extraClass : ""));
    a.setAttribute("aria-hidden", "true");
    var img = document.createElement("img");
    img.alt = "";
    img.src = avatarSrc();
    img.addEventListener("error", function () {
      img.remove();
      a.textContent = "H";
    });
    a.appendChild(img);
    return a;
  }

  var LINK_RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|(\+?\d[\d\s]{6,}\d)/g;
  var BOLD_RE = /\*\*([^*\n]+)\*\*/g;

  // Turn bare emails and phone numbers into clickable links.
  function appendLinkified(p, line) {
    var last = 0;
    var m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(line)) !== null) {
      if (m.index > last) p.appendChild(document.createTextNode(line.slice(last, m.index)));
      var a = document.createElement("a");
      var val = m[0];
      if (m[1]) {
        a.href = "mailto:" + val;
        a.textContent = val;
      } else {
        a.href = "tel:" + val.replace(/[^\d+]/g, "");
        a.textContent = val;
      }
      p.appendChild(a);
      last = m.index + val.length;
    }
    if (last < line.length) p.appendChild(document.createTextNode(line.slice(last)));
  }

  // Render **bold** as real bold text, keeping links clickable inside it.
  function appendInline(p, line) {
    var last = 0;
    var m;
    BOLD_RE.lastIndex = 0;
    while ((m = BOLD_RE.exec(line)) !== null) {
      if (m.index > last) appendLinkified(p, line.slice(last, m.index));
      var strong = document.createElement("strong");
      appendLinkified(strong, m[1]);
      p.appendChild(strong);
      last = m.index + m[0].length;
    }
    if (last < line.length) appendLinkified(p, line.slice(last));
  }

  // Parse the reply markdown into DOM nodes:
  //   "**text**"  -> <strong>
  //   blank line  -> new paragraph
  //   newline     -> <br>
  //   "• item"    -> <ul><li>, with indented lines kept inside the item
  function bubbleText(container, text) {
    var lines = String(text).split("\n");
    var p = null;
    var ul = null;
    var li = null;

    lines.forEach(function (raw) {
      var line = raw.replace(/\s+$/, "");
      var bullet = line.match(/^\s*(?:[•\-\*]|\d+[.)])\s+(.*)$/);

      if (bullet) {
        p = null;
        // Reuse the open list so bullets stay in one <ul> across blank lines.
        var last = container.lastChild;
        if (!ul || !last || last !== ul) {
          ul = el("ul", "hubsy-list");
          container.appendChild(ul);
        }
        li = el("li", "hubsy-li");
        ul.appendChild(li);
        appendInline(li, bullet[1]);
        return;
      }

      if (!line.trim()) {
        p = null;
        li = null;
        return;
      }

      // Indented line inside the current bullet: the bio under its name.
      if (li && /^[ \t]{2,}/.test(raw)) {
        li.appendChild(document.createElement("br"));
        appendInline(li, raw.replace(/^[ \t]{2,}/, ""));
        return;
      }

      ul = null;
      li = null;
      if (!p) {
        p = el("p", "hubsy-p");
        container.appendChild(p);
      } else {
        p.appendChild(document.createElement("br"));
      }
      if (/^[ \t]{2,}/.test(raw)) {
        // Indented continuation of a plain line.
        var cont = el("span", "hubsy-cont");
        p.appendChild(cont);
        appendInline(cont, raw.replace(/^[ \t]{2,}/, ""));
        return;
      }
      appendInline(p, line);
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
      "#hubsy-root .hubsy-cont{display:inline-block;padding-left:16px}",
      "#hubsy-root .hubsy-list{margin:2px 0 8px;padding-left:20px}",
      "#hubsy-root .hubsy-li{margin:0 0 8px}",
      "#hubsy-root .hubsy-li:last-child{margin-bottom:0}",
      "#hubsy-root .hubsy-msg .hubsy-list:last-child{margin-bottom:0}",
      "#hubsy-root .hubsy-p a{color:" + CFG.accentDark + ";font-weight:600;text-decoration:underline}",
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
      "#hubsy-root .hubsy-card{margin:0 0 10px;padding:0;display:flex;justify-content:center}",
      "#hubsy-root .hubsy-card-img{display:block;width:100%;max-width:100%;aspect-ratio:1/1;max-height:220px;object-fit:cover;object-position:center 18%;border-radius:14px;box-shadow:0 6px 18px rgba(5,18,56,.18);background:" + CFG.soft + "}",
      "#hubsy-root .hubsy-row{display:flex;gap:8px;align-items:flex-end;max-width:88%}",
      "#hubsy-root .hubsy-row-bot{align-self:flex-start}",
      "#hubsy-root .hubsy-row .hubsy-msg{align-self:flex-end;max-width:calc(100% - 34px)}",
      "#hubsy-root .hubsy-bavatar{width:26px;height:26px;border-radius:50%;background:" + CFG.accentBright + ";color:" + CFG.navy + ";display:grid;place-items:center;font-weight:800;font-size:13px;flex:none;box-shadow:0 1px 3px rgba(5,18,56,.22)}",
      "#hubsy-root .hubsy-avatar img{width:100%;height:100%;object-fit:cover;object-position:center 18%;border-radius:50%;display:block}",
      "@keyframes hubsy-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
      "#hubsy-root .hubsy-msg{animation:hubsy-in .24s ease-out both}",
      "@media(prefers-reduced-motion:reduce){#hubsy-root .hubsy-msg{animation:none}}",
      "@media(max-width:480px){#hubsy-root{right:12px;bottom:12px;left:12px}#hubsy-root .hubsy-window{right:0;left:0;bottom:68px;width:auto;height:calc(100vh - 100px);max-height:none}#hubsy-root .hubsy-launcher{width:100%;justify-content:center}}"
    ].join("\n");

    var launcher = el("button", "hubsy-launcher");
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Hap bisedën me Hubsy");
    launcher.appendChild(makeAvatar());
    launcher.appendChild(el("span", "hubsy-launcher-label", CFG.launcherLabel));

    var win = el("div", "hubsy-window");
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-modal", "false");
    win.setAttribute("aria-label", "Bisedë me Hubsy");

    var head = el("div", "hubsy-head");
    var hAvatar = makeAvatar();
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
    input.setAttribute("placeholder", "Shkruani një mesazh…");
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

  function ctaBlock(spec) {
    spec = spec || {};
    var showFlaka = spec.flaka !== false;
    var showLeonita = spec.leonita !== false;

    var wrap = el("div", "hubsy-cta");
    function link(label, href) {
      var a = el("a", null, label);
      a.href = href;
      if (/^https?:/i.test(href)) { a.target = "_blank"; a.rel = "noopener"; }
      wrap.appendChild(a);
    }
    function person(c) {
      if (c.calendly) link(c.name + " · Cakto takim", c.calendly);
      link(c.name + " · " + c.phone, "tel:" + String(c.phone).replace(/[^\d+]/g, ""));
      link(c.email, "mailto:" + c.email);
    }
    if (showFlaka) person(CFG.contacts.flaka);
    if (showLeonita) person(CFG.contacts.leonita);
    if (CFG.applyUrl) link("Apliko", CFG.applyUrl);
    return wrap;
  }

  function addBubble(role, text, opts) {
    opts = opts || {};
    var b = el("div", "hubsy-msg hubsy-" + (role === "user" ? "user" : "bot"));
    bubbleText(b, text);
    if (opts.image) b.insertBefore(avatarCard(), b.firstChild);
    if (role !== "user" && opts.cta) b.appendChild(ctaBlock(opts.cta));
    if (role === "user") {
      ui.log.appendChild(b);
    } else {
      var row = el("div", "hubsy-row hubsy-row-bot");
      row.appendChild(makeAvatar("hubsy-bavatar"));
      row.appendChild(b);
      ui.log.appendChild(row);
    }
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
    if (CFG.endpoint) {
      return fetch(CFG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message, history: history.slice(-CFG.maxHistory), language: REPLY_LANG })
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
        var head = "Nuk mund t'i ngarkoj një çast informacionet, por koleget e mia Flaka dhe Leonita janë këtu për ju.";
        return { reply: head, fallback: true, cta: { flaka: true, leonita: true } };
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

    // Keep the typing indicator visible for at least 2-2.5s so replies feel typed.
    var minDelay = 2000 + Math.floor(Math.random() * 501);
    Promise.all([
      ask(text),
      new Promise(function (resolve) { setTimeout(resolve, minDelay); })
    ]).then(function (out) {
      var result = out[0];
      typing.remove();
      if (!result) result = { reply: CFG.greeting, fallback: false };
      history.push({ role: "assistant", content: result.reply });
      addBubble("bot", result.reply, { cta: result.cta });
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

  function showGreeting() {
    // First message of the chat: Hubsy's photo card plus his warm intro, with
    // his avatar also sitting beside the bubble.
    return addBubble("bot", CFG.greeting, { image: true });
  }

  function open() {
    ui.root.classList.add("hubsy-open");
    ui.launcher.setAttribute("aria-label", "Mbyll bisedën me Hubsy");
    if (!ui.log.childElementCount) showGreeting();
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
      addBubble(m.role, m.content);
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
