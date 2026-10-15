import { setAudioModeAsync } from "expo-audio";

let configured = false;

export async function ensureAudioSession() {
  if (configured) return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: "mixWithOthers",
    shouldPlayInBackground: false,
  });
  configured = true;
}

export async function releaseAudioSession() {
  await setAudioModeAsync({ interruptionMode: "doNotMix" });
}
