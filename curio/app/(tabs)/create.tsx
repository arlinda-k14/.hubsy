import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../../src/lib/auth";

const MAX_SECONDS = 90;
const MAX_BYTES = 100 * 1024 * 1024;
const TARGET_RATIO = 9 / 16;

interface Picked {
  uri: string;
  width: number;
  height: number;
  durationMs: number;
  fileSize?: number;
}

export default function CreateScreen() {
  const { user } = useAuth();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");

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

    setPicked({ uri: a.uri, width, height, durationMs, fileSize });
  };

  const publish = () => {
    Alert.alert(
      "Upload pipeline",
      "Mux direct upload is the next step to wire: this submits to a signed upload URL and publishes on the asset.ready webhook.",
      [{ text: "OK", onPress: () => router.replace("/(tabs)") }],
    );
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Create</Text>
      <Text style={styles.sub}>90 seconds max · 100 MB max · vertical 9:16</Text>

      {!picked ? (
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

          <Pressable style={styles.cta} onPress={publish}>
            <Text style={styles.ctaText}>Upload</Text>
          </Pressable>
          <Pressable onPress={() => setPicked(null)}>
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
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: { color: "#5046e5", textAlign: "center", marginTop: 10, fontWeight: "600" },
});
