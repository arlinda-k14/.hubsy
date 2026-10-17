import { StyleSheet, Text, View } from "react-native";
import type { Platform } from "../types/models";
import { Icon } from "./Icon";

const PLATFORM_ICON: Record<string, string> = {
  youtube: "logo-youtube",
  tiktok: "logo-tiktok",
  instagram: "logo-instagram",
  linkedin: "logo-linkedin",
  curio: "sparkles",
};

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  curio: "Curio",
};

interface Props {
  platform: Platform;
  authorHandle?: string | null;
}

function normalizeHandle(raw: string): string {
  const trimmed = raw.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : "";
}

// A styled stand-in for the media layer when there is no poster/thumbnail and
// the video is not the active item, so cards never collapse to a plain black box.
export function VideoPlaceholder({ platform, authorHandle }: Props) {
  const handle = authorHandle ? normalizeHandle(authorHandle) : "";
  const label = PLATFORM_LABEL[platform] ?? "Video";
  return (
    <View style={styles.wrap}>
      <Icon name={(PLATFORM_ICON[platform] ?? "link-outline") as never} size={46} color="rgba(255,255,255,0.42)" />
      <Text style={styles.label}>{label}</Text>
      {handle ? (
        <Text style={styles.handle} numberOfLines={1}>
          {handle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 28,
    backgroundColor: "#171a26",
  },
  label: { color: "rgba(255,255,255,0.72)", fontSize: 14, fontWeight: "700" },
  handle: { color: "rgba(199,210,254,0.85)", fontSize: 12.5, fontWeight: "600" },
});
