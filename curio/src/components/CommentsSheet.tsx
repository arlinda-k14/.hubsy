import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth";
import {
  addComment,
  deleteComment,
  setCommentPinned,
  subscribeComments,
} from "../lib/comments";
import type { Comment } from "../types/models";

const SHEET_HEIGHT = Math.round(Dimensions.get("window").height * 0.78);
const REPLY_PREVIEW = 2;

function formatRelative(ts: Comment["createdAt"] | null): string {
  if (!ts || typeof ts.toMillis !== "function") return "now";
  const diff = Date.now() - ts.toMillis();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

interface Props {
  videoId: string;
  videoAuthorUid: string | null;
  onClose: () => void;
}

export function CommentsSheet({ videoId, videoAuthorUid, onClose }: Props) {
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [posting, setPosting] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const anim = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsub = subscribeComments(videoId, (list) => {
      setComments(list);
      setLoading(false);
    });
    Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    return unsub;
  }, [videoId, anim]);

  const close = () => {
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(onClose);
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 4,
        onPanResponderMove: (_e, g) => {
          if (g.dy > 0) dragY.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 120) {
            dragY.setValue(0);
            close();
          } else {
            Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const tree = useMemo(() => {
    const roots: Comment[] = [];
    const replies = new Map<string, Comment[]>();
    for (const c of comments) {
      if (c.parentId) {
        const arr = replies.get(c.parentId) ?? [];
        arr.push(c);
        replies.set(c.parentId, arr);
      } else {
        roots.push(c);
      }
    }
    for (const [parent, arr] of replies) {
      if (!roots.some((r) => r.id === parent)) {
        roots.push(...arr);
        replies.delete(parent);
      }
    }
    return { roots, replies };
  }, [comments]);

  const canPin = !!user && (user.uid === videoAuthorUid || !!profile?.isAdmin);
  const canDelete = (c: Comment) => !!user && (c.authorUid === user.uid || !!profile?.isAdmin);

  const submit = async () => {
    if (!user || !profile) {
      router.push("/sign-in");
      return;
    }
    const body = text.trim();
    if (!body) return;
    setPosting(true);
    try {
      await addComment({ videoId, parentId: replyTo?.id ?? null, text: body, profile });
      setText("");
      setReplyTo(null);
    } catch {
      // keep the text so the user can retry
    } finally {
      setPosting(false);
    }
  };

  const translateY = Animated.add(
    anim.interpolate({ inputRange: [0, 1], outputRange: [SHEET_HEIGHT, 0] }),
    dragY,
  );

  const renderReply = (c: Comment) => (
    <CommentRow
      key={c.id}
      comment={c}
      small
      canPin={canPin}
      canDelete={canDelete(c)}
      onReply={() => setReplyTo(c)}
      onPin={() => void setCommentPinned(videoId, c.id, !c.pinned)}
      onDelete={() => void deleteComment(videoId, c.id)}
    />
  );

  const renderRoot = ({ item }: { item: Comment }) => {
    const replies = tree.replies.get(item.id) ?? [];
    const open = expanded[item.id];
    const shown = open ? replies : replies.slice(0, REPLY_PREVIEW);
    return (
      <View>
        <CommentRow
          comment={item}
          canPin={canPin}
          canDelete={canDelete(item)}
          onReply={() => setReplyTo(item)}
          onPin={() => void setCommentPinned(videoId, item.id, !item.pinned)}
          onDelete={() => void deleteComment(videoId, item.id)}
        />
        {replies.length > 0 ? (
          <View style={styles.replyWrap}>
            {shown.map(renderReply)}
            {!open && replies.length > REPLY_PREVIEW ? (
              <Pressable onPress={() => setExpanded((p) => ({ ...p, [item.id]: true }))}>
                <Text style={styles.viewReplies}>View all {replies.length} replies</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={close} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.kav}
      >
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View {...pan.panHandlers} style={styles.handleArea}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Comments</Text>
              <Text style={styles.headerCount}>{comments.length}</Text>
              <View style={styles.headerSpacer} />
              <Pressable onPress={close} hitSlop={10}>
                <Ionicons name="close" size={24} color="#111827" />
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#5046e5" />
            </View>
          ) : (
            <FlatList
              data={tree.roots}
              keyExtractor={(c) => c.id}
              renderItem={renderRoot}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.emptyTitle}>No comments yet</Text>
                  <Text style={styles.emptyBody}>Start the conversation.</Text>
                </View>
              }
            />
          )}

          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            {replyTo ? (
              <View style={styles.replyingBar}>
                <Text style={styles.replyingText} numberOfLines={1}>
                  Replying to @{replyTo.authorUsername}
                </Text>
                <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#6b7280" />
                </Pressable>
              </View>
            ) : null}
            <View style={styles.composerRow}>
              <TextInput
                style={styles.composerInput}
                placeholder={user ? "Add a comment…" : "Sign in to comment"}
                placeholderTextColor="#9ca3af"
                value={text}
                onChangeText={setText}
                editable={!!user}
                multiline
                maxLength={1000}
                onSubmitEditing={() => void submit()}
              />
              <Pressable
                style={[styles.sendBtn, (!user || !text.trim() || posting) && styles.sendBtnDisabled]}
                onPress={() => void submit()}
                disabled={posting}
              >
                {posting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name={user ? "arrow-up" : "log-in-outline"} size={20} color="#fff" />
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

function CommentRow({
  comment,
  small,
  canPin,
  canDelete,
  onReply,
  onPin,
  onDelete,
}: {
  comment: Comment;
  small?: boolean;
  canPin: boolean;
  canDelete: boolean;
  onReply: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.row, small && styles.rowSmall]}>
      <View style={[styles.avatar, small && styles.avatarSmall]}>
        {comment.authorAvatarUrl ? (
          <Image source={{ uri: comment.authorAvatarUrl }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarText}>{initials(comment.authorUsername)}</Text>
        )}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowMeta}>
          {comment.pinned ? <Ionicons name="pin" size={12} color="#5046e5" /> : null}
          <Text style={styles.username}>@{comment.authorUsername}</Text>
          <Text style={styles.time}>{formatRelative(comment.createdAt)}</Text>
        </View>
        <Text style={styles.text}>{comment.text}</Text>
        <View style={styles.actions}>
          <Pressable onPress={onReply} hitSlop={6}>
            <Text style={styles.action}>Reply</Text>
          </Pressable>
          {canPin ? (
            <Pressable onPress={onPin} hitSlop={6}>
              <Text style={styles.action}>{comment.pinned ? "Unpin" : "Pin"}</Text>
            </Pressable>
          ) : null}
          {canDelete ? (
            <Pressable onPress={onDelete} hitSlop={6}>
              <Text style={[styles.action, styles.actionDanger]}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  kav: { justifyContent: "flex-end" },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  handleArea: { paddingTop: 8 },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#d1d5db" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  headerCount: { fontSize: 13, color: "#6b7280", marginLeft: 6 },
  headerSpacer: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  emptyBody: { fontSize: 14, color: "#6b7280" },
  list: { padding: 16, gap: 4 },
  row: { flexDirection: "row", gap: 10, paddingVertical: 8 },
  rowSmall: { paddingVertical: 6 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarSmall: { width: 28, height: 28, borderRadius: 14 },
  avatarImg: { width: "100%", height: "100%" },
  avatarText: { color: "#5046e5", fontWeight: "800", fontSize: 12 },
  rowBody: { flex: 1, gap: 3 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  username: { fontSize: 13, fontWeight: "700", color: "#374151" },
  time: { fontSize: 12, color: "#9ca3af" },
  text: { fontSize: 15, color: "#111827", lineHeight: 20 },
  actions: { flexDirection: "row", gap: 16, marginTop: 2 },
  action: { fontSize: 12, fontWeight: "700", color: "#6b7280" },
  actionDanger: { color: "#b91c1c" },
  replyWrap: { marginLeft: 46, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "#e5e7eb", paddingLeft: 10 },
  viewReplies: { fontSize: 13, fontWeight: "700", color: "#5046e5", paddingVertical: 8 },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: "#fff",
  },
  replyingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 8,
  },
  replyingText: { fontSize: 12, color: "#374151", flex: 1, marginRight: 8 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  composerInput: {
    flex: 1,
    maxHeight: 110,
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#5046e5",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#c7c9f5" },
});
