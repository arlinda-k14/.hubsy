import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../../src/lib/auth";
import { startUpload, watchVideo } from "../../src/lib/upload";
import type { Video } from "../../src/types/models";

const MAX_SECONDS = 90;
const MAX_BYTES = 100 * 1024 * 1024;
const TARGET_RATIO = 9 / 16;

type Phase = "idle" | "uploading" | "processing" | "failed";

interface Picked {
  uri: string;
  width: number;
  height: number;
  durationMs: number;
  fileSize?: number;
  mimeType: string;
}

export default function CreateScreen() {
  const { user } = useAuth();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const unwatch = useRef<(() => void) | null>(null);

  useEffect(() => () => unwatch.current?.(), []);

  const pick = async () => {
    if (!user) {
      router.push("/sign-in");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to pick a video.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      quality: 1,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    const width = a.width ?? 0;
    const height = a.height ?? 0;
    const durationMs = a.duration ?? 0;
    const fileSize = a.fileSize;

    const problems: string[] = [];
    if (durationMs > MAX_SECONDS * 1000) problems.push(`Longer than ${MAX_SECONDS}s`);
    if (fileSize && fileSize > MAX_BYTES) problems.push("Larger than 100 MB");
    if (width && height && Math.abs(width / height - TARGET_RATIO) > 0.02)
      problems.push("Not 9:16 vertical");

    if (problems.length) {
      Alert.alert(
        "Trim or crop needed",
        `This clip is: ${problems.join(", ")}. Open the editor to trim or crop it first.`,
        [{ text: "OK" }],
      );
      return;
    }

    setPicked({
      uri: a.uri,
      width,
      height,
      durationMs,
      fileSize,
      mimeType: a.mimeType ?? "video/mp4",
    });
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
        setPhase("failed");
        setFailure("Mux could not process this file. Try a different clip.");
      }
    });
  };

  const publish = async () => {
    if (!picked || !user) return;
    if (!title.trim()) {
      Alert.alert("Add a title", "Give your clip a title before uploading.");
      return;
    }
    setSubmitting(true);
    setFailure(null);
    setProgress(0);
    setPhase("uploading");
    try {
      const videoId = await startUpload(
        { title: title.trim(), tags, uri: picked.uri, mimeType: picked.mimeType, fileSize: picked.fileSize },
        setProgress,
      );
      setSubmitting(false);
      watchProcessing(videoId);
    } catch (e) {
      setSubmitting(false);
      setPhase("failed");
      setFailure(e instanceof Error ? e.message : "Upload failed.");
    }
  };

  const reset = () => {
    unwatch.current?.();
    unwatch.current = null;
    setPicked(null);
    setPhase("idle");
    setProgress(0);
    setFailure(null);
    setTitle("");
    setTags("");
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Create</Text>
      <Text style={styles.sub}>90 seconds max · 100 MB max · vertical 9:16</Text>

      {phase === "uploading" ? (
        <View style={styles.progressCard}>
          <ActivityIndicator color="#5046e5" />
          <Text style={styles.progressLabel}>Uploading… {progress}%</Text>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressHint}>Keep the app open until it finishes.</Text>
        </View>
      ) : phase === "processing" ? (
        <View style={styles.progressCard}>
          <ActivityIndicator color="#5046e5" />
          <Text style={styles.progressLabel}>Processing on Mux…</Text>
          <Text style={styles.progressHint}>
            We’ll publish it automatically the moment it’s ready.
          </Text>
        </View>
      ) : !picked ? (
        <Pressable style={styles.picker} onPress={pick}>
          <Ionicons name="cloud-upload-outline" size={34} color="#5046e5" />
          <Text style={styles.pickerText}>Choose a video</Text>
          <Text style={styles.pickerSub}>We’ll check the limits on-device first</Text>
        </Pressable>
      ) : (
        <View style={styles.details}>
          <View style={styles.thumb}>
            <Ionicons name="videocam-outline" size={30} color="#5046e5" />
            <Text style={styles.thumbText}>{Math.round(picked.durationMs / 1000)}s · 9:16</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Title"
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />
          <TextInput
            style={styles.input}
            placeholder="Tags, comma separated (e.g. Coding, Cloud)"
            value={tags}
            onChangeText={setTags}
          />

          {failure ? <Text style={styles.error}>{failure}</Text> : null}

          <Pressable style={[styles.cta, submitting && styles.ctaDisabled]} onPress={publish} disabled={submitting}>
            <Text style={styles.ctaText}>{failure ? "Retry upload" : "Upload"}</Text>
          </Pressable>
          <Pressable onPress={reset}>
            <Text style={styles.link}>Choose a different video</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8f7f4", padding: 24, paddingTop: 64 },
  title: { fontSize: 26, fontWeight: "800", color: "#111827" },
  sub: { fontSize: 14, color: "#4b5563", marginTop: 6, marginBottom: 20 },
  picker: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderStyle: "dashed",
    borderRadius: 18,
    paddingVertical: 48,
    alignItems: "center",
    gap: 8,
    backgroundColor: "#eef2ff",
  },
  pickerText: { fontSize: 16, fontWeight: "700", color: "#111827" },
  pickerSub: { fontSize: 13, color: "#4b5563" },
  details: { gap: 12 },
  thumb: { backgroundColor: "#0c0d12", borderRadius: 16, height: 180, alignItems: "center", justifyContent: "center", gap: 6 },
  thumbText: { color: "#e5e7eb", fontSize: 13 },
  input: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 13, backgroundColor: "#fff", fontSize: 15 },
  cta: { backgroundColor: "#5046e5", borderRadius: 999, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: { color: "#5046e5", textAlign: "center", marginTop: 10, fontWeight: "600" },
  error: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
  progressCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  progressLabel: { fontSize: 16, fontWeight: "700", color: "#111827" },
  progressHint: { fontSize: 13, color: "#4b5563", textAlign: "center" },
  bar: { width: "100%", height: 8, borderRadius: 999, backgroundColor: "#e5e7eb", overflow: "hidden" },
  barFill: { height: 8, borderRadius: 999, backgroundColor: "#5046e5" },
});
