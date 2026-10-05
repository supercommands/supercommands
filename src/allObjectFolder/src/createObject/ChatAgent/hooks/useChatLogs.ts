import { useState, useEffect, useRef } from 'react';
export interface LogItem {
    id: string;
    prompt: string;
    timestamp: number;
}
export function useChatLogs(sessionKey?: string, sessionPrompt?: string) {
    const [logs, setLogs] = useState<LogItem[]>([]);
    const prevLogsLengthRef = useRef(logs.length);
    // Load logs from extension local storage
    useEffect(() => {
        if (!sessionKey) {
            setLogs([]);
            return;
        }
        const storageKey = `ai_logs_${sessionKey}`;
        const loadLogs = (attempt = 0) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get([storageKey], result => {
                    const saved = result[storageKey];
                    if (saved) {
                        try {
                            const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
                            setLogs(parsed);
                        }
                        catch (e) {
                            console.error('Failed to parse saved logs', e);
                            setLogs([]);
                        }
                    }
                    else if (attempt < 10) {
                        // Increased retries
                        setTimeout(() => loadLogs(attempt + 1), 150); // Increased delay
                    }
                    else if (sessionPrompt) {
                        const seedLog = { id: `log-seed-${Date.now()}`, prompt: sessionPrompt.trim(), timestamp: Date.now() };
                        chrome.storage.local.set({ [storageKey]: [seedLog] });
                        setLogs([seedLog]);
                    }
                    else {
                        setLogs([]);
                    }
                });
            }
            else {
                setLogs([]);
            }
        };
        loadLogs();
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
            const handleStorageChange = (changes: {
                [key: string]: chrome.storage.StorageChange;
            }, areaName: string) => {
                if (areaName === 'local' && changes[storageKey]) {
                    const newValue = changes[storageKey].newValue;
                    if (newValue) {
                        setLogs(typeof newValue === 'string' ? JSON.parse(newValue) : newValue);
                    }
                }
            };
            chrome.storage.onChanged.addListener(handleStorageChange);
            return () => chrome.storage.onChanged.removeListener(handleStorageChange);
        }
        return () => { };
    }, [sessionKey, sessionPrompt]);
    return { logs, prevLogsLengthRef, setLogs };
}
