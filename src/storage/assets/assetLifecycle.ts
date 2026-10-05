/** Serializes asset saves, adoption and cleanup across extension contexts. */
let queue: Promise<unknown> = Promise.resolve();
export function withAssetLifecycleLock<T>(operation: () => Promise<T>): Promise<T> {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks) return locks.request('supercommands-asset-lifecycle', operation);
    // Environments without Web Locks receive same-context serialization only.
    const result = queue.then(operation, operation);
    queue = result.catch(() => undefined);
    return result;
}

/** Protects newly saved editor files and stages abandoned assets for retryable cleanup. */
export const ASSET_DELETION_GRACE_MS = 24 * 60 * 60 * 1000;
