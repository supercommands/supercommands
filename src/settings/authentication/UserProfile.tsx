import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { FaCog, FaSignOutAlt, FaUser } from 'react-icons/fa';
import { getUserId, getUserInfo, CMDOS_SIGN_UP_URL, CMDOS_SUBSCRIPTION_URL } from '../../storage/API/core/api';
import { FEATURE_FLAGS } from '../../pages/AltS_search_newtab/src/utils/featureFlags';

const LoginView: React.FC = () => {
  const iconUrl = chrome.runtime.getURL('popup/cmdOS_logo.png');
  const startWritingUrl = chrome.runtime.getURL('popup/start_writing.png');
  const websiteUrl = CMDOS_SIGN_UP_URL;

  const handleLogin = () => {
    window.location.href = websiteUrl;
  };

  return (
    <div className="flex flex-col items-center justify-center w-full px-4 py-6">
      <img src={iconUrl} alt="Cmdos Logo" className="h-8 w-8 mb-3" />

      <div className="mb-4 w-full max-w-[140px]">
        <img src={startWritingUrl} alt="Start Writing" className="w-full h-auto object-contain" />
      </div>

      <h2 className="text-lg font-bold text-[var(--color-textPrimary)] mb-1 text-center">cmdOS</h2>

      <p className="text-xs text-[var(--color-textSecondary)] mb-5 text-center px-2">
        Log in to access your notes and start writing
      </p>

      <button
        onClick={handleLogin}
        className="w-full py-2 px-4 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 rounded-lg transition-colors duration-200 font-medium text-sm text-center">
        Go to Login Page
      </button>
    </div>
  );
};

const UserProfile: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    email: string;
    name: string;
    avatar_url?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async (force = false) => {
      try {
        const chromeAny = (window as any).chrome;
        const now = Date.now();

        // 1. Try storage first
        const storage = await chromeAny.storage.local.get(['user_info', 'last_user_info_fetch_timestamp']);
        console.log('[UserProfile] Cached storage:', storage);
        const lastFetch = storage.last_user_info_fetch_timestamp || 0;
        const isCoolingDown = now - lastFetch < 60 * 60 * 1000; // 1-hour cooldown

        if (storage.user_info) {
          setUserInfo(storage.user_info);
          setLoading(false);
          if (isCoolingDown && !force) return;
        }

        const userId = await getUserId();
        console.log('[UserProfile] Fetching data for userId:', userId);
        const info = await getUserInfo(userId);
        console.log('[UserProfile] getUserInfo API response:', info);
        if (info && info.user) {
          const { user } = info;
          const emailVal = user.email || '';
          const fullName = user.first_name
            ? `${user.first_name} ${user.last_name || ''}`.trim()
            : emailVal.split('@')[0] || 'User';

          const data = {
            email: user.email,
            name: fullName,
            avatar_url: user.profile_image_url || user.image_url,
          };
          
          setUserInfo(data);
          await chromeAny.storage.local.set({ 
            user_info: data,
            last_user_info_fetch_timestamp: Date.now() 
          });
        }
      } catch (error) {
        setUserInfo(prev => prev); 
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    const listener = (changes: any) => {
      if (changes.user_info) {
        setUserInfo(changes.user_info.newValue || null);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSignOut = async () => {
    const keysToRemove = [
      'accessToken',
      'user_info',
      'last_org_counter_check_timestamp',
      'last_org_counter_check_result',
      'last_user_info_fetch_timestamp',
      'last_cloud_fetch_timestamp',
      'last_todo_fetch_timestamp',
      'last_sub_fetch_timestamp',
    ];
    await chrome.storage.local.remove(keysToRemove);
    window.location.reload();
  };

  const initial = userInfo?.name?.charAt(0).toUpperCase() || '?';

  if (!FEATURE_FLAGS.ENABLE_SHARING && !userInfo) return null;

  return (
    <div className="relative" ref={popupRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-9 h-9 rounded-full flex items-center justify-center font-medium cursor-pointer shadow-sm transition-colors border-2 select-none overflow-hidden
          ${
            userInfo
              ? 'bg-green-600 hover:bg-green-700 text-white border-transparent hover:border-green-400'
              : 'bg-[var(--color-containerBg)] text-[var(--color-iconDefault)] border-transparent hover:border-neutral-300 dark:hover:border-neutral-600'
          }`}>
        {userInfo?.avatar_url ? (
          <img src={userInfo.avatar_url} alt="Profile" className="w-full h-full object-cover" />
        ) : userInfo ? (
          <span>{initial}</span>
        ) : (
          <FaUser size={14} /> // Generic user icon when logged out
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-72 bg-[var(--color-popupBg)] rounded-xl shadow-xl border border-[var(--color-borderDefault)] overflow-hidden z-50">
            {userInfo ? (
              <>
                {/* Header with User Info */}
                <div className="p-4 border-b border-[var(--color-borderDefault)] flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-medium text-lg flex-shrink-0 overflow-hidden">
                    {userInfo.avatar_url ? (
                      <img src={userInfo.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span>{initial}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--color-textPrimary)] truncate">{userInfo.name}</h3>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="p-1">
                  <a
                    href={CMDOS_SUBSCRIPTION_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer group">
                    <FaCog className="text-[var(--color-iconDefault)] group-hover:text-neutral-600 dark:group-hover:text-neutral-300" />
                    <span>Manage account</span>
                  </a>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer group text-left">
                    <FaSignOutAlt className="text-[var(--color-iconDefault)] group-hover:text-neutral-600 dark:group-hover:text-neutral-300" />
                    <span>Sign out</span>
                  </button>
                </div>
              </>
            ) : (
              <LoginView />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserProfile;

