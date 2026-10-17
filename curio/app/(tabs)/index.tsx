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
  // The active card is tracked as React state (so cards re-render when it
  // changes) alongside a ref the pool reads synchronously.
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const initialized = useRef(false);

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

  // Reset to the first card whenever the filter changes, and load its player
  // the moment the first page of videos arrives so card 1 is active on load.
  useEffect(() => {
    activeIndexRef.current = 0;
    setActiveIndex(0);
    initialized.current = false;
  }, [category]);

  useEffect(() => {
    if (videos.length && !initialized.current) {
      initialized.current = true;
      void assignWindow(0);
    }
  }, [videos.length, assignWindow]);

  // Only the card sitting in the centre of the viewport drives playback. We
  // commit an index from two sources: viewability (continuous, while scrolling)
  // and the momentum-end snap point (exact, once the swipe settles).
  const commitIndex = useCallback(
    (index: number) => {
      if (!videos.length) return;
      const clamped = Math.max(0, Math.min(index, videos.length - 1));
      setActiveIndex((prev) => (prev === clamped ? prev : clamped));
      if (clamped !== activeIndexRef.current) {
        activeIndexRef.current = clamped;
        void assignWindow(clamped);
      }
      if (clamped >= videos.length - 3) void loadMore();
    },
    [videos.length, assignWindow, loadMore],
  );

  const commitRef = useRef(commitIndex);
  commitRef.current = commitIndex;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) commitRef.current(first.index);
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 70,
    minimumViewTime: 120,
  }).current;

  const onMomentumScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      commitRef.current(Math.round(e.nativeEvent.contentOffset.y / PAGE));
    },
    [PAGE],
  );

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

  // Tapping a card force-selects it, so playback starts immediately even if the
  // scroll/viewability tracking missed the change.
  const activateCard = useCallback(
    (index: number) => {
      commitIndex(index);
      if (!soundEnabled) enableSound();
    },
    [commitIndex, soundEnabled, enableSound],
  );

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
            onMomentumScrollEnd={onMomentumScrollEnd}
            viewabilityConfig={viewabilityConfig}
            extraData={activeIndex}
            renderItem={({ item, index }) => {
              const { player } = playerFor(index);
              return (
                <View style={[styles.page, { height: PAGE }]}>
                  {backdrop(item.posterUrl)}
                  <VideoCard
                    video={item}
                    player={player}
                    isCurrent={index === activeIndex}
                    soundEnabled={soundEnabled}
                    liked={!!liked[item.id]}
                    saved={!!saved[item.id]}
                    likeCount={item.likeCount ?? 0}
                    commentCount={item.commentCount ?? 0}
                    width={cardW}
                    height={cardH}
                    radius={radius}
                    onActivate={() => activateCard(index)}
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
  pillWrap: { position: "absolute", top: 18, left: 0, right: 0, alignItems: "center" },
  pillBar: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  pill: {
    paddingHorizontal: 17,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(9,11,20,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
  },
  pillActive: { backgroundColor: "#6366f1", borderColor: "#8b8ff5" },
  pillText: { color: "#f4f4f7", fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },
  pillTextActive: { color: "#ffffff" },
});
