import { createElement, useMemo } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";
import type { Platform as VideoPlatform, Video } from "../types/models";
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

// Third-party embeds ship their own chrome: Instagram's "View profile" header and
// "View more on Instagram / Add a comment" footer plus card side shadows, and
// TikTok's own header/footer. We render the embed oversized inside a clipping
// cropper so only the vertical video remains; the card's rounded, overflow-hidden
// wrapper hides anything that still spills past the bottom edge.
interface Crop {
  top: string;
  left: string;
  width: string;
  height: string;
}

const FULL: Crop = { top: "0%", left: "0%", width: "100%", height: "100%" };

const CROP: Record<VideoPlatform, Crop> = {
  instagram: { top: "-15%", left: "-5%", width: "110%", height: "135%" },
  tiktok: { top: "-8%", left: "-3%", width: "106%", height: "122%" },
  youtube: FULL,
  curio: FULL,
};

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
  const crop = CROP[video.platform] ?? FULL;

  // The media layer is always present so a card is never an empty/black box:
  // a poster/thumbnail when available, otherwise a branded placeholder. The
  // embed is layered on top only for the active card, so off-screen cards keep
  // their structure and the embed mounts instantly when a card becomes current.
  const backdrop = poster ? (
    <Image source={{ uri: poster }} style={styles.media} resizeMode="cover" />
  ) : (
    <VideoPlaceholder platform={video.platform} authorHandle={video.authorHandle} />
  );

  const mountEmbed = active && !!src;
  const embedStyle = {
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
        {backdrop}
        {mountEmbed
          ? createElement(
              "div",
              { style: styles.cropper },
              createElement("iframe", {
                src,
                title: video.title,
                allow: "autoplay; encrypted-media; picture-in-picture; clipboard-write",
                allowFullScreen: true,
                frameBorder: 0,
                style: embedStyle,
              }),
            )
          : null}
      </View>
    );
  }

  const WebView = require("react-native-webview").WebView;
  return (
    <View style={styles.frame}>
      {backdrop}
      {mountEmbed ? (
        <WebView
          originWhitelist={["*"]}
          source={{ uri: src }}
          style={embedStyle}
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

const styles = StyleSheet.create({
  frame: { ...StyleSheet.absoluteFillObject, overflow: "hidden", backgroundColor: "#171a26" },
  cropper: {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    pointerEvents: "auto",
  },
  media: { width: "100%", height: "100%" },
});
