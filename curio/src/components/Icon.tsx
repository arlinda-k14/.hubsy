import { Ionicons } from "@expo/vector-icons";
import { createElement } from "react";
import { Platform, type StyleProp, type ViewStyle } from "react-native";
import { IONICONS_SVG } from "./icons/ionicons-web";

type IoniconName = keyof typeof Ionicons.glyphMap;

interface Props {
  name: IoniconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

// On web, @expo/vector-icons paints glyphs from the Ionicons webfont. If that
// font ever fails to load (or is served from a stale, immutably-cached URL) the
// glyphs degrade to empty "tofu" boxes. To make web icons bulletproof we render
// the icon's real SVG inline instead - no webfont, nothing to cache wrongly.
export function Icon({ name, size = 24, color = "#000", style }: Props) {
  const inner = IONICONS_SVG[name as string];

  if (Platform.OS === "web" && inner) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" ` +
      `width="${size}" height="${size}" fill="${color}">` +
      `${inner.replace(/currentColor/g, color)}</svg>`;
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return createElement("img", {
      src,
      width: size,
      height: size,
      alt: "",
      draggable: false,
      style: { width: size, height: size, display: "block", ...(style as object) },
    });
  }

  return <Ionicons name={name} size={size} color={color} />;
}
