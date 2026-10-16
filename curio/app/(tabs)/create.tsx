import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { createElement, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "../../src/lib/auth";
import { FEED_CATEGORIES } from "../../src/lib/categories";
import { Icon } from "../../src/components/Icon";
import { db } from "../../src/lib/firebase";
import { PLATFORM_LABEL, parseVideoLink } from "../../src/lib/linkParser";
import { probeUploadBackend, startUpload, watchVideo } from "../../src/lib/upload";
import type { Video } from "../../src/types/models";

const MAX_SECONDS = 90;
const MAX_BYTES = 100 * 1024 * 1024;
const TARGET_RATIO = 9 / 16;

type Mode = "link" | "upload";
type Phase = "idle" | "uploading" | "processing";

interface Picked {
  uri: string;
  width: number;
  height: number;
  durationMs: number;
  fileSize?: number;
  mimeType: string;
}

function normalizeHandle(raw: string): string | null {
  const trimmed = raw.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : null;
}

function slugTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

function validateClip(meta: Picked): string | null {
  const problems: string[] = [];
  if (meta.durationMs > MAX_SECONDS * 1000) problems.push(`longer than ${MAX_SECONDS}s`);
  if (meta.fileSize && meta.fileSize > MAX_BYTES) problems.push("larger than 100 MB");
  if (meta.width && meta.height && Math.abs(meta.width / meta.height - TARGET_RATIO) > 0.02)
    problems.push("not 9:16 vertical");
  return problems.length ? `This clip is ${problems.join(", ")}.` : null;
}

async function readWebVideo(file: File): Promise<Picked> {
  const g = globalThis as unknown as { document: any; URL: any };
  const uri = g.URL.createObjectURL(file);
  const meta = await new Promise<{ width: number; height: number; duration: number }>(
    (resolve, reject) => {
      const el = g.document.createElement("video");
      el.preload = "metadata";
      el.onloadedmetadata = () =>
        resolve({ width: el.videoWidth, height: el.videoHeight, duration: el.duration });
      el.onerror = () => reject(new Error("Could not read that video file."));
      el.src = uri;
    },
  );
  return {
    uri,
    width: meta.width,
    height: meta.height,
    durationMs: Math.round((meta.duration || 0) * 1000),
    fileSize: file.size,
    mimeType: file.type || "video/mp4",
  };
}

function CreditsFields({
  handle,
  onHandle,
  link,
  onLink,
}: {
  handle: string;
  onHandle: (v: string) => void;
  link: string;
  onLink: (v: string) => void;
}) {
  const preview = normalizeHandle(handle);
  return (
    <View style={styles.credits}>
      <View style={styles.creditsHeader}>
        <Icon name="ribbon-outline" size={16} color="#5046e5" />
        <Text style={styles.creditsTitle}>Creator Credits</Text>
      </View>
      <Text style={styles.creditsSub}>
        Attribution shows as a credit badge on the video in the feed.
      </Text>

      <Text style={styles.label}>Creator Name / Handle</Text>
      <TextInput
        style={styles.input}
        placeholder="@camillemoore"
        autoCapitalize="none"
        autoCorrect={false}
        value={handle}
        onChangeText={onHandle}
      />

      <Text style={styles.label}>Original Platform / Source Link</Text>
      <TextInput
        style={styles.input}
        placeholder="https://original-source.example/…"
        autoCapitalize="none"
        autoCorrect={false}
        value={link}
        onChangeText={onLink}
      />

      {preview ? (
        <View style={styles.badgePreview}>
          <Icon name="person-circle" size={15} color="#0b1220" />
          <Text style={styles.badgePreviewText}>Credited to {preview}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function CreateScreen() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("link");

  // Paste Link state
  const [url, setUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [category, setCategory] = useState<string>("");
  const [creatorHandle, setCreatorHandle] = useState("");
  const [creatorLink, setCreatorLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [saving, setSaving] = useState(false);
  const [linkDone, setLinkDone] = useState<string | null>(null);
  const handleTouched = useRef(false);
  const linkTouched = useRef(false);

  // Upload state
  const [picked, setPicked] = useState<Picked | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<string>("");
  const [uploadCreatorHandle, setUploadCreatorHandle] = useState("");
  const [uploadCreatorLink, setUploadCreatorLink] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const unwatch = useRef<(() => void) | null>(null);

  useEffect(() => () => unwatch.current?.(), []);

  useEffect(() => {
    if (!user) {
      setBackendReady(null);
      return;
    }
    let alive = true;
    void probeUploadBackend().then((ok) => {
      if (alive) setBackendReady(ok);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  const preview = !linkDone && url.trim() ? parseVideoLink(url) : null;

  const onUrlChange = (value: string) => {
    setUrl(value);
    const parsed = parseVideoLink(value);
    if (parsed.ok) {
      if (!handleTouched.current && parsed.value.authorHandle) {
        setCreatorHandle(parsed.value.authorHandle);
      }
      if (!linkTouched.current) setCreatorLink(parsed.value.originalUrl);
    }
  };

  const submitLink = async () => {
    if (!user) {
      router.push("/sign-in");
      return;
    }
    setLinkError("");
    const parsed = parseVideoLink(url);
    if (!parsed.ok) {
      setLinkError(parsed.error);
      return;
    }
    if (!linkTitle.trim()) {
      setLinkError("Add a title for this clip.");
      return;
    }
    if (!category) {
      setLinkError("Pick a category.");
      return;
    }
    setSaving(true);
    try {
      const ref = doc(collection(db, "videos"));
      await setDoc(ref, {
        sourceType: "external",
        platform: parsed.value.platform,
        platformVideoId: parsed.value.videoId,
        originalUrl: creatorLink.trim() || parsed.value.originalUrl,
        embedUrl: parsed.value.embedUrl,
        authorHandle: normalizeHandle(creatorHandle),
        authorUid: user.uid,
        originalTitle: null,
        title: linkTitle.trim().slice(0, 120),
        mediaAssetId: null,
        muxUploadId: null,
        playbackUrl: null,
        mp4Url: null,
        posterUrl: null,
        status: "ready",
        tags: [category, slugTag(category)].filter((t, i, a) => a.indexOf(t) === i),
        creditOk: true,
        reportCount: 0,
        flagged: false,
        likeCount: 0,
        commentCount: 0,
        createdAt: serverTimestamp(),
        publishedAt: serverTimestamp(),
      });
      setLinkDone(linkTitle.trim());
      setUrl("");
      setLinkTitle("");
      setCategory("");
      setCreatorHandle("");
      setCreatorLink("");
      handleTouched.current = false;
      linkTouched.current = false;
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "Couldn’t save that clip.");
    } finally {
      setSaving(false);
    }
  };

  const pickNative = async () => {
    if (!user) {
      router.push("/sign-in");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to pick a video.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], quality: 1 });
    if (res.canceled) return;
    const a = res.assets[0];
    const meta: Picked = {
      uri: a.uri,
      width: a.width ?? 0,
      height: a.height ?? 0,
      durationMs: a.duration ?? 0,
      fileSize: a.fileSize,
      mimeType: a.mimeType ?? "video/mp4",
    };
    const problem = validateClip(meta);
    if (problem) {
      Alert.alert("Trim or crop needed", `${problem} Open the editor to trim or crop it first.`);
      return;
    }
    setPicked(meta);
  };

  const onWebFile = async (e: { target?: { files?: FileList | null } }) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    try {
      const meta = await readWebVideo(file);
      const problem = validateClip(meta);
      if (problem) {
        setFailure(`${problem} Use a 9:16 clip under 100 MB.`);
        setPicked(null);
        return;
      }
      setFailure(null);
      setPicked(meta);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not read that file.");
    }
  };

  const watchProcessing = (videoId: string) => {
    setPhase("processing");
    unwatch.current?.();
    unwatch.current = watchVideo(videoId, (video: Video | null) => {
      if (!video) return;
      if (video.status === "ready") {
        unwatch.current?.();
        setPhase("idle");
        Alert.alert("Published", "Your clip is live in the feed.", [
          { text: "View feed", onPress: () => router.replace("/(tabs)") },
        ]);
      } else if (video.status === "failed") {
        unwatch.current?.();
        setPhase("idle");
        setFailure("Mux could not process this file. Try a different clip.");
      }
    });
  };

  const publishUpload = async () => {
    if (!picked || !user) return;
    if (!backendReady) {
      setFailure("Direct file hosting requires Mux backend pipeline. Use “Paste Link” for external clips.");
      return;
    }
    if (!uploadTitle.trim()) {
      Alert.alert("Add a title", "Give your clip a title before uploading.");
      return;
    }
    if (!uploadCategory) {
      Alert.alert("Pick a category", "Choose a category for your clip.");
      return;
    }
    setSubmitting(true);
    setFailure(null);
    setProgress(0);
    setPhase("uploading");
    try {
      const videoId = await startUpload(
        {
          title: uploadTitle.trim(),
          tags: [uploadCategory, slugTag(uploadCategory)].join(","),
          uri: picked.uri,
          mimeType: picked.mimeType,
          fileSize: picked.fileSize,
          creatorHandle: normalizeHandle(uploadCreatorHandle),
          sourceLink: uploadCreatorLink.trim() || null,
        },
        setProgress,
      );
      setSubmitting(false);
      watchProcessing(videoId);
    } catch (e) {
      setSubmitting(false);
      setPhase("idle");
      setFailure(e instanceof Error ? e.message : "Upload failed.");
    }
  };

  const resetUpload = () => {
    unwatch.current?.();
    unwatch.current = null;
    setPicked(null);
    setPhase("idle");
    setProgress(0);
    setFailure(null);
    setUploadTitle("");
    setUploadCategory("");
    setUploadCreatorHandle("");
    setUploadCreatorLink("");
  };

  const categoryChips = (
    <>
      <Text style={styles.label}>Category</Text>
      <View style={styles.chips}>
        {FEED_CATEGORIES.map((c) => {
          const selected = (mode === "link" ? category : uploadCategory) === c;
          return (
            <Pressable
              key={c}
              style={[styles.chip, selected && styles.chipActive]}
              onPress={() => (mode === "link" ? setCategory(c) : setUploadCategory(c))}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Create</Text>

      <View style={styles.segment}>
        <Pressable
          style={[styles.segmentItem, mode === "link" && styles.segmentItemActive]}
          onPress={() => setMode("link")}
        >
          <Icon name="link-outline" size={16} color={mode === "link" ? "#111827" : "#6b7280"} />
          <Text style={[styles.segmentText, mode === "link" && styles.segmentTextActive]}>Paste Link</Text>
        </Pressable>
        <Pressable
          style={[styles.segmentItem, mode === "upload" && styles.segmentItemActive]}
          onPress={() => setMode("upload")}
        >
          <Icon name="cloud-upload-outline" size={16} color={mode === "upload" ? "#111827" : "#6b7280"} />
          <Text style={[styles.segmentText, mode === "upload" && styles.segmentTextActive]}>Upload File</Text>
        </Pressable>
      </View>

      {mode === "link" ? (
        <View style={styles.panel}>
          <Text style={styles.sub}>Paste a YouTube, TikTok or Instagram link. We store the official embed and credit the creator.</Text>

          {linkDone ? (
            <View style={styles.successCard}>
              <Icon name="checkmark-circle" size={22} color="#16a34a" />
              <Text style={styles.successText}>“{linkDone}” is live in the feed.</Text>
              <Pressable style={styles.cta} onPress={() => router.replace("/(tabs)")}>
                <Text style={styles.ctaText}>View feed</Text>
              </Pressable>
              <Pressable onPress={() => setLinkDone(null)}>
                <Text style={styles.link}>Add another</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="https://www.youtube.com/watch?v=…"
                autoCapitalize="none"
                autoCorrect={false}
                value={url}
                onChangeText={onUrlChange}
              />

              {preview ? (
                preview.ok ? (
                  <View style={styles.previewRow}>
                    <Icon name="checkmark-circle" size={16} color="#16a34a" />
                    <Text style={styles.previewText}>
                      {PLATFORM_LABEL[preview.value.platform]}
                      {preview.value.authorHandle ? ` · ${preview.value.authorHandle}` : ""}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.error}>{preview.error}</Text>
                )
              ) : null}

              <TextInput
                style={styles.input}
                placeholder="Title"
                value={linkTitle}
                onChangeText={setLinkTitle}
                maxLength={120}
              />

              {categoryChips}

              <CreditsFields
                handle={creatorHandle}
                onHandle={(v) => {
                  handleTouched.current = true;
                  setCreatorHandle(v);
                }}
                link={creatorLink}
                onLink={(v) => {
                  linkTouched.current = true;
                  setCreatorLink(v);
                }}
              />

              {linkError ? <Text style={styles.error}>{linkError}</Text> : null}

              <Pressable style={[styles.cta, saving && styles.ctaDisabled]} onPress={submitLink} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Publish link</Text>}
              </Pressable>
            </>
          )}
        </View>
      ) : (
        <View style={styles.panel}>
          <Text style={styles.sub}>Direct upload · 90s max · 100 MB max · vertical 9:16</Text>

          {backendReady === false ? (
            <View style={styles.notice}>
              <Icon name="information-circle-outline" size={18} color="#92400e" />
              <Text style={styles.noticeText}>
                Direct file hosting requires Mux backend pipeline. Use “Paste Link” for external clips.
              </Text>
            </View>
          ) : null}

          {phase === "uploading" ? (
            <View style={styles.progressCard}>
              <ActivityIndicator color="#5046e5" />
              <Text style={styles.progressLabel}>Uploading… {progress}%</Text>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${progress}%` }]} />
              </View>
            </View>
          ) : phase === "processing" ? (
            <View style={styles.progressCard}>
              <ActivityIndicator color="#5046e5" />
              <Text style={styles.progressLabel}>Processing on Mux…</Text>
              <Text style={styles.progressHint}>We’ll publish it automatically the moment it’s ready.</Text>
            </View>
          ) : !picked ? (
            Platform.OS === "web" ? (
              <View style={styles.dropzone}>
                <Icon name="cloud-upload-outline" size={30} color="#5046e5" />
                <Text style={styles.pickerText}>Choose a video</Text>
                <Text style={styles.pickerSub}>MP4 · 9:16 · under 100 MB</Text>
                {createElement("input", {
                  type: "file",
                  accept: "video/*",
                  onChange: onWebFile,
                  style: {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    cursor: "pointer",
                  },
                })}
              </View>
            ) : (
              <Pressable style={styles.dropzone} onPress={pickNative}>
                <Icon name="cloud-upload-outline" size={30} color="#5046e5" />
                <Text style={styles.pickerText}>Choose a video</Text>
                <Text style={styles.pickerSub}>MP4 · 9:16 · under 100 MB</Text>
              </Pressable>
            )
          ) : (
            <View style={styles.details}>
              <View style={styles.thumb}>
                <Icon name="videocam-outline" size={28} color="#5046e5" />
                <Text style={styles.thumbText}>{Math.round(picked.durationMs / 1000)}s · 9:16</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Title"
                value={uploadTitle}
                onChangeText={setUploadTitle}
                maxLength={120}
              />
              {failure ? <Text style={styles.error}>{failure}</Text> : null}
              <Pressable
                style={[styles.cta, (submitting || !backendReady) && styles.ctaDisabled]}
                onPress={publishUpload}
                disabled={submitting}
              >
                <Text style={styles.ctaText}>
                  {backendReady === false ? "Backend unavailable" : "Upload"}
                </Text>
              </Pressable>
              <Pressable onPress={resetUpload}>
                <Text style={styles.link}>Choose a different video</Text>
              </Pressable>
            </View>
          )}

          {failure && !picked ? <Text style={styles.error}>{failure}</Text> : null}

          {phase === "idle" ? (
            <>
              {categoryChips}
              <CreditsFields
                handle={uploadCreatorHandle}
                onHandle={setUploadCreatorHandle}
                link={uploadCreatorLink}
                onLink={setUploadCreatorLink}
              />
            </>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8f7f4" },
  content: { padding: 24, paddingTop: 64, paddingBottom: 48, gap: 14 },
  title: { fontSize: 26, fontWeight: "800", color: "#111827" },
  segment: {
    flexDirection: "row",
    backgroundColor: "#eceef2",
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
  },
  segmentItemActive: { backgroundColor: "#fff" },
  segmentText: { fontSize: 14, fontWeight: "600", color: "#6b7280" },
  segmentTextActive: { color: "#111827", fontWeight: "800" },
  panel: { gap: 12 },
  sub: { fontSize: 14, color: "#4b5563" },
  input: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 13, backgroundColor: "#fff", fontSize: 15 },
  label: { fontSize: 13, fontWeight: "700", color: "#374151", marginTop: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#5046e5", borderColor: "#5046e5" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  chipTextActive: { color: "#fff" },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  previewText: { fontSize: 13, color: "#374151", fontWeight: "600" },
  cta: { backgroundColor: "#5046e5", borderRadius: 999, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  ctaDisabled: { opacity: 0.55 },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: { color: "#5046e5", textAlign: "center", marginTop: 10, fontWeight: "600" },
  error: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
  successCard: { backgroundColor: "#f0fdf4", borderRadius: 16, padding: 20, alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#bbf7d0" },
  successText: { fontSize: 15, color: "#166534", fontWeight: "600", textAlign: "center" },
  notice: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a", borderRadius: 12, padding: 14 },
  noticeText: { flex: 1, fontSize: 13, color: "#92400e", lineHeight: 18 },
  dropzone: { borderWidth: 1, borderColor: "#dbeafe", borderStyle: "dashed", borderRadius: 18, paddingVertical: 44, alignItems: "center", gap: 8, backgroundColor: "#eef2ff", overflow: "hidden" },
  pickerText: { fontSize: 16, fontWeight: "700", color: "#111827" },
  pickerSub: { fontSize: 13, color: "#4b5563" },
  details: { gap: 12 },
  thumb: { backgroundColor: "#0c0d12", borderRadius: 16, height: 160, alignItems: "center", justifyContent: "center", gap: 6 },
  thumbText: { color: "#e5e7eb", fontSize: 13 },
  progressCard: { backgroundColor: "#fff", borderRadius: 18, padding: 24, alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  progressLabel: { fontSize: 16, fontWeight: "700", color: "#111827" },
  progressHint: { fontSize: 13, color: "#4b5563", textAlign: "center" },
  bar: { width: "100%", height: 8, borderRadius: 999, backgroundColor: "#e5e7eb", overflow: "hidden" },
  barFill: { height: 8, borderRadius: 999, backgroundColor: "#5046e5" },
  credits: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    gap: 8,
  },
  creditsHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  creditsTitle: { fontSize: 14, fontWeight: "800", color: "#111827" },
  creditsSub: { fontSize: 12.5, color: "#6b7280", marginBottom: 2 },
  badgePreview: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(80,70,229,0.1)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  badgePreviewText: { fontSize: 12, fontWeight: "800", color: "#312e81" },
});
