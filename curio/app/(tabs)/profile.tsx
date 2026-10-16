import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useVideoPlayer, VideoView } from "expo-video";
import { db } from "../../src/lib/firebase";
import { useAuth } from "../../src/lib/auth";
import { Icon } from "../../src/components/Icon";
import { EmbedPlayer } from "../../src/components/EmbedPlayer";
import { VideoPlaceholder } from "../../src/components/VideoPlaceholder";
import type { Video } from "../../src/types/models";

interface SavedRow {
  id: string;
  title?: string;
  videoId?: string;
}

type Tab = "videos" | "saved" | "liked" | "edit";

const TABS: { key: Tab; label: string }[] = [
  { key: "videos", label: "My Videos" },
  { key: "saved", label: "Saved" },
  { key: "liked", label: "Liked" },
  { key: "edit", label: "Edit Profile" },
];

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  curio: "Curio",
};

const PLATFORM_ICON: Record<string, string> = {
  youtube: "logo-youtube",
  tiktok: "logo-tiktok",
  instagram: "logo-instagram",
  curio: "sparkles",
};

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("videos");

  if (!user || !profile) {
    return (
      <View style={styles.gate}>
        <Text style={styles.gateTitle}>Sign in to Curio</Text>
        <Text style={styles.gateSub}>Create a profile to upload and save clips.</Text>
        <Pressable style={styles.cta} onPress={() => router.push("/sign-in")}>
          <Text style={styles.ctaText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.username.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.username}>@{profile.username}</Text>
          <Text style={styles.bio}>{profile.bio || "No bio yet."}</Text>
          <View style={styles.topics}>
            {profile.primaryTopics.slice(0, 4).map((t) => (
              <Text key={t} style={styles.topic}>
                #{t}
              </Text>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.tabbar}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tabBtn, tab === t.key && styles.tabBtnOn]}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "edit" ? (
        <EditTab />
      ) : tab === "videos" ? (
        <MyVideos uid={user.uid} />
      ) : (
        <VideoList uid={user.uid} kind={tab} />
      )}

      <Pressable style={styles.signout} onPress={signOut}>
        <Icon name="log-out-outline" size={18} color="#dc2626" />
        <Text style={styles.signoutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function normalizeHandle(raw: string): string {
  const trimmed = raw.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : "";
}

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

function posterFor(video: Video): string | null {
  if (video.posterUrl) return video.posterUrl;
  if (video.platform === "youtube") {
    const id = video.platformVideoId ?? (video.originalUrl ? youtubeId(video.originalUrl) : null);
    if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }
  return null;
}

function playerSource(video: Video): string | null {
  return Platform.OS === "web"
    ? video.mp4Url ?? video.playbackUrl
    : video.playbackUrl ?? video.mp4Url;
}

function confirmDelete(title: string, onConfirm: () => void) {
  const message = "Are you sure you want to delete this video?";
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${message}\n\n${title}`)) onConfirm();
    return;
  }
  Alert.alert("Delete video", message, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: onConfirm },
  ]);
}

function MyVideos({ uid }: { uid: string }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { width } = useWindowDimensions();
  const maxW = Math.min(width, 1180);
  const cols = width >= 1180 ? 4 : width >= 760 ? 3 : 2;
  const gap = 12;
  const cardW = Math.max(140, Math.floor((maxW - 40 - gap * (cols - 1)) / cols));

  const load = useCallback(async () => {
    try {
      const q = query(
        collection(db, "videos"),
        where("authorUid", "==", uid),
        orderBy("createdAt", "desc"),
        limit(60),
      );
      const snap = await getDocs(q);
      setVideos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Video));
      setState("ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        /requires an index/i.test(msg)
          ? "Your video library index is still building. Please try again shortly."
          : msg,
      );
      setState("error");
    }
  }, [uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = useCallback(
    (video: Video) => {
      confirmDelete(video.title, async () => {
        setBusyId(video.id);
        try {
          await deleteDoc(doc(db, "videos", video.id));
          setVideos((prev) => prev.filter((v) => v.id !== video.id));
          setPlayingId((prev) => (prev === video.id ? null : prev));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (Platform.OS === "web") {
            if (typeof window !== "undefined") window.alert(`Could not delete: ${msg}`);
          } else {
            Alert.alert("Delete failed", msg);
          }
        } finally {
          setBusyId(null);
        }
      });
    },
    [],
  );

  if (state === "loading") {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator color="#5046e5" />
        <Text style={styles.stateText}>Loading your videos…</Text>
      </View>
    );
  }

  if (state === "error") {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.errorTitle}>Couldn't load your videos</Text>
        <Text style={styles.stateText}>{error}</Text>
        <Pressable style={styles.retry} onPress={() => { setState("loading"); void load(); }}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!videos.length) {
    return (
      <View style={styles.stateBox}>
        <Icon name="videocam-outline" size={34} color="#9ca3af" />
        <Text style={styles.stateText}>You haven't added any videos yet.</Text>
        <Pressable style={styles.retry} onPress={() => router.push("/(tabs)/create")}>
          <Text style={styles.retryText}>Add a video</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.grid, { maxWidth: maxW, gap }]}>
      {videos.map((v) => (
        <ProfileVideoCard
          key={v.id}
          video={v}
          width={cardW}
          playing={playingId === v.id}
          busy={busyId === v.id}
          onTogglePlay={() => setPlayingId((prev) => (prev === v.id ? null : v.id))}
          onDelete={() => onDelete(v)}
        />
      ))}
    </View>
  );
}

function ProfileVideoCard({
  video,
  width,
  playing,
  busy,
  onTogglePlay,
  onDelete,
}: {
  video: Video;
  width: number;
  playing: boolean;
  busy: boolean;
  onTogglePlay: () => void;
  onDelete: () => void;
}) {
  const isExternal = video.sourceType === "external";
  const uri = playerSource(video);
  const thumb = posterFor(video);
  const playable = isExternal || !!uri;
  const handle = video.authorHandle ? normalizeHandle(video.authorHandle) : "";
  const height = Math.round(width * 1.3333);

  return (
    <View style={[styles.card, { width }]}>
      <View style={[styles.mediaBox, { height }]}>
        {playing ? (
          isExternal ? (
            <EmbedPlayer video={video} muted={false} active />
          ) : uri ? (
            <InlinePlayer uri={uri} muted={false} />
          ) : (
            <Preview video={video} thumb={thumb} />
          )
        ) : (
          <Preview video={video} thumb={thumb} />
        )}

        {playable ? (
          <Pressable
            style={styles.playOverlay}
            onPress={onTogglePlay}
            accessibilityLabel={playing ? "Pause" : "Play"}
          >
            <View style={styles.playBtn}>
              <Icon name={playing ? "pause" : "play"} size={playing ? 22 : 24} color="#fff" />
            </View>
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.deleteBtn, busy && styles.deleteBtnBusy]}
          onPress={onDelete}
          disabled={busy}
          hitSlop={6}
          accessibilityLabel="Delete"
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Icon name="trash-outline" size={18} color="#fff" />
          )}
        </Pressable>
      </View>

      <View style={styles.meta}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {video.title}
        </Text>

        {video.tags.length ? (
          <View style={styles.tagRow}>
            {video.tags.slice(0, 3).map((t) => (
              <Text key={t} style={styles.tagChip}>
                {t}
              </Text>
            ))}
          </View>
        ) : null}

        {handle ? (
          <View style={styles.credit}>
            <Icon name="person-circle" size={14} color="#5046e5" />
            <Text style={styles.creditText} numberOfLines={1}>
              Credited to {handle}
            </Text>
            <View style={styles.creditPlatform}>
              <Icon name={(PLATFORM_ICON[video.platform] ?? "link-outline") as never} size={11} color="#312e81" />
              <Text style={styles.creditPlatformText}>{PLATFORM_LABEL[video.platform] ?? video.platform}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Preview({ video, thumb }: { video: Video; thumb: string | null }) {
  if (thumb) {
    return <Image source={{ uri: thumb }} style={styles.media} resizeMode="cover" />;
  }
  return <VideoPlaceholder platform={video.platform} authorHandle={video.authorHandle} />;
}

function InlinePlayer({ uri, muted }: { uri: string; muted: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = muted;
    p.play();
  });
  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);
  return (
    <VideoView
      player={player}
      style={styles.media}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
    />
  );
}

function VideoList({ uid, kind }: { uid: string; kind: Tab }) {
  const [items, setItems] = useState<SavedRow[]>([]);

  useEffect(() => {
    const path =
      kind === "saved"
        ? collection(db, "users", uid, "saves")
        : collection(db, "users", uid, "likes");
    void getDocs(query(path, orderBy("createdAt", "desc"), limit(50))).then((snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SavedRow));
    });
  }, [uid, kind]);

  if (!items.length) {
    return <Text style={styles.empty}>Nothing here yet.</Text>;
  }

  return (
    <View style={styles.list}>
      {items.map((v) => (
        <View key={v.id} style={styles.row}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {v.title ?? v.videoId ?? v.id}
          </Text>
        </View>
      ))}
    </View>
  );
}

function EditTab() {
  const { profile } = useAuth();
  return (
    <View style={styles.edit}>
      <Text style={styles.editField}>Username: @{profile?.username}</Text>
      <Text style={styles.editField}>GitHub: {profile?.githubUrl ?? "—"}</Text>
      <Text style={styles.editField}>LinkedIn: {profile?.linkedinUrl ?? "—"}</Text>
      <Text style={styles.editField}>Bio: {profile?.bio || "—"}</Text>
      <Text style={styles.editHint}>Profile editing UI wires here next.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8f7f4" },
  content: { padding: 20, paddingTop: 60, gap: 16 },
  gate: { flex: 1, backgroundColor: "#f8f7f4", alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  gateTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  gateSub: { fontSize: 14, color: "#4b5563", textAlign: "center" },
  cta: { backgroundColor: "#5046e5", borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  ctaText: { color: "#fff", fontWeight: "700" },
  head: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#5046e5", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "800" },
  username: { fontSize: 18, fontWeight: "800", color: "#111827" },
  bio: { fontSize: 13, color: "#4b5563", marginTop: 2 },
  topics: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
  topic: { color: "#5046e5", fontSize: 12, fontWeight: "600" },
  tabbar: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#fff" },
  tabBtnOn: { backgroundColor: "#5046e5", borderColor: "#5046e5" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#4b5563" },
  tabTextOn: { color: "#fff" },
  grid: { flexDirection: "row", flexWrap: "wrap", alignSelf: "center", width: "100%" },
  card: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden" },
  mediaBox: { position: "relative", width: "100%", backgroundColor: "#171a26", overflow: "hidden" },
  media: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  playBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(8,10,18,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(8,10,18,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnBusy: { opacity: 0.8 },
  meta: { padding: 12, gap: 7 },
  cardTitle: { color: "#111827", fontSize: 14, fontWeight: "700", lineHeight: 18 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagChip: {
    color: "#312e81",
    backgroundColor: "#e0e7ff",
    fontSize: 11,
    fontWeight: "700",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  credit: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  creditText: { color: "#4b5563", fontSize: 11.5, fontWeight: "600", flexShrink: 1 },
  creditPlatform: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#eef2ff", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  creditPlatformText: { color: "#312e81", fontSize: 10, fontWeight: "800" },
  stateBox: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40 },
  stateText: { color: "#6b7280", fontSize: 14, textAlign: "center" },
  errorTitle: { color: "#111827", fontSize: 15, fontWeight: "700" },
  retry: { backgroundColor: "#5046e5", borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  list: { gap: 8 },
  row: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 14 },
  rowTitle: { color: "#111827", fontWeight: "600" },
  empty: { color: "#9ca3af", fontSize: 14 },
  edit: { gap: 10 },
  editField: { color: "#111827", fontSize: 14 },
  editHint: { color: "#9ca3af", fontSize: 13, marginTop: 6 },
  signout: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8 },
  signoutText: { color: "#dc2626", fontWeight: "600" },
});
