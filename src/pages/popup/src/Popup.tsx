import { nowUtc } from '../../../shared-components/utils';
import './Popup.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { useEffect, useState, useRef } from 'react';
import LoginGuide from './LoginGuide';
import UserProfile from './UserProfile';
import { FaTimes, FaSync, FaKeyboard } from 'react-icons/fa';
import { GoAlert } from 'react-icons/go';
import { BsLink45Deg } from 'react-icons/bs';
import { CMDOS_REDIRECT_URL, CMDOS_DOCS_URL } from '../../../storage/API/core/apiConfig';
import { CMDOS_SIGN_IN_URL } from '../../../storage/API/core/api';
import { FEATURE_FLAGS } from '../../AltS_search_newtab/src/utils/featureFlags';

const getOS = () => {
  const platform = window.navigator.platform.toLowerCase();
  const userAgent = window.navigator.userAgent.toLowerCase();
  if (platform.includes('mac') || userAgent.includes('mac')) {
    return 'mac';
  }
  return 'win';
};

const Popup = () => {
  const theme = useStorage(exampleThemeStorage);
  const isLight = theme === 'light';
  const logo = 'popup/cmdOS_logo.png';
  const gotoWebsite = () => chrome.tabs.create({ url: CMDOS_REDIRECT_URL });

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userProfileImg, setUserProfileImg] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<{ title: string; url: string } | null>(null);

  const [showSavePanel, setShowSavePanel] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Add debug log state
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const debugLogRef = useRef<HTMLDivElement>(null);

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

  // Custom debug logger that saves to state
  const debugLog = (message: string, data?: any) => {
    const timestamp = nowUtc().substr(11, 8);
    const logMessage = data ? `${timestamp} ${message}: ${JSON.stringify(data, null, 2)}` : `${timestamp} ${message}`;
    setDebugLogs(prev => {
      const newLogs = [...prev, logMessage];
      // Keep last 50 logs only
      return newLogs.slice(Math.max(0, newLogs.length - 50));
    });

    // Scroll to bottom of logs
    setTimeout(() => {
      if (debugLogRef.current) {
        debugLogRef.current.scrollTop = debugLogRef.current.scrollHeight;
      }
    }, 100);
  };

  // Replace first debugging calls
  useEffect(() => {
    debugLog('Popup initialized');
    debugLog('Current theme', theme);

    // Initial check
    chrome.storage.local.get(null, allStorage => {
      debugLog('All storage content', allStorage);
      // Try to set email from initial storage dump if available
      if (allStorage.user_email || allStorage.email) {
        setUserEmail(allStorage.user_email || allStorage.email);
      }
    });
  }, [theme]);

  // API functions directly in the component
  const getUserId = async (): Promise<string> => {
    try {
      debugLog('Getting userId from storage...');
      const result = await chrome.storage.local.get('accessToken');
      debugLog('Storage full result', result);

      // Debug: Log exact token structure and format
      const userIdResult = result.accessToken;
      debugLog('Raw accessToken', userIdResult);
      debugLog('Token type', typeof userIdResult);

      if (!userIdResult) {
        const error = 'No access token found in storage';
        debugLog('Error', error);
        throw new Error(error);
      }

      if (typeof userIdResult !== 'string') {
        debugLog('Token is not a string', userIdResult);
        throw new Error('Access token is not in the expected string format');
      }

      if (!userIdResult.startsWith('user_')) {
        debugLog('Token does not start with "user_"', userIdResult);
        throw new Error('Please login to use the extension');
      }

      return userIdResult;
    } catch (error) {
      debugLog('Error getting userId', error);
      throw error;
    }
  };

  // Function to process key (replace spaces with underscores)
  const processKey = (key: string) => {
    const trailingMatch = key.match(/(\s*)$/);
    const trailingSpaces = trailingMatch ? trailingMatch[0] : '';
    const core = key.slice(0, key.length - trailingSpaces.length);
    return core.replace(/ /g, '_') + trailingSpaces;
  };

  // Check for trigger_error_popup flag from background script
  const [showErrorPopup, setShowErrorPopup] = useState(false);

  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(['trigger_error_popup'], (result: any) => {
        if (result.trigger_error_popup) {
          setShowErrorPopup(true);
          // Clear the flag so it doesn't persist
          chromeAny.storage.local.remove('trigger_error_popup');
        }
      });
    }
  }, []);

  // Show heavily compacted Error/Alert Popup
  // Show heavily compacted Error/Alert Popup matching exact image format (vertical stack)

  // Fetch user info from chrome storage cache (local-first)
  const fetchUserInfo = async (_id: string) => {
    return null;
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Debug: Check localStorage directly first
        debugLog('Directly checking chrome.storage.local...');
        chrome.storage.local.get(null, allStorage => {
          debugLog('All storage content', allStorage);
        });

        // First check auth via background script
        debugLog('Sending check_auth message to background script...');
        chrome.runtime.sendMessage({ action: 'check_auth' }, async response => {
          debugLog('Auth check response from background', response);

          // Helper to fetch email and name after auth success
          const ensureUserEmail = (uid: string) => {
            chrome.storage.local.get(['user_email', 'email', 'profileImg', 'user_name'], res => {
              const cachedEmail = res.user_email || res.email;
              const cachedImage = res.profileImg;
              const cachedName = res.user_name;

              if (cachedImage) {
                setUserProfileImg(cachedImage);
              }

              if (cachedName) {
                setUserName(cachedName);
              }

              if (cachedEmail) {
                setUserEmail(cachedEmail);
              }
            });
          };

          if (response && response.isLoggedIn && response.userId) {
            debugLog('User is logged in via background check', response.userId);
            setUserId(response.userId);
            setIsLoggedIn(true);
            ensureUserEmail(response.userId);
          } else {
            // Fallback to direct storage check
            debugLog('Fallback to direct storage check...');
            try {
              const retrievedUserId = await getUserId();
              debugLog('Retrieved User ID from direct check', retrievedUserId);
              setUserId(retrievedUserId);
              setIsLoggedIn(true);
              ensureUserEmail(retrievedUserId);
            } catch (error) {
              debugLog('Direct auth check failed', error);
              setIsLoggedIn(false);
              // Debug: Let's try to manually check storage again after failure
              chrome.storage.local.get('accessToken', result => {
                debugLog('Manual accessToken check after failure', result);
              });
            }
          }
        });
      } catch (error) {
        debugLog('Authentication Error', error);
        setIsLoggedIn(false);
      }
    };

    checkAuth();
  }, []);

  const resetSelections = () => {
    setShowSavePanel(false);
  };

  const startSaveProcess = () => {
    setShowSavePanel(true);
    setError(null);
  };

  // Render the debug panel toggle button and panel
  const renderDebugPanel = () => (
    <div className="fixed bottom-2 right-2 z-50">
      {/* <button
        onClick={() => setShowDebugPanel(!showDebugPanel)}
        className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full">
        🐞
      </button> */}

      {showDebugPanel && (
        <div className="fixed inset-0 bg-white dark:bg-gray-800 z-50 p-3 flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">Debug Logs</h3>
            <button
              onClick={() => setShowDebugPanel(false)}
              className="bg-red-500 hover:bg-red-600 text-white p-1 rounded">
              Close
            </button>
          </div>

          <div
            ref={debugLogRef}
            className="flex-1 bg-black text-green-400 p-2 overflow-auto font-mono text-xs whitespace-pre">
            {debugLogs.join('\n')}
          </div>

          <div className="flex gap-2 mt-2 flex-wrap">
            <button
              onClick={() => setDebugLogs([])}
              className="bg-red-500 hover:bg-red-600 text-white p-1 px-2 rounded text-sm">
              Clear Logs
            </button>
            <button
              onClick={() => setDebugLogs([])}
              className="bg-blue-500 hover:bg-blue-600 text-white p-1 px-2 rounded text-sm">
              Clear Logs
            </button>
            <button
              onClick={() => {
                chrome.storage.local.get(null, result => {
                  debugLog('Storage contents', result);
                });
              }}
              className="bg-purple-500 hover:bg-purple-600 text-white p-1 px-2 rounded text-sm">
              Check Storage
            </button>
            <button
              onClick={() => {
                const logsText = debugLogs.join('\n');
                navigator.clipboard
                  .writeText(logsText)
                  .then(() => {
                    alert('Logs copied to clipboard!');
                  })
                  .catch(err => {
                    alert('Failed to copy logs: ' + err);
                    console.error('Copy failed:', err);
                  });
              }}
              className="bg-green-500 hover:bg-green-600 text-white p-1 px-2 rounded text-sm">
              Copy Logs
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Show heavily compacted Error/Alert Popup matching exact image format (vertical stack)
  // Moved to end of render to avoid React Hook errors (Rendered fewer hooks than expected)
  if (showErrorPopup) {
    return (
      <div
        className={`App ${!isLight ? 'dark' : ''} bg-white dark:bg-neutral-900 h-full flex flex-col p-4`}
        style={{ width: '300px', height: '300px' }}>
        {/* Header for Close */}
        {/* <div className="w-full flex justify-end mb-2">
              <button 
                onClick={() => window.close()}
                className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
                <FaTimes size={16} />
              </button>
           </div> */}

        {/* Alert Card */}
        <div className="w-[96%] bg-[#FFF9F0] border-[3px] border-orange-300  mt-2 rounded-lg h-[60px] mb-4 flex items-center justify-center gap-2 relative overflow-hidden mx-auto">
          {/* Shine effect - Diagonal white block on right */}
          <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-white via-white/80 transform skew-x-[-20deg] translate-x-8 b-[1px] border-[#ffd2b480]"></div>

          <div className="flex items-center gap-2 z-10">
            <span className="text-orange-400 text-lg">
              <GoAlert size={20} color="yellow-800" />
            </span>
            <span className="text-yellow-800  font-medium text-sm">Alert</span>
          </div>
        </div>

        {/* Warning Text */}
        <div className="space-y-2 px-1 font-medium">
          <p className="text-gray-600  ">
            The Alt+S feature is supported only on <br /> standard websites that start with{' '}
            <span className="text-green-700 dark:text-green-400 font-semibold">WWW </span>(e.g., www.example.com).
            <br />
            <span className="text-[#dc2626a8] px-1">
              {' '}
              It does not run on the <del>Extension Store</del> or on <del>blank tab pages</del>.
            </span>
          </p>
        </div>

        {/* Actions - Vertical Stack (Matching Image) */}
        <div className="flex flex-col gap-3 w-[65%] mt-4 mx-auto">
          <button
            onClick={() => chrome.tabs.create({ url: CMDOS_DOCS_URL })}
            className="w-full py-2 bg-white-600  border border-black-400  rounded-lg text-black text-xs font-medium hover:bg-gray-50 dark:hover:bg-neutral-700 hover:text-white transition-colors shadow-sm">
            Learn More
          </button>

          <button
            onClick={() => chrome.tabs.create({ url: CMDOS_DOCS_URL })}
            className="w-full py-2 bg-gradient-to-r from-purple-400 to-indigo-500 rounded-lg text-white text-xs font-medium hover:opacity-90 transition-opacity shadow-md">
            Tutorial
          </button>
        </div>
      </div>
    );
  }

  if (FEATURE_FLAGS.ENABLE_SHARING && !isLoggedIn) {
    return (
      <>
        <LoginGuide websiteUrl={CMDOS_SIGN_IN_URL} />
        {renderDebugPanel()}
      </>
    );
  }

  return (
    <div
      className={`App ${!isLight ? 'dark' : ''} rounded-xl overflow-hidden`}
      id="app-container dropdown-card"
      style={{ width: !showSavePanel ? '600px' : 'auto' }}>
      <div className="flex justify-between items-center w-full px-4 mb-3 pt-3">
        <div className="flex items-center gap-3">
          <button onClick={gotoWebsite} className="outline-none">
            <img src={chrome.runtime.getURL(logo)} className="w-8 h-8 object-contain" alt="logo" />
          </button>
          <h1 className="text-lg font-medium text-neutral-600 ">cmdOS</h1>
        </div>

        <div className="flex items-center gap-4">
          {FEATURE_FLAGS.ENABLE_SHARING && (
            <UserProfile
              user={{
                name: userName || userEmail?.split('@')[0] || 'User',
                email: userEmail,
                avatar_url: userProfileImg,
              }}
              onSignOut={handleSignOut}
            />
          )}

          <button
            onClick={() => window.close()}
            className="ml-1 text-neutral-800 hover:text-neutral-600 dark:text-neutral-400 dark:hover:text-neutral-200">
            <FaTimes size={18} />
          </button>
        </div>
      </div>

      {/* Header Divider */}
      <div className="w-full h-[1px] bg-neutral-500 mb-4"></div>

      {!showSavePanel ? (
        <div className="flex flex-col items-center w-full px-4">
          <h2 className="text-sm text-neutral-600 mb-6">To get started:</h2>

          <div className="flex items-center justify-center gap-8 mb-6 w-full">
            {getOS() === 'win' ? (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2 mb-2">
                  <kbd className="bg-black text-white px-3 py-2 rounded-md font-md min-w-[3rem] text-center">ALT</kbd>
                  <span className="text-lg text-black font-bold">+</span>
                  <kbd className="bg-white text-black border border-neutral-200 px-3 py-2 rounded-md font-bold text-xl min-w-[3rem] text-center shadow-sm">
                    S
                  </kbd>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2 mb-2">
                  <kbd className="bg-black text-white px-3 py-2 rounded-md font-bold text-lg min-w-[3rem] text-center flex items-center justify-center">
                    ⌥
                  </kbd>
                  <span className="text-lg text-black font-bold">+</span>
                  <kbd className="bg-white text-black border border-neutral-200 px-3 py-2 rounded-md font-bold text-xl min-w-[3rem] text-center shadow-sm">
                    S
                  </kbd>
                </div>
              </div>
            )}
          </div>

          <div className="relative w-[50%] overflow-hidden rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-6 text-center shadow-lg mb-4">
            <div className="flex justify-between items-start mb-1">
              {/* Decorative background blur removed for simplicity or added if needed */}
            </div>
            <h3 className="text-lg font-semibold mb-1 relative z-10">Want a quick demo?</h3>
            <p className="text-purple-100 text-sm mb-4 relative z-10">Learn the flow in under a minute.</p>

            <button
              onClick={() => window.open(CMDOS_DOCS_URL)}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/40 px-6 py-2 rounded-lg text-sm font-medium backdrop-blur-sm transition-colors relative z-10 flex items-center justify-center mx-auto gap-2">
              🚀 Watch Tutorial
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-medium text-xl">Save Link</h3>
            <button
              onClick={resetSelections}
              className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
              <FaTimes size={18} />
            </button>
          </div>

          {/* Display current tab info */}
          {currentTab && (
            <div className="mb-5 p-4 bg-neutral-100 rounded-md border border-neutral-200 dark:border-neutral-500">
              <div className="flex items-start mb-2">
                <BsLink45Deg className="mr-3 mt-1 text-neutral-500 flex-shrink-0" size={20} />
                <p className="text-base font-medium">{currentTab.title}</p>
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 pl-8 break-all">{currentTab.url}</p>
            </div>
          )}

          {/* Error message if any */}
          {error && (
            <div className="mb-5 p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-md text-sm border border-red-200 dark:border-red-800">
              {error}
              <div className="mt-2 flex">
                <button
                  onClick={() => setError(null)}
                  className="text-red-600 dark:text-red-300 flex items-center text-sm hover:underline mr-4">
                  <FaSync className="mr-1" size={12} /> Clear Error
                </button>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-center items-center py-4">
              <svg
                className="animate-spin h-6 w-6 text-neutral-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-2 text-neutral-600 dark:text-neutral-300">Loading...</span>
            </div>
          )}
        </div>
      )}

      {/* Add debug panel to the end */}
      {renderDebugPanel()}
    </div>
  );
};

export default withErrorBoundary(
  withSuspense(Popup, <div className="p-4 text-center">Loading...</div>),
  <div className="p-4 text-center text-red-500">An error occurred. Please try again.</div>,
);
