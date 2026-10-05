import { BRAND } from '../brandingConfig';
const DEBUG_FLAG = BRAND.storageKeys.debugStorage;
const LEGACY_DEBUG_FLAG = BRAND.legacyStorageKeys.debugStorage;
const PREFIX = `[${BRAND.name}StorageDebug]`;
const isDebugEnabled = () => {
    try {
        if (typeof window === 'undefined')
            return false;
        return (window.localStorage?.getItem(DEBUG_FLAG) === '1' ||
            window.localStorage?.getItem(LEGACY_DEBUG_FLAG) === '1' ||
            (window as any).__supercommands_debug_storage__ === true ||
            (window as any).__cmdos_debug_storage__ === true);
    }
    catch {
        return false;
    }
};
const normalizeError = (error: unknown) => {
    if (!error || typeof error !== 'object')
        return error;
    const err = error as any;
    return {
        name: err.name,
        message: err.message,
        stack: err.stack,
        response: err.response?.data,
    };
};
export const storageDebug = {
    flag: DEBUG_FLAG,
    enabled: isDebugEnabled,
    log(scope: string, message: string, data?: unknown) {
        if (!isDebugEnabled())
            return;
        console.log(`${PREFIX} ${scope}: ${message}`, data ?? '');
    },
    warn(scope: string, message: string, data?: unknown) {
        if (!isDebugEnabled())
            return;
        console.warn(`${PREFIX} ${scope}: ${message}`, data ?? '');
    },
    error(scope: string, message: string, error?: unknown, data?: unknown) {
        if (!isDebugEnabled())
            return;
        console.error(`${PREFIX} ${scope}: ${message}`, { error: normalizeError(error), data });
    },
};
export const getStorageDebugInstructions = () => `Enable storage diagnostics with: localStorage.setItem('${DEBUG_FLAG}','1'); location.reload();`;
