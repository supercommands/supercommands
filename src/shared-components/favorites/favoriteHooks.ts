import { useMemo } from 'react';
import { useDbStore } from '../../storage/store/useDbStore';
import { AI_GROUP, findCommandByAnyId, resolveCommandLookupKey } from '../commands';
import {
  toggleFavoriteRecord,
  removeFavoriteRecord,
  addFavoriteRecord,
  updateFavoriteRecordCategory,
} from './favoriteData';
import { extractSnippetIdFromCompoundId } from '../hotkeys/utils/hotkeyUtils';

import { useState, useEffect } from 'react';

const extractSessionFavoriteId = (referenceId: string): string => {
  const normalized = String(referenceId || '');
  const sessionMatch = normalized.match(/session_[0-9a-f-]+$/i);
  if (sessionMatch?.[0]) return sessionMatch[0];
  return extractSnippetIdFromCompoundId(normalized);
};

export const useUser = () => {
  const [userId, setUserId] = useState<string>('local_user');
  useEffect(() => {
    let handleStorageChange: ((changes: Record<string, any>, areaName: string) => void) | null = null;
    try {
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.get(['accessToken'], (result: any) => {
          const stored = result?.accessToken;
          if (stored && typeof stored === 'string' && stored.startsWith('user_')) {
            setUserId(stored);
          } else {
            setUserId('local_user');
          }
        });

        // Also listen for changes to accessToken to dynamically update the active user
        handleStorageChange = (changes: Record<string, any>, areaName: string) => {
          if (areaName === 'local' && changes.accessToken) {
            const newVal = changes.accessToken.newValue;
            if (newVal && typeof newVal === 'string' && newVal.startsWith('user_')) {
              setUserId(newVal);
            } else {
              setUserId('local_user');
            }
          }
        };
        chromeAny.storage.onChanged.addListener(handleStorageChange);
      }
    } catch {
      setUserId('local_user');
    }

    return () => {
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.storage?.onChanged && handleStorageChange) {
        chromeAny.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, []);
  return userId;
};

export const useFavorites = () => {
  const favorites = useDbStore((state) => state.favorites);
  const notes = useDbStore((state) => state.notes);
  const links = useDbStore((state) => state.links);

  const snippets = useDbStore((state) => state.snippets);
  const sessions = useDbStore((state) => state.sessions);
  const commands = useDbStore((state) => state.commands);
  const chatAgents = useDbStore((state) => state.chatAgents);
  const aiPrompts = useDbStore((state) => state.aiPrompts);
  const automations = useDbStore((state) => state.automations);
  const todos = useDbStore((state) => state.todos);
  const userId = useUser();

  const userFavorites = useMemo(() => {
    return favorites.filter((fav) => fav.user_id === userId);
  }, [favorites, userId]);

  const hotkeysMap = useDbStore((state) => state.hotkeysMap);
  const shortcutsMap = useDbStore((state) => state.shortcutsMap);

  const populatedFavorites = useMemo(() => {
    const seenReferenceIds = new Set<string>();
    return userFavorites.map(fav => {
      let fullObj: any = {
        favourite_id: fav.favourite_id,
        label: fav.label,
        favoriteCategoryId: fav.favoriteCategoryId ?? null,
        reference_id: fav.reference_id,
      };
      let found: any = undefined;
      let resolvedType = fav.reference_type;
      const rawId =
        fav.reference_type === 'session'
          ? extractSessionFavoriteId(fav.reference_id)
          : extractSnippetIdFromCompoundId(fav.reference_id);

      if (fav.reference_type === 'session') {
        found = sessions.find(s => s.id === fav.reference_id || s.id === rawId);
      } else if (fav.reference_type === 'chat_agent' || fav.reference_type === 'agent') {
        found = chatAgents.find(a => a.id === fav.reference_id || a.id === rawId);
        resolvedType = 'chat_agent';
      } else if (fav.reference_type === 'aiPrompt' || fav.reference_type === 'prompt') {
        found = aiPrompts.find(p => p.id === fav.reference_id || p.id === rawId);
        resolvedType = 'aiPrompt';
      } else if (fav.reference_type === 'automation') {
        found = automations.find(au => au.id === fav.reference_id || au.id === rawId);
      } else if (fav.reference_type === 'todo') {
        found = todos.find(t => t.id === fav.reference_id || t.id === rawId);
        if (!found) {
          found = snippets.find(s => s.id === fav.reference_id || s.id === rawId);
        }
        resolvedType = 'todo';
      } else if (fav.reference_type === 'note') {
        found = notes.find(n => n.id === fav.reference_id || n.id === rawId);
        if (!found) {
          // Fallback search in snippets and links
          found = snippets.find(s => s.id === fav.reference_id || s.id === rawId);
          if (found) resolvedType = 'snippet';
          else {
            found = links.find(l => l.id === fav.reference_id || l.id === rawId);
            if (found) resolvedType = 'link';
          }
        }
      } else if (fav.reference_type === 'link') {
        found = links.find(l => l.id === fav.reference_id || l.id === rawId);
        if (!found) {
          // Fallback search in snippets and notes
          found = snippets.find(s => s.id === fav.reference_id || s.id === rawId);
          if (found) resolvedType = 'snippet';
          else {
            found = notes.find(n => n.id === fav.reference_id || n.id === rawId);
            if (found) resolvedType = 'note';
          }
        }
      } else if (fav.reference_type === 'snippet') {
        found = snippets.find(s => s.id === fav.reference_id || s.id === rawId);
        if (!found) {
          // Fallback search in notes and links
          found = notes.find(n => n.id === fav.reference_id || n.id === rawId);
          if (found) resolvedType = 'note';
          else {
            found = links.find(l => l.id === fav.reference_id || l.id === rawId);
            if (found) resolvedType = 'link';
          }
        }
      }

      if (found) {
        fullObj = {
          ...found,
          ...fullObj,
          type: resolvedType,
          category:
            resolvedType === 'session'
              ? 'session'
              : (found as any).category || resolvedType,
        };
      } else if (fav.reference_type === 'command') {
        const cmd = findCommandByAnyId(commands, fav.reference_id) || (fav.reference_id === 'ai' ? AI_GROUP : null);
        fullObj = { ...cmd, ...fullObj, type: 'command' };
      }

      // Determine compoundId for the favorite item
      const itemFolderId = fullObj.folderId || fullObj.folder_id || null;
      const itemWorkspaceId = fullObj.workspaceId || fullObj.workspace_id || null;
      const compoundCategory = fullObj.category || fullObj.type || 'snippet';
      const itemRawId = fullObj.id || fullObj.snippet_id || fav.reference_id;
      const compoundId = `${itemWorkspaceId ? itemWorkspaceId + '_' : ''}${itemFolderId ? itemFolderId + '_' : ''}${compoundCategory}_${itemRawId}`;

      const commandLookupKey =
        fullObj.type === 'command'
          ? resolveCommandLookupKey(fullObj as any, [hotkeysMap, shortcutsMap])
          : compoundId;

      return {
        ...fullObj,
        compoundId: commandLookupKey,
        hotkey: hotkeysMap[commandLookupKey] || hotkeysMap[compoundId] || '',
        shortcut: shortcutsMap[commandLookupKey] || shortcutsMap[compoundId] || '',
      };
    }).filter(f => {
      const hasId = !!f.id;
      if (!hasId) return false;
      const refId = f.id || f.reference_id;
      if (seenReferenceIds.has(refId)) {
        return false;
      }
      seenReferenceIds.add(refId);
      return true;
    });
  }, [userFavorites, notes, links, snippets, sessions, commands, chatAgents, aiPrompts, automations, todos, hotkeysMap, shortcutsMap]);

  const isFavorite = (referenceId: string) => {
    const rawId = extractSessionFavoriteId(referenceId);
    return userFavorites.some(
      (fav) =>
        fav.reference_id === referenceId ||
        fav.reference_id === rawId ||
        extractSessionFavoriteId(fav.reference_id) === rawId
    );
  };

  const getFavoriteRecord = (referenceId: string) => {
    const rawId = extractSessionFavoriteId(referenceId);
    return userFavorites.find(
      fav =>
        fav.reference_id === referenceId ||
        fav.reference_id === rawId ||
        extractSessionFavoriteId(fav.reference_id) === rawId,
    ) || null;
  };

  const addFavorite = async (referenceId: string, referenceType: string, label?: string, favoriteCategoryId?: string | null) => {
    if (!userId) return;
    const rawId =
      referenceType === 'session'
        ? extractSessionFavoriteId(referenceId)
        : extractSnippetIdFromCompoundId(referenceId);
    await addFavoriteRecord(userId, rawId, referenceType, label, favoriteCategoryId);
  };

  const toggleFavorite = async (referenceId: string, referenceType: string, label?: string, favoriteCategoryId?: string | null) => {
    if (!userId) return;
    const rawId =
      referenceType === 'session'
        ? extractSessionFavoriteId(referenceId)
        : extractSnippetIdFromCompoundId(referenceId);
    await toggleFavoriteRecord(userId, rawId, referenceType, label, favoriteCategoryId);
  };

  const removeFavorite = async (referenceId: string) => {
    const rawId = extractSessionFavoriteId(referenceId);
    return removeFavoriteRecord(userId, rawId);
  };

  const setFavoriteCategory = async (referenceId: string, favoriteCategoryId: string | null) => {
    if (!userId) return null;
    const rawId = extractSnippetIdFromCompoundId(referenceId);
    return updateFavoriteRecordCategory(userId, rawId, favoriteCategoryId);
  };

  return {
    favorites: userFavorites,
    populatedFavorites,
    isFavorite,
    getFavoriteRecord,
    addFavorite,
    toggleFavorite,
    removeFavorite,
    setFavoriteCategory,
  };
};
