/**
 * @file tagHooks.ts
 * @description Provides React hook (`useTags`) for retrieving global tags or
 * tags visible to a specific dashboard view.
 *
 * @usage
 * ```tsx
 * import { useTags } from './tagHooks';
 * const tags = useTags({ workspaceId });
 * ```
 */
import { useMemo } from 'react';
import { useDbStore } from '../../../../storage/store/useDbStore';
export const useTags = (options?: {
    workspaceId?: string | null;
    includeGlobal?: boolean;
}) => {
    const allTags = useDbStore(state => state.tags);
    return useMemo(() => {
        const workspaceId = options?.workspaceId;
        const includeGlobal = options?.includeGlobal ?? true;
        if (!options || options.workspaceId === undefined) {
            return allTags.filter(tag => tag.workspaceId === null);
        }
        return allTags.filter(tag => (includeGlobal && tag.workspaceId === null) ||
            (workspaceId !== null && tag.workspaceId === workspaceId));
    }, [allTags, options?.workspaceId, options?.includeGlobal]);
};
