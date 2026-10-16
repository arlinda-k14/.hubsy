import { createElement, useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import type { Video } from "../types/models";

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

  if (!src) {
    return <View style={styles.fill} />;
  }

  if (Platform.OS === "web") {
    return (
      <View style={styles.fill} pointerEvents={active ? "auto" : "none"}>
        {createElement("iframe", {
          src,
          allow: "autoplay; encrypted-media; picture-in-picture; clipboard-write",
          allowFullScreen: true,
          frameBorder: 0,
          style: { width: "100%", height: "100%", border: 0 },
        })}
      </View>
    );
  }

  const WebView = require("react-native-webview").WebView;
  return (
    <View style={styles.fill} pointerEvents={active ? "auto" : "none"}>
      <WebView
        originWhitelist={["*"]}
        source={{ uri: src }}
        style={styles.fill}
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
  fill: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0c0d12" },
});
