import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z"/></svg>',
  bookmarked: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
};

const feed = document.getElementById("feed");
const authBtn = document.getElementById("authBtn");
const adminBtn = document.getElementById("adminBtn");
const avatarBtn = document.getElementById("avatarBtn");

const authDialog = document.getElementById("authDialog");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authMsg = document.getElementById("authMsg");
const authSubmit = document.getElementById("authSubmit");
const authTitle = document.getElementById("authTitle");
const authSub = document.getElementById("authSub");
const authSwitch = document.getElementById("authSwitch");
const authSwitchText = document.getElementById("authSwitchText");

const adminDialog = document.getElementById("adminDialog");
const adminForm = document.getElementById("adminForm");
const adminMsg = document.getElementById("adminMsg");
const adminSubmit = document.getElementById("adminSubmit");
const adminCancel = document.getElementById("adminCancel");

let currentUser = null;
let videos = [];
const bookmarks = new Set();
let authMode = "signin";
const cardObserver = new IntersectionObserver(onVisibility, { threshold: 0.6 });

/* ---------------- Auth ---------------- */

function setAuthMode(mode) {
  authMode = mode;
  const signin = mode === "signin";
  authTitle.textContent = signin ? "Sign in to Curio" : "Create your account";
  authSub.textContent = signin
    ? "Bookmark clips and contribute to the feed."
    : "Join Curio to save clips you love.";
  authSubmit.textContent = signin ? "Sign in" : "Create account";
  authSwitchText.textContent = signin ? "New to Curio?" : "Already have an account?";
  authSwitch.textContent = signin ? "Create an account" : "Sign in";
  authPassword.autocomplete = signin ? "current-password" : "new-password";
  authMsg.textContent = "";
  authMsg.className = "msg";
}

function openAuth() {
  setAuthMode("signin");
  authDialog.showModal();
}

authBtn.addEventListener("click", openAuth);
authSwitch.addEventListener("click", () => setAuthMode(authMode === "signin" ? "signup" : "signin"));
document.getElementById("avatarBtn").addEventListener("click", () => {
  signOut(auth).catch(() => {});
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = authEmail.value.trim();
  const password = authPassword.value;
  authSubmit.disabled = true;
  authMsg.textContent = "";
  authMsg.className = "msg";
  try {
    if (authMode === "signin") {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }
    authForm.reset();
    authDialog.close();
  } catch (err) {
    authMsg.textContent = err.message.replace("Firebase: ", "");
    authMsg.className = "msg error";
  } finally {
    authSubmit.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    authBtn.hidden = true;
    avatarBtn.classList.add("on");
    avatarBtn.textContent = (user.email || "?").charAt(0).toUpperCase();
    avatarBtn.title = `${user.email} — sign out`;
    adminBtn.hidden = false;
    await loadBookmarks();
  } else {
    authBtn.hidden = false;
    avatarBtn.classList.remove("on");
    adminBtn.hidden = true;
    bookmarks.clear();
  }
  refreshBookmarkUI();
});

/* ---------------- Bookmarks ---------------- */

async function loadBookmarks() {
  bookmarks.clear();
  const snap = await getDocs(collection(db, "users", currentUser.uid, "bookmarks"));
  snap.forEach((d) => bookmarks.add(d.id));
}

async function toggleBookmark(videoId, btn) {
  if (!currentUser) return openAuth();
  const ref = doc(db, "users", currentUser.uid, "bookmarks", videoId);
  btn.disabled = true;
  try {
    if (bookmarks.has(videoId)) {
      await deleteDoc(ref);
      bookmarks.delete(videoId);
    } else {
      await setDoc(ref, { videoId, createdAt: serverTimestamp() });
      bookmarks.add(videoId);
    }
    paintBookmark(btn, videoId);
  } finally {
    btn.disabled = false;
  }
}

function paintBookmark(btn, videoId) {
  const on = bookmarks.has(videoId);
  btn.classList.toggle("active", on);
  btn.innerHTML = on ? ICONS.bookmarked : ICONS.bookmark;
  btn.setAttribute("aria-label", on ? "Remove bookmark" : "Bookmark clip");
}

function refreshBookmarkUI() {
  feed.querySelectorAll(".bookmark-btn").forEach((btn) => {
    paintBookmark(btn, btn.dataset.id);
  });
}

/* ---------------- Link parsing ---------------- */

function parseMediaUrl(rawUrl) {
  const url = (rawUrl || "").trim();
  if (!url) return { type: "unknown", original: url };

  let u;
  try {
    u = new URL(url);
  } catch {
    return { type: "unknown", original: url };
  }

  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const path = u.pathname;

  // YouTube — Shorts, watch, embed, youtu.be
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    let id = "";
    if (path.startsWith("/shorts/")) id = path.split("/shorts/")[1].split("/")[0];
    else if (path === "/watch") id = u.searchParams.get("v") || "";
    else if (path.startsWith("/embed/")) id = path.split("/embed/")[1].split("/")[0];
    else if (path.startsWith("/live/")) id = path.split("/live/")[1].split("/")[0];
    if (id) return { type: "youtube", id, embedUrl: youtubeEmbed(id), original: url };
  }
  if (host === "youtu.be") {
    const id = path.slice(1).split("/")[0];
    if (id) return { type: "youtube", id, embedUrl: youtubeEmbed(id), original: url };
  }

  // Instagram — posts, reels, tv
  if (host === "instagram.com" || host === "instagr.am") {
    const m = path.match(/\/(p|reel|reels|tv)\/([^/?#]+)/);
    if (m) {
      return {
        type: "instagram",
        id: m[2],
        embedUrl: `https://www.instagram.com/p/${m[2]}/embed/`,
        original: url,
      };
    }
  }

  // TikTok — full video URLs (short vm./vt. links cannot be resolved client-side)
  if (host === "tiktok.com" || host === "m.tiktok.com") {
    const m = path.match(/\/video\/(\d+)/);
    if (m) {
      return {
        type: "tiktok",
        id: m[1],
        embedUrl: `https://www.tiktok.com/embed/v2/${m[1]}`,
        original: url,
      };
    }
  }

  // Direct video files
  if (/\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/i.test(path)) {
    return { type: "video", srcUrl: url, original: url };
  }

  return { type: "unknown", original: url };
}

function youtubeEmbed(id) {
  return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&playsinline=1&rel=0&modestbranding=1`;
}

/* ---------------- Feed ---------------- */

function renderFeed() {
  feed.innerHTML = "";
  cardObserver.disconnect();

  if (!videos.length) {
    feed.appendChild(emptyState());
    return;
  }

  videos.forEach((v) => feed.appendChild(buildCard(v)));
  feed.querySelectorAll(".video-card").forEach((c) => cardObserver.observe(c));
}

function buildCard(v) {
  const card = document.createElement("article");
  card.className = "video-card";
  card.dataset.id = v.id;

  const media = parseMediaUrl(v.videoUrl);
  card.dataset.type = media.type;

  if (media.type === "video") {
    card.classList.add("paused");
    card.appendChild(buildVideo(media.srcUrl, card));
    card.appendChild(buildPlayToggle(card));
    card.appendChild(buildPlayBadge());
    card.appendChild(buildScrim());
  } else if (media.type === "unknown") {
    card.appendChild(buildLinkFallback(media.original));
  } else {
    card.appendChild(buildEmbed(media));
    card.appendChild(buildScrim());
  }

  card.appendChild(buildContent(v));
  card.appendChild(buildRail(v));
  return card;
}

function buildVideo(src, card) {
  const video = document.createElement("video");
  video.src = src;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.addEventListener("error", () => {
    const scrim = card.querySelector(".scrim");
    if (scrim) scrim.style.background = "linear-gradient(to top, #e5e7eb, #f8f7f4)";
  });
  return video;
}

function buildEmbed(media) {
  const shell = document.createElement("div");
  shell.className = "embed-shell";

  const frame = document.createElement("iframe");
  frame.className = "embed-frame";
  frame.dataset.src = media.embedUrl; // loaded only when the card is in view
  frame.title = `Embedded ${media.type} clip`;
  frame.loading = "lazy";
  frame.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write");
  frame.setAttribute("allowfullscreen", "");
  frame.setAttribute("scrolling", "no");
  frame.setAttribute("frameborder", "0");
  shell.appendChild(frame);
  return shell;
}

function buildLinkFallback(url) {
  const wrap = document.createElement("div");
  wrap.className = "link-fallback";

  const a = document.createElement("a");
  a.className = "link-fallback-card";
  if (url) {
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
  a.innerHTML = `
    <span class="lf-icon">${ICONS.link}</span>
    <span class="lf-title">Link embedded</span>
    <span class="lf-sub">Tap to open in new tab</span>`;
  wrap.appendChild(a);
  return wrap;
}

function buildPlayToggle(card) {
  const tap = document.createElement("button");
  tap.className = "play-toggle";
  tap.type = "button";
  tap.setAttribute("aria-label", "Play or pause");
  tap.addEventListener("click", () => togglePlay(card));
  return tap;
}

function buildPlayBadge() {
  const badge = document.createElement("div");
  badge.className = "play-badge";
  badge.innerHTML = ICONS.play;
  return badge;
}

function buildScrim() {
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  return scrim;
}

function buildContent(v) {
  const content = document.createElement("div");
  content.className = "card-content";
  content.innerHTML = `
    <span class="badge">#${escapeHtml(v.category || "General")}</span>
    <h2 class="video-title">${escapeHtml(v.title || "Untitled clip")}</h2>
    <div class="meta">
      <span class="handle">${escapeHtml(v.creatorHandle || "@unknown")}</span>
      <span class="credit-tag">${escapeHtml(v.creatorCredit || "Curio Original")}</span>
    </div>`;
  return content;
}

function buildRail(v) {
  const rail = document.createElement("div");
  rail.className = "rail";
  const bm = document.createElement("button");
  bm.className = "bookmark-btn";
  bm.dataset.id = v.id;
  bm.addEventListener("click", () => toggleBookmark(v.id, bm));
  paintBookmark(bm, v.id);
  rail.appendChild(bm);
  return rail;
}

function togglePlay(card) {
  const video = card.querySelector("video");
  if (!video) return;
  if (video.paused) {
    video.play().then(() => card.classList.remove("paused")).catch(() => {});
  } else {
    video.pause();
    card.classList.add("paused");
  }
}

function onVisibility(entries) {
  entries.forEach((entry) => {
    const card = entry.target;
    const video = card.querySelector("video");
    const frame = card.querySelector(".embed-frame");

    if (entry.isIntersecting) {
      if (video) {
        video.play().then(() => card.classList.remove("paused")).catch(() => card.classList.add("paused"));
        clearTimeout(card._idle);
        card._idle = setTimeout(() => video.pause(), 60000);
      }
      if (frame && frame.dataset.src && frame.getAttribute("src") !== frame.dataset.src) {
        frame.src = frame.dataset.src;
      }
    } else {
      if (video) {
        video.pause();
        video.currentTime = 0;
        card.classList.add("paused");
      }
      if (frame) frame.src = "about:blank";
      clearTimeout(card._idle);
    }
  });
}

function emptyState() {
  const el = document.createElement("section");
  el.className = "state-screen";
  el.innerHTML = `
    <span class="badge">#Curio</span>
    <h2>Nothing here yet</h2>
    <p id="emptyMsg">The feed is empty. Sign in to add the first clip.</p>
    <button class="btn btn-primary" id="emptyBtn">Add a clip</button>`;
  el.querySelector("#emptyBtn").addEventListener("click", () => {
    currentUser ? openAdmin() : openAuth();
  });
  return el;
}

async function loadVideos() {
  try {
    const q = query(collection(db, "videos"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    videos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    const snap = await getDocs(collection(db, "videos"));
    videos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    videos.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }
  renderFeed();
}

/* ---------------- Admin ---------------- */

function openAdmin() {
  adminMsg.textContent = "";
  adminMsg.className = "msg";
  adminDialog.showModal();
}

adminBtn.addEventListener("click", openAdmin);
adminCancel.addEventListener("click", () => adminDialog.close());

adminForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return openAuth();

  const data = {
    videoUrl: document.getElementById("vUrl").value.trim(),
    title: document.getElementById("vTitle").value.trim(),
    category: document.getElementById("vCategory").value,
    creatorHandle: document.getElementById("vHandle").value.trim(),
    creatorCredit: document.getElementById("vCredit").value.trim(),
    createdAt: serverTimestamp(),
    authorId: currentUser.uid,
  };

  adminSubmit.disabled = true;
  adminMsg.textContent = "Publishing…";
  adminMsg.className = "msg";
  try {
    await addDoc(collection(db, "videos"), data);
    adminForm.reset();
    adminDialog.close();
    await loadVideos();
    feed.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    adminMsg.textContent = err.message.replace("Firebase: ", "");
    adminMsg.className = "msg error";
  } finally {
    adminSubmit.disabled = false;
  }
});

/* ---------------- Utils ---------------- */

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

loadVideos();
