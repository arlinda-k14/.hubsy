import { createVideoPlayer, type VideoPlayer } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import type { Video } from "../types/models";
import { ensureAudioSession, releaseAudioSession } from "../lib/audioSession";

export type SlotRole = "current" | "next" | "prev" | "idle";

// Browsers play uploaded MP4s through a native HTML5 <video> in VideoCard, so
// the web build never runs a pooled expo-video player (that would double-play
// audio behind the visible element). Native still uses the pooled player, and
// the Mux HLS rendition when available.
function sourceFor(video: Video): string | null {
  if (Platform.OS === "web") return null;
  return video.playbackUrl ?? video.mp4Url;
}

interface Slot {
  player: VideoPlayer;
  videoId: string | null;
  role: SlotRole;
}

const SLOT_COUNT = 3;
const PREBUFFER_MS = 2000;

export function usePlayerPool(videos: Video[]) {
  const slotsRef = useRef<Slot[]>(
    Array.from({ length: SLOT_COUNT }, () => ({
      player: createVideoPlayer(null),
      videoId: null,
      role: "idle" as SlotRole,
    })),
  );
  const [soundEnabled, setSoundEnabled] = useState(false);
  const activeIndexRef = useRef(0);
  const videosRef = useRef(videos);
  videosRef.current = videos;

  const indexOfId = (id: string | null) =>
    id ? videosRef.current.findIndex((v) => v.id === id) : -1;

  const roleForIndex = useCallback((index: number): SlotRole => {
    const i = activeIndexRef.current;
    if (index === i) return "current";
    if (index === i + 1) return "next";
    if (index === i - 1) return "prev";
    return "idle";
  }, []);

  const handoffAudio = useCallback(async () => {
    const slots = slotsRef.current;
    const current = slots.find((s) => s.videoId && indexOfId(s.videoId) === activeIndexRef.current);
    if (!current || current.player.status !== "readyToPlay") {
      slots.forEach((s) => {
        if (s !== current) {
          s.player.muted = true;
          s.player.pause();
        }
      });
      if (current) {
        current.player.muted = true;
        await current.player.play();
        const sub = current.player.addListener("statusChange", async ({ status }) => {
          if (status === "readyToPlay") {
            current.player.muted = !soundEnabled;
            sub.remove();
          }
        });
      }
      return;
    }
    await ensureAudioSession();
    slots.forEach((s) => {
      if (s === current) return;
      s.player.muted = true;
      s.player.pause();
    });
    current.player.muted = !soundEnabled;
    await current.player.play();
  }, [soundEnabled]);

  const assignWindow = useCallback(
    async (index: number) => {
      const list = videosRef.current;
      if (!list.length) return;
      const clamped = Math.max(0, Math.min(index, list.length - 1));
      const targetIds = [clamped - 1, clamped, clamped + 1]
        .filter((i) => i >= 0 && i < list.length)
        .map((i) => list[i].id);

      const slots = slotsRef.current;

      const carry = new Set(targetIds.filter((id) => slots.some((s) => s.videoId === id)));
      const freeSlots = slots.filter((s) => !s.videoId || !carry.has(s.videoId));
      const toLoad = targetIds.filter((id) => !carry.has(id));

      carry.forEach((id) => {
        const s = slots.find((slot) => slot.videoId === id);
        if (s) s.role = roleForIndex(indexOfId(id));
      });

      toLoad.forEach((id) => {
        const slot = freeSlots.shift();
        const video = list.find((v) => v.id === id);
        if (!slot || !video) return;
        const src = sourceFor(video);
        // External/embed videos have no Mux source — they are played by
        // EmbedPlayer, so they must never occupy a native player slot.
        if (!src) return;
        slot.videoId = video.id;
        slot.role = roleForIndex(indexOfId(id));
        slot.player.replace(src);
        slot.player.muted = true;
        slot.player.loop = true;
        void prebuffer(slot.player);
      });

      slots.forEach((s) => {
        if (!s.videoId) return;
        const feedIndex = indexOfId(s.videoId);
        if (feedIndex === -1) {
          s.player.replace(null);
          s.videoId = null;
          s.role = "idle";
        }
      });

      activeIndexRef.current = clamped;
      await handoffAudio();
    },
    [handoffAudio, roleForIndex],
  );

  const muteActive = useCallback(() => {
    const slots = slotsRef.current;
    slots.forEach((s) => {
      s.player.muted = true;
      if (s.role === "current") s.player.pause();
    });
    void releaseAudioSession();
  }, []);

  const enableSound = useCallback(() => {
    setSoundEnabled((prev) => {
      if (prev) return prev;
      const current = slotsRef.current.find(
        (s) => s.videoId && indexOfId(s.videoId) === activeIndexRef.current,
      );
      if (current) {
        current.player.muted = false;
        void current.player.play();
      }
      void ensureAudioSession();
      return true;
    });
  }, []);

  const playerFor = useCallback(
    (index: number): { player: VideoPlayer | null; role: SlotRole } => {
      const id = videos[index]?.id;
      if (!id) return { player: null, role: "idle" };
      // Role is derived from the active index (not slot existence) so
      // external/embed videos — which never occupy a native slot — still
      // register as the current, active card.
      const slot = slotsRef.current.find((s) => s.videoId === id);
      return { player: slot?.player ?? null, role: roleForIndex(index) };
    },
    [videos, roleForIndex],
  );

  useEffect(() => {
    const slots = slotsRef.current;
    return () => {
      slots.forEach((s) => s.player.release());
    };
  }, []);

  return { playerFor, assignWindow, muteActive, enableSound, soundEnabled };
}

async function prebuffer(player: VideoPlayer) {
  try {
    player.muted = true;
    await player.play();
    await new Promise((resolve) => setTimeout(resolve, PREBUFFER_MS));
    if (player.muted) player.pause();
  } catch {
    player.pause();
  }
}
