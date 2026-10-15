import { setAudioModeAsync } from "expo-audio";

let configured = false;

export async function ensureAudioSession() {
  if (configured) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: false,
    });
  } catch {
    return;
  }
  configured = true;
}

export async function releaseAudioSession() {
  try {
    await setAudioModeAsync({ interruptionMode: "doNotMix" });
  } catch {
    return;
  }
}
