import { useEffect, useRef, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type Query,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Video } from "../types/models";

const PAGE_SIZE = 10;

function friendlyError(err: unknown, category: string | null): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/requires an index/i.test(msg)) {
    return `${category ?? "This"} feed is still warming up. Try again in a moment.`;
  }
  if (/network|offline|unavailable|failed to fetch/i.test(msg)) {
    return "You appear to be offline. Check your connection and retry.";
  }
  return "Couldn’t load the feed.";
}

function buildQuery(category: string | null, cursor: QueryDocumentSnapshot | null): Query {
  const constraints: QueryConstraint[] = [where("status", "==", "ready")];
  if (category) constraints.push(where("tags", "array-contains", category));
  constraints.push(orderBy("publishedAt", "desc"));
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(PAGE_SIZE));
  return query(collection(db, "videos"), ...constraints);
}

export function useFeed(category: string | null = null) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const categoryRef = useRef(category);
  categoryRef.current = category;

  const cursorRef = useRef<QueryDocumentSnapshot | null>(null);
  const loadingMoreRef = useRef(false);
  const exhaustedRef = useRef(false);

  const mapDoc = (d: QueryDocumentSnapshot): Video => ({ id: d.id, ...d.data() }) as Video;

  async function loadFirst() {
    setLoading(true);
    setError(null);
    setVideos([]);
    setCursor(null);
    cursorRef.current = null;
    exhaustedRef.current = false;
    setExhausted(false);
    const cat = category;
    try {
      const snap = await getDocs(buildQuery(cat, null));
      if (categoryRef.current !== cat) return;
      const nextCursor = snap.docs[snap.docs.length - 1] ?? null;
      setVideos(snap.docs.map(mapDoc));
      setCursor(nextCursor);
      cursorRef.current = nextCursor;
      exhaustedRef.current = snap.docs.length < PAGE_SIZE;
      setExhausted(exhaustedRef.current);
    } catch (e) {
      setError(friendlyError(e, cat));
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (loadingMoreRef.current || exhaustedRef.current || !cursorRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const cat = categoryRef.current;
    try {
      const snap = await getDocs(buildQuery(cat, cursorRef.current));
      if (categoryRef.current !== cat) return;
      const nextCursor = snap.docs[snap.docs.length - 1] ?? cursorRef.current;
      setVideos((prev) => [...prev, ...snap.docs.map(mapDoc)]);
      setCursor(nextCursor);
      cursorRef.current = nextCursor;
      exhaustedRef.current = snap.docs.length < PAGE_SIZE;
      setExhausted(exhaustedRef.current);
    } catch (e) {
      setError(friendlyError(e, cat));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  return { videos, loading, loadingMore, error, refresh: loadFirst, loadMore, exhausted };
}
