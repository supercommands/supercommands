import './Popup.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { CMDOS_REDIRECT_URL } from '../../../storage/API/core/apiConfig';
import { useEffect, useState } from 'react';

const getOS = () => {
  const platform = window.navigator.platform.toLowerCase();
  const userAgent = window.navigator.userAgent.toLowerCase();
  if (platform.includes('mac') || userAgent.includes('mac')) {
    return 'mac';
  }
  return 'win';
};

const getBrowserShortcutSettingsUrl = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('edg')) {
    return 'edge://extensions/shortcuts';
  } else if (userAgent.includes('brave')) {
    return 'brave://extensions/shortcuts';
  } else if (userAgent.includes('firefox')) {
    return 'about:addons'; 
  }
  return 'chrome://extensions/shortcuts';
};

const Popup = () => {
  const theme = useStorage(exampleThemeStorage);
  const isLight = theme === 'light';
  const logo = 'popup/cmdOS_logo.png';
  const gotoWebsite = () => chrome.tabs.create({ url: CMDOS_REDIRECT_URL });

  const [shortcutAssigned, setShortcutAssigned] = useState<boolean | null>(null);
  const [assignedShortcut, setAssignedShortcut] = useState<string>('');

  useEffect(() => {
    chrome.commands.getAll((commands) => {
      const openCmd = commands.find(c => c.name === 'open_alt_q');
      if (openCmd && openCmd.shortcut) {
        setShortcutAssigned(true);
        setAssignedShortcut(openCmd.shortcut);
      } else {
        setShortcutAssigned(false);
      }
    });
  }, []);

  const handleSetShortcut = () => {
    chrome.tabs.create({ url: getBrowserShortcutSettingsUrl() });
  };

  const renderShortcutKeys = () => {
    const os = getOS();
    const keys = assignedShortcut ? assignedShortcut.split('+') : (os === 'mac' ? ['⌥', 'S'] : ['ALT', 'S']);
    
    return (
      <div className="flex items-center gap-2">
        {keys.map((key, index) => (
          <div key={index} className="flex items-center gap-2">
            <kbd className={`${index === 0 ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-white dark:bg-neutral-800 text-black dark:text-white border border-neutral-200 dark:border-neutral-700'} px-3 py-2 rounded-md font-bold text-lg min-w-[3rem] text-center shadow-sm`}>
              {key === 'MacCtrl' || key === 'Command' ? '⌘' : key === 'Alt' && os === 'mac' ? '⌥' : key}
            </kbd>
            {index < keys.length - 1 && <span className="text-lg text-neutral-800 dark:text-neutral-200 font-bold">+</span>}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className={`App ${!isLight ? 'dark' : ''} bg-white dark:bg-neutral-900 rounded-xl overflow-hidden`}
      id="app-container"
      style={{ width: '400px' }}>
      <div className="flex justify-between items-center w-full px-4 mb-3 pt-3">
        {/* Left Side: Branding only */}
        <div className="flex items-center gap-3">
          <button onClick={gotoWebsite} className="outline-none">
            <img src={chrome.runtime.getURL(logo)} className="w-8 h-8 object-contain" alt="logo" />
          </button>
          <h1 className="text-lg font-medium text-neutral-600 dark:text-neutral-200">cmdOS</h1>
        </div>
        {/* Right Side: Empty as requested */}
        <div></div>
      </div>

      {/* Header Divider */}
      <div className="w-full h-[1px] bg-neutral-200 dark:bg-neutral-700 mb-4"></div>

      {/* Middle Section (Shortcut Detection) */}
      <div className="flex flex-col items-center w-full px-4 pb-6 min-h-[100px] justify-center">
        {shortcutAssigned === null ? (
          <p className="text-neutral-500 text-sm">Checking shortcut status...</p>
        ) : shortcutAssigned ? (
          <>
            <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">Your cmdOS Shortcut</h2>
            <div className="flex flex-col items-center mb-4">
              {renderShortcutKeys()}
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center max-w-[280px]">
              Press this hotkey on any website to instantly open the cmdOS search interface and customize your workflow.
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center text-center">
            <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
              Shortcut Not Assigned
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-5 max-w-[280px]">
              Add your custom shortcut (we recommend <strong className="text-neutral-700 dark:text-neutral-200">{getOS() === 'mac' ? '⌥ + S' : 'Alt + S'}</strong>) so you can quickly use the cmdOS search interface on any website.
            </p>
            <button
              onClick={handleSetShortcut}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
              Set Keyboard Shortcut
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default withErrorBoundary(
  withSuspense(Popup, <div className="p-4 text-center">Loading...</div>),
  <div className="p-4 text-center text-red-500">An error occurred. Please try again.</div>,
);
