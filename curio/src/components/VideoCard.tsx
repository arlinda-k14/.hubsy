import { Ionicons } from "@expo/vector-icons";
import { VideoView, type VideoPlayer } from "expo-video";
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Video } from "../types/models";
import { EmbedPlayer } from "./EmbedPlayer";

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  curio: "Curio",
};

interface Props {
  video: Video;
  player: VideoPlayer | null;
  role: "current" | "next" | "prev" | "idle";
  soundEnabled: boolean;
  liked: boolean;
  saved: boolean;
  likeCount: number;
  commentCount: number;
  onLike: () => void;
  onComment: () => void;
  onSave: () => void;
  onReport: () => void;
  onShare: () => void;
}

export function VideoCard({
  video,
  player,
  role,
  soundEnabled,
  liked,
  saved,
  likeCount,
  commentCount,
  onLike,
  onComment,
  onSave,
  onReport,
  onShare,
}: Props) {
  const isExternal = video.sourceType === "external";
  const active = role === "current";

  return (
    <View style={styles.card}>
      {isExternal ? (
        <EmbedPlayer video={video} muted={!soundEnabled} active={active} />
      ) : player ? (
        <VideoView
          player={player}
          style={styles.media}
          contentFit="cover"
          nativeControls={false}
          allowsFullscreen={false}
        />
      ) : (
        <View style={styles.media}>
          {video.posterUrl ? (
            <Image source={{ uri: video.posterUrl }} style={styles.poster} />
          ) : null}
        </View>
      )}

      <View style={styles.scrim} pointerEvents="none" />

      <View style={styles.bottom}>
        {video.authorHandle ? (
          <Pressable
            style={styles.credit}
            onPress={() => {
              if (video.originalUrl) void Linking.openURL(video.originalUrl);
            }}
          >
            <View style={styles.creditDot} />
            <Text style={styles.creditText}>
              {video.authorHandle} · {PLATFORM_LABEL[video.platform] ?? video.platform}
            </Text>
            <Ionicons name="open-outline" size={13} color="#4b5563" />
          </Pressable>
        ) : null}

        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>

        <View style={styles.tags}>
          {video.tags.slice(0, 3).map((t) => (
            <Text key={t} style={styles.tag}>
              #{t}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.rail}>
        <RailButton icon={liked ? "heart" : "heart-outline"} active={liked} count={likeCount} onPress={onLike} />
        <RailButton icon="chatbubble-outline" count={commentCount} onPress={onComment} />
        <RailButton icon={saved ? "bookmark" : "bookmark-outline"} active={saved} onPress={onSave} />
        <RailButton icon="share-outline" onPress={onShare} />
        <RailButton icon="flag-outline" onPress={onReport} />
      </View>
    </View>
  );
}

function RailButton({
  icon,
  active,
  count,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  count?: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.railBtn, active && styles.railBtnActive]} hitSlop={8}>
      <Ionicons name={icon} size={23} color={active ? "#fff" : "#111827"} />
      {count && count > 0 ? (
        <Text style={[styles.railCount, active && styles.railCountActive]}>
          {count > 999 ? `${Math.floor(count / 1000)}k` : count}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: "#000" },
  media: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0c0d12" },
  poster: { width: "100%", height: "100%", resizeMode: "cover" },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    borderTopColor: "transparent",
  },
  bottom: {
    position: "absolute",
    left: 14,
    right: 74,
    bottom: 28,
    gap: 8,
  },
  credit: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  creditDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#5eead4" },
  creditText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  title: { color: "#fff", fontSize: 17, fontWeight: "700", lineHeight: 22 },
  tags: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tag: { color: "#c7d2fe", fontSize: 13, fontWeight: "600" },
  rail: { position: "absolute", right: 12, bottom: 40, gap: 12, alignItems: "center" },
  railBtn: {
    minWidth: 46,
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  railBtnActive: { backgroundColor: "#5046e5" },
  railCount: { fontSize: 10, fontWeight: "800", color: "#111827", marginTop: 1 },
  railCountActive: { color: "#fff" },
});
