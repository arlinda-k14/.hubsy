import { Ionicons } from "@expo/vector-icons";
import { VideoView, type VideoPlayer } from "expo-video";
import { createElement, useEffect, useRef, type ReactNode } from "react";
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { Video } from "../types/models";
import { EmbedPlayer } from "./EmbedPlayer";
import { VideoPlaceholder } from "./VideoPlaceholder";
import { Icon } from "./Icon";

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  curio: "Curio",
};

const PLATFORM_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  youtube: "logo-youtube",
  tiktok: "logo-tiktok",
  instagram: "logo-instagram",
  linkedin: "logo-linkedin",
  curio: "sparkles",
};

interface Props {
  video: Video;
  player: VideoPlayer | null;
  isCurrent: boolean;
  soundEnabled: boolean;
  liked: boolean;
  saved: boolean;
  likeCount: number;
  commentCount: number;
  width: number;
  height: number;
  radius?: number;
  onActivate: () => void;
  onLike: () => void;
  onComment: () => void;
  onSave: () => void;
  onReport: () => void;
  onShare: () => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return String(n);
}

function normalizeHandle(raw: string): string {
  const trimmed = raw.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : "";
}

export function VideoCard({
  video,
  player,
  isCurrent,
  soundEnabled,
  liked,
  saved,
  likeCount,
  commentCount,
  width,
  height,
  radius = 0,
  onActivate,
  onLike,
  onComment,
  onSave,
  onReport,
  onShare,
}: Props) {
  const isExternal = video.sourceType === "external";
  const active = isCurrent;
  const handle = video.authorHandle ? normalizeHandle(video.authorHandle) : "";
  const platformLabel = PLATFORM_LABEL[video.platform] ?? video.platform;
  const attribution = handle
    ? `Credited to ${handle}`
    : isExternal
      ? `Original on ${platformLabel}`
      : "";
  const mp4 = video.mp4Url ?? video.playbackUrl;

  // Exactly one card plays at a time. External clips use the platform embed;
  // uploaded clips use a native HTML5 <video> on web (reliable autoplay +
  // controls, no iframe) and the pooled expo-video player on native.
  let media: ReactNode;
  if (isExternal) {
    media = <EmbedPlayer video={video} muted={!soundEnabled} active={active} />;
  } else if (Platform.OS === "web") {
    media =
      active && mp4 ? (
        <WebVideo src={mp4} poster={video.posterUrl} muted={!soundEnabled} />
      ) : (
        <Backdrop video={video} />
      );
  } else if (player) {
    media = (
      <VideoView
        player={player}
        style={styles.media}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
      />
    );
  } else {
    media = <Backdrop video={video} />;
  }

  return (
    <View style={[styles.card, { width, height, borderRadius: radius }]}>
      {media}

      <Scrim side="top" />
      <Scrim side="bottom" />

      {/* Fallback activation: tapping an inactive card force-selects it so the
          player starts even if scroll tracking missed the change. */}
      {!active ? (
        <Pressable
          style={styles.activateLayer}
          onPress={onActivate}
          accessibilityLabel="Play this clip"
        />
      ) : null}

      {attribution ? (
        <Pressable
          style={styles.creditBadge}
          onPress={() => {
            if (video.originalUrl) void Linking.openURL(video.originalUrl);
          }}
          hitSlop={6}
        >
          <Icon name="person-circle" size={16} color="#0b1220" />
          <Text style={styles.creditText} numberOfLines={1}>
            {attribution}
          </Text>
          <View style={styles.creditPlatform}>
            <Icon
              name={PLATFORM_ICON[video.platform] ?? "link-outline"}
              size={12}
              color="#312e81"
            />
            <Text style={styles.creditPlatformText}>{platformLabel}</Text>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.bottom} pointerEvents="none">
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
        {video.tags.length ? (
          <View style={styles.tags}>
            {video.tags.slice(0, 3).map((t) => (
              <Text key={t} style={styles.tag}>
                #{t}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.rail}>
        <RailButton
          icon={liked ? "thumbs-up" : "thumbs-up-outline"}
          color={liked ? "#a5b4fc" : "#fff"}
          count={likeCount}
          label="Like"
          onPress={onLike}
        />
        <RailButton
          icon="chatbubble-ellipses-outline"
          color="#fff"
          count={commentCount}
          label="Comment"
          onPress={onComment}
        />
        <RailButton
          icon={saved ? "bookmark" : "bookmark-outline"}
          color={saved ? "#a5b4fc" : "#fff"}
          label="Save"
          onPress={onSave}
        />
        <RailButton icon="share-social-outline" color="#fff" label="Share" onPress={onShare} />
        <RailButton icon="flag-outline" color="rgba(255,255,255,0.66)" label="Report" onPress={onReport} small />
      </View>
    </View>
  );
}

// Static poster / styled placeholder shown behind, or instead of, live media.
function Backdrop({ video }: { video: Video }) {
  return (
    <View style={styles.media}>
      {video.posterUrl ? (
        <Image source={{ uri: video.posterUrl }} style={styles.poster} />
      ) : (
        <VideoPlaceholder platform={video.platform} authorHandle={video.authorHandle} />
      )}
    </View>
  );
}

// Native HTML5 <video> for uploaded clips on web. Native controls + autoplay
// give clean browser playback without an iframe. If unmuted autoplay is blocked
// we fall back to muted playback so the clip always moves.
function WebVideo({ src, poster, muted }: { src: string; poster: string | null; muted: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = muted;
    const play = el.play();
    if (play && typeof play.catch === "function") {
      play.catch(() => {
        el.muted = true;
        void el.play().catch(() => {});
      });
    }
  }, [src, muted]);

  return createElement("video", {
    ref,
    src,
    poster: poster ?? undefined,
    controls: true,
    autoPlay: true,
    playsInline: true,
    muted,
    loop: true,
    preload: "auto",
    style: webVideoStyle,
  });
}

const webVideoStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  backgroundColor: "#000",
  display: "block",
  zIndex: 1,
} as const;

// Multi-band scrims emulate a soft gradient without a gradient dependency,
// keeping text and icons legible over any video with no hard edges.
const TOP_BANDS = [0.3, 0.14, 0.05];
const BOTTOM_BANDS = [0.05, 0.1, 0.16, 0.24, 0.34, 0.46];

function Scrim({ side }: { side: "top" | "bottom" }) {
  const bands = side === "top" ? TOP_BANDS : BOTTOM_BANDS;
  return (
    <View
      style={[styles.scrim, side === "top" ? styles.scrimTop : styles.scrimBottom]}
      pointerEvents="none"
    >
      {bands.map((opacity, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: `rgba(2,3,7,${opacity})` }} />
      ))}
    </View>
  );
}

function RailButton({  icon,
  color,
  count,
  label,
  onPress,
  small,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  count?: number;
  label: string;
  onPress: () => void;
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.railBtn, pressed && styles.railBtnPressed]}
    >
      <Icon name={icon} size={small ? 20 : 26} color={color} />
      {count && count > 0 ? <Text style={styles.railCount}>{formatCount(count)}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#05060a", overflow: "hidden" },
  media: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0c0d12", zIndex: 1 },
  poster: { width: "100%", height: "100%", resizeMode: "cover" },
  activateLayer: { ...StyleSheet.absoluteFillObject, zIndex: 2, backgroundColor: "transparent" },
  scrim: { position: "absolute", left: 0, right: 0, flexDirection: "column", zIndex: 2 },
  scrimTop: { top: 0, height: "20%" },
  scrimBottom: { bottom: 0, height: "40%" },
  creditBadge: {
    position: "absolute",
    zIndex: 3,
    top: 14,
    left: 14,
    maxWidth: "76%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
  },
  creditText: { color: "#0b1220", fontSize: 12.5, fontWeight: "800", flexShrink: 1 },
  creditPlatform: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#e0e7ff",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  creditPlatformText: { color: "#312e81", fontSize: 10.5, fontWeight: "800" },
  bottom: { position: "absolute", zIndex: 3, left: 16, right: 90, bottom: 30, gap: 8 },
  title: {
    color: "#fff",
    fontSize: 16.5,
    fontWeight: "800",
    lineHeight: 22,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  tags: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tag: {
    color: "#dbe3ff",
    fontSize: 13,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  rail: { position: "absolute", zIndex: 3, right: 12, bottom: 30, gap: 18, alignItems: "center" },
  railBtn: { alignItems: "center", justifyContent: "center", minWidth: 44 },
  railBtnPressed: { opacity: 0.6 },
  railCount: {
    marginTop: 3,
    color: "#fff",
    fontSize: 11.5,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
});
