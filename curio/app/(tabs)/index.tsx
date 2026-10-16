import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../src/lib/auth";
import { ALL_CATEGORY, FEED_FILTERS, type FeedFilter } from "../../src/lib/categories";
import { useFeed } from "../../src/hooks/useFeed";
import { usePlayerPool } from "../../src/components/PlayerPool";
import { VideoCard } from "../../src/components/VideoCard";
import { fileReport, setLike as persistLike, setSaved as persistSaved } from "../../src/lib/engagement";

export default function FeedScreen() {
  const { user } = useAuth();
  const { width: winW, height: winH } = useWindowDimensions();
  const [filter, setFilter] = useState<FeedFilter>(ALL_CATEGORY);
  const category = filter === ALL_CATEGORY ? null : filter;

  const { videos, loading, error, refresh, loadMore } = useFeed(category);
  const { playerFor, assignWindow, muteActive, enableSound, soundEnabled } = usePlayerPool(videos);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const activeIndex = useRef(0);

  const isDesktop = winW >= 768;
  const PAGE = winH;
  let cardW = winW;
  let cardH = winH;
  let radius = 0;
  if (isDesktop) {
    radius = 28;
    cardH = Math.max(320, winH - 112);
    cardW = Math.round((cardH * 9) / 16);
    const maxW = Math.min(winW * 0.52, 460);
    if (cardW > maxW) {
      cardW = Math.round(maxW);
      cardH = Math.round((cardW * 16) / 9);
    }
  }

  useEffect(() => {
    activeIndex.current = 0;
  }, [category]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) {
        activeIndex.current = first.index;
        void assignWindow(first.index);
        if (first.index >= videos.length - 3) void loadMore();
      }
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const requireAuth = useCallback(() => {
    if (!user) {
      router.push("/sign-in");
      return false;
    }
    return true;
  }, [user]);

  const onTap = useCallback(() => {
    if (!soundEnabled) enableSound();
  }, [soundEnabled, enableSound]);

  const toggleLike = useCallback(
    async (videoId: string) => {
      if (!requireAuth()) return;
      const next = !liked[videoId];
      setLiked((p) => ({ ...p, [videoId]: next }));
      try {
        await persistLike(user!.uid, videoId, next);
      } catch {
        setLiked((p) => ({ ...p, [videoId]: !next }));
      }
    },
    [liked, requireAuth, user],
  );

  const toggleSave = useCallback(
    async (videoId: string) => {
      if (!requireAuth()) return;
      const next = !saved[videoId];
      setSaved((p) => ({ ...p, [videoId]: next }));
      try {
        await persistSaved(user!.uid, videoId, next);
      } catch {
        setSaved((p) => ({ ...p, [videoId]: !next }));
      }
    },
    [saved, requireAuth, user],
  );

  const report = useCallback(
    async (videoId: string) => {
      if (!requireAuth()) return;
      await fileReport(user!.uid, videoId, "policy", "");
    },
    [requireAuth, user],
  );

  const header = (
    <View style={styles.pillWrap} pointerEvents="box-none">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillBar}
      >
        {FEED_FILTERS.map((f) => {
          const activeFilter = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.pill, activeFilter && styles.pillActive]}
            >
              <Text style={[styles.pillText, activeFilter && styles.pillTextActive]}>{f}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const backdrop = (posterUrl: string | null) => (
    <>
      {isDesktop && posterUrl ? (
        <Image
          source={{ uri: posterUrl }}
          style={StyleSheet.absoluteFill}
          blurRadius={70}
          resizeMode="cover"
        />
      ) : null}
      {isDesktop ? <View style={[StyleSheet.absoluteFill, styles.backdropTint]} /> : null}
    </>
  );

  return (
    <View style={styles.root}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#5046e5" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errTitle}>Couldn’t load the feed</Text>
          <Text style={styles.errBody}>{error}</Text>
          <Pressable style={styles.retry} onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.flex} onPress={onTap}>
          <FlatList
            key={filter}
            data={videos}
            keyExtractor={(v) => v.id}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={PAGE}
            decelerationRate="fast"
            onScrollBeginDrag={muteActive}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item, index }) => {
              const { player, role } = playerFor(index);
              return (
                <View style={[styles.page, { height: PAGE }]}>
                  {backdrop(item.posterUrl)}
                  <VideoCard
                    video={item}
                    player={player}
                    role={role}
                    soundEnabled={soundEnabled}
                    liked={!!liked[item.id]}
                    saved={!!saved[item.id]}
                    likeCount={item.likeCount ?? 0}
                    commentCount={item.commentCount ?? 0}
                    width={cardW}
                    height={cardH}
                    radius={radius}
                    onLike={() => toggleLike(item.id)}
                    onComment={() =>
                      requireAuth() &&
                      router.push({
                        pathname: "/comments/[id]",
                        params: { id: item.id, authorUid: item.authorUid ?? "" },
                      })
                    }
                    onSave={() => toggleSave(item.id)}
                    onReport={() => report(item.id)}
                    onShare={() => requireAuth()}
                  />
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={[styles.center, { height: PAGE }]}>
                <Text style={styles.errTitle}>
                  {category ? `No ${category} clips yet` : "No clips yet"}
                </Text>
                <Text style={styles.errBody}>Be the first to post.</Text>
              </View>
            }
          />
        </Pressable>
      )}
      {header}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0d17" },
  flex: { flex: 1 },
  page: { width: "100%", alignItems: "center", justifyContent: "center" },
  backdropTint: { backgroundColor: "rgba(11,13,23,0.86)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
  errTitle: { fontSize: 18, fontWeight: "700", color: "#e5e7eb" },
  errBody: { fontSize: 14, color: "#9ca3af", textAlign: "center" },
  retry: { marginTop: 8, backgroundColor: "#5046e5", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
  retryText: { color: "#fff", fontWeight: "600" },
  pillWrap: { position: "absolute", top: 16, left: 0, right: 0, alignItems: "center" },
  pillBar: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  pillActive: { backgroundColor: "#5046e5", borderColor: "#5046e5" },
  pillText: { color: "#e5e7eb", fontSize: 13, fontWeight: "700" },
  pillTextActive: { color: "#fff" },
});
