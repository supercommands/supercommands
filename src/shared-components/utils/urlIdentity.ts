/** URL identity is independent of case-insensitive search matching. */
export function getUrlIdentity(value: string): string {
    const raw = value.trim();
    try {
        // URL canonicalizes the scheme, hostname and default port, but preserves
        // path/query case, fragments and meaningful trailing slashes.
        return new URL(raw).href;
    }
    catch {
        return raw;
    }
}
export function requireHttpUrl(value: string): string {
    try {
        const url = new URL(value.trim());
        if (url.protocol === 'http:' || url.protocol === 'https:')
            return url.href;
    }
    catch {
        // Domain callers share a usable error for empty and malformed input.
    }
    throw new Error('Use a valid HTTP or HTTPS URL.');
}
