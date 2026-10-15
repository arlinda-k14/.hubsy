import { createHmac, timingSafeEqual } from "crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();

const MUX_API = "https://api.mux.com/video/v1";

interface UploadRequest {
  title?: unknown;
  tags?: unknown;
}

function authHeader(): string {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) throw new HttpsError("failed-precondition", "Mux credentials are not configured.");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

function normalizeTags(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean).slice(0, 5);
  }
  if (typeof input === "string") {
    return input.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5);
  }
  return [];
}

// Client calls this to begin an upload. Returns a signed Mux upload URL and the
// Firestore video id the client should watch for status changes.
export const createUpload = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in to upload.");
  const { title, tags } = (req.data ?? {}) as UploadRequest;
  const cleanTitle = typeof title === "string" ? title.trim().slice(0, 120) : "";
  if (!cleanTitle) throw new HttpsError("invalid-argument", "A title is required.");

  const uid = req.auth.uid;
  const profileSnap = await db.doc(`users/${uid}`).get();
  const authorHandle = (profileSnap.data()?.username as string | undefined) ?? null;

  const videoRef = db.collection("videos").doc();
  const videoId = videoRef.id;

  const res = await fetch(`${MUX_API}/uploads`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      cors_origin: "*",
      new_asset_settings: {
        playback_policy: ["public"],
        passthrough: videoId,
        mp4_support: "standard",
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new HttpsError("internal", `Mux upload creation failed (${res.status}). ${detail.slice(0, 200)}`);
  }

  const payload = (await res.json()) as { data: { id: string; url: string } };

  await videoRef.set({
    sourceType: "upload",
    platform: "curio",
    originalUrl: null,
    authorHandle,
    authorUid: uid,
    originalTitle: null,
    title: cleanTitle,
    mediaAssetId: null,
    muxUploadId: payload.data.id,
    playbackUrl: null,
    mp4Url: null,
    posterUrl: null,
    status: "processing",
    tags: normalizeTags(tags),
    creditOk: true,
    reportCount: 0,
    flagged: false,
    likeCount: 0,
    commentCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    publishedAt: null,
  });

  return { videoId, uploadId: payload.data.id, uploadUrl: payload.data.url };
});

function verifyMuxSignature(header: string | undefined, rawBody: Buffer, secret: string): boolean {
  if (!header) return false;
  const parts: Record<string, string> = {};
  for (const chunk of header.split(",")) {
    const [k, v] = chunk.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const timestamp = parts.t;
  const provided = parts.v1;
  if (!timestamp || !provided) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody.toString("utf8")}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Mux posts asset lifecycle events here. We bind them back to a video doc via
// the Mux `passthrough` field we set to the Firestore video id.
export const muxWebhook = onRequest(async (req, res) => {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret) {
    res.status(500).send("Webhook secret not configured.");
    return;
  }
  if (!verifyMuxSignature(req.headers["mux-signature"] as string | undefined, req.rawBody, secret)) {
    res.status(401).send("Invalid signature.");
    return;
  }

  const event = req.body as { type?: string; data?: Record<string, unknown> };
  const type = event.type ?? "";
  const data = (event.data ?? {}) as Record<string, unknown>;
  const videoId = (data.passthrough as string | undefined) ?? undefined;

  if (videoId) {
    const ref = db.doc(`videos/${videoId}`);
    if (type === "video.upload.asset_created") {
      await ref.set({ mediaAssetId: (data.asset_id as string) ?? null }, { merge: true });
    } else if (type === "video.asset.ready") {
      const playbackIds = (data.playback_ids as Array<{ id: string }> | undefined) ?? [];
      const playbackId = playbackIds[0]?.id ?? null;
      await ref.set(
        {
          mediaAssetId: (data.id as string) ?? null,
          playbackUrl: playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null,
          mp4Url: playbackId ? `https://stream.mux.com/${playbackId}/capped-1080p.mp4` : null,
          posterUrl: playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg?time=0` : null,
          status: "ready",
          publishedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } else if (type === "video.asset.errored") {
      await ref.set({ status: "failed" }, { merge: true });
    }
  }

  res.status(200).json({ received: true });
});
