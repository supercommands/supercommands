import { configureStore } from '@reduxjs/toolkit';
// Minimal compatibility store for legacy react-redux hooks.
// The app state now comes from UI stores and Dexie, but a Provider is still
// required for components that keep using useDispatch().
export const reduxStore = configureStore({
    reducer: (state = {}) => state,
});
export type ReduxRootState = ReturnType<typeof reduxStore.getState>;
export type ReduxAppDispatch = typeof reduxStore.dispatch;
