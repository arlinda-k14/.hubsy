import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../../src/lib/firebase";
import { useAuth } from "../../src/lib/auth";
import { Icon } from "../../src/components/Icon";

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

function VideoList({ uid, kind }: { uid: string; kind: Tab }) {
  const [items, setItems] = useState<SavedRow[]>([]);

  useEffect(() => {
    const path =
      kind === "videos"
        ? collection(db, "users", uid, "videos")
        : kind === "saved"
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
