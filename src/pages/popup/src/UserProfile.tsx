import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { useEffect, useState, useRef } from 'react';
import { FaCog, FaSignOutAlt } from 'react-icons/fa';
import { CMDOS_SIGN_UP_URL } from '../../../storage/API/core/api';

interface UserInfo {
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface UserProfileProps {
  user: UserInfo | null;
  onSignOut: () => void;
}

const LoginView: React.FC = () => {
  const iconUrl = chrome.runtime.getURL('popup/tasklabs_logo.png');
  const startWritingUrl = chrome.runtime.getURL('popup/start_writing.png');
  const websiteUrl = CMDOS_SIGN_UP_URL;

  const handleLogin = () => {
    chrome.tabs.create({ url: websiteUrl });
  };

  return (
    <div className="flex flex-col items-center justify-center w-[300px] px-4 py-6">
      <img src={iconUrl} alt="Cmdos Logo" className="h-10 w-10 mb-3" />

      <div className="mb-4 w-full max-w-[140px]">
        <img src={startWritingUrl} alt="Start Writing" className="w-full h-auto object-contain" />
      </div>

      <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-1 text-center">cmdOS</h2>

      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-5 text-center px-2">
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

const UserProfile: React.FC<UserProfileProps> = ({ user, onSignOut }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

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

  const initial = user?.name?.charAt(0).toUpperCase() || '?';

  return (
    <div className="relative z-50" ref={popupRef}>
      <div className="relative flex flex-col items-center group text-black">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 rounded-full bg-[#bf360c] flex items-center justify-center text-white text-lg font-normal shadow-sm cursor-pointer hover:opacity-90 transition-opacity outline-none overflow-hidden p-0"
          title={user?.name || 'Profile'}>
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span>{initial}</span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-72 bg-frostedwhite dark:bg-frostedwhite backdrop-blur-sm rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700/50 overflow-hidden z-[100]">
            {user ? (
              <>
                {/* Header with User Info */}
                <div className="p-4 border-b border-neutral-100 dark:border-neutral-700 flex items-center gap-3 text-black">
                  <div className="w-10 h-10 rounded-full bg-[#bf360c] text-white flex items-center justify-center font-medium text-lg flex-shrink-0 overflow-hidden ">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span>{initial}</span>
                    )}
                  </div>
                  <div className="text-black">
                    <h3 className="text-sm font-semibold text-black truncate">{user.name || 'User'}</h3>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="p-1">
                  <a
                    href="#"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer group">
                    <FaCog className="text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300" />
                    <span className="text-black">Manage account</span>
                  </a>
                  <button
                    onClick={onSignOut}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer group text-left">
                    <FaSignOutAlt className="text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300" />
                    <span className="text-black">Sign out</span>
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
