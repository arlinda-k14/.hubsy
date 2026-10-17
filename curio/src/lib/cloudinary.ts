import { Platform } from "react-native";

// Cloudinary *unsigned* upload preset. The cloud name and preset name are
// public by design - they ship in the client bundle - so they are safe to set
// via EXPO_PUBLIC_* environment variables and commit.
export const CLOUDINARY_CLOUD_NAME =
  process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
export const CLOUDINARY_UPLOAD_PRESET =
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

// Cloudinary's free tier caps a single video upload at 100 MB.
export const CLOUDINARY_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

export function cloudinaryConfigured(): boolean {
  return CLOUDINARY_CLOUD_NAME.length > 0 && CLOUDINARY_UPLOAD_PRESET.length > 0;
}

function deliveryBase(): string {
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload`;
}

// Force an MP4 (H.264/AAC) rendition so any source (mov, etc.) plays in an
// HTML <video> on web and in expo-video on native.
export function cloudinaryMp4(publicId: string): string {
  return `${deliveryBase()}/f_mp4,q_auto/${publicId}.mp4`;
}

// First-frame poster, cropped to a vertical-ish tile.
export function cloudinaryPoster(publicId: string): string {
  return `${deliveryBase()}/so_0,w_720,c_fill/${publicId}.jpg`;
}

export interface CloudinaryUpload {
  publicId: string;
  mp4Url: string;
  posterUrl: string;
  durationMs: number | null;
  bytes: number | null;
}

// Web passes the picked File; native passes { uri, name, type }.
export type CloudinarySource = File | { uri: string; name: string; type: string };

export function uploadVideoToCloudinary(
  source: CloudinarySource,
  onProgress: (pct: number) => void,
): Promise<CloudinaryUpload> {
  return new Promise((resolve, reject) => {
    if (!cloudinaryConfigured()) {
      reject(new Error("Cloudinary isn’t configured yet."));
      return;
    }
    const form = new FormData();
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    if (Platform.OS === "web") {
      form.append("file", source as Blob);
    } else {
      form.append("file", source as unknown as Blob);
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      let res: {
        public_id?: string;
        duration?: number;
        bytes?: number;
        error?: { message?: string };
      };
      try {
        res = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("Upload failed: unexpected response from Cloudinary."));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && res.public_id) {
        resolve({
          publicId: res.public_id,
          mp4Url: cloudinaryMp4(res.public_id),
          posterUrl: cloudinaryPoster(res.public_id),
          durationMs: res.duration ? Math.round(res.duration * 1000) : null,
          bytes: res.bytes ?? null,
        });
      } else {
        reject(new Error(res.error?.message ?? `Upload failed (${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(form);
  });
}
