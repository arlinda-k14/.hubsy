import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../src/lib/firebase";
import { useAuth } from "../../src/lib/auth";

const TOPICS = [
  "Coding",
  "Data Science",
  "AI & ML",
  "Cloud",
  "DevOps",
  "Security",
  "Web Dev",
  "Mobile",
  "Hardware",
  "Career",
];

export default function TopicsScreen() {
  const { user, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (t: string) =>
    setSelected((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { primaryTopics: selected });
      await refreshProfile();
      router.replace("/(tabs)");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>What are you into?</Text>
      <Text style={styles.sub}>Pick the topics you want in your feed. You can change these later.</Text>
      <View style={styles.grid}>
        {TOPICS.map((t) => {
          const on = selected.includes(t);
          return (
            <Pressable key={t} onPress={() => toggle(t)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{t}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        style={[styles.cta, (!selected.length || busy) && styles.ctaDisabled]}
        disabled={!selected.length || busy}
        onPress={save}
      >
        <Text style={styles.ctaText}>{busy ? "Saving…" : "Continue"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8f7f4", padding: 24, paddingTop: 64 },
  title: { fontSize: 26, fontWeight: "800", color: "#111827" },
  sub: { fontSize: 15, color: "#4b5563", marginTop: 8, marginBottom: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: "#dbeafe", backgroundColor: "#eef2ff" },
  chipOn: { backgroundColor: "#5046e5", borderColor: "#5046e5" },
  chipText: { color: "#3730a3", fontWeight: "600" },
  chipTextOn: { color: "#fff" },
  cta: { marginTop: "auto", backgroundColor: "#5046e5", borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
