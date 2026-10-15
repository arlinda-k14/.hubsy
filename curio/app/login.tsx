import { router } from "expo-router";
import * as Linking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { authErrorText, useAuth } from "../src/lib/auth";

export default function LoginRoute() {
  const { completeMagicLink } = useAuth();
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const url = await Linking.getInitialURL();
        if (!url) throw new Error("No sign-in link found.");
        await completeMagicLink(url);
        router.replace("/onboarding/topics");
      } catch (e) {
        setError(authErrorText(e));
      }
    })();
  }, [completeMagicLink]);

  return (
    <View style={styles.screen}>
      {error ? (
        <>
          <Text style={styles.title}>Sign-in link problem</Text>
          <Text style={styles.body}>{error}</Text>
          <Pressable style={styles.btn} onPress={() => router.replace("/sign-in")}>
            <Text style={styles.btnText}>Back to sign in</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color="#5046e5" />
          <Text style={styles.body}>Signing you in…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8f7f4", alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  title: { fontSize: 20, fontWeight: "800", color: "#111827" },
  body: { fontSize: 14, color: "#4b5563", textAlign: "center" },
  btn: { marginTop: 8, backgroundColor: "#5046e5", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
  btnText: { color: "#fff", fontWeight: "700" },
});
