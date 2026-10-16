import type { Platform } from "../types/models";

export interface ParsedLink {
  platform: Platform;
  videoId: string;
  embedUrl: string;
  originalUrl: string;
  authorHandle: string | null;
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

export function parseVideoLink(raw: string): ParseResult {
  const url = toUrl(raw);
  if (!url) return { ok: false, error: "Enter a valid YouTube, TikTok or Instagram link." };

  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    return youtube(url);
  }
  if (host.endsWith("tiktok.com")) return tiktok(url);
  if (host.endsWith("instagram.com")) return instagram(url);

  return { ok: false, error: "Only YouTube, TikTok and Instagram links are supported." };
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  curio: "Curio",
};
