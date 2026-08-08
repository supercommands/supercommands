# Extracted Components Documentation

This file exists as a central reference for how to re-integrate and render isolated components that have been extracted from our main views but are currently **not rendered** in the UI by design. As we continue to refactor and modularize, we will add more components here.

We extracted this component to strictly handle the rendering of "All AI" shortcuts and default quick commands, isolating it from the heavy logic of `HomeView.tsx`. Currently, it is **not rendered** in `HomeView.tsx` by design. 

## How to Render `HomeView` Again in `Container.tsx`

`HomeView` is currently not rendered from the idle/default home branches in `Container.tsx`. Those branches now render `RightDraggableRegion` so the right-side idle area can be controlled separately without touching BoardView, SheetView, Searchbar, editors, popups, or modals.

If you want to restore `HomeView`, update the two idle home branches in:

```text
src/pages/AltS_search_newtab/src/components/Container.tsx
```

### 1. Restore the Import

Change the type-only import back to a value import:

```tsx
import HomeView, { type HomeViewHandle } from '../landingPage/views/HomeView';
```

### 2. Replace `RightDraggableRegion`

There are two idle/default branches that currently render:

```tsx
<RightDraggableRegion />
```

Restore both branches with the code below.

### 3. Restore the `displayHomeView` Branch

Find the `// Priority 4: Home View` branch in `renderMainContent()` and replace `<RightDraggableRegion />` with:

```tsx
<HomeView
  onRequestOpenUrls={handleRequestOpenUrls}
  ref={homeViewRef}
  onExecuteFavorite={(fav: any, e?: any) => boardViewRef.current?.executeFavorite(fav, e)}
  onQuickCommandSelect={commandId => {
    const localDef = findCommandByAnyId(commands, commandId);
    if (localDef && localDef.surface !== 'website') {
      if (localDef?.behavior === 'instant') {
        handleCommandExecute(commandId as any);
        return;
      }
    }
    if (commandId === 'saved-automation') {
      onOpenSpreadsheetMainContainer?.('saved-automation');
      return;
    }
    if (commandId === 'todo') {
      useUIStore.getState().setSidebar('todoSidebar', { open: true });
      return;
    }
    if (commandId === 'collections') {
      onOpenSpreadsheetMainContainer?.('collections');
      return;
    }
    searchbarRef.current?.lockCommand(commandId);
    searchbarRef.current?.focus();
  }}
  onSnippetSelect={handleHomeSnippetSelect as any}
  onRequestSnippetDelete={handleHomeDeleteRequest as any}
  onRequestLinkEdit={handleHomeLinkEdit as any}
  onHighlightChange={handleInteractiveItemHighlight}
  onRequestFocusSearch={handleRequestFocusSearch}
  onCommandPreview={cmd => searchbarRef.current?.previewCommand(cmd as any)}
  isCommandLocked={!!suggestionState?.lockedCommand}
  isSuggestionVisible={suggestionState?.isVisible}
  inlineNotification={inlineNotification}
  onNavigateToListView={onNavigateToListView}
  isLoggedIn={isLoggedIn}
  onOpenContextMenu={(x, y, fav) => boardViewRef.current?.openContextMenu?.(x, y, fav)}
/>
```

This branch uses `findCommandByAnyId`, so restore this import too if it was removed:

```tsx
import { findCommandByAnyId, isLocalCommandId } from '../../../../shared-components/commands';
```

### 4. Restore the Final Default/Welcome Branch

Near the end of `renderMainContent()`, replace the final fallback `<RightDraggableRegion />` with:

```tsx
<HomeView
  ref={homeViewRef}
  onExecuteFavorite={(fav: any, e?: any) => boardViewRef.current?.executeFavorite(fav, e)}
  onQuickCommandSelect={commandId => {
    if (commandId === 'todo') {
      useUIStore.getState().setSidebar('todoSidebar', { open: true });
      return;
    }
    if (commandId === 'collections') {
      onOpenSpreadsheetMainContainer?.('collections');
      return;
    }
    if (commandId === 'saved-automation') {
      onOpenSpreadsheetMainContainer?.('saved-automation');
      return;
    }
    searchbarRef.current?.lockCommand(commandId);
    searchbarRef.current?.focus();
  }}
  onSnippetSelect={handleHomeSnippetSelect as any}
  onRequestSnippetDelete={handleHomeDeleteRequest as any}
  onRequestLinkEdit={handleHomeLinkEdit as any}
  onHighlightChange={handleInteractiveItemHighlight}
  onRequestFocusSearch={handleRequestFocusSearch}
  onCommandPreview={cmd => searchbarRef.current?.previewCommand(cmd as any)}
  isCommandLocked={!!suggestionState?.lockedCommand}
  isAtMenuOpen={suggestionState?.isAtMenuOpen}
  isSuggestionVisible={suggestionState?.isVisible}
  onNavigateToListView={onNavigateToListView}
  isLoggedIn={isLoggedIn}
  onOpenContextMenu={(x, y, fav) => boardViewRef.current?.openContextMenu?.(x, y, fav)}
/>
```

### Notes

- Keep the hidden `BoardView` block in place unless you also verify all `boardViewRef` usages.
- Restore both `HomeView` branches together so default home behavior stays consistent.
- Do not wrap `BoardView`, `SpreadsheetMainContainer`, Searchbar, or editors with the draggable region.
- After restoring `HomeView`, verify search focus, BoardView/search suggestions, SheetView, notes, links, prompts, todo, AI, and settings flows.

---

## How to Render `DefaultCommandsList`

If you want to render this component again inside `HomeView.tsx` or any other view that inherits `DefaultContainer`, you must follow these steps:

### 1. Import the Component
First, ensure you import the component at the top of your file:
```tsx
import DefaultCommandsList from './DefaultCommandsList';
```

### 2. Render the Component
Place the component inside your view's JSX structure. It requires the exact same props that are typically passed down from `useUIStore` or `useDbStore` in `HomeView.tsx`. 

Here is the exact code block you can copy and paste:

```tsx
<DefaultCommandsList
  ref={ref}
  favoriteIdSet={favoriteIdSet}
  userCommandsMap={userCommandsMap}
  todoCounts={todoCounts}
  onQuickCommandSelect={onQuickCommandSelect}
  onCommandPreview={onCommandPreview}
  onSnippetSelect={handleSnippetOpen}
  onRequestSnippetDelete={onRequestSnippetDelete}
  onRequestFocusSearch={onRequestFocusSearch}
  onHighlightChange={handleHighlightChange}
  actionsButtonLabel={getDynamicActionLabel()}
  onToggleFavorite={toggleFavoriteForItem}
  onRequestEditLink={onRequestLinkEdit}
  selectedAIs={selectedAIs}
  onToggleAI={handleToggleAI}
  inlineNotification={inlineNotification}
  isCommandLocked={isCommandLocked}
  isAtMenuOpen={isAtMenuOpen}
  isSuggestionVisible={isSuggestionVisible}
  onNavigateToListView={onNavigateToListView}
  isLoggedIn={isLoggedIn}
  status={commandStatus}
  onRequestOpenUrls={handleOpenUrls}
  folderInfo={
    selectedFolderRecord
      ? {
        name: selectedFolderRecord.folderName,
        notesCount: teamSnippets.filter(
          (s: any) =>
            s.snippet.category !== 'link' &&
            s.snippet.category !== 'session',
        ).length,
        linksCount: teamSnippets.filter(
          (s: any) =>
            s.snippet.category === 'link' ||
            s.snippet.category === 'session',
        ).length,
      }
      : null
  }
/>
```

### Notes
- The `todoCounts` property is optional, but if provided, it enables dynamic badging for tasks.
- `teamSnippets` must be fetched using `useHomeSnippets()` if you plan to populate `folderInfo` stats. 
- Ensure that `useFavorites()` is used in the parent component to populate `favoriteIdSet` and pass `toggleFavoriteForItem`, otherwise the user will not be able to star/unstar commands.

---

## How to Render `FavoritesGrid`

If you want to render the Favorites Grid again inside `HomeView.tsx` or any other view, follow these steps:

### 1. Import the Component
First, ensure you import the component at the top of your file:
```tsx
import { FavoritesGrid } from './FavoritesGrid';
```

### 2. Render the Component
Place the component inside your view's JSX structure. It requires the parent to pass down state flags like `isCarRace` and context menu callbacks.

Here is the exact code block you can copy and paste:

```tsx
<FavoritesGrid 
  isCarRace={isCarRace} 
  onOpenContextMenu={onOpenContextMenu} 
  onExecuteFavorite={onExecuteFavorite} 
/>
```

### Notes
- The `FavoritesGrid` component internally uses `useFavorites()` to manage drag-and-drop state, category folders, and actual favorite items. 
- You do NOT need to pass the `favorites` list as a prop; it connects to the store internally.
- If you render this inside `HomeView.tsx`, ensure you place it cleanly under the main container or inline where appropriate, as it occupies full width by default.

---

## How to Render `AppTodoSidebar`

If you want to render the right-side To-Do List drawer again, follow these steps:

### 1. Import the Component
First, ensure you import the component at the top of your global layout file (typically `App.tsx`):
```tsx
import { AppTodoSidebar } from './AppTodoSidebar';
```

### 2. Render the Component
Place the component near the end of your layout's JSX structure (so it overlays properly) wrapped in the necessary visibility conditions.

Here is the exact code block you can copy and paste:

```tsx
{!showTutorial &&
  activeView?.type === 'home' &&
  !activeLockedCommand &&
  !isSpreadsheetViewOpen &&
  !isBoardViewOpen &&
  !activeEditor &&
  !todoCreatePrefill && (
    <AppTodoSidebar
      isEmbedded={isEmbedded}
      isSpreadsheetViewOpen={isSpreadsheetViewOpen}
      isBoardViewOpen={isBoardViewOpen}
      isActuallyExpanded={isActuallyExpanded && !showTodosView}
      isLoggedIn={isLoggedIn}
    />
)}
```

### Notes
- `AppTodoSidebar` is a globally positioned component. It was previously rendered in `App.tsx` rather than `HomeView.tsx` because it requires a high-level z-index and slides in from the right edge of the entire screen.
- You must ensure the environment flags (`isEmbedded`, `isSpreadsheetViewOpen`, etc.) are actively managed in the parent state so it doesn't collide with other full-screen editors.
