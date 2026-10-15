import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Video } from "../types/models";

const PAGE_SIZE = 10;

export function useFeed() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [exhausted, setExhausted] = useState(false);

  const mapDoc = (d: QueryDocumentSnapshot): Video =>
    ({ id: d.id, ...d.data() }) as Video;

  async function loadFirst() {
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, "videos"),
        where("status", "==", "ready"),
        orderBy("publishedAt", "desc"),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(q);
      setVideos(snap.docs.map(mapDoc));
      setCursor(snap.docs[snap.docs.length - 1] ?? null);
      setExhausted(snap.docs.length < PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load feed.");
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (loadingMore || exhausted || !cursor) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, "videos"),
        where("status", "==", "ready"),
        orderBy("publishedAt", "desc"),
        startAfter(cursor),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(q);
      setVideos((prev) => [...prev, ...snap.docs.map(mapDoc)]);
      setCursor(snap.docs[snap.docs.length - 1] ?? cursor);
      setExhausted(snap.docs.length < PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadFirst();
  }, []);

  return { videos, loading, loadingMore, error, refresh: loadFirst, loadMore, exhausted };
}
