import * as React from 'react';
import { motion } from 'framer-motion';

import { FEATURE_FLAGS } from '../../pages/AltS_search_newtab/src/utils/featureFlags';
import { CMDOS_SIGN_UP_URL } from '../../storage/API/core/api';

interface LoginButtonProps {
  isLoggedIn: boolean;
  userId: string | null;
}

const LoginButton: React.FC<LoginButtonProps> = ({ isLoggedIn, userId }) => {
  if (!FEATURE_FLAGS.ENABLE_SHARING) return null;
  if (isLoggedIn && userId !== 'local_user') return null;

  const handleLogin = () => {
    // IMPORTANT: must open in a new tab — NOT navigate the current page.
    // Navigating away destroys the React app and the chrome.storage.onChanged
    // listener in useAuthSync, so the login token write is never detected.
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.tabs?.create) {
      chromeAny.tabs.create({ url: CMDOS_SIGN_UP_URL });
    } else {
      window.open(CMDOS_SIGN_UP_URL, '_blank');
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05, translateY: -1 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleLogin}
      className="px-4 py-2 bg-gradient-to-r from-neutral-800 to-neutral-900 dark:from-white dark:to-neutral-100 text-white dark:text-neutral-900 text-sm font-semibold rounded-full shadow-lg shadow-neutral-900/10 hover:shadow-neutral-900/20 transition-all border border-white/10 dark:border-transparent flex items-center gap-2 cursor-pointer">
      Login
    </motion.button>
  );
};

export default LoginButton;

