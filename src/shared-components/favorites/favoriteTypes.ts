export interface FavoriteRecord {
  id: string; // The generated UUID for this favorite record
  favourite_id: string; // The ID from the backend (if synced) or local
  user_id: string; // The user ID, fallback to 'local_user' if not logged in
  reference_id: string; // The ID of the item being favorited (e.g., snippetId, linkId)
  reference_type: string; // The type of the item ('snippet', 'command', etc.)
  favoriteCategoryId?: string | null; // Optional link to a user-created favorite category
  label?: string; // Optional label/title for quick display
  updatedAt: number; // Timestamp
}
