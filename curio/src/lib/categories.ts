export const FEED_CATEGORIES = ["Marketing", "Vibe Coding", "Tech"] as const;

export type FeedCategory = (typeof FEED_CATEGORIES)[number];

export const ALL_CATEGORY = "All";

export type FeedFilter = typeof ALL_CATEGORY | FeedCategory;

export const FEED_FILTERS: readonly FeedFilter[] = [ALL_CATEGORY, ...FEED_CATEGORIES];
