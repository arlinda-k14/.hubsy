import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export const AVATAR_MAX_CHARS = 50;
export const BIO_MAX_CHARS = 160;

// Downscale + center-crop an image file to a small square JPEG data URL so an
// uploaded avatar stays tiny (well under Firestore's 1 MB document limit) and
// needs no Storage bucket.
function fileToSquareDataUrl(file: File, size: number): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        } catch {
          resolve(null);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// Returns a data URL (or remote/file uri on native) for the chosen avatar, or
// null if the user cancelled. Uploads are strictly user-initiated (a tap opens
// the picker), so popup/file-dialog blocking is not a concern.
export async function pickAvatar(): Promise<string | null> {
  if (Platform.OS === "web") {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        resolve(await fileToSquareDataUrl(file, 256));
      };
      input.click();
    });
  }

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.4,
    base64: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  if (asset.base64) return `data:image/jpeg;base64,${asset.base64}`;
  return asset.uri ?? null;
}

export function isValidAvatarUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  return /^https?:\/\/.+/i.test(v) || v.startsWith("data:image/");
}
