// useNotification.ts
import { useCallback } from 'react';
import { useUIStore } from '../uiStateManager';
const useNotification = () => {
    // Memoize the function to prevent unstable references that cause re-renders
    const triggerNotification = useCallback((message: string, type?: 'success' | 'error' | 'warning' | 'info') => {
        useUIStore.getState().queueNotification({ message, type: type || 'info' });
    }, []);
    return triggerNotification;
};
export default useNotification;
