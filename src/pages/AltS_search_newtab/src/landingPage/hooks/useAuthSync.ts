import { useEffect, useRef, useState } from 'react';
import { getUserId } from '../../../../../storage/API/core/api';
import { startupPerf } from '../../startupPerf';

export const useAuthSync = () => {
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState('local_user');
  const userIdRef = useRef('local_user');

  useEffect(() => {
    let alive = true;

    const syncUserId = async () => {
      try {
        const currentUserId = await getUserId();
        if (!alive) return;
        if (currentUserId) {
          startupPerf('auth:userIdResolved', {
            isLocalUser: currentUserId === 'local_user',
          });
          userIdRef.current = currentUserId;
          setUserId(currentUserId);
        }
      } catch (error) {
        console.error('[useAuthSync] Initial user ID lookup failed', error);
      } finally {
        if (alive) {
          startupPerf('auth:checked');
          setAuthChecked(true);
        }
      }
    };

    syncUserId();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 30;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        return;
      }

      try {
        const currentUserId = await getUserId();
        if (!currentUserId || currentUserId === userIdRef.current) return;
        userIdRef.current = currentUserId;
        setUserId(currentUserId);
      } catch (error) {
        console.error('[useAuthSync] Polling user ID failed', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const isLoggedIn = userId !== '' && userId !== 'local_user';

  return { authChecked, userId, isLoggedIn };
};
