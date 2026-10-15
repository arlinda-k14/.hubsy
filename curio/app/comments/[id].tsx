import { router, useLocalSearchParams } from "expo-router";
import { CommentsSheet } from "../../src/components/CommentsSheet";

export default function CommentsRoute() {
  const { id, authorUid } = useLocalSearchParams<{ id: string; authorUid?: string }>();
  return (
    <CommentsSheet
      videoId={id}
      videoAuthorUid={authorUid ?? null}
      onClose={() => router.back()}
    />
  );
}
