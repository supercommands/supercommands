import { useState, useEffect, useCallback, useMemo } from 'react';
import type { BrowserTab } from '../../linkTypes';

export function useChromeTabs(isOpen: boolean) {
  const [tabsByWindow, setTabsByWindow] = useState<Record<number, BrowserTab[]>>({});
  const [hasFetchedTabs, setHasFetchedTabs] = useState(false);
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);
  const [collapsedWindows, setCollapsedWindows] = useState<Record<number, boolean>>({});

  const chromeAny = (window as any).chrome;

  // Fetch current window ID on mount/open
  useEffect(() => {
    if (!isOpen) return;
    if (chromeAny?.windows?.getCurrent) {
      chromeAny.windows.getCurrent({ populate: false }, (currentWindow: any) => {
        if (currentWindow?.id) {
          setCurrentWindowId(currentWindow.id);
        }
      });
      return;
    }

    if (chromeAny?.runtime?.sendMessage) {
      chromeAny.runtime.sendMessage({ action: 'alts_get_chrome_tabs' }, (response: any) => {
        if (response?.success && typeof response.currentWindowId === 'number') {
          setCurrentWindowId(response.currentWindowId);
        }
      });
    }
  }, [isOpen, chromeAny]);

  // Fetch all tabs
  const fetchTabs = useCallback(() => {
    if (!chromeAny?.tabs?.query) {
      if (chromeAny?.runtime?.sendMessage) {
        chromeAny.runtime.sendMessage({ action: 'alts_get_chrome_tabs' }, (response: any) => {
          if (!response?.success || !Array.isArray(response.tabs)) {
            setTabsByWindow({});
            setHasFetchedTabs(true);
            return;
          }

          const tabs = response.tabs.filter(
            (t: any) =>
              t.url &&
              !t.url.startsWith('chrome-extension://') &&
              !t.url.startsWith('chrome://') &&
              t.url !== 'about:blank',
          );

          const grouped = (tabs.reduce((acc: Record<number, BrowserTab[]>, tab: any) => {
            const windowId = tab.windowId ?? -1;
            if (!acc[windowId]) acc[windowId] = [];
            acc[windowId].push({
              id: tab.id,
              url: tab.url,
              title: tab.title || tab.url,
              favIconUrl: tab.favIconUrl,
              windowId: tab.windowId,
              active: tab.active,
              highlighted: tab.highlighted,
              index: tab.index,
            });
            return acc;
          }, {} as Record<number, BrowserTab[]>)) as Record<number, BrowserTab[]>;

          Object.keys(grouped).forEach((windowId) => {
            grouped[Number(windowId)].sort((a, b) => {
              if (a.active && !b.active) return -1;
              if (!a.active && b.active) return 1;
              return Number(a.index ?? 0) - Number(b.index ?? 0);
            });
          });

          setTabsByWindow(grouped);
          if (typeof response.currentWindowId === 'number') setCurrentWindowId(response.currentWindowId);
          setHasFetchedTabs(true);
        });
        return;
      }
      setTabsByWindow({});
      setHasFetchedTabs(true);
      return;
    }
    
    chromeAny.tabs.query({}, (fetchedTabs: any[]) => {
      if (chromeAny.runtime?.lastError || !fetchedTabs) {
        setTabsByWindow({});
        setHasFetchedTabs(true);
        return;
      }
      
      const tabs = fetchedTabs.filter(
        (t) => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://') && t.url !== 'about:blank'
      );
      
      const grouped = tabs.reduce<Record<number, BrowserTab[]>>((acc, tab) => {
        const windowId = tab.windowId ?? -1;
        if (!acc[windowId]) acc[windowId] = [];
        acc[windowId].push({
          id: tab.id,
          url: tab.url,
          title: tab.title || tab.url,
          favIconUrl: tab.favIconUrl,
          windowId: tab.windowId,
          active: tab.active,
          highlighted: tab.highlighted,
          index: tab.index,
        });
        return acc;
      }, {});

      Object.keys(grouped).forEach((windowId) => {
        grouped[Number(windowId)].sort((a, b) => {
          if (a.active && !b.active) return -1;
          if (!a.active && b.active) return 1;
          return Number(a.index ?? 0) - Number(b.index ?? 0);
        });
      });

      setTabsByWindow(grouped);
      setHasFetchedTabs(true);
    });
  }, [chromeAny]);

  useEffect(() => {
    if (isOpen) {
      fetchTabs();

      const handleTabChange = () => {
        fetchTabs();
      };

      if (chromeAny?.tabs) {
        if (chromeAny.tabs.onCreated) chromeAny.tabs.onCreated.addListener(handleTabChange);
        if (chromeAny.tabs.onUpdated) chromeAny.tabs.onUpdated.addListener(handleTabChange);
        if (chromeAny.tabs.onRemoved) chromeAny.tabs.onRemoved.addListener(handleTabChange);
        if (chromeAny.tabs.onActivated) chromeAny.tabs.onActivated.addListener(handleTabChange);
        if (chromeAny.tabs.onAttached) chromeAny.tabs.onAttached.addListener(handleTabChange);
        if (chromeAny.tabs.onDetached) chromeAny.tabs.onDetached.addListener(handleTabChange);
      }

      return () => {
        if (chromeAny?.tabs) {
          if (chromeAny.tabs.onCreated) chromeAny.tabs.onCreated.removeListener(handleTabChange);
          if (chromeAny.tabs.onUpdated) chromeAny.tabs.onUpdated.removeListener(handleTabChange);
          if (chromeAny.tabs.onRemoved) chromeAny.tabs.onRemoved.removeListener(handleTabChange);
          if (chromeAny.tabs.onActivated) chromeAny.tabs.onActivated.removeListener(handleTabChange);
          if (chromeAny.tabs.onAttached) chromeAny.tabs.onAttached.removeListener(handleTabChange);
          if (chromeAny.tabs.onDetached) chromeAny.tabs.onDetached.removeListener(handleTabChange);
        }
      };
    } else {
      setTabsByWindow({});
      setHasFetchedTabs(false);
      setCurrentWindowId(null);
      setCollapsedWindows({});
      return undefined;
    }
  }, [isOpen, fetchTabs, chromeAny]);

  const sortedWindowEntries = useMemo(
    () => Object.entries(tabsByWindow).sort((a, b) => Number(a[0]) - Number(b[0])),
    [tabsByWindow]
  );

  const allTabs = useMemo(() => {
    return sortedWindowEntries.flatMap(([, tabs]) => tabs);
  }, [sortedWindowEntries]);

  return {
    tabsByWindow,
    allTabs,
    currentWindowId,
    collapsedWindows,
    setCollapsedWindows,
    hasFetchedTabs,
    fetchTabs,
  };
}
