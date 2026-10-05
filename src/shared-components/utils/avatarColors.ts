// Shared avatar color utilities for consistent styling across AltS_search_newtab
export const AVATAR_COLORS = [
    'bg-purple-400',
    'bg-orange-400',
    'bg-blue-400',
    'bg-green-400',
    'bg-pink-400',
    'bg-yellow-400',
    'bg-cyan-400',
    'bg-red-400'
];
/**
 * Get avatar color based on a name string
 * Uses consistent hashing to ensure same name always gets same color
 */
export const getAvatarColor = (name: string): string => {
    const index = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
    return AVATAR_COLORS[index];
};
/**
 * Get initials from first and last name
 */
export const getInitials = (firstName?: string, lastName?: string): string => {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return first + last || first || '?';
};
/**
 * Get single initial from a name
 */
export const getSingleInitial = (name?: string): string => {
    return name?.charAt(0)?.toUpperCase() || '?';
};
