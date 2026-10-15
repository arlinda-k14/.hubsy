import {
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Comment, UserProfile } from "../types/models";

export function subscribeComments(
  videoId: string,
  cb: (comments: Comment[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, "videos", videoId, "comments"),
    orderBy("pinned", "desc"),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment));
  });
}

export async function addComment(args: {
  videoId: string;
  parentId: string | null;
  text: string;
  profile: UserProfile;
}): Promise<void> {
  const { videoId, parentId, text, profile } = args;
  const trimmed = text.trim().slice(0, 1000);
  if (!trimmed) return;
  const newRef = doc(collection(db, "videos", videoId, "comments"));
  const videoRef = doc(db, "videos", videoId);
  await runTransaction(db, async (tx) => {
    tx.set(newRef, {
      videoId,
      authorUid: profile.uid,
      authorUsername: profile.username,
      authorAvatarUrl: profile.avatarUrl,
      text: trimmed,
      parentId,
      pinned: false,
      createdAt: serverTimestamp(),
    });
    tx.update(videoRef, { commentCount: increment(1) });
  });
}

export async function deleteComment(videoId: string, commentId: string): Promise<void> {
  const videoRef = doc(db, "videos", videoId);
  await runTransaction(db, async (tx) => {
    tx.delete(doc(db, "videos", videoId, "comments", commentId));
    tx.update(videoRef, { commentCount: increment(-1) });
  });
}

export async function setCommentPinned(
  videoId: string,
  commentId: string,
  pinned: boolean,
): Promise<void> {
  await updateDoc(doc(db, "videos", videoId, "comments", commentId), { pinned });
}
