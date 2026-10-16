import { createElement, useMemo } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";
import type { Platform as VideoPlatform, Video } from "../types/models";

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

// Third-party embeds ship their own UI chrome (Instagram's "View profile" header
// and "View more on Instagram / Add a comment" footer, plus card side shadows).
// We render the iframe larger than its frame and clip it, so only the vertical
// video itself remains visible. Values are % of the frame box.
interface Crop {
  top: string;
  left: string;
  width: string;
  height: string;
}

const FULL: Crop = { top: "0%", left: "0%", width: "100%", height: "100%" };

const CROP: Record<VideoPlatform, Crop> = {
  instagram: { top: "-12%", left: "-4%", width: "108%", height: "145%" },
  tiktok: { top: "-4%", left: "-1%", width: "102%", height: "110%" },
  youtube: FULL,
  curio: FULL,
};

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
      return video.embedUrl;
    }
    if (video.platform === "youtube" && video.originalUrl) {
      const id = youtubeId(video.originalUrl);
      if (!id) return null;
      return `https://www.youtube.com/embed/${id}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&playsinline=1&loop=1&playlist=${id}&modestbranding=1&rel=0`;
    }
    return null;
  }, [video.embedUrl, video.originalUrl, video.platform, video.platformVideoId, muted]);

  const poster = video.posterUrl ? (
    <Image source={{ uri: video.posterUrl }} style={styles.poster} resizeMode="cover" />
  ) : null;

  // Strict single-playback: only the centered card mounts an embed. Everything
  // else shows the poster, so no secondary iframe can ever autoplay.
  if (!active || !src) {
    return <View style={styles.frame}>{poster}</View>;
  }

  const crop = CROP[video.platform] ?? FULL;
  const cropStyle = {
    position: "absolute" as const,
    top: crop.top,
    left: crop.left,
    width: crop.width,
    height: crop.height,
    borderWidth: 0,
    pointerEvents: "auto" as const,
  };

  if (Platform.OS === "web") {
    return (
      <View style={styles.frame}>
        {createElement("iframe", {
          src,
          allow: "autoplay; encrypted-media; picture-in-picture; clipboard-write",
          allowFullScreen: true,
          frameBorder: 0,
          style: cropStyle,
        })}
      </View>
    );
  }

  const WebView = require("react-native-webview").WebView;
  return (
    <View style={styles.frame}>
      <WebView
        originWhitelist={["*"]}
        source={{ uri: src }}
        style={cropStyle}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { ...StyleSheet.absoluteFillObject, overflow: "hidden", backgroundColor: "#0c0d12" },
  poster: { width: "100%", height: "100%" },
});
