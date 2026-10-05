export type OS = 'mac' | 'win' | 'android' | 'cros' | 'linux' | 'openbsd' | 'fuchsia' | 'unknown';
/**
 * Detects the operating system.
 * Uses chrome.runtime.getPlatformInfo if available (typical for extensions),
 * falling back to navigator.platform/userAgent for pure web contexts.
 */
export const detectOS = async (): Promise<OS> => {
    // 1. Try Extension API
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getPlatformInfo) {
        return new Promise(resolve => {
            chrome.runtime.getPlatformInfo(info => {
                resolve((info.os as OS) || 'unknown');
            });
        });
    }
    // 2. Fallback to Navigator
    const platform = navigator.platform.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();
    // Mac (includes "Macintosh", "MacIntel", "MacPPC", "Mac68K", and iOS devices often)
    if (platform.includes('mac') || userAgent.includes('mac'))
        return 'mac';
    // Windows
    if (platform.includes('win') || userAgent.includes('win'))
        return 'win';
    // Linux
    if (platform.includes('linux') || userAgent.includes('linux'))
        return 'linux';
    // Android
    if (platform.includes('android') || userAgent.includes('android'))
        return 'android';
    // Chrome OS
    if (userAgent.includes('cros'))
        return 'cros';
    return 'unknown';
};
export const isMac = (os: OS): boolean => os === 'mac';
