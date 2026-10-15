import {
  GithubAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithCredential,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import * as AppleAuthentication from "expo-apple-authentication";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { app, db } from "./firebase";
import type { UserProfile } from "../types/models";

const webStorage = {
  getItem: async (key: string) => window.localStorage.getItem(key),
  setItem: async (key: string, value: string) => {
    window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    window.localStorage.removeItem(key);
  },
};

const nativeStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const appStorage = Platform.OS === "web" ? webStorage : nativeStorage;

export const curioAuth = initializeAuth(app, {
  persistence:
    Platform.OS === "web" ? browserLocalPersistence : getReactNativePersistence(appStorage),
});

const ACTION_CODE_SETTINGS = {
  handleCodeInApp: true,
  url: Linking.createURL("/login"),
  iOSBundleId: "app.curio.kos",
  androidPackageName: "app.curio.kos",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

// Turns a raw Firebase/popup error into something a person can read, instead of
// leaking "Firebase: Error (auth/...)".
export function authErrorText(e: unknown): string {
  const code = (e as { code?: string } | null)?.code ?? "";
  switch (code) {
    case "auth/invalid-email":
    case "auth/missing-email":
      return "Please enter a valid email address";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don’t match.";
    case "auth/email-already-in-use":
      return "That email already has an account — try signing in instead.";
    case "auth/weak-password":
      return "Please choose a stronger password.";
    case "auth/unauthorized-continue-uri":
      return "This sign-in link isn’t authorized for this domain yet.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/user-cancelled":
      return "Sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Allow pop-ups and try again.";
    case "auth/operation-not-allowed":
      return "That sign-in method isn’t enabled yet.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again in a moment.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default: {
      const msg = e instanceof Error ? e.message : "";
      const cleaned = msg
        .replace(/^Firebase:\s*/i, "")
        .replace(/\s*\(auth\/[^)]+\)\.?$/, "")
        .trim();
      return cleaned || "Something went wrong. Please try again.";
    }
  }
}

if (Platform.OS !== "web") {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
    offlineAccess: false,
  });
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  initializing: boolean;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  completeMagicLink: (url: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signInApple: () => Promise<void>;
  signInGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const snap = await getDoc(doc(db, "users", uid));
    setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
  }, []);

  const ensureProfile = useCallback(async (u: User) => {
    const ref = doc(db, "users", u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const base = (u.email ?? "coder").split("@")[0].toLowerCase();
      const username = `${base}_${u.uid.slice(0, 4)}`;
      const fresh: Omit<UserProfile, "createdAt"> & { createdAt: unknown } = {
        uid: u.uid,
        username,
        usernameLower: username.toLowerCase(),
        avatarUrl: u.photoURL,
        bio: "",
        githubUrl: null,
        linkedinUrl: null,
        primaryTopics: [],
        likedTabPublic: false,
        isAdmin: false,
        createdAt: serverTimestamp(),
      };
      await setDoc(ref, fresh);
      setProfile({ ...fresh, createdAt: snap.data()?.createdAt } as UserProfile);
    } else {
      setProfile(snap.data() as UserProfile);
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(curioAuth, async (u) => {
      setUser(u);
      if (u) await ensureProfile(u);
      else setProfile(null);
      setInitializing(false);
    });
  }, [ensureProfile]);

  const signUpEmail = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(curioAuth, email, password);
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(curioAuth, email, password);
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) throw new Error("Please enter a valid email address");
    await sendSignInLinkToEmail(curioAuth, trimmed, ACTION_CODE_SETTINGS);
    await appStorage.setItem("magic_email", trimmed);
  }, []);

  const completeMagicLink = useCallback(async (url: string) => {
    if (!url) return;
    const email = (await appStorage.getItem("magic_email")) ?? "";
    if (!email) throw new Error("Open the link from the same device that requested it.");
    await signInWithEmailLink(curioAuth, email, url);
    await appStorage.removeItem("magic_email");
  }, []);

  const signInGoogle = useCallback(async () => {
    if (Platform.OS === "web") {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(curioAuth, provider);
      return;
    }
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    const idToken = res.data?.idToken;
    if (!idToken) throw new Error("Google sign-in returned no token.");
    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(curioAuth, credential);
  }, []);

  const signInApple = useCallback(async () => {
    if (Platform.OS === "web") {
      const provider = new OAuthProvider("apple.com");
      provider.addScope("email");
      provider.addScope("name");
      await signInWithPopup(curioAuth, provider);
      return;
    }
    const apple = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!apple.identityToken) throw new Error("Apple sign-in returned no token.");
    const provider = new OAuthProvider("apple.com");
    const credential = provider.credential({
      idToken: apple.identityToken,
      rawNonce: undefined,
    });
    await signInWithCredential(curioAuth, credential);
  }, []);

  const signInGitHub = useCallback(async () => {
    if (Platform.OS === "web") {
      const provider = new GithubAuthProvider();
      provider.addScope("read:user");
      provider.addScope("user:email");
      await signInWithPopup(curioAuth, provider);
      return;
    }
    const redirectUri = Linking.createURL("/oauth/github");
    const clientId = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? "";
    const authUrl =
      `https://github.com/login/oauth/authorize?client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user user:email`;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    if (result.type !== "success" || !result.url) throw new Error("GitHub sign-in was cancelled.");
    const token = new URL(result.url).searchParams.get("code");
    if (!token) throw new Error("GitHub sign-in failed.");
    const exchanged = await fetch(
      `https://github.com/login/oauth/access_token?client_id=${clientId}&client_secret=${process.env.EXPO_PUBLIC_GITHUB_CLIENT_SECRET}&code=${token}`,
      { headers: { Accept: "application/json" } },
    ).then((r) => r.json());
    if (!exchanged.access_token) throw new Error("GitHub token exchange failed.");
    const credential = GithubAuthProvider.credential(exchanged.access_token);
    await signInWithCredential(curioAuth, credential);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(curioAuth);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.uid);
  }, [user, loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      initializing,
      signUpEmail,
      signInEmail,
      sendMagicLink,
      completeMagicLink,
      signInGoogle,
      signInApple,
      signInGitHub,
      signOut,
      refreshProfile,
    }),
    [
      user,
      profile,
      initializing,
      signUpEmail,
      signInEmail,
      sendMagicLink,
      completeMagicLink,
      signInGoogle,
      signInApple,
      signInGitHub,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
