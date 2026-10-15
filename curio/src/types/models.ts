import type { Timestamp } from "firebase/firestore";

export type VideoSource = "upload" | "external";

export type VideoStatus =
  | "draft"
  | "processing"
  | "ready"
  | "failed"
  | "unpublished"
  | "removed";

export type Platform = "curio" | "youtube" | "tiktok" | "instagram";

export interface UserProfile {
  uid: string;
  username: string;
  usernameLower: string;
  avatarUrl: string | null;
  bio: string;
  githubUrl: string | null;
  linkedinUrl: string | null;
  primaryTopics: string[];
  likedTabPublic: boolean;
  isAdmin: boolean;
  createdAt: Timestamp;
}

export interface Video {
  id: string;
  sourceType: VideoSource;
  platform: Platform;
  originalUrl: string | null;
  authorHandle: string | null;
  authorUid: string | null;
  originalTitle: string | null;
  title: string;
  mediaAssetId: string | null;
  playbackUrl: string | null;
  posterUrl: string | null;
  status: VideoStatus;
  tags: string[];
  creditOk: boolean;
  reportCount: number;
  flagged: boolean;
  likeCount: number;
  commentCount: number;
  createdAt: Timestamp;
  publishedAt: Timestamp | null;
}

export interface Comment {
  id: string;
  videoId: string;
  authorUid: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  text: string;
  parentId: string | null;
  pinned: boolean;
  createdAt: Timestamp;
}

export interface Collection {
  id: string;
  ownerUid: string;
  name: string;
  createdAt: Timestamp;
}

export interface Report {
  id: string;
  videoId: string;
  reporterUid: string;
  reason: ReportReason;
  detail: string;
  createdAt: Timestamp;
}

export type ReportReason =
  | "copyright"
  | "policy"
  | "spam"
  | "other";

export interface WatchEvent {
  videoId: string;
  uid: string | null;
  completionPct: number;
  watchedAt: Timestamp;
}
