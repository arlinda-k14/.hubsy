import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth, isValidEmail, authErrorText } from "../src/lib/auth";

export default function SignInScreen() {
  const { signInGoogle, signInApple, signInGitHub, sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const run = async (key: string, fn: () => Promise<void>, after?: () => void) => {
    setBusy(key);
    setError("");
    setMessage("");
    try {
      await fn();
      after?.();
    } catch (e) {
      setError(authErrorText(e));
    } finally {
      setBusy(null);
    }
  };

  const submitMagicLink = () => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setMessage("");
      setError("Please enter a valid email address");
      return;
    }
    void run(
      "email",
      () => sendMagicLink(trimmed),
      () => setMessage("Check your inbox for a sign-in link."),
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.brand}>
        <View style={styles.mark}>
          <Text style={styles.markText}>C</Text>
        </View>
        <Text style={styles.brandText}>Curio</Text>
      </View>
      <Text style={styles.title}>Tech & AI, one clip at a time</Text>
      <Text style={styles.sub}>Coding, data, cloud and AI — curated for people who build.</Text>

      <Pressable
        style={[styles.btn, styles.github]}
        onPress={() => run("github", signInGitHub, () => router.replace("/onboarding/topics"))}
        disabled={!!busy}
      >
        {busy === "github" ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="logo-github" size={20} color="#fff" />
            <Text style={styles.githubText}>Continue with GitHub</Text>
          </>
        )}
      </Pressable>

      <Pressable
        style={styles.btn}
        onPress={() => run("google", signInGoogle, () => router.replace("/onboarding/topics"))}
        disabled={!!busy}
      >
        <Ionicons name="logo-google" size={18} color="#111827" />
        <Text style={styles.btnText}>Continue with Google</Text>
      </Pressable>

      <Pressable
        style={styles.btn}
        onPress={() => run("apple", signInApple, () => router.replace("/onboarding/topics"))}
        disabled={!!busy}
      >
        <Ionicons name="logo-apple" size={20} color="#111827" />
        <Text style={styles.btnText}>Continue with Apple</Text>
      </Pressable>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.or}>or</Text>
        <View style={styles.line} />
      </View>

      <TextInput
        style={styles.input}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="go"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={submitMagicLink}
      />
      <Pressable
        style={styles.btn}
        onPress={submitMagicLink}
        disabled={!!busy}
      >
        {busy === "email" ? (
          <ActivityIndicator color="#111827" />
        ) : (
          <Text style={styles.btnText}>Email me a magic link</Text>
        )}
      </Pressable>

      {message ? <Text style={styles.ok}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8f7f4", padding: 24, paddingTop: 72, gap: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#5046e5", alignItems: "center", justifyContent: "center" },
  markText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  brandText: { fontSize: 17, fontWeight: "700", color: "#111827" },
  title: { fontSize: 26, fontWeight: "800", color: "#111827", marginTop: 20, lineHeight: 32 },
  sub: { fontSize: 15, color: "#4b5563", marginBottom: 12 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 999,
    paddingVertical: 14,
  },
  github: { backgroundColor: "#111827", borderColor: "#111827", paddingVertical: 16 },
  githubText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  btnText: { color: "#111827", fontWeight: "600", fontSize: 15 },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 6 },
  line: { flex: 1, height: 1, backgroundColor: "#e5e7eb" },
  or: { color: "#9ca3af", fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    fontSize: 15,
  },
  ok: { color: "#5046e5", fontSize: 13 },
  error: { color: "#dc2626", fontSize: 13 },
});
