import {
  collection,
  deleteDoc,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { ReportReason } from "../types/models";

export async function setLike(uid: string, videoId: string, on: boolean) {
  const likeRef = doc(db, "videos", videoId, "likes", uid);
  const videoRef = doc(db, "videos", videoId);
  await runTransaction(db, async (tx) => {
    if (on) {
      tx.set(likeRef, { uid, createdAt: serverTimestamp() });
      tx.update(videoRef, { likeCount: increment(1) });
    } else {
      tx.delete(likeRef);
      tx.update(videoRef, { likeCount: increment(-1) });
    }
  });
}

export async function setSaved(
  uid: string,
  videoId: string,
  on: boolean,
  collectionId: string | null = null,
) {
  const saveRef = doc(db, "users", uid, "saves", videoId);
  if (on) {
    await setDoc(saveRef, {
      videoId,
      collectionId,
      createdAt: serverTimestamp(),
    });
  } else {
    await deleteDoc(saveRef);
  }
}

export async function fileReport(
  uid: string,
  videoId: string,
  reason: ReportReason,
  detail: string,
) {
  const reportRef = doc(collection(db, "reports"));
  await setDoc(reportRef, {
    videoId,
    reporterUid: uid,
    reason,
    detail,
    createdAt: serverTimestamp(),
  });
}
