'use client';
import * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  FaChevronRight,
  FaMoon,
  FaCheck,
  FaUsers,
  FaClock,
  FaRocket,
  FaChevronLeft,
  FaLink,
  FaTrash,
  FaExpand,
  FaCompress,
  FaShieldHalved,
} from 'react-icons/fa6';
import { FaTimes, FaPlus, FaChevronDown, FaArrowRight, FaPlusSquare, FaGithub } from 'react-icons/fa';
import { useDispatch } from 'react-redux';

import { FeaturePresentationCard } from './featurePresentationCard';
import { DashboardViewsOnboarding } from './DashboardViewsOnboarding';
import type { OnboardingDashboardViewsLayout } from './layout/onboardingLayoutSchema';
import { useOnboardingDashboardViewsLayout, useOnboardingThemeLayout } from './layout/useOnboardingLayout';
import {
  ONBOARDING_ROLE_TEMPLATES,
  getRoleTemplates,
  getRecommendedRoleTemplates,
  generateLinkItems,
  type SupportedOnboardingRoleId,
  type OnboardingWidgetKind,
  type OnboardingNoteObjectTemplate,
  type DashboardViewGroup,
} from './DashboardviewTemplates';
import { saveShortcut } from '../shared-components/shortcuts/core/shortcutManager';
import {
  normalizeShortcutTrigger,
  getShortcutTriggerFormatError,
  getReservedShortcutReason,
} from '../shared-components/shortcuts/core/shortcutDbData';
import {
  loadWidgetDashboardStateAsync,
  WIDGET_DASHBOARD_STORAGE_EVENT,
} from '../storage/localStorage/widgetDashboardStorage';
import { db } from '../storage/indexDB/dbConfig';
import { normalizeCollectionLaunchSettings } from '../allObjectFolder/src/createObject/widgets/widgetTypes';
import { createNote } from '../allObjectFolder/src/createObject/notes/noteData';
import { createSession } from '../allObjectFolder/src/createObject/session/sessionData';
import { DEFAULT_SESSION_SETTINGS } from '../allObjectFolder/src/createObject/session/sessionSettings';
import { createLink } from '../allObjectFolder/src/createObject/links/linkData';
import { createAiPrompt } from '../allObjectFolder/src/createObject/aiPrompt/aiPromptData';
import { createTodo } from '../allObjectFolder/src/createObject/todos/todoData';

import { createWidgetInWorkspace } from '../allObjectFolder/src/createObject/widgets/widgetData';
import { ensureDashboardViewsInGroup } from '../storage/localStorage/widgetDashboardGroupStorage';
import { useAppearance, THEME_FAMILIES } from '@extension/ui';
import { useDbStore } from '../storage/store/useDbStore';
import { generateEntityId } from '../shared-components/utils/idGenerator';
import { createWorkspace } from '../settings/allWorkspaceManager/workspaces/workspaceData';
import {
  FiLoader,
  FiCloud,
  FiUpload,
  FiDatabase,
  FiFolder,
  FiHardDrive,
  FiRefreshCw,
  FiInfo,
  FiLock,
  FiCode,
  FiArrowUpRight,
} from 'react-icons/fi';
import { StorageManager } from '../storage/localStorage/storageManager';
import { getDriveToken, listBackupsFromDrive, downloadBackupFromDrive } from '../settings/backup/logic/driveApi';
import { restoreDatabaseFromJSON } from '../settings/backup/logic/restoreData';
import { readBackupArchive } from '../settings/backup/logic/backupArchive';
import { formatBackupPayloadSize } from '../settings/backup/logic/extractData';
import { markOnboardingCoreSetupCompleted } from '../storage/localStorage/onboardingStorage';

const computeBackupSummary = (backupData: any) => ({
  organizationCount: 0,
  workspaceCount: backupData?.manifest?.tableCounts?.workspaces || 0,
  snippetCount: backupData?.manifest?.tableCounts?.snippets || 0,
  todoCount: backupData?.manifest?.tableCounts?.todos || 0,
  favoritesCount: backupData?.manifest?.tableCounts?.favorites || 0,
});

import clsx from 'clsx';
import { getFaviconUrl } from '../shared-components/searchBarMain/utilityFunctions/utils';
import type { CommandDefinition } from '../shared-components/searchBarMain/commandConfigurations/commands';
import { COMMANDS, AI_GROUP } from '../shared-components/searchBarMain/commandConfigurations/commands';

import { saveHotkey as apiSaveHotkey } from '../shared-components/hotkeys';
import { normalizeHotkeyString } from '../shared-components/hotkeys/core/eventParser';

import { getUserId, checkHasCloudData } from '../storage/API/core/api';
import { useHotkeyValidation } from '../shared-components/hotkeys';
import { SpreadsheetMultiLinkInput } from '../shared-components/spreadsheetUi/ui/spreadsheetMultiLinkInput';
import { FEATURE_FLAGS } from '../pages/AltS_search_newtab/src/utils/featureFlags';
import { useUIStore } from '../shared-components/uiStateManager';

// ==========================================
// 1. Algorithms (from onboardingAlgos.ts)
// ==========================================

export interface LinkItem {
  id: string;
  title: string;
  url: string;
}

export const cleanDomain = (url: string) => {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};

const isValidLink = (url: string) => {
  if (!url) return false;
  if (url.startsWith('chrome-extension://') || url.startsWith('chrome://') || url.startsWith('about:')) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const isGoogle = host === 'google.com' || host.includes('.google.');
    const isSearch = u.pathname.includes('/search') && u.searchParams.has('q');
    if (isGoogle && isSearch) return false;
    return true;
  } catch {
    return false;
  }
};

export async function getMostUsedLinks(count: number = 6): Promise<LinkItem[]> {
  return new Promise(resolve => {
    if (typeof chrome === 'undefined' || !chrome.history || !chrome.topSites) {
      resolve([]);
      return;
    }
    chrome.topSites.get(topSites => {
      chrome.history.search({ text: '', maxResults: 100, startTime: 0 }, historyItems => {
        const pool = new Map<string, { title: string; url: string; score: number }>();
        (topSites || [])
          .filter(s => isValidLink(s.url))
          .forEach((s, idx) => {
            const domain = cleanDomain(s.url);
            if (!pool.has(domain)) {
              pool.set(domain, { title: s.title || domain, url: s.url, score: (20 - idx) * 10 });
            }
          });
        (historyItems || [])
          .filter(h => isValidLink(h.url || ''))
          .forEach(h => {
            if (!h.url) return;
            const domain = cleanDomain(h.url);
            const current = pool.get(domain);
            const visitScore = (h.visitCount || 0) * 5;
            if (current) {
              current.score += visitScore;
            } else {
              pool.set(domain, { title: h.title || domain, url: h.url, score: visitScore });
            }
          });
        const sorted = Array.from(pool.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, count)
          .map((item, idx) => ({
            id: `mu_${idx}`,
            title: item.title,
            url: item.url,
          }));
        resolve(sorted);
      });
    });
  });
}

export async function getTopBookmarksVisited(count: number = 5): Promise<LinkItem[]> {
  return new Promise(resolve => {
    if (typeof chrome === 'undefined' || !chrome.bookmarks || !chrome.history) {
      resolve([]);
      return;
    }
    chrome.bookmarks.getTree(tree => {
      const bookmarks: { title: string; url: string }[] = [];
      const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
        for (const node of nodes) {
          if (node.url && isValidLink(node.url)) bookmarks.push({ title: node.title, url: node.url });
          if (node.children) walk(node.children);
        }
      };
      walk(tree);
      chrome.history.search({ text: '', maxResults: 500, startTime: 0 }, historyItems => {
        const historyMap = new Map<string, number>();
        (historyItems || []).forEach(h => {
          if (h.url) historyMap.set(h.url, h.visitCount || 0);
        });
        const domainMap = new Map<string, { title: string; url: string; visitCount: number }>();
        bookmarks.forEach(b => {
          const domain = cleanDomain(b.url);
          const vc = historyMap.get(b.url) || 0;
          const existing = domainMap.get(domain);
          if (!existing || vc > existing.visitCount) {
            domainMap.set(domain, { title: b.title, url: b.url, visitCount: vc });
          }
        });
        const scoredBookmarks = Array.from(domainMap.values())
          .sort((a, b) => b.visitCount - a.visitCount)
          .slice(0, count)
          .map((b, idx) => ({
            id: `bm_${idx}`,
            title: b.title || cleanDomain(b.url),
            url: b.url,
          }));
        resolve(scoredBookmarks);
      });
    });
  });
}

export async function getRoutineDetection(count: number = 5): Promise<LinkItem[]> {
  return new Promise(resolve => {
    if (typeof chrome === 'undefined' || !chrome.history) {
      resolve([]);
      return;
    }
    const now = new Date();
    const currentHour = now.getHours();
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    chrome.history.search({ text: '', maxResults: 3000, startTime: twoWeeksAgo }, historyItems => {
      const frequencyMap = new Map<string, { title: string; url: string; count: number }>();
      (historyItems || [])
        .filter(item => isValidLink(item.url || ''))
        .forEach(item => {
          if (!item.url || !item.lastVisitTime) return;
          const visitDate = new Date(item.lastVisitTime);
          const visitHour = visitDate.getHours();
          const hourDiff = Math.abs(visitHour - currentHour);
          const isNear = hourDiff <= 1 || hourDiff >= 23;
          if (isNear) {
            const domain = cleanDomain(item.url);
            const existing = frequencyMap.get(domain);
            if (existing) {
              existing.count += 1;
            } else {
              frequencyMap.set(domain, {
                title: item.title || domain,
                url: item.url,
                count: 1,
              });
            }
          }
        });
      const sorted = Array.from(frequencyMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, count)
        .map((item, idx) => ({
          id: `routine_${idx}`,
          title: item.title,
          url: item.url,
        }));
      resolve(sorted);
    });
  });
}

// ==========================================
// 2. Recommendations (from moduleRecommendations.ts)
// ==========================================

const CATEGORY_WEIGHTS: Record<string, number> = {
  ai: 10,
  productivity: 8,
  communication: 7,
  linear: 7,
  slack: 7,
  default: 5,
};

export const computeModuleScore = (module: any): number => {
  const rawCategory = String(module.category || module.parent_name || 'default').toLowerCase();
  const categoryScore = CATEGORY_WEIGHTS[rawCategory] || CATEGORY_WEIGHTS.default;
  const steps = module.execution_steps || [];
  const executionScore = steps.length * 0.5;
  let capabilityBonus = 0;
  const variables = module.variables || [];
  const hasImages = variables.some(
    (v: any) => v.type === 'file' || v.type === 'image' || String(v.key).includes('image'),
  );
  const hasLongText = variables.some(
    (v: any) => v.type === 'text' || v.type === 'textarea' || String(v.key).includes('long_text'),
  );
  if (hasImages) capabilityBonus += 2;
  if (hasLongText) capabilityBonus += 1;
  if (module.paramConfigs) {
    if (JSON.stringify(module.paramConfigs).includes('image')) capabilityBonus += 2;
    if (JSON.stringify(module.paramConfigs).includes('textarea')) capabilityBonus += 1;
  }
  let featuredBonus = 0;
  if (module.is_featured || module.isFeatured) featuredBonus += 5;
  let aiBonus = 0;
  if (rawCategory === 'ai' || String(module.name).toLowerCase().includes('ai')) aiBonus += 2;
  const rawScore = categoryScore + executionScore + capabilityBonus + featuredBonus + aiBonus;
  const MAX_SCORE = 30;
  const normalizedScore = Math.min(rawScore / MAX_SCORE, 1.0);
  return Number(normalizedScore.toFixed(2));
};

export const getTopRecommendedModules = (modules: any[], limit: number = 5): any[] => {
  if (!modules || modules.length === 0) return [];
  const scored = modules.map(m => ({
    ...m,
    recommendationScore: computeModuleScore(m),
  }));
  scored.sort((a, b) => b.recommendationScore - a.recommendationScore);
  return scored.slice(0, limit);
};

export const getRecommendedCategories = (modules: any[], limit: number = 3, historyContext: string = ''): any[] => {
  if (!modules || modules.length === 0) return [];
  const ctx = historyContext.toLowerCase();
  const groups = new Map<string, any>();
  modules.forEach(module => {
    const rawCategory = String(module.category || module.parent_name || 'other');
    const key = rawCategory.toLowerCase();
    const name = String(module.name || module.module_key || '').toLowerCase();
    const isAIGlobal = key === 'ai' || name.includes('ai');
    let contextBoost = 0;
    if (ctx) {
      const h = String(module.iconHost || module.icon_host || module.parent_icon_host || '').toLowerCase();
      const domainParts = h
        .replace(/^https?:\/\//, '')
        .replace(/^(app\.|www\.|mail\.|dev\.)/, '')
        .split('.');
      const mainDomain = domainParts[0];
      if (name.length > 2 && ctx.includes(name)) contextBoost = 5;
      else if (mainDomain && mainDomain.length > 2 && ctx.includes(mainDomain)) contextBoost = 4;
      else if (key.length > 2 && ctx.includes(key) && key !== 'other' && key !== 'default') contextBoost = 3;
      else if (
        isAIGlobal &&
        (ctx.includes('chatgpt') || ctx.includes('openai') || ctx.includes('anthropic') || ctx.includes('claude'))
      ) {
        contextBoost = 5;
      }
    }
    const isFeatured = !!(module.is_featured || module.isFeatured);
    if (!contextBoost && !isFeatured) return;
    if (!groups.has(key)) {
      const iconHost = module.icon_host || module.parent_icon_host || module.iconHost || '';
      groups.set(key, {
        id: key,
        name: rawCategory,
        iconHost,
        modules: [],
        maxContextBoost: 0,
      });
    }
    const group = groups.get(key);
    const featuredBoost = isFeatured ? 2 : 0;
    const recommendationScore = computeModuleScore(module) + contextBoost + featuredBoost;
    group.modules.push({
      ...module,
      recommendationScore,
    });
    if (contextBoost > group.maxContextBoost) {
      group.maxContextBoost = contextBoost;
    }
  });
  const categories = Array.from(groups.values());
  categories.forEach(cat => {
    cat.modules.sort((a: any, b: any) => b.recommendationScore - a.recommendationScore);
  });
  categories.forEach(cat => {
    cat.score = cat.maxContextBoost * 100 + (cat.modules[0]?.recommendationScore || 0);
    cat.modules = cat.modules.slice(0, 4);
  });
  categories.sort((a, b) => b.score - a.score);
  return categories.slice(0, limit);
};

// ==========================================
// 3. Onboarding Template UI Components (from OnBoardTemplates.tsx)
// ==========================================

type LinkGroupItem = {
  id: string;
  name: string;
  description: string;
  hotkey: string;
  isAdded: boolean;
  links: LinkItem[];
};

export interface OnboardingManagerProps {
  onFinish?: () => void;
  isLoggedIn?: boolean;
  isDark?: boolean;
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Sora:wght@300;400;500;600;700&display=swap');
  
  .cmdos-onboarding-root {
    --ob-page-bg: #ffffff;
    --ob-surface: #ffffff;
    --ob-surface-soft: #f8fafc;
    --ob-text-primary: #0f172a;
    --ob-text-secondary: #475569;
    --ob-text-muted: #64748b;
    --ob-border: #e2e8f0;
    --ob-accent: #8b3dff;
    --ob-accent-hover: #7c3aed;
    --ob-accent-muted: rgba(139, 92, 246, 0.12);
    --ob-gradient-start: #8b3dff;
    --ob-gradient-end: #6366f1;

    /* Fixed overrides for all extension theme --color-* variables so onboarding never recolors */
    --color-backgroundGradient: #ffffff;
    --color-rootBg: #ffffff;
    --color-tutorialTextTitle: #0f172a;
    --color-tutorialTextDescription: #64748b;
    --color-tutorialTextGradientStart: #8b3dff;
    --color-tutorialTextGradientEnd: #6366f1;
    --color-tutorialAccent: #8b3dff;
    --color-tutorialAccentMuted: rgba(139, 92, 246, 0.12);
    --color-tutorialCardBg: #ffffff;
    --color-cardBg: #ffffff;
    --color-borderDefault: #e2e8f0;
    --color-borderActive: #8b3dff;
    --color-textPrimary: #0f172a;
    --color-textSecondary: #475569;
    --color-textMuted: #64748b;
    --color-textPlaceholder: #94a3b8;
    --color-inputBg: #f8fafc;
    --color-hoverBg: rgba(0, 0, 0, 0.04);
    --color-selectedBg: rgba(139, 92, 246, 0.08);
    --color-focusRing: rgba(139, 92, 246, 0.4);
    --color-widgetShadow: rgba(0, 0, 0, 0.06);
    --color-accent: #8b3dff;
    --color-danger: #ef4444;
    --color-success: #10b981;

    color-scheme: light;
  }

  .ob-onboarding-container {
    font-family: 'Sora', sans-serif;
    color: #1e293b;
    -webkit-font-smoothing: antialiased;
  }

  .ob-sheet-container {
    background: var(--color-cardBg, #ffffff);
    border: 1px solid var(--color-borderDefault, #e1e1e1);
    border-radius: 4px;
    box-shadow: 0 4px 12px var(--color-widgetShadow, rgba(0,0,0,0.05));
    overflow: hidden;
    width: 100%;
    margin-bottom: 20px;
  }

  .ob-sheet-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .ob-sheet-header th {
    position: sticky;
    top: 0;
    z-index: 30;
    background: #f8fafc;
    border-bottom: 1px solid #e1e1e1;
    border-right: 1px solid #f1f5f9;
    padding: 10px 14px;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    letter-spacing: 0.02em;
    box-shadow: 0 1px 0 #e1e1e1;
    outline: none !important;
    user-select: none;
  }

  .ob-sheet-header th:last-child {
    border-right: none;
  }

  .ob-sheet-header th.ob-header-cell {
    box-shadow: 0 1px 0 #e1e1e1 !important;
    background: #f8fafc !important;
  }

  .ob-sheet-row {
    border-bottom: 1px solid #f1f5f9;
    transition: background 0.15s ease;
  }

  .ob-sheet-row:hover {
    background: #f8fafc;
  }

  .ob-sheet-cell {
    padding: 0 14px;
    border-right: 1px solid #f1f5f9;
    font-size: 13px;
    color: #334155;
    position: relative;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    height: 48px;
    vertical-align: middle;
  }

  .ob-sheet-cell:last-child {
    border-right: none;
  }

  .ob-cell-selected {
    box-shadow: inset 0 0 0 2px #3b82f6 !important;
    background: #eff6ff !important;
    z-index: 10;
  }

  .ob-cell-editing {
    background: #ffffff !important;
    box-shadow: inset 0 0 0 2px #3b82f6, 0 4px 12px rgba(0,0,0,0.1) !important;
    z-index: 20;
    padding: 0 !important;
  }

  .ob-cell-editing input {
    width: 100%;
    height: 100%;
    border: none;
    outline: none;
    padding: 0 14px;
    font-family: inherit;
    font-size: 13px;
    background: transparent;
  }

  .ob-badge-prefix {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    background: #f1f5f9;
    color: #475569;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
  }

  .ob-add-btn {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    color: #3b82f6;
    font-size: 11px;
    font-weight: 700;
    padding: 5px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .ob-add-btn:hover:not(:disabled) {
    background: #eff6ff;
    border-color: #3b82f6;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.12);
  }

  .ob-add-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .ob-add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #f8fafc;
  }

  .ob-added-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #f0fdf4;
    color: #16a34a;
    font-size: 11px;
    font-weight: 800;
    padding: 5px 12px;
    border-radius: 6px;
    border: 1px solid #dcfce7;
    animation: fadeSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .ob-finish-btn {
    padding: 8px 24px;
    background: #16a34a;
    color: #ffffff;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
    box-shadow: 0 1px 2px rgba(22, 163, 74, 0.2);
  }

  .ob-finish-btn:hover:not(:disabled) {
    opacity: 0.9;
    transform: none;
  }

  .ob-finish-btn:disabled {
    opacity: 0.7;
    cursor: wait;
    background: #16a34a;
  }

  .ob-scroll-area {
    scrollbar-width: thin;
    scrollbar-color: #e2e8f0 transparent;
  }

  .ob-scroll-area::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .ob-scroll-area::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 10px;
  }

  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .onboarding-standard-content {
    width: clamp(560px, 46vw, 820px);
    max-width: calc(100vw - 40px);
    margin: auto;
  }

  .onboarding-body {
    min-height: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: clamp(24px, 4vh, 56px) 20px;
    width: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: #e2e8f0 transparent;
  }

  .onboarding-body::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .onboarding-body::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 10px;
  }

  .ob-fluid-h1 {
    font-size: clamp(20px, 1.35vw, 30px) !important;
    line-height: 1.2 !important;
  }

  .ob-fluid-hero-text {
    font-size: clamp(32px, 2.25vw, 48px) !important;
    line-height: 1.15 !important;
  }

  .ob-fluid-subtext {
    font-size: clamp(14px, 0.9vw, 18px) !important;
    line-height: 1.5 !important;
  }

  .ob-fluid-feature-text {
    font-size: clamp(14px, 0.85vw, 17px) !important;
    line-height: 1.4 !important;
  }

  .ob-fluid-feature-icon {
    width: clamp(16px, 1vw, 21px) !important;
    height: clamp(16px, 1vw, 21px) !important;
    font-size: clamp(16px, 1vw, 21px) !important;
    flex-shrink: 0 !important;
  }

  .ob-fluid-note-box {
    width: 100% !important;
    font-size: clamp(13px, 0.78vw, 16px) !important;
    padding: clamp(12px, 0.85vw, 17px) clamp(14px, 1.1vw, 22px) !important;
  }

  .ob-fluid-note-text {
    font-size: clamp(13px, 0.78vw, 16px) !important;
    line-height: 1.5 !important;
  }

  .ob-fluid-gap-container {
    gap: clamp(18px, 1.4vw, 30px);
  }

  .ob-fluid-feature-list {
    gap: clamp(12px, 0.8vw, 18px);
  }

  .ob-fluid-input-container {
    max-width: clamp(340px, 26vw, 480px) !important;
  }

  .ob-fluid-input {
    font-size: clamp(13px, 0.85vw, 16px) !important;
    padding-top: clamp(8px, 0.7vw, 14px) !important;
    padding-bottom: clamp(8px, 0.7vw, 14px) !important;
  }

  @media (max-width: 700px) {
    .onboarding-standard-content {
      width: calc(100vw - 32px);
    }
  }

  @media (max-height: 760px) {
    .ob-fluid-gap-container {
      gap: 14px !important;
    }

    .ob-fluid-feature-list {
      gap: 9px !important;
    }

    .ob-fluid-note-box {
      padding-top: 10px !important;
      padding-bottom: 10px !important;
    }
  }
`;

const ONBOARDING_COMMANDS: CommandDefinition[] = COMMANDS.filter(c =>
  ['ai', 'gpt', 'claude', 'gemini', 'perplexity', 'yt'].includes(c.id),
);

function useTypingPlaceholder(examples: string[], speed = 65, pause = 1600) {
  const [placeholder, setPlaceholder] = useState('');
  const state = useRef<{ idx: number; charIdx: number; deleting: boolean; timer: any }>({
    idx: 0,
    charIdx: 0,
    deleting: false,
    timer: null,
  });

  useEffect(() => {
    const tick = () => {
      const s = state.current;
      const word = examples[s.idx];
      if (!s.deleting) {
        s.charIdx++;
        setPlaceholder(word.slice(0, s.charIdx));
        if (s.charIdx === word.length) {
          s.deleting = true;
          s.timer = setTimeout(tick, pause);
          return;
        }
      } else {
        s.charIdx--;
        setPlaceholder(word.slice(0, s.charIdx));
        if (s.charIdx === 0) {
          s.deleting = false;
          s.idx = (s.idx + 1) % examples.length;
        }
      }
      s.timer = setTimeout(tick, s.deleting ? speed / 2 : speed);
    };
    state.current.timer = setTimeout(tick, speed);
    return () => {
      if (state.current.timer) clearTimeout(state.current.timer as any);
    };
  }, [examples, speed, pause]);

  return placeholder;
}

function FaviconImg({ host, size = 18 }: { host: string; size?: number }) {
  const faviconUrl = getFaviconUrl(host);
  const [errored, setErrored] = useState(false);
  if (!faviconUrl || errored) {
    return <FaLink style={{ width: size * 0.75, height: size * 0.75, color: '#94a3b8' }} />;
  }
  return (
    <img
      src={faviconUrl}
      alt=""
      width={size}
      height={size}
      onError={() => setErrored(true)}
      style={{
        width: size,
        height: size,
        borderRadius: 2,
        objectFit: 'contain',
        border: '1px solid #f1f5f9',
      }}
    />
  );
}

function StackedFavicons({ links }: { links: LinkItem[] }) {
  const shown = links.slice(0, 3);
  if (shown.length === 0) {
    return <FaLink style={{ width: 13, height: 13, color: '#94a3b8' }} />;
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((link, idx) => (
        <div
          key={link.id || idx}
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: '1px solid #ffffff',
            boxShadow: '0 0 0 1px #e2e8f0',
            overflow: 'hidden',
            flexShrink: 0,
            marginLeft: idx > 0 ? -6 : 0,
            background: '#ffffff',
            padding: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: shown.length - idx,
            position: 'relative',
          }}>
          <FaviconImg host={link.url} size={12} />
        </div>
      ))}
    </div>
  );
}

function AddedBadge() {
  return (
    <span
      className="ob-added-pill"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        color: 'rgba(255,255,255,.35)',
        fontSize: 12,
        fontFamily: "'Sora',sans-serif",
      }}>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'rgba(74,222,128,.12)',
          border: '1px solid rgba(74,222,128,.25)',
        }}>
        <FaCheck style={{ width: 10, height: 10, color: 'rgb(74,222,128)' }} />
      </span>
      Added
    </span>
  );
}

function renderUrlContent(url: string) {
  if (!url) return '';
  if (url.startsWith('{')) {
    try {
      const parsed = JSON.parse(url);
      if (parsed.urls && Array.isArray(parsed.urls)) {
        return parsed.urls.map((u: string) => cleanDomain(u)).join(', ');
      }
    } catch (e) {
      return cleanDomain(url);
    }
  }
  return cleanDomain(url);
}

function AddButton({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      className="ob-add-btn"
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        color: disabled ? 'rgba(255,255,255,.2)' : 'rgb(74,222,128)',
        border: `1px solid ${disabled ? 'rgba(255,255,255,.08)' : 'rgba(74,222,128,.2)'}`,
        borderRadius: 8,
        padding: '4px 10px',
        background: disabled ? 'transparent' : 'rgba(74,222,128,.04)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12,
        fontFamily: "'Sora',sans-serif",
        transition: 'all .2s',
      }}
      title={disabled ? 'Set a hotkey first to add this group' : ''}>
      <FaPlus style={{ width: 12, height: 12 }} /> Add
    </button>
  );
}

async function saveCommandsToStorage(toAdd: CommandDefinition[]): Promise<void> {
  const res = await StorageManager.getItem('alts_commands');
  const existing: CommandDefinition[] = Array.isArray(res) ? res : [];
  const existingIds = new Set(existing.map((c: CommandDefinition) => c.id));
  const merged = [...existing, ...toAdd.filter(c => !existingIds.has(c.id))];
  await StorageManager.setItem('alts_commands', merged);
}

async function saveCommandsToDraft(toAdd: CommandDefinition[]): Promise<void> {
  const res = await StorageManager.getItem('alts_commands_draft');
  const existing: CommandDefinition[] = Array.isArray(res) ? res : [];
  const existingIds = new Set(existing.map((c: CommandDefinition) => c.id));
  const merged = [...existing, ...toAdd.filter(c => !existingIds.has(c.id))];
  await StorageManager.setItem('alts_commands_draft', merged);
}

async function saveLinksDraft(
  linkGroups: LinkGroupItem[],
  singleLinks: LinkItem[],
  hotkeys: Record<string, string>,
): Promise<void> {
  const draftPayload = {
    linkGroups: linkGroups.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      hotkey: hotkeys[g.id] || '',
      links: g.links,
    })),
    singleLinks: singleLinks.map(l => ({
      ...l,
      hotkey: hotkeys[l.id] || '',
    })),
  };
  await StorageManager.setItem('Onboarded_links', draftPayload);
}

async function resolvePersonalTeamId(): Promise<any | null> {
  const localOrgs = await StorageManager.getItem('localOrganizations');
  if (!Array.isArray(localOrgs)) {
    console.warn('[OnBoardTemplates] localOrganizations not found or not an array');
    return null;
  }
  const personalTeam = localOrgs.find((team: any) => team.is_personal_space === true);
  if (personalTeam?.team_id) {
    return personalTeam;
  } else {
    console.warn('[OnBoardTemplates] No personal space team found');
    return null;
  }
}

async function createLinksDirectly(
  linkGroups: LinkGroupItem[],
  singleLinks: LinkItem[],
  hotkeys: Record<string, string>,
): Promise<string[]> {
  const createdIds: string[] = [];
  try {
    const teamObj = await resolvePersonalTeamId();
    if (!teamObj || !teamObj.team_id) {
      console.error('[OnBoardTemplates] Could not resolve personal team ID, skipping direct link creation');
      return [];
    }
    const teamId = teamObj.team_id;
    const storageMode = teamObj.storageMode ?? 'local';
    const wsResult = await createWorkspace('Your shortcuts');
    const workspaceId = wsResult.id;
    if (!workspaceId) {
      console.error('[OnBoardTemplates] Failed to get workspace ID from createNewWorkspace response');
      return [];
    }
    return []; // Snippet creation removed as per user request
  } catch (err) {
    console.error('[OnBoardTemplates] Failed to create smart links directly:', err);
  }
  return createdIds;
}

export function OnboardingManager({ onFinish, isLoggedIn, isDark = true }: OnboardingManagerProps) {
  const dispatch = useDispatch();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [addedCmds, setAddedCmds] = useState<Record<string, boolean>>({});
  const [addedGroups, setAddedGroups] = useState<Record<string, boolean>>({});
  const [addedSingles, setAddedSingles] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);
  const [linkGroups, setLinkGroups] = useState<LinkGroupItem[]>([]);
  const [singleLinks, setSingleLinks] = useState<LinkItem[]>([]);
  const [hotkeys, setHotkeys] = useState<Record<string, string>>({});
  const [capturingFor, setCapturingFor] = useState<string | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [recommendedCategories, setRecommendedCategories] = useState<any[]>([]);
  const [addedAutomations, setAddedAutomations] = useState<Record<string, boolean>>({});
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const { validateHotkey } = useHotkeyValidation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedCell, setSelectedCell] = useState<{ itemId: string; colIndex: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ itemId: string; colIndex: number } | null>(null);

  const flatRows = useMemo(() => {
    const rows: any[] = [];
    if (recommendedCategories.length > 0) {
      rows.push({ type: 'section', label: 'Automation Integrations', id: 'sec_automations' });
      recommendedCategories.forEach(cat => {
        const catId = `cat_${cat.id}`;
        rows.push({ type: 'automationCategory', id: catId, data: cat });
        if (expandedCategory === cat.id) {
          cat.modules.forEach((mod: any, idx: number) => {
            rows.push({
              type: 'automationModule',
              id: `mod_${mod.module_id || mod.module_key}`,
              data: mod,
              parentId: cat.id,
              index: idx,
            });
          });
        }
      });
    }
    rows.push({ type: 'section', label: 'Links Shortcuts', id: 'sec_links' });
    singleLinks.forEach(l => rows.push({ type: 'singleLink', id: `single_${l.id}`, data: l }));
    rows.push({ type: 'section', label: 'Smart Links', id: 'sec_collections' });
    linkGroups.forEach(g => {
      const groupId = `group_${g.id}`;
      rows.push({ type: 'group', id: groupId, data: g });
      if (expandedGroup === g.id) {
        g.links.forEach(l => rows.push({ type: 'subLink', id: `sub_${l.id}`, data: l, parentId: g.id }));
      }
    });
    rows.push({ type: 'section', label: 'Global Commands', id: 'sec_commands' });
    ONBOARDING_COMMANDS.forEach(cmd => rows.push({ type: 'command', id: `cmd_${cmd.id}`, data: cmd }));
    return rows;
  }, [singleLinks, linkGroups, expandedGroup, recommendedCategories, expandedCategory]);

  const columnCount = 4;

  const handleFinish = useCallback(async () => {
    setIsFinishing(true);
    try {
      const addedLinkGroups = linkGroups.filter(g => addedGroups[g.id]);
      const addedSingleLinks = singleLinks.filter(s => addedSingles[s.id]);
      const cmdsToInstall = ONBOARDING_COMMANDS.filter(c => addedCmds[c.id]);
      if (isLoggedIn) {
        if (cmdsToInstall.length > 0) {
          await saveCommandsToStorage(cmdsToInstall);
        }
        const snippetIds = await createLinksDirectly(addedLinkGroups, addedSingleLinks, hotkeys);
        try {
          const userId = await getUserId();
          if (userId && snippetIds.length > 0) {
          }
        } catch {
          // non-critical
        }
      } else {
        await saveLinksDraft(addedLinkGroups, singleLinks, hotkeys);
        if (cmdsToInstall.length > 0) await saveCommandsToDraft(cmdsToInstall);
      }
    } catch (err) {
      console.error('[OnBoardTemplates] Failed to finish setup:', err);
    } finally {
      setIsFinishing(false);
      useDbStore.getState().initDbSync();
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.set({ user_fav_sync_trigger: Date.now() });
      }
      setTimeout(() => {
        onFinish?.();
      }, 500);
    }
  }, [
    isLoggedIn,
    linkGroups,
    addedGroups,
    singleLinks,
    addedSingles,
    hotkeys,
    recommendedCategories,
    addedAutomations,
    addedCmds,
    onFinish,
    dispatch,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCell || capturingFor) return;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput && e.key !== 'Enter' && e.key !== 'Tab' && e.key !== 'Escape') {
        return;
      }
      const { itemId, colIndex } = selectedCell;
      const rowIndex = flatRows.findIndex(r => r.id === itemId);
      if (rowIndex === -1) return;
      const isEditing = editingCell !== null;
      const shouldSkipCell = (row: any, col: number) => {
        if (row.type === 'section') return true;
        if (row.type === 'automationCategory' && col === 2) return true;
        if (row.type === 'subLink' && (col === 2 || col === 3)) return true;
        if (row.type === 'automationModule' && col === 1) return false;
        return false;
      };
      if (e.key === 'Escape') {
        if (isEditing) {
          e.preventDefault();
          setEditingCell(null);
        }
        return;
      }
      if (isEditing && e.key !== 'Enter' && e.key !== 'Tab') return;
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (!isEditing) {
          if (colIndex === 3) {
            const row = flatRows[rowIndex];
            if (row.type === 'automationCategory') {
              const allAdded = row.data.modules.every((m: any) => addedAutomations[m.module_id]);
              setAddedAutomations(p => {
                const next = { ...p };
                row.data.modules.forEach((m: any) => (next[m.module_id] = !allAdded));
                return next;
              });
            } else if (row.type === 'automationModule') {
              setAddedAutomations(p => ({ ...p, [row.data.module_id]: !p[row.data.module_id] }));
            } else if (row.type === 'command') setAddedCmds(p => ({ ...p, [row.data.id]: !p[row.data.id] }));
            else if (row.type === 'group') setAddedGroups(p => ({ ...p, [row.data.id]: !p[row.data.id] }));
            else if (row.type === 'singleLink') setAddedSingles(p => ({ ...p, [row.data.id]: !p[row.data.id] }));
            return;
          }
          if (colIndex === 2) {
            const row = flatRows[rowIndex];
            if (row.type !== 'section' && row.type !== 'automationCategory') {
              setCapturingFor(row.data.id);
              return;
            }
          }
          if (!shouldSkipCell(flatRows[rowIndex], colIndex)) {
            setEditingCell(selectedCell);
          }
        } else {
          setEditingCell(null);
          let nRow = rowIndex + 1;
          while (nRow < flatRows.length && shouldSkipCell(flatRows[nRow], colIndex)) {
            nRow++;
          }
          if (nRow < flatRows.length) {
            setSelectedCell({ itemId: flatRows[nRow].id, colIndex });
          }
        }
        return;
      }
      const moveFocus = (rInc: number, cInc: number) => {
        let nRow = rowIndex + rInc;
        let nCol = colIndex + cInc;
        if (nCol < 0) nCol = 0;
        if (nCol >= columnCount) nCol = columnCount - 1;
        if (rInc !== 0) {
          while (nRow >= 0 && nRow < flatRows.length && shouldSkipCell(flatRows[nRow], nCol)) {
            nRow += rInc;
          }
        }
        if (cInc !== 0) {
          while (nCol >= 0 && nCol < columnCount && shouldSkipCell(flatRows[nRow], nCol)) {
            nCol += cInc;
          }
          if (nCol < 0 || nCol >= columnCount) {
            nCol = colIndex;
          }
        }
        if (nRow >= 0 && nRow < flatRows.length) {
          setSelectedCell({ itemId: flatRows[nRow].id, colIndex: nCol });
        }
      };
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        moveFocus(-1, 0);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        moveFocus(1, 0);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        moveFocus(0, -1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        moveFocus(0, 1);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        if (isEditing) setEditingCell(null);
        let nRow = rowIndex;
        let nCol = colIndex + (e.shiftKey ? -1 : 1);
        const findNextValid = (row: number, col: number, forward: boolean) => {
          let r = row;
          let c = col;
          while (r >= 0 && r < flatRows.length) {
            while (c >= 0 && c < columnCount) {
              if (!shouldSkipCell(flatRows[r], c)) return { r, c };
              c += forward ? 1 : -1;
            }
            r += forward ? 1 : -1;
            c = forward ? 0 : columnCount - 1;
          }
          return null;
        };
        const next = findNextValid(nRow, nCol, !e.shiftKey);
        if (next) {
          setSelectedCell({ itemId: flatRows[next.r].id, colIndex: next.c });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, editingCell, flatRows, capturingFor, addedAutomations, addedCmds, addedGroups, addedSingles]);

  useEffect(() => {
    if (flatRows.length > 0 && !selectedCell && !loadingLinks) {
      const automationSecIdx = flatRows.findIndex(r => r.id === 'sec_automations');
      const linksSecIdx = flatRows.findIndex(r => r.id === 'sec_links');
      const startIdx = automationSecIdx !== -1 ? automationSecIdx : linksSecIdx !== -1 ? linksSecIdx : 0;
      for (let i = startIdx; i < flatRows.length; i++) {
        if (flatRows[i].type !== 'section') {
          setSelectedCell({ itemId: flatRows[i].id, colIndex: 0 });
          break;
        }
      }
    }
  }, [flatRows, selectedCell, loadingLinks]);

  useEffect(() => {
    if (selectedCell) {
      const rowIndex = flatRows.findIndex(r => r.id === selectedCell.itemId);
      if (rowIndex === -1) return undefined;
      if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        containerRef.current?.focus({ preventScroll: true });
      }
      const timer = setTimeout(() => {
        const el = document.querySelector(`.ob-sheet-table tbody tr:nth-child(${rowIndex + 1})`);
        if (el) {
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [selectedCell, flatRows]);

  const assignAvailableHotkeys = useCallback(
    async (items: { id: string }[], current: Record<string, string>) => {
      const next: Record<string, string> = { ...current };
      const reserved = new Set<string>(Object.values(current).filter(Boolean));
      const numberCandidates = Array.from({ length: 9 }, (_, i) => `Alt+${i + 1}`).concat('Alt+0');
      const letterCandidates = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => `Alt+${letter}`);
      const candidates = [...numberCandidates, ...letterCandidates];
      for (const item of items) {
        if (next[item.id]) continue;
        for (const candidate of candidates) {
          if (reserved.has(candidate)) continue;
          const result = await validateHotkey(candidate, item.id);
          if (result.isValid) {
            next[item.id] = candidate;
            reserved.add(candidate);
            break;
          }
        }
      }
      return next;
    },
    [validateHotkey],
  );

  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = styles;
    document.head.appendChild(el);
    setTimeout(() => setMounted(true), 50);
    return () => {
      try {
        document.head.removeChild(el);
      } catch {}
    };
  }, []);

  useEffect(() => {
    StorageManager.getItem('alts_commands').then(() => {
      const defaultCmds: Record<string, boolean> = {};
      ONBOARDING_COMMANDS.forEach(cmd => {
        defaultCmds[cmd.id] = true;
      });
      setAddedCmds(defaultCmds);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoadingLinks(true);
      try {
        const [mostUsedPool, bookmarkPool, routinePool, moduleCatalogRes] = await Promise.all([
          getMostUsedLinks(20),
          getTopBookmarksVisited(15),
          getRoutineDetection(15),
          Promise.resolve([]),
        ]);
        if (cancelled) return;

        const historyContext = [
          ...mostUsedPool.map(l => cleanDomain(l.url)),
          ...bookmarkPool.map(l => cleanDomain(l.url)),
          'productivity',
          'artificial intelligence',
          'news',
          'technology',
          'software development',
        ].join(' ');

        const topCategories = getRecommendedCategories(moduleCatalogRes || [], 25, historyContext);
        setRecommendedCategories(topCategories);
        const autoAdded: Record<string, boolean> = {};
        topCategories.forEach((cat: any) => {
          cat.modules.forEach((m: any) => {
            autoAdded[m.module_id] = true;
          });
        });
        setAddedAutomations(autoAdded);

        const seenDomains = new Set<string>();
        const singles: LinkItem[] = [];
        for (const link of mostUsedPool) {
          if (singles.length >= 2) break;
          const domain = cleanDomain(link.url);
          if (!seenDomains.has(domain)) {
            singles.push({ ...link, id: `sl_${singles.length}` });
            seenDomains.add(domain);
          }
        }
        setSingleLinks(singles);
        const singlesAdded: Record<string, boolean> = {};
        singles.forEach(s => {
          singlesAdded[s.id] = true;
        });
        setAddedSingles(singlesAdded);

        const groups: LinkGroupItem[] = [
          {
            id: 'grp_tech_news',
            name: 'Daily Tech News',
            description: 'Stay updated with the latest in technology.',
            hotkey: '',
            isAdded: true,
            links: [
              { id: 'tn_1', title: 'TechCrunch', url: 'https://techcrunch.com/' },
              { id: 'tn_2', title: 'The Information', url: 'https://www.theinformation.com/' },
              { id: 'tn_3', title: 'Fast Company', url: 'https://www.fastcompany.com/' },
            ],
          },
          {
            id: 'grp_blogs',
            name: 'Daily Blogs',
            description: 'Popular platforms for reading and writing.',
            hotkey: '',
            isAdded: true,
            links: [
              { id: 'blog_1', title: 'Medium', url: 'https://medium.com/' },
              { id: 'blog_2', title: 'Substack', url: 'https://substack.com/' },
            ],
          },
        ];
        setLinkGroups(groups);
        const hk = await assignAvailableHotkeys([...singles, ...groups], {});
        if (cancelled) return;
        setHotkeys(hk);
        const defaultAdded: Record<string, boolean> = {};
        groups.forEach(g => {
          defaultAdded[g.id] = true;
        });
        setAddedGroups(defaultAdded);
      } catch (err) {
        console.error('[OnBoardTemplates] Failed to load link suggestions:', err);
      } finally {
        if (!cancelled) setLoadingLinks(false);
      }
    };
    loadData();
    return () => {
      cancelled = true;
    };
  }, [assignAvailableHotkeys]);

  useEffect(() => {
    if (!capturingFor) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      const parts: string[] = [];
      if (e.altKey) parts.push('Alt');
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.shiftKey) parts.push('Shift');
      const k = e.key;
      if (!['Alt', 'Control', 'Shift', 'Meta'].includes(k)) {
        parts.push(k.toUpperCase());
        setHotkeys(p => ({ ...p, [capturingFor]: parts.join('+') }));
        setCapturingFor(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [capturingFor]);

  const addedCmdsCount = ONBOARDING_COMMANDS.filter(c => addedCmds[c.id]).length;
  const addedGroupsCount = linkGroups.filter(g => addedGroups[g.id]).length;
  const addedCount = addedCmdsCount + addedGroupsCount;

  const updateGroupLink = (gid: string, lid: string, url: string) => {
    setLinkGroups(gs =>
      gs.map(g =>
        g.id === gid
          ? { ...g, links: g.links.map(l => (l.id === lid ? { ...l, url, title: cleanDomain(url) } : l)) }
          : g,
      ),
    );
  };

  const deleteGroupLink = (gid: string, lid: string) => {
    setLinkGroups(gs => gs.map(g => (g.id === gid ? { ...g, links: g.links.filter(l => l.id !== lid) } : g)));
  };

  const updateSingleLink = (id: string, url: string) => {
    setSingleLinks(ls => ls.map(l => (l.id === id ? { ...l, url, title: cleanDomain(url) } : l)));
  };

  return (
    <div
      className="ob-onboarding-container"
      style={{
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.4s ease',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}>
      <style>{styles}</style>
      <div style={{ flexShrink: 0, padding: '16px 16px 16px 16px' }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: 2,
            letterSpacing: '-0.025em',
          }}>
          Setup Your Workspace
        </h1>
      </div>
      <div
        className="ob-sheet-container"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          width: '100%',
          margin: '0 0px',
        }}>
        <div
          ref={containerRef}
          className="ob-scroll-area"
          style={{ flex: 1, overflowY: 'auto', outline: 'none' }}
          tabIndex={0}>
          <table className="ob-sheet-table">
            <thead className="ob-sheet-header">
              <tr>
                <th className="ob-header-cell" style={{ width: '35%' }} data-sheet-header-col="0" tabIndex={0}>
                  Name
                </th>
                <th className="ob-header-cell" style={{ width: '35%' }}>
                  URLs / Information
                </th>
                <th className="ob-header-cell" style={{ width: '15%' }}>
                  Shortcut
                </th>
                <th className="ob-header-cell" style={{ width: '15%' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {flatRows.map(row => {
                if (row.type === 'section') {
                  return null;
                }
                if (row.type === 'automationCategory') {
                  const cat = row.data;
                  const isExpanded = expandedCategory === cat.id;
                  const allAdded = cat.modules.every((m: any) => addedAutomations[m.module_id]);
                  return (
                    <tr key={`cat_${cat.id}`} className="ob-sheet-row">
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 0 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 0 })}
                        onDoubleClick={() => setExpandedCategory(isExpanded ? null : cat.id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setExpandedCategory(isExpanded ? null : cat.id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              display: 'flex',
                              color: '#94a3b8',
                            }}>
                            {isExpanded ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
                          </button>
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                            <FaviconImg host={cat.iconHost} size={18} />
                          </div>
                          <span style={{ fontWeight: 600, color: '#1e293b', textTransform: 'capitalize' }}>
                            {cat.name}
                          </span>
                        </div>
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 1 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 1 })}>
                        {cat.modules.length} Automation Modules
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 2 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 2 })}></td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 3 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 3 })}>
                        {allAdded ? (
                          <span className="ob-added-label">
                            <FaCheck size={10} /> Added
                          </span>
                        ) : (
                          <button
                            className="ob-add-btn"
                            onClick={e => {
                              e.stopPropagation();
                              setAddedAutomations(p => {
                                const next = { ...p };
                                cat.modules.forEach((m: any) => (next[m.module_id] = true));
                                return next;
                              });
                            }}>
                            + Add All
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }
                if (row.type === 'automationModule') {
                  const mod = row.data;
                  const isAdded = !!addedAutomations[mod.module_id];
                  return (
                    <tr
                      key={`mod_${row.parentId}_${row.index}`}
                      className="ob-sheet-row"
                      style={{ background: '#fdfdfd' }}>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 0 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 0 })}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 44 }}>
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: 4,
                            }}>
                            <FaviconImg
                              host={mod.icon_host || mod.parent_icon_host || mod.iconHost || 'default'}
                              size={14}
                            />
                          </div>
                          <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
                            {mod.name || mod.module_key}
                          </span>
                        </div>
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 1 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 1 })}>
                        <span style={{ color: '#64748b', fontSize: 12 }}>{mod.description || 'Automation module'}</span>
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 2 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 2 })}>
                        <span className="ob-badge-prefix">/{mod.command_key || mod.module_key}</span>
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 3 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 3 })}>
                        {isAdded ? (
                          <span className="ob-added-label">
                            <FaCheck size={10} /> Added
                          </span>
                        ) : (
                          <button
                            className="ob-add-btn"
                            onClick={e => {
                              e.stopPropagation();
                              setAddedAutomations(p => ({ ...p, [mod.module_id]: true }));
                            }}>
                            + Add
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }
                if (row.type === 'command') {
                  const cmd = row.data;
                  const isAdded = !!addedCmds[cmd.id];
                  const isEditingKeywords = editingCell?.itemId === row.id && editingCell?.colIndex === 1;
                  return (
                    <tr key={cmd.id} className="ob-sheet-row">
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 0 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 0 })}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                            {cmd.id === 'ai' ? (
                              <StackedFavicons
                                links={AI_GROUP.members.map(
                                  id => ({ url: COMMANDS.find(c => c.id === id)?.iconHost || '' }) as any,
                                )}
                              />
                            ) : (
                              <FaviconImg host={cmd.iconHost} size={18} />
                            )}
                          </div>
                          <span style={{ fontWeight: 500, color: '#1e293b' }}>{cmd.label}</span>
                        </div>
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 1 && 'ob-cell-selected',
                          editingCell?.itemId === row.id && editingCell?.colIndex === 1 && 'ob-cell-editing',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 1 })}
                        onDoubleClick={() => setEditingCell({ itemId: row.id, colIndex: 1 })}>
                        {isEditingKeywords ? (
                          <input
                            autoFocus
                            defaultValue={cmd.keywords.join(', ')}
                            onBlur={() => {
                              setEditingCell(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                setEditingCell(null);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                e.currentTarget.value = cmd.keywords.join(', ');
                                setEditingCell(null);
                              }
                            }}
                          />
                        ) : (
                          cmd.keywords.slice(0, 3).join(', ')
                        )}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 2 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 2 })}>
                        <span className="ob-badge-prefix">{cmd.prefix}</span>
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 3 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 3 })}>
                        {isAdded ? (
                          <span className="ob-added-label">
                            <FaCheck size={10} /> Added
                          </span>
                        ) : (
                          <button
                            className="ob-add-btn"
                            onClick={e => {
                              e.stopPropagation();
                              setAddedCmds(p => ({ ...p, [cmd.id]: true }));
                            }}>
                            + Add
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }
                if (row.type === 'singleLink') {
                  const link = row.data;
                  const isAdded = !!addedSingles[link.id];
                  const isEditingName = editingCell?.itemId === row.id && editingCell?.colIndex === 0;
                  const isEditingUrl = editingCell?.itemId === row.id && editingCell?.colIndex === 1;
                  return (
                    <tr key={link.id} className="ob-sheet-row">
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 0 && 'ob-cell-selected',
                          isEditingName && 'ob-cell-editing',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 0 })}
                        onDoubleClick={() => setEditingCell({ itemId: row.id, colIndex: 0 })}>
                        {isEditingName ? (
                          <input
                            autoFocus
                            defaultValue={link.title}
                            onBlur={e => {
                              setSingleLinks(ls =>
                                ls.map(l => (l.id === link.id ? { ...l, title: e.target.value } : l)),
                              );
                              setEditingCell(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                setSingleLinks(ls =>
                                  ls.map(l => (l.id === link.id ? { ...l, title: e.currentTarget.value } : l)),
                                );
                                setEditingCell(null);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                e.currentTarget.value = link.title;
                                setEditingCell(null);
                              }
                            }}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 24,
                                height: 24,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                              <FaviconImg host={link.url} size={18} />
                            </div>
                            <span style={{ fontWeight: 500, color: '#1e293b' }}>{link.title}</span>
                          </div>
                        )}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 1 && 'ob-cell-selected',
                          editingCell?.itemId === row.id && editingCell?.colIndex === 1 && 'ob-cell-editing',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 1 })}
                        onDoubleClick={() => setEditingCell({ itemId: row.id, colIndex: 1 })}
                        style={{
                          overflow:
                            editingCell?.itemId === row.id && editingCell?.colIndex === 1 ? 'visible' : 'hidden',
                        }}>
                        {isEditingUrl ? (
                          <SpreadsheetMultiLinkInput
                            initialUrls={link.url.startsWith('{') ? JSON.parse(link.url).urls : [link.url]}
                            onSave={val => {
                              updateSingleLink(link.id, val);
                              setEditingCell(null);
                            }}
                            onCancel={() => setEditingCell(null)}
                          />
                        ) : (
                          renderUrlContent(link.url)
                        )}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 2 && 'ob-cell-selected',
                        )}
                        onClick={() => {
                          setSelectedCell({ itemId: row.id, colIndex: 2 });
                          setCapturingFor(link.id);
                        }}>
                        {capturingFor === link.id ? (
                          <span style={{ color: '#3b82f6', fontWeight: 600 }}>Press keys…</span>
                        ) : (
                          <span className="ob-badge-prefix">{hotkeys[link.id] || 'Set'}</span>
                        )}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 3 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 3 })}>
                        {isAdded ? (
                          <span className="ob-added-label">
                            <FaCheck size={10} /> Added
                          </span>
                        ) : (
                          <button
                            className="ob-add-btn"
                            onClick={() => setAddedSingles(p => ({ ...p, [link.id]: !p[link.id] }))}>
                            + Add
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }
                if (row.type === 'group') {
                  const group = row.data;
                  const isAdded = !!addedGroups[group.id];
                  const isExpanded = expandedGroup === group.id;
                  const isEditingName = editingCell?.itemId === row.id && editingCell?.colIndex === 0;
                  return (
                    <tr key={group.id} className="ob-sheet-row">
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 0 && 'ob-cell-selected',
                          isEditingName && 'ob-cell-editing',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 0 })}
                        onDoubleClick={() => setEditingCell({ itemId: row.id, colIndex: 0 })}>
                        {isEditingName ? (
                          <input
                            autoFocus
                            defaultValue={group.name}
                            onBlur={e => {
                              setLinkGroups(gs =>
                                gs.map(g => (g.id === group.id ? { ...g, name: e.target.value } : g)),
                              );
                              setEditingCell(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                setLinkGroups(gs =>
                                  gs.map(g => (g.id === group.id ? { ...g, name: e.currentTarget.value } : g)),
                                );
                                setEditingCell(null);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                e.currentTarget.value = group.name;
                                setEditingCell(null);
                              }
                            }}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              onClick={e => {
                                e.stopPropagation();
                                setExpandedGroup(isExpanded ? null : group.id);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                color: '#94a3b8',
                                width: 12,
                                flexShrink: 0,
                              }}>
                              {isExpanded ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
                            </div>
                            <div
                              style={{
                                width: 34,
                                height: 24,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                              <StackedFavicons links={group.links} />
                            </div>
                            <span style={{ fontWeight: 500, color: '#1e293b' }}>{group.name}</span>
                          </div>
                        )}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 1 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 1 })}>
                        {group.description}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 2 && 'ob-cell-selected',
                        )}
                        onClick={() => {
                          setSelectedCell({ itemId: row.id, colIndex: 2 });
                          setCapturingFor(group.id);
                        }}>
                        {capturingFor === group.id ? (
                          <span style={{ color: '#3b82f6', fontWeight: 600 }}>Press keys…</span>
                        ) : (
                          <span className="ob-badge-prefix">{hotkeys[group.id] || 'Set'}</span>
                        )}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 3 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 3 })}>
                        {isAdded ? (
                          <span className="ob-added-label">
                            <FaCheck size={10} /> Added
                          </span>
                        ) : (
                          <button
                            className="ob-add-btn"
                            onClick={e => {
                              e.stopPropagation();
                              setAddedGroups(p => ({ ...p, [group.id]: true }));
                            }}>
                            + Add
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }
                if (row.type === 'subLink') {
                  const link = row.data;
                  const parentId = row.parentId;
                  const isEditingName = editingCell?.itemId === row.id && editingCell?.colIndex === 0;
                  const isEditingUrl = editingCell?.itemId === row.id && editingCell?.colIndex === 1;
                  return (
                    <tr key={link.id} className="ob-sheet-row" style={{ backgroundColor: '#fdfdfd' }}>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 0 && 'ob-cell-selected',
                          editingCell?.itemId === row.id && editingCell?.colIndex === 0 && 'ob-cell-editing',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 0 })}
                        onDoubleClick={() => setEditingCell({ itemId: row.id, colIndex: 0 })}
                        style={{ paddingLeft: 40 }}>
                        {isEditingName ? (
                          <input
                            autoFocus
                            defaultValue={link.title}
                            onBlur={e => {
                              setLinkGroups(gs =>
                                gs.map(g =>
                                  g.id === parentId
                                    ? {
                                        ...g,
                                        links: g.links.map(l =>
                                          l.id === link.id ? { ...l, title: e.target.value } : l,
                                        ),
                                      }
                                    : g,
                                ),
                              );
                              setEditingCell(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                setLinkGroups(gs =>
                                  gs.map(g =>
                                    g.id === parentId
                                      ? {
                                          ...g,
                                          links: g.links.map(l =>
                                            l.id === link.id ? { ...l, title: e.currentTarget.value } : l,
                                          ),
                                        }
                                      : g,
                                  ),
                                );
                                setEditingCell(null);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                e.currentTarget.value = link.title;
                                setEditingCell(null);
                              }
                            }}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FaviconImg host={link.url} size={14} />
                            <span style={{ color: '#64748b' }}>{link.title}</span>
                          </div>
                        )}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 1 && 'ob-cell-selected',
                          editingCell?.itemId === row.id && editingCell?.colIndex === 1 && 'ob-cell-editing',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 1 })}
                        onDoubleClick={() => setEditingCell({ itemId: row.id, colIndex: 1 })}
                        style={{
                          color: '#94a3b8',
                          fontSize: 10,
                          overflow:
                            editingCell?.itemId === row.id && editingCell?.colIndex === 1 ? 'visible' : 'hidden',
                        }}>
                        {isEditingUrl ? (
                          <SpreadsheetMultiLinkInput
                            initialUrls={link.url.startsWith('{') ? JSON.parse(link.url).urls : [link.url]}
                            onSave={val => {
                              updateGroupLink(parentId, link.id, val);
                              setEditingCell(null);
                            }}
                            onCancel={() => setEditingCell(null)}
                          />
                        ) : (
                          renderUrlContent(link.url)
                        )}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 2 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 2 })}></td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 3 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 3 })}>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            deleteGroupLink(parentId, link.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: 0.6,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}>
                          <FaTimes size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                }
                return null;
              })}
            </tbody>
          </table>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            zIndex: 40,
          }}>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
            {addedCount} item{addedCount !== 1 ? 's' : ''} selected for your workspace
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleFinish} disabled={isFinishing} className="ob-finish-btn">
              {isFinishing ? (
                <>
                  <FiLoader className="animate-spin" /> Setting up...
                </>
              ) : (
                'Finish Setup'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. Onboarding Wizard Main Overlay Component (from TutorialOverlay.tsx)
// ==========================================

const scrollbarStyles = `
  .tutorial-overlay-scroll::-webkit-scrollbar {
    width: 4px;
  }
  .tutorial-overlay-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .tutorial-overlay-scroll::-webkit-scrollbar-thumb {
    background: rgba(128, 128, 128, 0.25);
    border-radius: 10px;
  }
  .tutorial-overlay-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(128, 128, 128, 0.4);
  }
`;

export async function installOnboardingDashboardViews(
  workspaceId: string,
  roleId: SupportedOnboardingRoleId = 'founder',
  selectedTemplateIds: string[],
  dashboardViewShortcuts?: Record<string, string>,
  dashboardViewHotkeys?: Record<string, string>,
): Promise<{
  installedViewIds: string[];
  existingViewIds: string[];
  resolvedViewIds: string[];
  skippedTemplateIds: string[];
}> {
  const installedViewIds: string[] = [];
  const existingViewIds: string[] = [];
  const resolvedViewIds: string[] = [];
  const skippedTemplateIds: string[] = [];

  if (!workspaceId) {
    return { installedViewIds, existingViewIds, resolvedViewIds, skippedTemplateIds };
  }

  const roleTemplates = getRoleTemplates(roleId);
  const selectedIdSet = new Set(selectedTemplateIds);
  roleTemplates.forEach(template => {
    if (template.isDefaultView) selectedIdSet.add(template.id);
  });
  const selectedTemplates = roleTemplates.filter(template => selectedIdSet.has(template.id));
  const existingViews = await db.widgetViews.where('workspaceId').equals(workspaceId).toArray();
  const existingDefaultView = existingViews.find(view => view.isDefault);

  for (const template of selectedTemplates) {
    const existingView = existingViews.find(
      view =>
        view.settings?.source === 'onboarding' &&
        view.settings?.templateId === template.id &&
        (view.settings?.role === roleId || (roleId === 'founder' && !view.settings?.role)),
    );
    const viewId = existingView?.id || generateEntityId('dashboardView');
    const shouldBeDefault = existingDefaultView
      ? existingDefaultView.id === viewId
      : template.isDefaultView;
    const rawShortcut = dashboardViewShortcuts?.[template.id] || template.defaultShortcut;
    const normalizedShortcut = normalizeShortcutTrigger(rawShortcut);
    const normalizedHotkey = normalizeHotkeyString(dashboardViewHotkeys?.[template.id] || '');
    const wasOutdated = existingView?.settings?.templateVersion !== template.version;

    await db.transaction(
      'rw',
      [db.widgetViews, db.notes, db.sessions, db.links, db.aiPrompts, db.todos, db.widgets, db.widgetLayouts],
      async () => {
        const now = Date.now();
        const existingWidgets = existingView ? await db.widgets.where('viewId').equals(viewId).toArray() : [];
        const storedEntityIds = (existingView?.settings?.onboardingEntityIds || {}) as Record<string, string>;
        const noteWidget = existingWidgets.find(widget => widget.type === 'note-library');
        const sessionWidget = existingWidgets.find(
          widget => widget.type === 'session-item' || widget.referenceType === 'session',
        );
        const aiPromptWidget = existingWidgets.find(widget => widget.type === 'ai-prompt-library');
        const linkWidget = existingWidgets.find(widget => widget.type === 'link-library');

        const noteTemplates = template.objects.filter(
          (object): object is OnboardingNoteObjectTemplate => object.type === 'note',
        );
        const sessionTemplate = template.objects.find(object => object.type === 'session')!;
        const aiPromptTemplate = template.objects.find(object => object.type === 'aiPrompt')!;
        const linkTemplate = template.objects.find(object => object.type === 'link');

        const existingNoteIds = Array.from(
          new Set([
            ...(Array.isArray((storedEntityIds as any).noteIds) ? (storedEntityIds as any).noteIds : []),
            ...(storedEntityIds.noteId ? [storedEntityIds.noteId] : []),
            ...(((noteWidget?.settings as any)?.selectedNoteIds || []) as string[]),
          ]),
        ).filter(Boolean);
        const noteIds: string[] = [];

        for (let noteIndex = 0; noteIndex < noteTemplates.length; noteIndex += 1) {
          const noteTemplate = noteTemplates[noteIndex];
          let noteId = existingNoteIds[noteIndex] || '';
          let noteRecord = noteId ? await db.notes.get(noteId) : undefined;

          if (!noteRecord) {
            noteRecord = await createNote({
              workspaceId,
              folderId: null,
              title: noteTemplate.title,
              body: noteTemplate.content,
              tagIds: [],
            });
            noteId = noteRecord.id;
          } else if (wasOutdated) {
            await db.notes.update(noteId, { title: noteTemplate.title, body: noteTemplate.content, updatedAt: now });
          }

          noteIds.push(noteId);
        }

        let sessionId =
          storedEntityIds.sessionId ||
          String(sessionWidget?.referenceId || (sessionWidget?.settings as any)?.sessionId || '');
        let sessionRecord = sessionId ? await db.sessions.get(sessionId) : undefined;
        const sessionOpenSettings = {
          ...DEFAULT_SESSION_SETTINGS,
          openMode: 'new_window' as const,
          autoSaveMode: DEFAULT_SESSION_SETTINGS.autoSaveMode,
        };
        if (!sessionRecord) {
          sessionRecord = await createSession({
            workspaceId,
            folderId: null,
            title: sessionTemplate.title,
            description: sessionTemplate.description || '',
            urls: generateLinkItems(sessionTemplate.urls),
            tagIds: [],
            sessionOpenSettings,
            shortcut: '',
          });
          sessionId = sessionRecord.id;
        } else {
          await db.sessions.update(sessionId, {
            ...(wasOutdated
              ? {
                  title: sessionTemplate.title,
                  description: sessionTemplate.description || '',
                  urls: generateLinkItems(sessionTemplate.urls),
                }
              : {}),
            sessionOpenSettings: { ...sessionRecord.sessionOpenSettings, ...sessionOpenSettings },
            updatedAt: now,
          });
        }

        let aiPromptId =
          storedEntityIds.aiPromptId || String((aiPromptWidget?.settings as any)?.selectedPromptIds?.[0] || '');
        let aiPromptRecord = aiPromptId ? await db.aiPrompts.get(aiPromptId) : undefined;
        if (!aiPromptRecord) {
          aiPromptRecord = await createAiPrompt({
            workspaceId,
            folderId: null,
            title: aiPromptTemplate.title,
            prompt: aiPromptTemplate.content,
            modelUrls: { gpt: 'https://chatgpt.com' },
            enabledModelIds: ['gpt'],
            tagIds: [],
          });
          aiPromptId = aiPromptRecord.id;
        } else if (wasOutdated) {
          await db.aiPrompts.update(aiPromptId, {
            title: aiPromptTemplate.title,
            prompt: aiPromptTemplate.content,
            modelUrls: { gpt: 'https://chatgpt.com' },
            enabledModelIds: ['gpt'],
            updatedAt: now,
          });
        }

        let linkId = storedEntityIds.linkId || String((linkWidget?.settings as any)?.selectedCollectionIds?.[0] || '');
        let linkRecord = linkId ? await db.links.get(linkId) : undefined;
        if (linkTemplate?.urls?.length && !linkRecord) {
          linkRecord = await createLink({
            workspaceId,
            folderId: null,
            title: linkTemplate.title,
            urls: generateLinkItems(linkTemplate.urls),
            tagIds: [],
            shortcut: '',
          });
          linkId = linkRecord.id;
        } else if (linkRecord && linkTemplate?.urls?.length && wasOutdated) {
          await db.links.update(linkId, {
            title: linkTemplate.title,
            urls: generateLinkItems(linkTemplate.urls),
            updatedAt: now,
          });
        }

        let todoId = storedEntityIds.todoId || '';
        let todoRecord = todoId ? await db.todos.get(todoId) : undefined;
        if (template.todo && !todoRecord) {
          const randomFutureTime = Date.now() + 5 * 60_000 + Math.floor(Math.random() * 24 * 60 * 60_000);
          todoRecord = await createTodo(
            template.todo.title,
            [],
            'one-time',
            randomFutureTime,
            undefined,
            template.todo.description,
            [],
            '',
            workspaceId,
          );
          todoId = todoRecord.id;
        } else if (template.todo && todoRecord && wasOutdated) {
          await db.todos.update(todoId, {
            name: template.todo.title,
            description: template.todo.description,
            scheduleType: 'one-time',
            recurringType: undefined,
            workspaceId,
            updatedAt: now,
          });
        }

        const entityIds = {
          noteId: noteIds[0] || '',
          noteIds,
          sessionId,
          aiPromptId,
          ...(linkId ? { linkId } : {}),
          ...(todoId ? { todoId } : {}),
        };
        if (shouldBeDefault) {
          await db.widgetViews
            .where('workspaceId')
            .equals(workspaceId)
            .modify(view => {
              if (view.id !== viewId && view.isDefault) {
                view.isDefault = false;
                view.updatedAt = now;
              }
            });
        }
        await db.widgetViews.put({
          id: viewId,
          workspaceId,
          title: template.title,
          isDefault: shouldBeDefault,
          collectionLaunchSettings: normalizeCollectionLaunchSettings(existingView?.collectionLaunchSettings),
          settings: {
            ...existingView?.settings,
            source: 'onboarding',
            role: roleId,
            viewGroup: template.group,
            templateId: template.id,
            templateVersion: template.version,
            onboardingEntityIds: entityIds,
          },
          createdAt: existingView?.createdAt || now,
          updatedAt: now,
        });

        const widgetTypeFor = (kind: OnboardingWidgetKind) =>
          ({
            session: 'session-item',
            notes: 'note-library',
            'ai-prompts': 'ai-prompt-library',
            links: 'link-library',
            news: 'news',
            weather: 'weather',
          })[kind];

        for (let index = 0; index < template.widgets.length; index += 1) {
          const kind = template.widgets[index];
          if (kind === 'links' && !linkId) continue;
          const type = widgetTypeFor(kind);
          const currentWidget = existingWidgets.find(widget => widget.type === type);
          const widgetInput: any = {
            title:
              kind === 'session'
                ? sessionTemplate.title
                : kind === 'notes'
                  ? noteTemplates.length === 1
                    ? noteTemplates[0].title
                    : `${template.title} Notes`
                  : kind === 'ai-prompts'
                    ? 'Chat Agents'
                    : kind === 'links'
                      ? linkTemplate?.title
                      : kind === 'news'
                        ? 'News'
                        : 'Weather',
            type,
            categoryId: kind === 'news' || kind === 'weather' ? 'external-widgets' : 'core-widgets',
            sizePreset: kind === 'session' ? 'large' : 'medium',
            expansionMode: 'preset',
            settings: {},
          };

          if (kind === 'session') {
            Object.assign(widgetInput, { referenceId: sessionId, referenceType: 'session', settings: { sessionId } });
          }

          if (kind === 'notes') {
            widgetInput.settings = {
              sourceMode: 'manual',
              selectedNoteIds: noteIds,
              selectedTagIds: [],
              tagMatchMode: 'any',
              sortBy: 'saved-order',
            };
          }

          if (kind === 'ai-prompts') {
            widgetInput.settings = {
              sourceMode: 'manual',
              selectedPromptIds: [aiPromptId],
              selectedTagIds: [],
              tagMatchMode: 'any',
              sortBy: 'saved-order',
            };
          }

          if (kind === 'links') {
            widgetInput.settings = {
              sourceMode: 'manual',
              selectedCollectionIds: [linkId],
              selectedTagIds: [],
              tagMatchMode: 'any',
              sortBy: 'saved-order',
            };
          }

          if (currentWidget) {
            await db.widgets.update(currentWidget.id, { ...widgetInput, updatedAt: now });
          } else {
            await createWidgetInWorkspace(workspaceId, viewId, widgetInput, {
              x: 0,
              y: index * 5,
              w: kind === 'session' ? 12 : 8,
              h: 5,
              minW: 4,
              maxW: 12,
              minH: 5,
              maxH: 15,
              isDraggable: true,
              isResizable: true,
              static: false,
            });
          }
        }
      },
    );

    if (normalizedShortcut) {
      await saveShortcut(viewId, viewId, normalizedShortcut, template.title, 'collection');
    }

    if (normalizedHotkey) {
      await apiSaveHotkey(viewId, viewId, normalizedHotkey, 'collection');
    }

    if (existingView) {
      skippedTemplateIds.push(template.id);
      existingViewIds.push(viewId);
    } else {
      installedViewIds.push(viewId);
    }
    resolvedViewIds.push(viewId);
  }

  if (resolvedViewIds.length > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WIDGET_DASHBOARD_STORAGE_EVENT));
  }

  return { installedViewIds, existingViewIds, resolvedViewIds, skippedTemplateIds };
}

export async function installFounderDashboardViews(
  workspaceId: string,
  selectedTemplateIds: string[],
  dashboardViewShortcuts?: Record<string, string>,
  dashboardViewHotkeys?: Record<string, string>,
): Promise<{
  installedViewIds: string[];
  existingViewIds: string[];
  resolvedViewIds: string[];
  skippedTemplateIds: string[];
}> {
  return installOnboardingDashboardViews(
    workspaceId,
    'founder',
    selectedTemplateIds,
    dashboardViewShortcuts,
    dashboardViewHotkeys,
  );
}

interface OnboardingCardsProps {
  onClose: () => void;
  isLoggedIn?: boolean;
  isReturningUser?: boolean;
  initialStep?: Step;
}

type Step =
  | 'dashboard_views'
  | 'get_started'
  | 'theme'
  | 'organization'
  | 'onboarding'
  | 'restore_options'
  | 'restore_success'
  | 'cloud_migration_onboarding'
  | 'presentation';

const OnboardingHeader: React.FC<{
  currentStep: number;
  totalSteps?: number;
  isLight?: boolean;
  stepCountLayout?: OnboardingDashboardViewsLayout['stepCount'];
}> = ({ currentStep, totalSteps = 4, isLight = true, stepCountLayout }) => {
  return (
    <div
      className="flex flex-col items-center select-none shrink-0"
      style={{
        paddingTop: stepCountLayout?.paddingTop ?? 24,
        gap: stepCountLayout?.gap ?? 6,
      }}>
      <span
        className="font-bold uppercase"
        style={{
          color:
            stepCountLayout?.labelColor ?? (isLight ? 'var(--color-tutorialTextDescription)' : 'var(--ob-text-muted)'),
          fontSize: stepCountLayout?.labelFontSize ?? 11,
          fontWeight: stepCountLayout?.labelFontWeight ?? 700,
          letterSpacing: stepCountLayout?.labelLetterSpacing ?? '0.05em',
          textTransform: stepCountLayout?.labelTextTransform ?? 'uppercase',
        }}>
        Step {currentStep} of {totalSteps}
      </span>
      <div
        className="flex"
        style={{
          width: stepCountLayout?.progressWidth ?? 128,
          gap: stepCountLayout?.progressGap ?? 6,
        }}>
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <div
            key={idx}
            className="flex-1 transition-colors"
            style={{
              height: stepCountLayout?.progressHeight ?? 4,
              borderRadius: stepCountLayout?.progressRadius ?? 999,
              backgroundColor:
                currentStep >= idx + 1
                  ? (stepCountLayout?.progressActiveColor ??
                    (isLight ? 'var(--color-tutorialAccent)' : 'var(--ob-accent)'))
                  : (stepCountLayout?.progressInactiveColor ??
                    (isLight ? 'var(--color-borderDefault)' : 'var(--ob-border)')),
            }}
          />
        ))}
      </div>
    </div>
  );
};

interface OnboardingFooterProps {
  currentStep: number;
  totalSteps?: number;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  isNextDisabled?: boolean;
  isLight?: boolean;
}

interface OnboardingNextButtonProps {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
  isLight?: boolean;
}

const OnboardingNextButton: React.FC<OnboardingNextButtonProps> = ({
  onClick,
  label = 'Next →',
  disabled,
  isLight = false,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex items-center gap-2 px-5 py-2 rounded-full text-xs md:text-sm font-semibold transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100 text-white cursor-pointer"
    style={{
      backgroundImage: isLight
        ? 'linear-gradient(to right, #8b3dff, #7c2ae8)'
        : 'linear-gradient(to right, var(--ob-gradient-start), var(--ob-gradient-end))',
      boxShadow: isLight ? '0 4px 14px rgba(139, 61, 255, 0.3)' : '0 4px 14px var(--ob-accent-muted)',
    }}>
    {label}
  </button>
);

const OnboardingFooter: React.FC<OnboardingFooterProps> = ({
  currentStep,
  totalSteps = 4,
  onBack,
  onNext,
  nextLabel = 'Next →',
  isNextDisabled,
  isLight = false,
}) => {
  return (
    <div className="relative flex items-center justify-between w-full mt-auto h-12 select-none">
      {/* Left Back Button */}
      {onBack ? (
        <button
          onClick={onBack}
          className="flex items-center gap-2 font-semibold text-xs md:text-sm transition-colors px-4 py-2 cursor-pointer"
          style={{ color: isLight ? '#64748b' : 'var(--ob-text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = isLight ? '#0f172a' : 'var(--ob-text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = isLight ? '#64748b' : 'var(--ob-text-muted)')}>
          <FaChevronLeft size={12} /> Back
        </button>
      ) : (
        <div className="w-16"></div>
      )}

      {/* Center Progress Dots */}
      <div className="absolute left-1/2 transform -translate-x-1/2 flex gap-2">
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <span
            key={idx}
            className="w-2 h-2 rounded-full transition-colors"
            style={{
              backgroundColor:
                currentStep === idx + 1
                  ? isLight
                    ? '#8b3dff'
                    : 'var(--ob-accent)'
                  : isLight
                    ? '#cbd5e1'
                    : 'var(--ob-border)',
            }}
          />
        ))}
      </div>

      {/* Right Next Button */}
      {onNext ? (
        <OnboardingNextButton onClick={onNext} label={nextLabel} disabled={isNextDisabled} isLight={isLight} />
      ) : (
        <div className="w-16"></div>
      )}
    </div>
  );
};

const getDefaultDashboardViewHotkeys = (templates: { id: string }[]): Record<string, string> =>
  Object.fromEntries(templates.map((template, index) => [template.id, `Alt+${index + 1}`]));

const OnboardingCards = React.forwardRef<HTMLDivElement, OnboardingCardsProps>(
  ({ onClose, isLoggedIn, isReturningUser, initialStep }, ref) => {
    const [step, setStep] = useState<Step>(initialStep ?? 'dashboard_views');
    const dashboardViewsStepRef = useRef<HTMLDivElement | null>(null);
    const themeStepRef = useRef<HTMLDivElement | null>(null);
    const dashboardViewsLayout = useOnboardingDashboardViewsLayout(dashboardViewsStepRef);
    const themeLayout = useOnboardingThemeLayout(themeStepRef);
    const [recommendedTemplateIdsByRole] = useState<Record<SupportedOnboardingRoleId, string[]>>(
      () =>
        Object.fromEntries(
          ONBOARDING_ROLE_TEMPLATES.map(role => [
            role.id,
            getRecommendedRoleTemplates(role.id).map(template => template.id),
          ]),
        ) as Record<SupportedOnboardingRoleId, string[]>,
    );
    const onboardingRoles = useMemo(
      () =>
        ONBOARDING_ROLE_TEMPLATES.map(role => ({
          ...role,
          views: role.views.filter(template => recommendedTemplateIdsByRole[role.id].includes(template.id)),
        })),
      [recommendedTemplateIdsByRole],
    );
    const getDisplayedRoleTemplates = useCallback(
      (roleId: SupportedOnboardingRoleId) => {
        const recommendedIds = recommendedTemplateIdsByRole[roleId];
        return getRoleTemplates(roleId).filter(template => recommendedIds.includes(template.id));
      },
      [recommendedTemplateIdsByRole],
    );
    const [selectedRoleId, setSelectedRoleId] = useState<SupportedOnboardingRoleId>('founder');
    const [selectedDashboardViewTemplateIds, setSelectedDashboardViewTemplateIds] = useState<string[]>(
      () => recommendedTemplateIdsByRole.founder,
    );
    const [dashboardViewShortcuts, setDashboardViewShortcuts] = useState<Record<string, string>>(() =>
      Object.fromEntries(getDisplayedRoleTemplates('founder').map(template => [template.id, template.defaultShortcut])),
    );
    const [dashboardViewHotkeys, setDashboardViewHotkeys] = useState<Record<string, string>>(() =>
      getDefaultDashboardViewHotkeys(getDisplayedRoleTemplates('founder')),
    );

    const handleRoleChange = useCallback(
      (newRoleId: SupportedOnboardingRoleId) => {
        setSelectedRoleId(newRoleId);
        const templates = getDisplayedRoleTemplates(newRoleId);
        setSelectedDashboardViewTemplateIds(templates.filter(t => t.defaultSelected).map(t => t.id));
        setDashboardViewShortcuts(Object.fromEntries(templates.map(t => [t.id, t.defaultShortcut])));
        setDashboardViewHotkeys(getDefaultDashboardViewHotkeys(templates));
        setDashboardViewShortcutErrors({});
        setDashboardViewHotkeyErrors({});
      },
      [getDisplayedRoleTemplates],
    );

    const [dashboardViewShortcutErrors, setDashboardViewShortcutErrors] = useState<Record<string, string>>({});
    const [dashboardViewHotkeyErrors, setDashboardViewHotkeyErrors] = useState<Record<string, string>>({});
    const createdWorkspaceIdRef = useRef<string | null>(null);
    const [workspaceCreationError, setWorkspaceCreationError] = useState<string | null>(null);
    const dispatch = useDispatch();
    const { themeId, setTheme: setThemeProfile, wallpaperId, setWallpaper } = useAppearance();
    const { validateHotkey: validateDashboardViewHotkey } = useHotkeyValidation();

    const [hasCloudWorkspaces, setHasCloudWorkspaces] = useState(false);

    useEffect(() => {
      const checkCloudData = async () => {
        if (isLoggedIn && FEATURE_FLAGS.ENABLE_SHARING) {
          const found = await checkHasCloudData();
          setHasCloudWorkspaces(found);
        }
      };
      checkCloudData();
    }, [isLoggedIn]);

    const [shouldShowOrgStep, setShouldShowOrgStep] = useState(false);
    const [orgName, setOrgName] = useState('');
    const [selectedStorageMode, setSelectedStorageMode] = useState<'local' | 'cloud'>('local');
    const [isCreating, setIsCreating] = useState(false);
    // True only when the user has a real cloud account (userId starts with 'user_')
    const [isCloudUser, setIsCloudUser] = useState(false);

    // Restore states
    const [restoreError, setRestoreError] = useState<string | null>(null);
    const [restoredSummary, setRestoredSummary] = useState<any | null>(null);
    const [isRestoring, setIsRestoring] = useState(false);

    // Google Drive states
    const [driveStatus, setDriveStatus] = useState<
      'checking' | 'disconnected' | 'connected' | 'connecting' | 'listing'
    >('disconnected');
    const [driveEmail, setDriveEmail] = useState<string>('');
    const [driveBackups, setDriveBackups] = useState<any[]>([]);
    const [driveError, setDriveError] = useState<string | null>(null);
    const [restoringFileId, setRestoringFileId] = useState<string | null>(null);
    const [loadingDriveBackups, setLoadingDriveBackups] = useState(false);

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Google Drive: check connection on mount
    React.useEffect(() => {
      chrome.identity.getAuthToken({ interactive: false }, async token => {
        if (token) {
          setDriveStatus('connected');
          setDriveEmail('Connected');
          // Load backups
          setLoadingDriveBackups(true);
          const files = await listBackupsFromDrive().catch(() => []);
          setDriveBackups(files);
          setLoadingDriveBackups(false);
        } else {
          setDriveStatus('disconnected');
        }
      });
    }, []);

    const loadDriveBackups = async (force = false) => {
      setLoadingDriveBackups(true);
      setDriveError(null);
      try {
        const files = await listBackupsFromDrive();
        setDriveBackups(files);
        setDriveStatus('connected');
      } catch (err: any) {
        setDriveError(err?.message ?? 'Failed to load Drive backups.');
        setDriveStatus('connected');
      } finally {
        setLoadingDriveBackups(false);
      }
    };

    const handleConnectDrive = async () => {
      setDriveError(null);
      setDriveStatus('connecting');
      try {
        const token = await getDriveToken();
        if (token) {
          setDriveStatus('connected');
          setDriveEmail('Connected');
          await loadDriveBackups(true);
        } else {
          setDriveStatus('disconnected');
        }
      } catch (err: any) {
        setDriveError(err?.message ?? 'Failed to connect to Google Drive.');
        setDriveStatus('disconnected');
      }
    };

    const handleDriveRestore = async (fileId: string) => {
      setRestoringFileId(fileId);
      setRestoreError(null);
      setIsRestoring(true);
      try {
        const payload = await downloadBackupFromDrive(fileId);
        await restoreDatabaseFromJSON(payload);
        const fileSummary = computeBackupSummary(payload);
        setRestoredSummary(fileSummary);
        setStep('restore_success');
      } catch (err: any) {
        setRestoreError(err?.message ?? 'Failed to restore from Drive.');
      } finally {
        setIsRestoring(false);
        setRestoringFileId(null);
      }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      setRestoreError(null);
      setIsRestoring(true);
      try {
        const backupData = await readBackupArchive(file, { hydrateAssets: true });
        await restoreDatabaseFromJSON(backupData);
        const fileSummary = computeBackupSummary(backupData);
        setRestoredSummary(fileSummary);
        setStep('restore_success');
      } catch (err) {
        setRestoreError('Failed to parse or restore from ZIP backup file.');
      } finally {
        setIsRestoring(false);
      }
    };

    const validateSelectedDashboardViewBindings = useCallback(async (): Promise<boolean> => {
      const shortcutErrors: Record<string, string> = {};
      const hotkeyErrors: Record<string, string> = {};
      const activeTemplates = getDisplayedRoleTemplates(selectedRoleId);
      const selectedTemplates = activeTemplates.filter(t => selectedDashboardViewTemplateIds.includes(t.id));

      if (selectedTemplates.length === 0) {
        setDashboardViewShortcutErrors({ _general: 'Please select at least 1 workspace template.' });
        setDashboardViewHotkeyErrors({});
        return false;
      }

      const usedTriggers = new Set<string>();
      const usedHotkeys = new Set<string>();

      for (const template of selectedTemplates) {
        const rawShortcut = dashboardViewShortcuts[template.id] || template.defaultShortcut;
        const normalizedShortcut = normalizeShortcutTrigger(rawShortcut);

        if (!normalizedShortcut) {
          shortcutErrors[template.id] = 'Shortcut cannot be empty.';
        } else {
          const formatErr = getShortcutTriggerFormatError(rawShortcut);
          if (formatErr) {
            shortcutErrors[template.id] = formatErr;
          } else if (usedTriggers.has(normalizedShortcut)) {
            shortcutErrors[template.id] = `Duplicate shortcut "${normalizedShortcut}". Unique trigger required.`;
          } else {
            usedTriggers.add(normalizedShortcut);

            const reservedReason = await getReservedShortcutReason(rawShortcut);
            if (reservedReason) {
              shortcutErrors[template.id] = reservedReason;
            } else {
              const existingShortcut = await db.userShortcuts.where('trigger').equals(normalizedShortcut).first();
              if (existingShortcut) {
                shortcutErrors[template.id] = `The shortcut "${normalizedShortcut}" is already in use.`;
              }
            }
          }
        }

        const normalizedHotkey = normalizeHotkeyString(dashboardViewHotkeys[template.id] || '');
        if (!normalizedHotkey) {
          hotkeyErrors[template.id] = 'Hotkey cannot be empty.';
        } else if (usedHotkeys.has(normalizedHotkey)) {
          hotkeyErrors[template.id] = `Duplicate hotkey "${normalizedHotkey}". Unique hotkey required.`;
        } else {
          usedHotkeys.add(normalizedHotkey);
          const result = await validateDashboardViewHotkey(normalizedHotkey, template.id);
          if (!result.isValid) {
            hotkeyErrors[template.id] = result.errorMessage || `The hotkey "${normalizedHotkey}" is already in use.`;
          }
        }
      }

      setDashboardViewShortcutErrors(shortcutErrors);
      setDashboardViewHotkeyErrors(hotkeyErrors);

      return Object.keys(shortcutErrors).length === 0 && Object.keys(hotkeyErrors).length === 0;
    }, [
      dashboardViewHotkeys,
      dashboardViewShortcuts,
      getDisplayedRoleTemplates,
      selectedDashboardViewTemplateIds,
      selectedRoleId,
      validateDashboardViewHotkey,
    ]);

    React.useEffect(() => {
      StorageManager.getItem(['localOrganizations', 'accessToken']).then(res => {
        const localOrgs = res.localOrganizations || [];
        const hasNoLocal = !Array.isArray(localOrgs) || localOrgs.length === 0;
        if (hasNoLocal) {
          setShouldShowOrgStep(true);
        } else {
          setShouldShowOrgStep(false);
        }
        // Determine if this is a real cloud account
        const token = res.accessToken;
        if (typeof token === 'string' && token.startsWith('user_')) {
          setIsCloudUser(true);
        }
      });
    }, []);

    const handleCreateOrgAndWorkspace = async () => {
      setIsCreating(true);
      setWorkspaceCreationError(null);
      try {
        let workspaceId = createdWorkspaceIdRef.current;
        if (!workspaceId) {
          const finalWorkspaceName = orgName.trim() || 'Personal Workspace';
          const workspace = await createWorkspace(finalWorkspaceName);
          workspaceId = workspace.id;
          createdWorkspaceIdRef.current = workspace.id;
        }

        await loadWidgetDashboardStateAsync(workspaceId);

        const installResult = await installOnboardingDashboardViews(
          workspaceId,
          selectedRoleId,
          selectedDashboardViewTemplateIds,
          dashboardViewShortcuts,
          dashboardViewHotkeys,
        );

        if (installResult.resolvedViewIds.length > 0) {
          const selectedTemplates = getRoleTemplates(selectedRoleId).filter(template =>
            selectedDashboardViewTemplateIds.includes(template.id),
          );
          const viewIdsByGroup = new Map<DashboardViewGroup, string[]>();

          selectedTemplates.forEach((template, index) => {
            const viewId = installResult.resolvedViewIds[index];
            if (!viewId) return;
            const existing = viewIdsByGroup.get(template.group) || [];
            existing.push(viewId);
            viewIdsByGroup.set(template.group, existing);
          });

        for (const [group, viewIds] of viewIdsByGroup) {
          await ensureDashboardViewsInGroup({
            workspaceId,
              group,
              viewIds,
              preferredViewOrder: viewIds,
          });
        }
      }

      await markOnboardingCoreSetupCompleted(workspaceId);
      setStep('theme');
    } catch (err: any) {
        console.error('[TutorialOverlay] Failed to setup workspace or install founder views:', err);
        setWorkspaceCreationError(err?.message || 'Failed to finish workspace setup. Please try again.');
      } finally {
        setIsCreating(false);
      }
    };

    const toTitleCase = (str: string) => {
      return str
        .replace(/[-_]/g, ' ')
        .replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
    };

    // Wallpaper list static hardcoded to avoid duplicate bundle assets
    const wallpapers = [
      { id: 'none', label: 'None', src: '' },
      ...['car-race.png', 'Evermist.png', 'sky.png']
        .map(filename => {
          const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
          return {
            id: filename,
            label: filename === 'car-race.png' ? 'Car Race' : toTitleCase(nameWithoutExt),
            src: `AltS_search_newtab/images/wallappear/${filename}`,
          };
        })
        .sort((a, b) => {
          if (a.label === 'Default Wallpaper') return -1;
          if (b.label === 'Default Wallpaper') return 1;
          return a.label.localeCompare(b.label);
        }),
    ];

    // Temporarily disable 3rd step for everyone per user request
    const shouldShowOnboarding = false; // !isReturningUser;

    if (typeof window === 'undefined') return null;

    return createPortal(
      <div 
        className="cmdos-onboarding-root"
        style={step === 'theme' ? {
          '--color-rootBg': 'inherit',
          '--color-backgroundGradient': 'inherit',
          '--color-cardBg': 'inherit',
          '--color-textPrimary': 'inherit',
          '--color-textSecondary': 'inherit',
          '--color-textMuted': 'inherit',
          '--color-borderDefault': 'inherit',
          '--color-borderActive': 'inherit',
          '--color-hoverBg': 'inherit',
          '--color-selectedBg': 'inherit',
          '--color-tutorialCardBg': 'inherit',
          '--color-tutorialTextTitle': 'inherit',
          '--color-tutorialTextDescription': 'inherit',
          '--color-tutorialAccent': 'inherit',
          '--color-tutorialAccentMuted': 'inherit',
          '--color-widgetShadow': 'inherit',
          '--color-accent': 'inherit',
        } as React.CSSProperties : undefined}
      >
        <motion.div
          ref={ref}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            background: step === 'presentation' ? 'transparent' : (step === 'theme' ? 'var(--color-rootBg, #ffffff)' : '#ffffff'),
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
          }}
          className={`fixed inset-0 z-[9999] h-screen w-screen max-h-screen max-w-screen flex flex-col items-center justify-between font-sans select-none overflow-hidden ${
            step === 'presentation'
              ? 'p-0 text-slate-100'
              : step === 'dashboard_views'
                ? 'p-0 bg-white text-slate-900'
                : step === 'theme'
                  ? 'py-6 md:py-8 px-6 md:px-12 text-[var(--color-textPrimary)]'
                  : 'py-6 md:py-8 px-6 md:px-12 bg-white text-slate-900'
          }`}>
          <style>{scrollbarStyles}</style>
          <style>{styles}</style>

          <AnimatePresence mode="wait">
            {/* ── Step 1: Founder Dashboard Views ── */}
            {step === 'dashboard_views' && (
              <motion.div
                key="dashboard_views"
                ref={dashboardViewsStepRef}
                data-onboarding-step="dashboard_views"
                data-onboarding-width-mode={dashboardViewsLayout.widthMode}
                data-onboarding-height-mode={dashboardViewsLayout.heightMode}
                data-onboarding-card-density={dashboardViewsLayout.cardDensity}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full min-h-screen bg-white flex flex-col items-center justify-between overflow-y-auto"
                style={{
                  paddingLeft: dashboardViewsLayout.screen.paddingX,
                  paddingRight: dashboardViewsLayout.screen.paddingX,
                  paddingTop: dashboardViewsLayout.screen.paddingTop,
                  paddingBottom: dashboardViewsLayout.screen.paddingBottom,
                }}
                onClick={e => e.stopPropagation()}>
                <div
                  className="w-full flex justify-center"
                  style={{ paddingBottom: dashboardViewsLayout.stepCount.paddingBottom }}>
                  <OnboardingHeader currentStep={1} isLight stepCountLayout={dashboardViewsLayout.stepCount} />
                </div>

                <div
                  className="dashboard-views-step-body flex-1 w-full mx-auto flex justify-center"
                  style={{
                    maxWidth: dashboardViewsLayout.maxContentWidth,
                  }}>
                  <DashboardViewsOnboarding
                    maxContentWidth={dashboardViewsLayout.maxContentWidth}
                    titleLayout={dashboardViewsLayout.title}
                    roleCategoryLayout={dashboardViewsLayout.roleCategories}
                    dividerLayout={dashboardViewsLayout.divider}
                    templateCardsLayout={dashboardViewsLayout.templateCards}
                    roles={onboardingRoles}
                    selectedRoleId={selectedRoleId}
                    onRoleChange={handleRoleChange}
                    selectedTemplateIds={selectedDashboardViewTemplateIds}
                    onSelectionChange={newIds => {
                      setSelectedDashboardViewTemplateIds(newIds);
                      const activeTemplates = getDisplayedRoleTemplates(selectedRoleId);
                      const selectedCount = activeTemplates.filter(t => newIds.includes(t.id)).length;
                      setDashboardViewShortcutErrors(prev => {
                        const next = { ...prev };
                        if (selectedCount > 0) {
                          delete next._general;
                        } else {
                          next._general = 'Please select at least 1 workspace template.';
                        }
                        return next;
                      });
                    }}
                    shortcuts={dashboardViewShortcuts}
                    onShortcutChange={(templateId, val) => {
                      setDashboardViewShortcuts(prev => ({ ...prev, [templateId]: val }));
                      setDashboardViewShortcutErrors(prev => {
                        const next = { ...prev };
                        delete next[templateId];
                        return next;
                      });
                    }}
                    hotkeys={dashboardViewHotkeys}
                    onHotkeyChange={(templateId, val) => {
                      setDashboardViewHotkeys(prev => ({ ...prev, [templateId]: normalizeHotkeyString(val) }));
                      setDashboardViewHotkeyErrors(prev => {
                        const next = { ...prev };
                        delete next[templateId];
                        return next;
                      });
                    }}
                    validationErrors={dashboardViewShortcutErrors}
                    hotkeyValidationErrors={dashboardViewHotkeyErrors}
                    onContinue={async () => {
                      if (await validateSelectedDashboardViewBindings()) {
                        setStep('organization');
                      }
                    }}
                  />
                </div>

                <div className="w-full max-w-[1240px] mx-auto">
                  <OnboardingFooter currentStep={1} isLight />
                </div>
              </motion.div>
            )}

            {/* ── Step: Restore Options Screen ── */}
            {step === 'restore_options' && (
              <motion.div
                key="restore_options"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col items-center justify-between w-full max-w-[850px] max-h-full gap-4 md:gap-6"
                onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center gap-2">
                  <span
                    className="text-[12px] font-semibold tracking-wider uppercase"
                    style={{ color: 'var(--color-textMuted)' }}>
                    Restore Options
                  </span>
                </div>

                <div className="flex-grow flex flex-col justify-start items-center gap-6 mt-4 mb-auto w-full max-h-[75vh] overflow-y-auto tutorial-overlay-scroll px-2">
                  <div className="text-center max-w-[700px] flex flex-col gap-2">
                    <h1
                      className="text-lg md:text-2xl lg:text-3xl font-medium"
                      style={{ color: 'var(--color-tutorialTextTitle)' }}>
                      Select a <span style={{ color: 'var(--color-tutorialAccent)' }}>Restore Method</span>
                    </h1>
                    <p className="text-xs md:text-sm" style={{ color: 'var(--color-tutorialTextDescription)' }}>
                      Connect Google Drive or upload a previous backup file to restore.
                    </p>
                  </div>

                  {restoreError && (
                    <div className="w-full max-w-[620px] p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs text-left animate-pulse">
                      {restoreError}
                    </div>
                  )}

                  <div className="w-full max-w-[850px] grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Google Drive Block */}
                    <div
                      className="p-5 rounded-2xl border flex flex-col justify-between"
                      style={{
                        backgroundColor: 'var(--color-tutorialCardBg)',
                        borderColor: 'var(--color-borderDefault)',
                      }}>
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center border"
                              style={{
                                backgroundColor:
                                  driveStatus === 'connected' || driveStatus === 'listing'
                                    ? 'var(--color-tutorialAccentMuted)'
                                    : 'var(--color-hoverBg)',
                                borderColor:
                                  driveStatus === 'connected' || driveStatus === 'listing'
                                    ? 'var(--color-tutorialAccent)'
                                    : 'var(--color-borderDefault)',
                                color:
                                  driveStatus === 'connected' || driveStatus === 'listing'
                                    ? 'var(--color-tutorialAccent)'
                                    : 'var(--color-textMuted)',
                              }}>
                              <FiCloud size={18} />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold" style={{ color: 'var(--color-tutorialTextTitle)' }}>
                                Google Drive Backups
                              </h3>
                              <p
                                className="text-[11px] leading-tight"
                                style={{ color: 'var(--color-tutorialTextDescription)' }}>
                                Retrieve backups stored in your Drive
                              </p>
                            </div>
                          </div>

                          {/* Connect button or connected status */}
                          {driveStatus === 'disconnected' && (
                            <button
                              onClick={handleConnectDrive}
                              className="px-3.5 py-1.5 rounded-lg text-white text-xs font-bold transition-all shadow-md"
                              style={{ backgroundColor: 'var(--color-accent)' }}>
                              Connect Drive
                            </button>
                          )}
                          {driveStatus === 'connecting' && (
                            <div
                              className="flex items-center gap-1.5 text-xs"
                              style={{ color: 'var(--color-textMuted)' }}>
                              <FiRefreshCw className="animate-spin" size={12} />
                              Connecting...
                            </div>
                          )}
                          {driveStatus === 'connected' && (
                            <span
                              className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: 'var(--color-tutorialAccentMuted)',
                                color: 'var(--color-tutorialAccent)',
                                borderColor: 'var(--color-borderDefault)',
                              }}>
                              Connected
                            </span>
                          )}
                        </div>

                        {driveEmail && (
                          <div
                            className="text-[11px] font-mono px-3 py-1.5 rounded-lg w-fit mb-4 border"
                            style={{
                              backgroundColor: 'var(--color-hoverBg)',
                              borderColor: 'var(--color-borderDefault)',
                              color: 'var(--color-textMuted)',
                            }}>
                            Account:{' '}
                            <span className="font-semibold" style={{ color: 'var(--color-tutorialTextTitle)' }}>
                              {driveEmail}
                            </span>
                          </div>
                        )}
                      </div>

                      {driveStatus === 'connected' && (
                        <div
                          className="space-y-2 border-t pt-4 mt-auto"
                          style={{ borderColor: 'var(--color-borderDefault)' }}>
                          <div className="flex justify-between items-center mb-1">
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider"
                              style={{ color: 'var(--color-textMuted)' }}>
                              Available Backups ({driveBackups.length})
                            </span>
                            <button
                              onClick={() => loadDriveBackups(true)}
                              className="text-[10px] hover:underline flex items-center gap-1"
                              style={{ color: 'var(--color-tutorialAccent)' }}>
                              <FiRefreshCw size={10} className={loadingDriveBackups ? 'animate-spin' : ''} /> Refresh
                            </button>
                          </div>

                          {loadingDriveBackups && (
                            <div
                              className="flex items-center justify-center py-6 text-xs gap-2"
                              style={{ color: 'var(--color-textMuted)' }}>
                              <FiRefreshCw className="animate-spin" size={14} /> Loading Drive files...
                            </div>
                          )}

                          {!loadingDriveBackups && driveBackups.length === 0 && (
                            <p className="text-xs text-center py-4 italic" style={{ color: 'var(--color-textMuted)' }}>
                              No backups found in your Google Drive.
                            </p>
                          )}

                          {!loadingDriveBackups && driveBackups.length > 0 && (
                            <div className="space-y-2 max-h-[160px] overflow-y-auto tutorial-overlay-scroll pr-1">
                              {driveBackups.map(file => {
                                const date = new Date(file.createdTime).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                });
                                const time = new Date(file.createdTime).toLocaleTimeString(undefined, {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                });
                                const size = file.manifest?.estimatedPayloadBytes
                                  ? formatBackupPayloadSize(file.manifest.estimatedPayloadBytes)
                                  : '';
                                const isRestoringThis = restoringFileId === file.id;

                                return (
                                  <div
                                    key={file.id}
                                    className="flex justify-between items-center p-2.5 rounded-xl border transition-all"
                                    style={{
                                      backgroundColor: 'var(--color-hoverBg)',
                                      borderColor: 'var(--color-borderDefault)',
                                    }}>
                                    <div className="min-w-0">
                                      <p
                                        className="text-xs font-semibold truncate max-w-[180px]"
                                        style={{ color: 'var(--color-tutorialTextTitle)' }}>
                                        {file.name}
                                      </p>
                                      <p
                                        className="text-[10px] font-mono mt-0.5"
                                        style={{ color: 'var(--color-textMuted)' }}>
                                        {date} · {time} {size && `· ${size}`}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => handleDriveRestore(file.id)}
                                      disabled={isRestoring}
                                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                                      style={{
                                        backgroundColor: 'var(--color-tutorialAccentMuted)',
                                        color: 'var(--color-tutorialAccent)',
                                      }}>
                                      {isRestoringThis ? (
                                        <FiRefreshCw className="animate-spin" size={12} />
                                      ) : (
                                        <FiUpload size={12} />
                                      )}
                                      Restore
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Local Backup Block */}
                    <div
                      className="p-5 rounded-2xl border flex flex-col justify-between"
                      style={{
                        backgroundColor: 'var(--color-tutorialCardBg)',
                        borderColor: 'var(--color-borderDefault)',
                      }}>
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0"
                            style={{
                              backgroundColor: 'var(--color-hoverBg)',
                              borderColor: 'var(--color-borderDefault)',
                              color: 'var(--color-textMuted)',
                            }}>
                            <FiDatabase size={18} />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold" style={{ color: 'var(--color-tutorialTextTitle)' }}>
                              Restore from Local File
                            </h3>
                            <p
                              className="text-[11px] leading-tight"
                              style={{ color: 'var(--color-tutorialTextDescription)' }}>
                              Upload a .zip backup file from your computer
                            </p>
                          </div>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--color-textMuted)' }}>
                          If you have previously exported a local backup, you can restore your entire workspace directly
                          from your computer without connecting to Google Drive.
                        </p>
                      </div>

                      <div
                        className="mt-6 border-t pt-4 flex justify-end"
                        style={{ borderColor: 'var(--color-borderDefault)' }}>
                        <input
                          type="file"
                          accept=".zip"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isRestoring}
                          className="px-4 py-2 w-full justify-center rounded-lg border text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                          style={{
                            borderColor: 'var(--color-borderDefault)',
                            backgroundColor: 'var(--color-hoverBg)',
                            color: 'var(--color-tutorialTextTitle)',
                          }}>
                          {isRestoring ? <FiLoader className="animate-spin" size={14} /> : <FiUpload size={14} />}
                          Upload File
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Navigation */}
                <div className="relative flex items-center justify-between w-full mt-auto h-12">
                  <button
                    disabled={isRestoring}
                    onClick={() => setStep('organization')}
                    className="flex items-center gap-2 font-semibold text-xs md:text-sm transition-colors px-4 py-2 disabled:opacity-50"
                    style={{ color: 'var(--color-textMuted)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-tutorialTextTitle)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-textMuted)')}>
                    <FaChevronLeft size={12} /> Back
                  </button>

                  <button
                    disabled={isRestoring}
                    onClick={() => setStep('theme')}
                    className="text-xs md:text-sm font-semibold transition-colors px-4 py-2 disabled:opacity-50"
                    style={{ color: 'var(--color-textMuted)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-tutorialTextTitle)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-textMuted)')}>
                    Skip for Now
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step: Restore Success Screen ── */}
            {step === 'restore_success' && (
              <motion.div
                key="restore_success"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col items-center justify-between w-full max-w-[650px] max-h-full gap-6 p-6"
                onClick={e => e.stopPropagation()}>
                <div className="flex-grow flex flex-col justify-center items-center gap-6 my-auto text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center">
                    <FaCheck size={24} />
                  </div>

                  <div className="space-y-2">
                    <h1 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--color-tutorialTextTitle)' }}>
                      Restore Successful!
                    </h1>
                    <p className="text-xs max-w-sm mx-auto" style={{ color: 'var(--color-tutorialTextDescription)' }}>
                      All your settings, shortcuts, hotkeys, and data have been recovered.
                    </p>
                  </div>

                  {restoredSummary && (
                    <div
                      className="w-full max-w-sm rounded-2xl border p-4 text-left space-y-2 mt-2"
                      style={{
                        backgroundColor: 'var(--color-tutorialCardBg)',
                        borderColor: 'var(--color-borderDefault)',
                      }}>
                      <h3
                        className="text-[10px] font-bold uppercase tracking-wider mb-2"
                        style={{ color: 'var(--color-textMuted)' }}>
                        Restored Summary
                      </h3>

                      <div
                        className="flex justify-between items-center text-xs border-b py-1.5"
                        style={{ borderColor: 'var(--color-borderDefault)' }}>
                        <span
                          className="flex items-center gap-1.5"
                          style={{ color: 'var(--color-tutorialTextDescription)' }}>
                          <FiHardDrive size={12} /> Organizations
                        </span>
                        <span className="font-bold" style={{ color: 'var(--color-tutorialTextTitle)' }}>
                          {restoredSummary.organizationCount}
                        </span>
                      </div>

                      <div
                        className="flex justify-between items-center text-xs border-b py-1.5"
                        style={{ borderColor: 'var(--color-borderDefault)' }}>
                        <span
                          className="flex items-center gap-1.5"
                          style={{ color: 'var(--color-tutorialTextDescription)' }}>
                          <FiFolder size={12} /> Workspaces
                        </span>
                        <span className="font-bold" style={{ color: 'var(--color-tutorialTextTitle)' }}>
                          {restoredSummary.workspaceCount}
                        </span>
                      </div>

                      <div
                        className="flex justify-between items-center text-xs border-b py-1.5"
                        style={{ borderColor: 'var(--color-borderDefault)' }}>
                        <span
                          className="flex items-center gap-1.5"
                          style={{ color: 'var(--color-tutorialTextDescription)' }}>
                          <FiDatabase size={12} /> Snippets & Todos
                        </span>
                        <span className="font-bold" style={{ color: 'var(--color-tutorialTextTitle)' }}>
                          {restoredSummary.snippetCount + restoredSummary.todoCount}
                        </span>
                      </div>

                      {restoredSummary.favoritesCount > 0 && (
                        <div
                          className="flex justify-between items-center text-xs border-b py-1.5"
                          style={{ borderColor: 'var(--color-borderDefault)' }}>
                          <span
                            className="flex items-center gap-1.5"
                            style={{ color: 'var(--color-tutorialTextDescription)' }}>
                            ★ Favorites
                          </span>
                          <span className="font-bold" style={{ color: 'var(--color-tutorialTextTitle)' }}>
                            {restoredSummary.favoritesCount}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="w-full flex justify-center mt-auto">
                  <button
                    onClick={() => setStep('theme')}
                    className="w-full max-w-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-full text-sm font-semibold transition-all shadow-lg shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98]">
                    Next →
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Organization selection / Create Workspace ── */}
            {step === 'organization' && (
              <motion.div
                key="organization"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col items-center justify-between w-full h-full max-h-full relative"
                onClick={e => e.stopPropagation()}>
                <OnboardingHeader currentStep={2} />

                {/* Centered Form Layout with a card-like container */}
                <div className="onboarding-body">
                  <div className="onboarding-standard-content flex flex-col items-center justify-center">
                    {/* Card container with a thin border */}
                    <div
                      className="w-full rounded-2xl p-6 flex flex-col ob-fluid-gap-container border"
                      style={{
                        backgroundColor: 'var(--color-tutorialCardBg)',
                        borderColor: 'var(--color-borderDefault)',
                        boxShadow: '0 18px 44px var(--color-widgetShadow, rgba(0, 0, 0, 0.22))',
                      }}>
                      <div className="text-center space-y-1.5">
                        <h2
                          className="ob-fluid-h1 font-semibold tracking-tight"
                          style={{ color: 'var(--color-tutorialTextTitle)' }}>
                          Create a{' '}
                          <span
                            className="text-transparent bg-clip-text"
                            style={{
                              backgroundImage:
                                'linear-gradient(to right, var(--color-tutorialTextGradientStart), var(--color-tutorialTextGradientEnd))',
                            }}>
                            Workspace
                          </span>
                        </h2>
                      </div>

                      {/* Workspace Name Input (reduced width and centered) */}
                      <div className="space-y-1.5 text-left w-full ob-fluid-input-container mx-auto">
                        <label
                          htmlFor="onboarding-workspace-name"
                          className="ob-fluid-note-text font-bold text-[var(--color-tutorialTextDescription)] tracking-wider uppercase block text-left">
                          Workspace Name <span className="text-[var(--color-danger)] font-normal ml-0.5">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <input
                            id="onboarding-workspace-name"
                            type="text"
                            value={orgName}
                            onChange={e => setOrgName(e.target.value)}
                            placeholder="John Doe"
                            className="ob-fluid-input w-full pl-4 pr-[130px] bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] rounded-xl text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder)] outline-none focus:border-[var(--color-borderActive)] focus:ring-1 focus:ring-[var(--color-focusRing)] transition-all font-medium shadow-inner"
                          />
                          <div className="absolute right-3 flex items-center gap-1.5 text-[10px] text-[var(--color-textMuted)] font-medium select-none pointer-events-none">
                            <FiLock size={10} />
                            <span>Private • Stored locally</span>
                          </div>
                        </div>
                      </div>

                      {workspaceCreationError && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center flex flex-col gap-2 mx-auto w-full">
                          <span>{workspaceCreationError}</span>
                          <button
                            onClick={handleCreateOrgAndWorkspace}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold w-fit mx-auto cursor-pointer">
                            Retry Setup
                          </button>
                        </div>
                      )}

                      {/* Create Workspace CTA Button (Reduced width & centered) */}
                      <button
                        disabled={isCreating}
                        onClick={handleCreateOrgAndWorkspace}
                        className="w-fit mx-auto px-6 flex items-center justify-center gap-2 py-2 ob-fluid-feature-text font-bold text-white rounded-xl transition-all active:scale-[0.98] shadow-lg disabled:opacity-75 cursor-pointer mt-1"
                        style={{
                          backgroundImage:
                            'linear-gradient(to right, var(--color-tutorialTextGradientStart), var(--color-tutorialTextGradientEnd))',
                          boxShadow: '0 10px 28px var(--color-tutorialAccentMuted)',
                        }}>
                        {isCreating ? (
                          <>
                            <FiLoader className="animate-spin" /> Creating...
                          </>
                        ) : (
                          <>
                            Create Workspace <FaChevronRight size={9} className="ml-1" />
                          </>
                        )}
                      </button>

                      {/* Trust Badges - aligned bottom under the form layout inside the card */}
                      <div className="grid grid-cols-3 gap-0 mt-2 select-none w-full pt-5 border-t border-[var(--color-borderDefault)] divide-x divide-[var(--color-borderDefault)]">
                        {/* Column 1 */}
                        <div className="flex items-start gap-2.5 px-4">
                          <div className="w-7 h-7 rounded-full bg-[var(--color-tutorialAccentMuted)] text-[var(--color-tutorialAccent)] flex items-center justify-center shrink-0 mt-0.5 border border-[var(--color-borderDefault)]">
                            <FaShieldHalved size={11} />
                          </div>
                          <div className="flex flex-col text-left">
                            <strong className="text-[var(--color-tutorialTextTitle)] font-semibold text-[10.5px] md:text-[11.5px] tracking-wide">
                              Local-first
                            </strong>
                            <span className="text-[9.5px] md:text-[10.5px] text-[var(--color-tutorialTextDescription)] mt-0.5">
                              All your data is stored{' '}
                              <span className="text-[var(--color-tutorialTextTitle)] font-medium">
                                locally on your device.
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Column 2 */}
                        <div className="flex items-start gap-2.5 px-4">
                          <div className="w-7 h-7 rounded-full bg-[var(--color-tutorialAccentMuted)] text-[var(--color-tutorialAccent)] flex items-center justify-center shrink-0 mt-0.5 border border-[var(--color-borderDefault)]">
                            <FiCloud size={12} />
                          </div>
                          <div className="flex flex-col text-left">
                            <strong className="text-[var(--color-tutorialTextTitle)] font-semibold text-[10.5px] md:text-[11.5px] tracking-wide">
                              Optional backup
                            </strong>
                            <span className="text-[9.5px] md:text-[10.5px] text-[var(--color-tutorialTextDescription)] font-medium mt-0.5">
                              Connect to Drive anytime
                            </span>
                          </div>
                        </div>

                        {/* Column 3 */}
                        <div className="flex items-start gap-2.5 px-4">
                          <div className="w-7 h-7 rounded-full bg-[var(--color-tutorialAccentMuted)] text-[var(--color-tutorialAccent)] flex items-center justify-center shrink-0 mt-0.5 border border-[var(--color-borderDefault)]">
                            <FiCode size={12} />
                          </div>
                          <div className="flex flex-col text-left">
                            <strong className="text-[var(--color-tutorialTextTitle)] font-semibold text-[10.5px] md:text-[11.5px] tracking-wide">
                              Open source
                            </strong>
                            <span className="text-[9.5px] md:text-[10.5px] text-[var(--color-tutorialTextDescription)] mt-0.5">
                              Built with community love ❤️
                            </span>
                            <a
                              href="https://github.com/cmdOS-App/cmdOS"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--color-tutorialAccent)] hover:text-[var(--color-tutorialTextTitle)] font-medium flex items-center justify-start gap-1.5 mt-1 transition-colors cursor-pointer text-[9.5px]">
                              <FaGithub size={10} className="mb-[0.5px] opacity-80" /> Explore source code{' '}
                              <FiArrowUpRight size={9} />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <OnboardingFooter currentStep={2} onBack={() => setStep('dashboard_views')} />
              </motion.div>
            )}

            {/* ── Step 4: Theme & Wallpaper Selection ── */}
            {step === 'theme' && (
              <motion.div
                key="theme"
                ref={themeStepRef}
                data-onboarding-step="theme"
                data-onboarding-width-mode={themeLayout.widthMode}
                data-onboarding-height-mode={themeLayout.heightMode}
                data-onboarding-card-density={themeLayout.cardDensity}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col items-center justify-between w-full h-full max-h-full"
                onClick={e => e.stopPropagation()}>
                <div
                  className="w-full flex justify-center"
                  style={{ paddingBottom: themeLayout.stepCount.paddingBottom }}>
                  <OnboardingHeader currentStep={3} stepCountLayout={themeLayout.stepCount} />
                </div>

                {/* Theme & Wallpaper Customization Content */}
                <div
                  className="onboarding-body"
                  style={{
                    paddingLeft: themeLayout.screen.paddingX,
                    paddingRight: themeLayout.screen.paddingX,
                    paddingTop: themeLayout.screen.paddingTop,
                    paddingBottom: themeLayout.screen.paddingBottom,
                  }}>
                  <div
                    className="flex flex-col items-center justify-center text-center"
                    style={{
                      width: '100%',
                      maxWidth: themeLayout.contentMaxWidth,
                      gap: themeLayout.contentGap,
                    }}>
                    <div className="text-center w-full flex flex-col" style={{ gap: themeLayout.headerGap }}>
                      <h1
                        className="m-0"
                        style={{
                          color: 'var(--color-tutorialTextTitle)',
                          fontSize: themeLayout.titleFontSize,
                          lineHeight: themeLayout.titleLineHeight,
                          fontWeight: themeLayout.titleFontWeight,
                        }}>
                        Customize <span style={{ color: 'var(--color-tutorialAccent)' }}>Appearance</span>
                      </h1>
                      <p
                        className="m-0"
                        style={{
                          color: 'var(--color-tutorialTextDescription)',
                          fontSize: themeLayout.subtitleFontSize,
                          lineHeight: themeLayout.subtitleLineHeight,
                        }}>
                        Personalize your cmdOS experience by picking a theme profile.
                      </p>
                    </div>

                    <div
                      className="w-full text-left"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: themeLayout.sectionGap,
                      }}>
                      {/* Main Themes Header */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: themeLayout.sectionGap,
                        }}>
                        <h2
                          className="m-0 text-left"
                          style={{
                            color: 'var(--color-tutorialTextTitle)',
                            fontSize: themeLayout.sectionTitleFontSize,
                            fontWeight: themeLayout.sectionTitleFontWeight,
                            letterSpacing: '0.05em',
                          }}>
                          Themes
                        </h2>

                        {/* Dark Theme Selection Row */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: themeLayout.groupGap,
                          }}>
                          <h3
                            className="m-0 text-left"
                            style={{
                              color: 'var(--color-textMuted)',
                              fontSize: themeLayout.groupTitleFontSize,
                              fontWeight: themeLayout.groupTitleFontWeight,
                              letterSpacing: '0.05em',
                            }}>
                            Dark
                          </h3>
                          <div
                            className="grid justify-items-start"
                            style={{
                              gridTemplateColumns: `repeat(${themeLayout.gridColumns}, minmax(0, 1fr))`,
                              gap: themeLayout.gridGap,
                              width: '100%',
                            }}>
                            {THEME_FAMILIES.map(family => {
                              const id = family.darkId;
                              const isSelected = themeId === id;
                              return (
                                <motion.div
                                  key={id}
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`Select ${family.name} dark theme`}
                                  aria-pressed={isSelected}
                                  whileHover={{ scale: 1.03, y: -2 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => {
                                    setThemeProfile(id);
                                    setWallpaper('none');
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setThemeProfile(id);
                                      setWallpaper('none');
                                    }
                                  }}
                                  className={`cursor-pointer border transition-all relative overflow-hidden shadow-lg ${
                                    isSelected
                                      ? 'shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                                      : 'hover:border-[var(--color-borderActive)]'
                                  }`}
                                  style={{
                                    background: family.darkGradient,
                                    borderColor: isSelected ? 'rgb(16, 185, 129)' : 'var(--color-borderDefault)',
                                    width: themeLayout.itemWidth,
                                    height: themeLayout.itemHeight,
                                    borderRadius: themeLayout.itemRadius,
                                  }}>
                                  {/* Subtle inner border */}
                                  <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none" />

                                  {/* Mini scattered dot pattern preview overlay */}
                                  <svg
                                    className="absolute inset-0 w-full h-full pointer-events-none opacity-50"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden="true">
                                    <circle cx="22" cy="15" r="0.9" fill="#FFF" opacity="0.45" />
                                    <circle cx="75" cy="12" r="1.1" fill="#F4F7FA" opacity="0.55" />
                                    <circle cx="125" cy="22" r="0.8" fill="#FFF" opacity="0.35" />
                                    <circle cx="45" cy="48" r="1.0" fill="#E5EDF7" opacity="0.35" />
                                    <circle cx="105" cy="55" r="0.7" fill="#FFF" opacity="0.35" />
                                  </svg>

                                  {/* Active Indicator Checkmark */}
                                  {isSelected && (
                                    <div
                                      className="absolute rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10 animate-in zoom-in-50 duration-150"
                                      style={{
                                        top: themeLayout.selectedBadgeOffset,
                                        right: themeLayout.selectedBadgeOffset,
                                        width: themeLayout.selectedBadgeSize,
                                        height: themeLayout.selectedBadgeSize,
                                      }}>
                                      <FaCheck size={themeLayout.selectedBadgeIconSize} />
                                    </div>
                                  )}

                                  {/* Name Pill */}
                                  <div
                                    className="absolute bg-black/60 backdrop-blur-md border border-white/10 z-10 select-none"
                                    style={{
                                      bottom: themeLayout.namePillOffset,
                                      left: themeLayout.namePillOffset,
                                      paddingLeft: themeLayout.namePillPaddingX,
                                      paddingRight: themeLayout.namePillPaddingX,
                                      paddingTop: themeLayout.namePillPaddingY,
                                      paddingBottom: themeLayout.namePillPaddingY,
                                      borderRadius: themeLayout.namePillRadius,
                                    }}>
                                    <span
                                      className="text-white tracking-wide"
                                      style={{
                                        fontSize: themeLayout.nameFontSize,
                                        fontWeight: themeLayout.nameFontWeight,
                                      }}>
                                      {family.name}
                                    </span>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Light Theme Selection Row */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: themeLayout.groupGap,
                          }}>
                          <h3
                            className="m-0 text-left"
                            style={{
                              color: 'var(--color-textMuted)',
                              fontSize: themeLayout.groupTitleFontSize,
                              fontWeight: themeLayout.groupTitleFontWeight,
                              letterSpacing: '0.05em',
                            }}>
                            Light
                          </h3>
                          <div
                            className="grid justify-items-start"
                            style={{
                              gridTemplateColumns: `repeat(${themeLayout.gridColumns}, minmax(0, 1fr))`,
                              gap: themeLayout.gridGap,
                              width: '100%',
                            }}>
                            {THEME_FAMILIES.filter(family => family.hasLightVariant !== false && family.lightId).map(
                              family => {
                                const id = family.lightId!;
                                const isSelected = themeId === id;
                                return (
                                  <motion.div
                                    key={id}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Select ${family.name} light theme`}
                                    aria-pressed={isSelected}
                                    whileHover={{ scale: 1.03, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                      setThemeProfile(id);
                                      setWallpaper('none');
                                    }}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setThemeProfile(id);
                                        setWallpaper('none');
                                      }
                                    }}
                                    className={`cursor-pointer border transition-all relative overflow-hidden shadow-lg ${
                                      isSelected
                                        ? 'shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                                        : 'hover:border-[var(--color-borderActive)]'
                                    }`}
                                    style={{
                                      background: family.lightGradient,
                                      borderColor: isSelected ? 'rgb(16, 185, 129)' : 'var(--color-borderDefault)',
                                      width: themeLayout.itemWidth,
                                      height: themeLayout.itemHeight,
                                      borderRadius: themeLayout.itemRadius,
                                    }}>
                                    {/* Subtle inner border */}
                                    <div className="absolute inset-0 border border-black/5 rounded-xl pointer-events-none" />

                                    {/* Active Indicator Checkmark */}
                                    {isSelected && (
                                      <div
                                        className="absolute rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10 animate-in zoom-in-50 duration-150"
                                        style={{
                                          top: themeLayout.selectedBadgeOffset,
                                          right: themeLayout.selectedBadgeOffset,
                                          width: themeLayout.selectedBadgeSize,
                                          height: themeLayout.selectedBadgeSize,
                                        }}>
                                        <FaCheck size={themeLayout.selectedBadgeIconSize} />
                                      </div>
                                    )}

                                    {/* Name Pill */}
                                    <div
                                      className="absolute bg-white/70 backdrop-blur-md border border-black/10 z-10 select-none"
                                      style={{
                                        bottom: themeLayout.namePillOffset,
                                        left: themeLayout.namePillOffset,
                                        paddingLeft: themeLayout.namePillPaddingX,
                                        paddingRight: themeLayout.namePillPaddingX,
                                        paddingTop: themeLayout.namePillPaddingY,
                                        paddingBottom: themeLayout.namePillPaddingY,
                                        borderRadius: themeLayout.namePillRadius,
                                      }}>
                                      <span
                                        className="tracking-wide"
                                        style={{
                                          color: '#0f172a',
                                          fontSize: themeLayout.nameFontSize,
                                          fontWeight: themeLayout.nameFontWeight,
                                        }}>
                                        {family.name}
                                      </span>
                                    </div>
                                  </motion.div>
                                );
                              },
                            )}
                          </div>
                        </div>
                      </div>


                    </div>
                  </div>
                </div>

                <OnboardingFooter
                  currentStep={3}
                  onBack={() => setStep('organization')}
                  onNext={() => setStep('presentation')}
                />
              </motion.div>
            )}

            {/* ── Step 4: Onboarding setup ── */}
            {shouldShowOnboarding && step === 'onboarding' && (
              <motion.div
                key="onboarding"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="tutorial-overlay-scroll w-[900px] h-auto min-h-[380px] rounded-[32px] flex flex-col shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] cursor-default relative overflow-hidden bg-[var(--color-tutorialCardBg)] border border-[var(--color-borderDefault)] text-[var(--color-textPrimary)]"
                style={{ zoom: 1.25 }}
                onClick={e => e.stopPropagation()}>
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-5 right-5 p-2 rounded-full hover:bg-red-500/10 text-[var(--color-textMuted)] hover:text-red-400 transition-colors z-10"
                  title="Close">
                  <FaTimes size={20} />
                </button>

                <div className="absolute top-5 left-10 z-10">
                  <span className="text-[14px] font-bold text-[var(--color-textMuted)] tabular-nums">Step 3/3</span>
                </div>

                <OnboardingManager onFinish={onClose} isLoggedIn={isLoggedIn} />
              </motion.div>
            )}

            {/* ── Step 5: Presentation Card ── */}
            {step === 'presentation' && (
              <motion.div
                key="presentation"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="absolute inset-0 z-[100000] h-screen w-screen flex flex-col items-center justify-start overflow-hidden bg-transparent"
                onClick={e => e.stopPropagation()}>
                <FeaturePresentationCard
                  onClose={onClose}
                  onBack={isReturningUser || initialStep === 'presentation' ? undefined : () => setStep('theme')}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        {step === 'dashboard_views' && (
          <div
            className="fixed z-[10000]"
            style={{
              right: dashboardViewsLayout.screen.paddingX,
              bottom: dashboardViewsLayout.screen.paddingBottom,
            }}>
            <OnboardingNextButton
              onClick={async () => {
                if (await validateSelectedDashboardViewBindings()) {
                  setStep('organization');
                }
              }}
              disabled={
                getDisplayedRoleTemplates(selectedRoleId).filter(template =>
                  selectedDashboardViewTemplateIds.includes(template.id),
                ).length === 0
              }
              isLight
            />
          </div>
        )}
      </div>,
      document.body,
    );
  },
);

export default OnboardingCards;
