import { createRoot } from 'react-dom/client';
import './index.css';
import '@extension/ui/lib/global.css';
import AltS_search_newtab from './NewTab';
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { queryClient } from './query/queryClient';
import { migrateLocalStorageToChromeStorage } from '@extension/shared/lib/utils';
import { useEffect, Suspense } from 'react';
import { AppearanceProvider } from '@extension/ui';
import { reduxStore } from './redux/store';

function AppBootstrapper() {
  useEffect(() => {
    // Run migration in background on mount
    migrateLocalStorageToChromeStorage().catch(err => console.error('[Migration] Background error:', err));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<></>}>
        <Provider store={reduxStore}>
          <AppearanceProvider>
            <AltS_search_newtab />
          </AppearanceProvider>
        </Provider>
      </Suspense>
    </QueryClientProvider>
  );
}

function init() {
  const appContainer = document.querySelector('#app-container');
  if (!appContainer) {
    throw new Error('Can not find #app-container');
  }
  const root = createRoot(appContainer);

  root.render(<AppBootstrapper />);
}

init();
