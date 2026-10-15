import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../src/lib/auth";
import { useFeed } from "../../src/hooks/useFeed";
import { usePlayerPool } from "../../src/components/PlayerPool";
import { VideoCard } from "../../src/components/VideoCard";
import { fileReport, setLike as persistLike, setSaved as persistSaved } from "../../src/lib/engagement";

const { height } = Dimensions.get("window");

export default function FeedScreen() {
  const { user } = useAuth();
  const { videos, loading, error, refresh, loadMore } = useFeed();
  const { playerFor, assignWindow, muteActive, enableSound, soundEnabled } =
    usePlayerPool(videos);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const activeIndex = useRef(0);

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#5046e5" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errTitle}>Couldn’t load the feed</Text>
        <Text style={styles.errBody}>{error}</Text>
        <Pressable style={styles.retry} onPress={refresh}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable style={styles.flex} onPress={onTap}>
      <FlatList
        data={videos}
        keyExtractor={(v) => v.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        decelerationRate="fast"
        onScrollBeginDrag={muteActive}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => {
          const { player, role } = playerFor(index);
          return (
            <View style={{ height }}>
              <VideoCard
                video={item}
                player={player}
                role={role}
                soundEnabled={soundEnabled}
                liked={!!liked[item.id]}
                saved={!!saved[item.id]}
                onLike={() => toggleLike(item.id)}
                onComment={() => requireAuth() && router.push(`/comments/${item.id}`)}
                onSave={() => toggleSave(item.id)}
                onReport={() => report(item.id)}
                onShare={() => requireAuth()}
              />
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={[styles.center, { height }]}>
            <Text style={styles.errTitle}>No clips yet</Text>
            <Text style={styles.errBody}>Be the first to post.</Text>
          </View>
        }
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8f7f4", gap: 8, padding: 24 },
  errTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  errBody: { fontSize: 14, color: "#4b5563", textAlign: "center" },
  retry: { marginTop: 8, backgroundColor: "#5046e5", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
  retryText: { color: "#fff", fontWeight: "600" },
});
