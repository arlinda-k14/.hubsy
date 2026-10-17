import { createElement, useMemo } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";
import type { Video } from "../types/models";
import { VideoPlaceholder } from "./VideoPlaceholder";

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("youtu.be")) return u.pathname.slice(1).split("/")[0] || null;
    if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/shorts/")[1].split("/")[0];
    if (u.pathname === "/watch") return u.searchParams.get("v");
    if (u.pathname.startsWith("/embed/")) return u.pathname.split("/embed/")[1].split("/")[0];
    return null;
  } catch {
    return null;
  }
}

// A thumbnail to show behind / instead of the embed. Prefer a stored poster,
// then derive a YouTube still. TikTok/Instagram provide no static JPEG without
// a per-item API call, so those fall back to the styled placeholder.
function posterFor(video: Video): string | null {
  if (video.posterUrl) return video.posterUrl;
  if (video.platform === "youtube") {
    const id = video.platformVideoId ?? (video.originalUrl ? youtubeId(video.originalUrl) : null);
    if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }
  return null;
}

interface Props {
  video: Video;
  muted: boolean;
  active: boolean;
}

export function EmbedPlayer({ video, muted, active }: Props) {
  const src = useMemo(() => {
    if (video.embedUrl) {
      if (video.platform === "youtube") {
        const id = video.platformVideoId ?? youtubeId(video.embedUrl);
        if (id) {
          return `https://www.youtube.com/embed/${id}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&playsinline=1&loop=1&playlist=${id}&modestbranding=1&rel=0`;
        }
      }
      if (video.platform === "linkedin") {
        // LinkedIn's /embed/feed/update endpoint is already a self-contained,
        // responsive post player - hand it to the iframe verbatim.
        return video.embedUrl;
      }
      return video.embedUrl;
    }
    if (video.platform === "youtube" && video.originalUrl) {
      const id = youtubeId(video.originalUrl);
      if (!id) return null;
      return `https://www.youtube.com/embed/${id}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&playsinline=1&loop=1&playlist=${id}&modestbranding=1&rel=0`;
    }
    return null;
  }, [video.embedUrl, video.originalUrl, video.platform, video.platformVideoId, muted]);

  const poster = useMemo(() => posterFor(video), [video]);

  // Layer 1 (back, z-index 1): poster/thumbnail or the styled placeholder. It
  // always fills the frame, so an off-screen or not-yet-loaded card is never a
  // broken/black box.
  const backdrop = poster ? (
    <Image source={{ uri: poster }} style={styles.media} resizeMode="cover" />
  ) : (
    <VideoPlaceholder platform={video.platform} authorHandle={video.authorHandle} />
  );

  // Layer 2 (front, z-index 2): the live embed, mounted only for the active
  // card so exactly one video ever plays. It renders above the placeholder.
  const mountEmbed = active && !!src;

  if (Platform.OS === "web") {
    return (
      <View style={styles.frame}>
        <View style={styles.layerBack}>{backdrop}</View>
        {mountEmbed ? (
          <View style={styles.layerFront}>
            {createElement("iframe", {
              src,
              title: video.title,
              allow: "autoplay; encrypted-media; picture-in-picture; clipboard-write",
              allowFullScreen: true,
              frameBorder: 0,
              style: iframeStyle,
            })}
          </View>
        ) : null}
      </View>
    );
  }

  const WebView = require("react-native-webview").WebView;
  return (
    <View style={styles.frame}>
      <View style={styles.layerBack}>{backdrop}</View>
      {mountEmbed ? (
        <WebView
          originWhitelist={["*"]}
          source={{ uri: src }}
          style={styles.webview}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          scrollEnabled={false}
          javaScriptEnabled
          domStorageEnabled
        />
      ) : null}
    </View>
  );
}

// Explicit, crop-free sizing so the embed always paints edge-to-edge above the
// placeholder layer (never behind it, never at zero size). pointerEvents is
// auto so an active embed is fully interactive.
const iframeStyle = {
  display: "block",
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  borderWidth: 0,
  borderStyle: "none",
  margin: 0,
  padding: 0,
  zIndex: 2,
  pointerEvents: "auto",
} as const;

const styles = StyleSheet.create({
  // Own stacking context so the inner z-index 1/2 layers order deterministically.
  frame: { ...StyleSheet.absoluteFillObject, overflow: "hidden", backgroundColor: "#171a26", zIndex: 1 },
  layerBack: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  layerFront: { ...StyleSheet.absoluteFillObject, overflow: "hidden", zIndex: 2, pointerEvents: "auto" },
  media: { width: "100%", height: "100%" },
  webview: { ...StyleSheet.absoluteFillObject, zIndex: 2, backgroundColor: "transparent" },
});
