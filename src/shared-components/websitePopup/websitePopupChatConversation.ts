/** Shared legacy conversation eligibility; no browser or storage dependencies. */
export function detectWebsitePopupChatConversation(rawUrl: string) {
    try {
        const url = new URL(rawUrl);
        if (!['http:', 'https:'].includes(url.protocol))
            return null;
        const host = url.hostname.toLowerCase();
        if (url.pathname.split('/')[2]?.toLowerCase() === 'new')
            return null;
        const matches = (domain: string) => host === domain || host.endsWith(`.${domain}`);
        const providerId = (matches('chatgpt.com') || host === 'chat.openai.com') && /^\/c\/[^/]+/.test(url.pathname)
            ? 'gpt'
            : matches('claude.ai') && /^\/chat\/[^/]+/.test(url.pathname)
                ? 'claude'
                : matches('gemini.google.com') && /^\/app\/[^/]+/.test(url.pathname)
                    ? 'gemini'
                    : matches('perplexity.ai') && /^\/search\/[^/]+/.test(url.pathname)
                        ? 'perplexity'
                        : null;
        return providerId ? { providerId, url: rawUrl.trim() } : null;
    }
    catch {
        return null;
    }
}
