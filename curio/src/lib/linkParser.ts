import type { Platform } from "../types/models";

export interface ParsedLink {
  platform: Platform;
  videoId: string;
  embedUrl: string;
  originalUrl: string;
  authorHandle: string | null;
  // Best-effort title we can pull from the URL itself (currently LinkedIn post
  // slugs). Used to pre-fill the Title field so the creator doesn't start blank.
  suggestedTitle?: string | null;
}

export type ParseResult = { ok: true; value: ParsedLink } | { ok: false; error: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function toUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) return null;
    return url;
  } catch {
    return null;
  }
}

function youtube(url: URL): ParseResult {
  const host = url.hostname.replace(/^www\.|^m\.|^music\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  let id: string | null = null;

  if (host === "youtu.be") {
    id = parts[0] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") id = parts[1] ?? null;
  }

  if (!id || !YOUTUBE_ID.test(id)) {
    return { ok: false, error: "Couldn’t read that YouTube link. Use a watch, Shorts, or youtu.be URL." };
  }

  const handleFromPath = parts[0]?.startsWith("@") ? parts[0] : null;

  return {
    ok: true,
    value: {
      platform: "youtube",
      videoId: id,
      embedUrl: `https://www.youtube.com/embed/${id}`,
      originalUrl: `https://www.youtube.com/watch?v=${id}`,
      authorHandle: handleFromPath,
    },
  };
}

function tiktok(url: URL): ParseResult {
  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") {
    return { ok: false, error: "Short TikTok links aren’t supported. Open the video and copy the full tiktok.com/@user/video/… URL." };
  }
  const parts = url.pathname.split("/").filter(Boolean);
  const handle = parts[0]?.startsWith("@") ? parts[0] : null;
  const videoIndex = parts.indexOf("video");
  const id = videoIndex >= 0 ? parts[videoIndex + 1] : null;

  if (!id || !/^\d+$/.test(id)) {
    return { ok: false, error: "Couldn’t read that TikTok link. Copy the full URL that includes /video/." };
  }

  return {
    ok: true,
    value: {
      platform: "tiktok",
      videoId: id,
      embedUrl: `https://www.tiktok.com/embed/v2/${id}`,
      originalUrl: handle ? `https://www.tiktok.com/${handle}/video/${id}` : url.origin + url.pathname,
      authorHandle: handle,
    },
  };
}

function instagram(url: URL): ParseResult {
  const parts = url.pathname.split("/").filter(Boolean);
  const kinds = ["p", "reel", "reels", "tv"];
  let kind: string | null = null;
  let code: string | null = null;
  let handle: string | null = null;

  if (parts[0]?.startsWith("@") || (parts.length >= 3 && !kinds.includes(parts[0]))) {
    handle = `@${parts[0].replace(/^@/, "")}`;
  }

  const kindIndex = parts.findIndex((p) => kinds.includes(p));
  if (kindIndex >= 0) {
    kind = parts[kindIndex] === "reels" ? "reel" : parts[kindIndex];
    code = parts[kindIndex + 1] ?? null;
  }

  if (!kind || !code || !/^[A-Za-z0-9_-]+$/.test(code)) {
    return { ok: false, error: "Couldn’t read that Instagram link. Use a /p/, /reel/ or /tv/ URL." };
  }

  return {
    ok: true,
    value: {
      platform: "instagram",
      videoId: code,
      embedUrl: `https://www.instagram.com/${kind}/${code}/embed`,
      originalUrl: `https://www.instagram.com/${kind}/${code}/`,
      authorHandle: handle,
    },
  };
}

// LinkedIn post / feed-update URLs we accept:
//   https://www.linkedin.com/feed/update/urn:li:activity:{id}/
//   https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:{id}   (or share)
//   https://www.linkedin.com/posts/{vanity}_{slug}-activity-{id}-{hash}/
// and rewrite them to LinkedIn's public embed endpoint
//   https://www.linkedin.com/embed/feed/update/urn:li:{kind}:{id}
const LINKEDIN_URN = /urn:li:(activity|ugcpost|share):(\d+)/i;
const LINKEDIN_SLUG_ACTIVITY = /activity-(\d{6,})/i;

function titleFromSlug(text: string): string | null {
  const clean = text.trim();
  if (clean.length < 8) return null;
  const cased = clean.charAt(0).toUpperCase() + clean.slice(1);
  return cased.length > 120 ? `${cased.slice(0, 117)}…` : cased;
}

function linkedin(url: URL): ParseResult {
  const path = decodeURIComponent(url.pathname);
  const urn = path.match(LINKEDIN_URN);
  const slugActivity = path.match(LINKEDIN_SLUG_ACTIVITY);
  const id = urn?.[2] ?? slugActivity?.[1] ?? null;

  if (!id) {
    return {
      ok: false,
      error:
        "Couldn’t read that LinkedIn link. Use a post or feed-update URL containing an activity, ugcPost or share id.",
    };
  }

  // Preserve the exact URN kind when the URL carries one (share / ugcPost /
  // activity); otherwise default to the ugcPost form LinkedIn's own
  // "Embed this post" control emits.
  const kind = urn ? urn[1].toLowerCase().replace("ugcpost", "ugcPost") : "ugcPost";
  const embedUrl = `https://www.linkedin.com/embed/feed/update/urn:li:${kind}:${id}`;

  const parts = path.split("/").filter(Boolean);
  const postsIndex = parts.indexOf("posts");
  const slug = postsIndex >= 0 ? parts[postsIndex + 1] : null;

  let authorHandle: string | null = null;
  let suggestedTitle: string | null = null;
  if (slug) {
    const underscore = slug.indexOf("_");
    if (underscore > 0) {
      const vanity = slug.slice(0, underscore);
      if (/^[A-Za-z0-9-]{2,}$/.test(vanity)) authorHandle = `@${vanity}`;
      const text = slug
        .slice(underscore + 1)
        .replace(/activity-\d+.*$/i, "")
        .replace(/-+$/g, "")
        .replace(/-/g, " ")
        .trim();
      suggestedTitle = titleFromSlug(text);
    } else if (!/activity-/i.test(slug) && /^[A-Za-z0-9-]{2,}$/.test(slug)) {
      authorHandle = `@${slug}`;
    }
  }

  return {
    ok: true,
    value: {
      platform: "linkedin",
      videoId: id,
      embedUrl,
      originalUrl: url.origin + url.pathname,
      authorHandle,
      suggestedTitle,
    },
  };
}

export function parseVideoLink(raw: string): ParseResult {
  const url = toUrl(raw);
  if (!url) return { ok: false, error: "Enter a valid YouTube, TikTok, Instagram or LinkedIn link." };

  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    return youtube(url);
  }
  if (host.endsWith("tiktok.com")) return tiktok(url);
  if (host.endsWith("instagram.com")) return instagram(url);
  if (host === "lnkd.in") {
    return { ok: false, error: "Short LinkedIn links aren’t supported. Open the post and copy the full linkedin.com URL." };
  }
  if (host.endsWith("linkedin.com")) return linkedin(url);

  return { ok: false, error: "Only YouTube, TikTok, Instagram and LinkedIn links are supported." };
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  curio: "Curio",
};
