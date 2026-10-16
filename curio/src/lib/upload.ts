import { Platform } from "react-native";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import type { Video } from "../types/models";

export interface UploadInput {
  title: string;
  tags: string;
  uri: string;
  mimeType: string;
  fileSize?: number;
  creatorHandle?: string | null;
  sourceLink?: string | null;
}

interface CreateUploadResult {
  videoId: string;
  uploadId: string;
  uploadUrl: string;
}

function guessMime(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

async function uploadOnWeb(
  uploadUrl: string,
  uri: string,
  mimeType: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  const blob = await fetch(uri).then((r) => r.blob());
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}).`));
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(blob);
  });
}

async function uploadOnNative(
  uploadUrl: string,
  uri: string,
  mimeType: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  const FileSystem = await import("expo-file-system/legacy");
  const task = FileSystem.createUploadTask(
    uploadUrl,
    uri,
    {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { "Content-Type": mimeType },
    },
    (data) => {
      if (data.totalBytesSent && data.totalBytesExpectedToSend) {
        onProgress(Math.round((data.totalBytesSent / data.totalBytesExpectedToSend) * 100));
      }
    },
  );
  const result = await task.uploadAsync();
  if (!result || result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed (${result?.status ?? "no response"}).`);
  }
}

export async function startUpload(
  input: UploadInput,
  onProgress: (pct: number) => void,
): Promise<string> {
  const create = httpsCallable<
    { title: string; tags: string; creatorHandle: string | null; sourceLink: string | null },
    CreateUploadResult
  >(functions, "createUpload");
  const { data } = await create({
    title: input.title,
    tags: input.tags,
    creatorHandle: input.creatorHandle ?? null,
    sourceLink: input.sourceLink ?? null,
  });
  const mimeType = input.mimeType || guessMime(input.uri);

  if (Platform.OS === "web") {
    await uploadOnWeb(data.uploadUrl, input.uri, mimeType, onProgress);
  } else {
    await uploadOnNative(data.uploadUrl, input.uri, mimeType, onProgress);
  }
  onProgress(100);
  return data.videoId;
}

export function watchVideo(videoId: string, cb: (video: Video | null) => void): () => void {
  return onSnapshot(doc(db, "videos", videoId), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Video) : null);
  });
}

// Detects whether the Mux backend pipeline is reachable. Sends an empty title,
// so the function rejects with invalid-argument before doing any work — no side
// effects. `not-found` means Functions aren't deployed (Spark plan).
export async function probeUploadBackend(): Promise<boolean> {
  try {
    const fn = httpsCallable(functions, "createUpload");
    await fn({ title: "" });
    return true;
  } catch (e) {
    const code = (e as { code?: string } | null)?.code ?? "";
    if (
      code.includes("not-found") ||
      code.includes("unavailable") ||
      code.includes("failed-precondition") ||
      code.includes("internal")
    ) {
      return false;
    }
    return true;
  }
}
