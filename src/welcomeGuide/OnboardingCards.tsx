'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { FaChevronRight, FaMoon, FaCheck, FaUsers, FaClock, FaRocket, FaChevronLeft, FaKeyboard, FaLink, FaTrash, FaExpand, FaCompress, FaShieldHalved } from 'react-icons/fa6';
import { FaTimes, FaPlus, FaChevronDown, FaArrowRight, FaPlusSquare, FaGithub } from 'react-icons/fa';
import { useDispatch } from 'react-redux';

import { FeaturePresentationCard } from './featurePresentationCard';
import { useAppearance } from '@extension/ui';
import { useDbStore } from '../storage/store/useDbStore';
import { createWorkspace } from '../settings/allWorkspaceManager/workspaces/workspaceData';
import { FiLoader, FiCloud, FiUpload, FiDatabase, FiFolder, FiHardDrive, FiRefreshCw, FiLayers, FiZap, FiInfo, FiLock, FiCode, FiArrowUpRight } from 'react-icons/fi';
import { StorageManager } from '../storage/localStorage/storageManager';
import { 
  getDriveToken, 
  listBackupsFromDrive, 
  downloadBackupFromDrive 
} from '../settings/backup/logic/driveApi';
import { restoreDatabaseFromJSON } from '../settings/backup/logic/restoreData';
import JSZip from 'jszip';

const computeBackupSummary = (backupData: any) => ({
  organizationCount: 0,
  workspaceCount: backupData?.manifest?.tableCounts?.workspaces || 0,
  snippetCount: backupData?.manifest?.tableCounts?.snippets || 0,
  todoCount: backupData?.manifest?.tableCounts?.todos || 0,
  favoritesCount: backupData?.manifest?.tableCounts?.favorites || 0
});

import clsx from 'clsx';
import { getFaviconUrl } from '../shared-components/searchBarMain/utilityFunctions/utils';
import type { CommandDefinition } from '../shared-components/searchBarMain/commandConfigurations/commands';
import { COMMANDS, AI_GROUP } from '../shared-components/searchBarMain/commandConfigurations/commands';

import { saveHotkey as apiSaveHotkey } from '../shared-components/hotkeys';

import { getUserId, CMDOS_SIGN_UP_URL, checkHasCloudData } from '../storage/API/core/api';
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
  
  .ob-onboarding-container {
    font-family: 'Sora', sans-serif;
    color: #1e293b;
    -webkit-font-smoothing: antialiased;
  }

  .ob-sheet-container {
    background: #ffffff;
    border: 1px solid #e1e1e1;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
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
    margin-left: auto;
    margin-right: auto;
  }

  .onboarding-body {
    min-height: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: clamp(24px, 4vh, 56px) 20px;
    width: 100%;
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

  .ob-theme-item {
    width: clamp(160px, 12vw, 220px) !important;
    height: clamp(95px, 7vw, 125px) !important;
  }

  .ob-wallpaper-item {
    width: clamp(140px, 10.5vw, 185px) !important;
    height: clamp(85px, 6.2vw, 115px) !important;
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
    dispatch
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
              {flatRows.map((row) => {
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
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }
  .tutorial-overlay-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

interface OnboardingCardsProps {
  onClose: () => void;
  isLoggedIn?: boolean;
  isReturningUser?: boolean;
  initialStep?: Step;
}

type Step = 'quote' | 'get_started' | 'theme' | 'organization' | 'onboarding' | 'restore_options' | 'restore_success' | 'cloud_migration_onboarding' | 'presentation';

const OnboardingHeader: React.FC<{ currentStep: number }> = ({ currentStep }) => {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[12px] font-semibold tracking-wider text-neutral-500 uppercase">
        Step {currentStep} of 4
      </span>
      <div className="flex gap-1.5 w-32">
        <div className={`h-1 flex-1 rounded-full ${currentStep >= 1 ? 'bg-[#5f5eff]' : 'bg-neutral-800'}`}></div>
        <div className={`h-1 flex-1 rounded-full ${currentStep >= 2 ? 'bg-[#5f5eff]' : 'bg-neutral-800'}`}></div>
        <div className={`h-1 flex-1 rounded-full ${currentStep >= 3 ? 'bg-[#5f5eff]' : 'bg-neutral-800'}`}></div>
        <div className={`h-1 flex-1 rounded-full ${currentStep >= 4 ? 'bg-[#5f5eff]' : 'bg-neutral-800'}`}></div>
      </div>
    </div>
  );
};

interface OnboardingFooterProps {
  currentStep: number;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  isNextDisabled?: boolean;
}

const OnboardingFooter: React.FC<OnboardingFooterProps> = ({
  currentStep,
  onBack,
  onNext,
  nextLabel = 'Next →',
  isNextDisabled
}) => {
  const { theme } = useAppearance();
  const isDark = theme.isDark;
  return (
    <div className="relative flex items-center justify-between w-full mt-auto h-12">
      {/* Left Back Button */}
      {onBack ? (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-neutral-500 hover:text-neutral-300 font-semibold text-xs md:text-sm transition-colors px-4 py-2"
        >
          <FaChevronLeft size={12} /> Back
        </button>
      ) : (
        <div className="w-16"></div>
      )}

      {/* Center Progress Dots */}
      <div className="absolute left-1/2 transform -translate-x-1/2 flex gap-2">
        <span className={`w-2 h-2 rounded-full ${currentStep === 1 ? 'bg-[#8b5cf6]' : 'bg-neutral-800'}`}></span>
        <span className={`w-2 h-2 rounded-full ${currentStep === 2 ? 'bg-[#8b5cf6]' : 'bg-neutral-800'}`}></span>
        <span className={`w-2 h-2 rounded-full ${currentStep === 3 ? 'bg-[#8b5cf6]' : 'bg-neutral-800'}`}></span>
        <span className={`w-2 h-2 rounded-full ${currentStep === 4 ? 'bg-[#8b5cf6]' : 'bg-neutral-800'}`}></span>
      </div>

      {/* Right Next Button */}
      {onNext ? (
        <button
          onClick={onNext}
          disabled={isNextDisabled}
          className="flex items-center gap-2 bg-[#5f5eff] hover:bg-[#5f5eff]/95 text-white px-5 py-2 rounded-full text-xs md:text-sm font-semibold transition-all shadow-lg shadow-[#5f5eff]/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          {nextLabel}
        </button>
      ) : (
        <div className="w-16"></div>
      )}
    </div>
  );
};

const OnboardingCards = React.forwardRef<HTMLDivElement, OnboardingCardsProps>(({ onClose, isLoggedIn, isReturningUser, initialStep }, ref) => {
  const [step, setStep] = useState<Step>(initialStep ?? 'quote');
  const dispatch = useDispatch();
  const { themeId, setTheme: setThemeProfile, wallpaperId, setWallpaper } = useAppearance();

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
  const [driveStatus, setDriveStatus] = useState<'checking' | 'disconnected' | 'connected' | 'connecting' | 'listing'>('disconnected');
  const [driveEmail, setDriveEmail] = useState<string>('');
  const [driveBackups, setDriveBackups] = useState<any[]>([]);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [restoringFileId, setRestoringFileId] = useState<string | null>(null);
  const [loadingDriveBackups, setLoadingDriveBackups] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Google Drive: check connection on mount
  React.useEffect(() => {
    chrome.identity.getAuthToken({ interactive: false }, async (token) => {
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
      const zip = new JSZip();
      const unzipped = await zip.loadAsync(file);
      
      const backupData: any = {
        manifest: null,
        tables: {}
      };

      const manifestFile = unzipped.file('manifest.json');
      if (!manifestFile) throw new Error('Invalid backup ZIP: missing manifest.json');
      backupData.manifest = JSON.parse(await manifestFile.async('string'));

      for (const relativePath of Object.keys(unzipped.files)) {
        if (relativePath.endsWith('.json') && relativePath !== 'manifest.json') {
          const tableName = relativePath.replace('.json', '');
          const tableContent = await unzipped.file(relativePath)?.async('string');
          if (tableContent) {
            backupData.tables[tableName] = JSON.parse(tableContent);
          }
        }
      }

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

  React.useEffect(() => {
    StorageManager.getItem(['localOrganizations', 'accessToken']).then((res) => {
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
    try {
      const finalWorkspaceName = orgName.trim() || 'Personal Workspace';
      await createWorkspace(finalWorkspaceName);
    } catch (err) {
      console.error('[TutorialOverlay] Failed to setup workspace:', err);
    } finally {
      setIsCreating(false);
      setStep('presentation');
    }
  };

  const toTitleCase = (str: string) => {
    return str
      .replace(/[-_]/g, ' ')
      .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
  };

  // Wallpaper list static hardcoded to avoid duplicate bundle assets
  const wallpapers = [
    { id: 'none', label: 'None', src: '' },
    ...['car-race.png', 'Evermist.png', 'sky.png'].map(filename => {
      const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
      return {
        id: filename,
        label: toTitleCase(nameWithoutExt),
        src: `AltS_search_newtab/images/wallappear/${filename}`,
      };
    }).sort((a, b) => {
      if (a.label === 'Default Wallpaper') return -1;
      if (b.label === 'Default Wallpaper') return 1;
      return a.label.localeCompare(b.label);
    })
  ];

  const isDark = true;

  // Temporarily disable 3rd step for everyone per user request
  const shouldShowOnboarding = false; // !isReturningUser;

  if (typeof window === 'undefined') return null;

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        background: 'rgba(5, 5, 10, 0.65)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
      className="fixed inset-0 z-[9999] h-screen w-screen max-h-screen max-w-screen flex flex-col items-center justify-between text-neutral-300 font-sans select-none overflow-hidden py-6 md:py-8 px-6 md:px-12">
      <style>{scrollbarStyles}</style>
      <style>{styles}</style>
      
      {/* Ambient background glows */}
        <AnimatePresence>
          {step === 'organization' && (
            <motion.div 
              key="auth-buttons"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="fixed top-8 right-10 flex items-center gap-1.5 text-[11px] select-none z-50"
            >
              <span className="text-neutral-400 font-medium">Existing user?</span>
              <button 
                onClick={() => {
                  if (typeof chrome !== 'undefined' && chrome.tabs) {
                    chrome.tabs.create({ url: CMDOS_SIGN_UP_URL });
                  } else {
                    window.open(CMDOS_SIGN_UP_URL, '_blank');
                  }
                }} 
                className="text-[#8b5cf6] hover:text-[#8b5cf6]/80 font-semibold bg-transparent border-none p-0 cursor-pointer transition-colors"
              >
                Sign In
              </button>
              <span className="text-white/10 mx-0.5">|</span>
              <button 
                onClick={() => setStep('restore_options')} 
                className="text-[#8b5cf6] hover:text-[#8b5cf6]/80 font-semibold bg-transparent border-none p-0 cursor-pointer transition-colors"
              >
                Import Backup
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* ── Step 1: Quote screen ── */}
          {step === 'quote' && (
            <motion.div
              key="quote"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col items-center justify-between w-full h-full max-h-full"
              onClick={e => e.stopPropagation()}>
              
              <OnboardingHeader currentStep={1} />

              {/* Centered layout for quote contents */}
              <div className="onboarding-body">
                <div className="onboarding-standard-content flex flex-col justify-center items-center ob-fluid-gap-container text-center">
                  
                  <div className="space-y-3 w-full">
                    <h1 className="ob-fluid-h1 font-bold tracking-tight text-center" style={{ color: 'var(--color-tutorialTextTitle)' }}>
                      Save time on repeat browser work.
                    </h1>
                    <div className="flex items-center justify-center">
                      <span 
                        className="ob-fluid-hero-text font-bold tracking-tight bg-gradient-to-r bg-clip-text text-transparent"
                        style={{
                          backgroundImage: 'linear-gradient(to right, var(--color-tutorialTextGradientStart), var(--color-tutorialTextGradientEnd))',
                          WebkitBackgroundClip: 'text'
                        }}
                      >
                        3 - 4 hours / week
                      </span>
                    </div>
                    <p className="ob-fluid-subtext font-normal text-center" style={{ color: 'var(--color-tutorialTextDescription)' }}>
                      Built for power users who choose <span style={{ color: 'var(--color-tutorialTextTitle)' }} className="font-semibold">efficiency.</span>
                    </p>
                  </div>

                  <div className="flex flex-col ob-fluid-feature-list items-start mx-auto w-fit">
                    {/* Point 1 */}
                    <div className="flex items-center gap-3">
                      <div style={{ color: 'var(--color-tutorialAccent)' }} className="shrink-0 flex items-center justify-center ob-fluid-feature-icon">
                        <FaKeyboard className="w-full h-full" />
                      </div>
                      <p className="ob-fluid-feature-text font-medium" style={{ color: 'var(--color-tutorialTextTitle)' }}>
                        Keyboard-first
                      </p>
                    </div>

                    {/* Point 2 */}
                    <div className="flex items-center gap-3">
                      <div style={{ color: 'var(--color-tutorialAccent)' }} className="shrink-0 flex items-center justify-center ob-fluid-feature-icon">
                        <FiLayers className="w-full h-full" />
                      </div>
                      <p className="ob-fluid-feature-text font-medium" style={{ color: 'var(--color-tutorialTextTitle)' }}>
                        Less tab switching, more flow
                      </p>
                    </div>

                    {/* Point 3 */}
                    <div className="flex items-center gap-3">
                      <div style={{ color: 'var(--color-tutorialAccent)' }} className="shrink-0 flex items-center justify-center ob-fluid-feature-icon">
                        <FiZap className="w-full h-full" />
                      </div>
                      <p className="ob-fluid-feature-text font-medium" style={{ color: 'var(--color-tutorialTextTitle)' }}>
                        Create command shortcuts for everything in your browser
                      </p>
                    </div>
                  </div>

                  {/* Note Box */}
                  <div 
                    className="ob-fluid-note-box rounded-xl border flex items-start text-left"
                    style={{
                      backgroundColor: 'rgba(139, 92, 246, 0.03)',
                      borderColor: 'rgba(139, 92, 246, 0.15)'
                    }}
                  >
                    <div style={{ color: 'var(--color-tutorialAccent)' }} className="mt-0.5 shrink-0 flex items-center justify-center ob-fluid-feature-icon mr-2.5">
                      <FiInfo className="w-full h-full" />
                    </div>
                    <p className="ob-fluid-note-text leading-relaxed" style={{ color: 'var(--color-tutorialTextDescription)' }}>
                      <span className="font-semibold" style={{ color: 'var(--color-tutorialTextTitle)' }}>Note:</span> The product may take 3 - 4 days to get used to. Once you're comfortable with the product, <span className="font-semibold" style={{ color: 'var(--color-tutorialTextTitle)' }}>you'll feel the speed.</span>
                    </p>
                  </div>

                </div>
              </div>

              <OnboardingFooter currentStep={1} onNext={() => setStep('theme')} />
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
                <span className="text-[12px] font-semibold tracking-wider text-neutral-500 uppercase">
                  Restore Options
                </span>
              </div>

              <div className="flex-grow flex flex-col justify-start items-center gap-6 mt-4 mb-auto w-full max-h-[75vh] overflow-y-auto tutorial-overlay-scroll px-2">
                <div className="text-center max-w-[700px] flex flex-col gap-2">
                  <h1 className="text-lg md:text-2xl lg:text-3xl font-medium text-neutral-200">
                    Select a <span className="text-blue-400">Restore Method</span>
                  </h1>
                  <p className="text-neutral-400 text-xs md:text-sm">
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
                  <div className="p-5 rounded-2xl border border-white/10 bg-white/5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                            driveStatus === 'connected' || driveStatus === 'listing'
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                              : 'bg-white/5 border-white/10 text-neutral-400'
                          }`}>
                            <FiCloud size={18} />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white">Google Drive Backups</h3>
                            <p className="text-[11px] text-neutral-400 leading-tight">Retrieve backups stored in your Drive</p>
                          </div>
                        </div>

                        {/* Connect button or connected status */}
                        {driveStatus === 'disconnected' && (
                          <button
                            onClick={handleConnectDrive}
                            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md"
                          >
                            Connect Drive
                          </button>
                        )}
                        {driveStatus === 'connecting' && (
                          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                            <FiRefreshCw className="animate-spin" size={12} />
                            Connecting...
                          </div>
                        )}
                        {driveStatus === 'connected' && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Connected
                          </span>
                        )}
                      </div>

                      {driveEmail && (
                        <div className="text-[11px] text-neutral-400 font-mono bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg w-fit mb-4">
                          Account: <span className="text-white font-semibold">{driveEmail}</span>
                        </div>
                      )}
                    </div>

                    {driveStatus === 'connected' && (
                      <div className="space-y-2 border-t border-white/10 pt-4 mt-auto">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Available Backups ({driveBackups.length})</span>
                          <button onClick={() => loadDriveBackups(true)} className="text-[10px] text-blue-400 hover:underline flex items-center gap-1">
                            <FiRefreshCw size={10} className={loadingDriveBackups ? 'animate-spin' : ''} /> Refresh
                          </button>
                        </div>

                        {loadingDriveBackups && (
                          <div className="flex items-center justify-center py-6 text-xs text-neutral-400 gap-2">
                            <FiRefreshCw className="animate-spin" size={14} /> Loading Drive files...
                          </div>
                        )}

                        {!loadingDriveBackups && driveBackups.length === 0 && (
                          <p className="text-xs text-neutral-400 text-center py-4 italic">No backups found in your Google Drive.</p>
                        )}

                        {!loadingDriveBackups && driveBackups.length > 0 && (
                          <div className="space-y-2 max-h-[160px] overflow-y-auto tutorial-overlay-scroll pr-1">
                            {driveBackups.map(file => {
                              const date = new Date(file.createdTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                              const time = new Date(file.createdTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                              const size = file.size ? `${(parseInt(file.size)/1024).toFixed(1)} KB` : '';
                              const isRestoringThis = restoringFileId === file.id;

                              return (
                                <div key={file.id} className="flex justify-between items-center p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-white truncate max-w-[180px]">{file.name}</p>
                                    <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{date} · {time} {size && `· ${size}`}</p>
                                  </div>
                                  <button
                                    onClick={() => handleDriveRestore(file.id)}
                                    disabled={isRestoring}
                                    className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                                  >
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
                  <div className="p-5 rounded-2xl border border-white/10 bg-white/5 flex flex-col justify-between">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 text-neutral-400 shrink-0">
                          <FiDatabase size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Restore from Local File</h3>
                          <p className="text-[11px] text-neutral-400 leading-tight">Upload a .zip backup file from your computer</p>
                        </div>
                      </div>
                      <p className="text-xs text-neutral-500">
                        If you have previously exported a local backup, you can restore your entire workspace directly from your computer without connecting to Google Drive.
                      </p>
                    </div>

                    <div className="mt-6 border-t border-white/10 pt-4 flex justify-end">
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
                        className="px-4 py-2 w-full justify-center rounded-lg border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isRestoring ? (
                          <FiLoader className="animate-spin" size={14} />
                        ) : (
                          <FiUpload size={14} />
                        )}
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
                  className="flex items-center gap-2 text-neutral-500 hover:text-neutral-300 font-semibold text-xs md:text-sm transition-colors px-4 py-2 disabled:opacity-50">
                  <FaChevronLeft size={12} /> Back
                </button>

                <button
                  disabled={isRestoring}
                  onClick={() => setStep('presentation')}
                  className="text-neutral-500 hover:text-neutral-300 text-xs md:text-sm font-semibold transition-colors px-4 py-2 disabled:opacity-50">
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
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <FaCheck size={24} />
                </div>

                <div className="space-y-2">
                  <h1 className="text-xl md:text-2xl font-bold text-white">Restore Successful!</h1>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                    All your settings, shortcuts, hotkeys, and data have been recovered.
                  </p>
                </div>

                {restoredSummary && (
                  <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-4 text-left space-y-2 mt-2">
                    <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Restored Summary</h3>
                    
                    <div className="flex justify-between items-center text-xs border-b border-white/5 py-1.5">
                      <span className="text-neutral-400 flex items-center gap-1.5"><FiHardDrive size={12} /> Organizations</span>
                      <span className="text-white font-bold">{restoredSummary.organizationCount}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs border-b border-white/5 py-1.5">
                      <span className="text-neutral-400 flex items-center gap-1.5"><FiFolder size={12} /> Workspaces</span>
                      <span className="text-white font-bold">{restoredSummary.workspaceCount}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs border-b border-white/5 py-1.5">
                      <span className="text-neutral-400 flex items-center gap-1.5"><FiDatabase size={12} /> Snippets & Todos</span>
                      <span className="text-white font-bold">{restoredSummary.snippetCount + restoredSummary.todoCount}</span>
                    </div>

                    {restoredSummary.favoritesCount > 0 && (
                      <div className="flex justify-between items-center text-xs border-b border-white/5 py-1.5">
                        <span className="text-neutral-400 flex items-center gap-1.5">★ Favorites</span>
                        <span className="text-white font-bold">{restoredSummary.favoritesCount}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="w-full flex justify-center mt-auto">
                <button
                  onClick={() => setStep('presentation')}
                  className="w-full max-w-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-full text-sm font-semibold transition-all shadow-lg shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98]">
                  Next →
                </button>
              </div>
            </motion.div>
          )}


          {step === 'theme' && (
            <motion.div
              key="theme"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col items-center justify-between w-full h-full max-h-full"
              onClick={e => e.stopPropagation()}>
              
              <OnboardingHeader currentStep={2} />

              {/* Theme & Wallpaper Customization Content */}
              <div className="onboarding-body">
                <div className="onboarding-standard-content flex flex-col items-center justify-center ob-fluid-gap-container text-center">
                  <div className="text-center w-full flex flex-col gap-2">
                    <h1 className="ob-fluid-h1 font-medium text-neutral-200">
                      Customize <span className="text-[#8b5cf6]">Appearance</span>
                    </h1>
                    <p className="ob-fluid-subtext text-neutral-400 leading-relaxed">
                      Personalize your cmdOS experience by picking a theme profile and background wallpaper.
                    </p>
                  </div>

                  <div className="w-full space-y-6 mt-2 text-left">
                    {/* Theme Selection Row */}
                    <div className="space-y-3">
                      <h3 className="ob-fluid-subtext font-bold text-neutral-400 tracking-wider uppercase text-left">
                        Select Theme
                      </h3>
                      <div className="flex gap-4 justify-start">
                        {['default-dark', 'ocean-blue'].map(id => {
                          const isSelected = themeId === id;
                          const label = id === 'default-dark' ? 'Dark Mode' : 'Ocean Blue';
                          const bgColor = id === 'default-dark' ? '#000000' : '#090e1a';
                          
                          return (
                            <motion.div
                              key={id}
                              whileHover={{ scale: 1.03, y: -2 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setThemeProfile(id)}
                              style={{ backgroundColor: bgColor }}
                              className={`ob-theme-item cursor-pointer border rounded-xl transition-all relative overflow-hidden shadow-lg ${
                                isSelected
                                  ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                                  : 'border-white/10 hover:border-white/20'
                              }`}
                            >
                              {/* Subtle inner border for contrast */}
                              <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none" />

                              {/* Mini Mockup layout illustration inside the card */}
                              <div className="absolute inset-2 flex gap-1.5 opacity-40 pointer-events-none">
                                {/* Sidebar */}
                                <div className="w-6 h-full rounded bg-white/10" />
                                {/* Content area */}
                                <div className="flex-1 flex flex-col gap-1">
                                  <div className="h-3 w-12 rounded bg-white/20" />
                                  <div className="h-2 w-full rounded bg-white/10" />
                                  <div className="h-2 w-2/3 rounded bg-white/10" />
                                </div>
                              </div>

                              {/* Active Indicator Checkmark */}
                              {isSelected && (
                                <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10 animate-in zoom-in-50 duration-150">
                                  <FaCheck size={9} />
                                </div>
                              )}

                              {/* Name Pill (Bottom Left Overlay) */}
                              <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
                                <span className="text-[10px] font-bold text-white tracking-wide">{label}</span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Wallpaper Selection Row */}
                    <div className="space-y-3 pt-6 border-t border-white/10">
                      <h3 className="ob-fluid-subtext font-bold text-neutral-400 tracking-wider uppercase text-left">
                        Select Wallpaper
                      </h3>
                      <div className="flex flex-wrap gap-4 w-full">
                        {wallpapers.map(wall => {
                          const isSelected = wallpaperId === wall.id;
                          const bgStyle = wall.id === 'none'
                            ? { backgroundColor: '#111115' }
                            : {
                                backgroundImage: `url('${
                                  typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                                    ? chrome.runtime.getURL(wall.src) 
                                    : '/' + wall.src
                                }')`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                              };

                          return (
                            <motion.div
                              key={wall.id}
                              whileHover={{ scale: 1.03, y: -2 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setWallpaper(wall.id)}
                              style={bgStyle}
                              className={`ob-wallpaper-item cursor-pointer border rounded-xl transition-all relative overflow-hidden shadow-lg ${
                                isSelected
                                  ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                                  : 'border-white/10 hover:border-white/20'
                              }`}
                            >
                              {/* Subtle inner border for contrast */}
                              <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none" />

                              {/* Active Indicator Checkmark */}
                              {isSelected && (
                                <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10 animate-in zoom-in-50 duration-150">
                                  <FaCheck size={9} />
                                </div>
                              )}

                              {/* Name Pill (Bottom Left Overlay) */}
                              <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
                                <span className="text-[10px] font-bold text-white tracking-wide">{wall.label}</span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <OnboardingFooter currentStep={2} onBack={() => setStep('quote')} onNext={() => setStep('organization')} />
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
              
              <OnboardingHeader currentStep={3} />

              {/* Centered Form Layout with a card-like container */}
              <div className="onboarding-body">
                <div className="onboarding-standard-content flex flex-col items-center justify-center">
                  
                  {/* Card container with a thin border */}
                  <div className="w-full border border-white/10 rounded-2xl p-6 flex flex-col ob-fluid-gap-container">
                    <div className="text-center space-y-1.5">
                      <h2 className="ob-fluid-h1 font-semibold text-white tracking-tight">
                        Create <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Workspace</span>
                      </h2>
                    </div>

                    {/* Workspace Name Input (reduced width and centered) */}
                    <div className="space-y-1.5 text-left w-full ob-fluid-input-container mx-auto">
                      <label className="ob-fluid-note-text font-bold text-neutral-400 tracking-wider uppercase block text-left">
                        Workspace Name <span className="text-red-500 font-normal ml-0.5">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          placeholder="John Doe"
                          className="ob-fluid-input w-full pl-4 pr-[130px] bg-white/[0.02] border border-white/10 rounded-xl text-white placeholder-neutral-500 outline-none focus:border-[#8b5cf6]/50 focus:ring-1 focus:ring-[#8b5cf6]/20 transition-all font-medium shadow-inner"
                        />
                        <div className="absolute right-3 flex items-center gap-1.5 text-[10px] text-neutral-500 font-medium select-none pointer-events-none">
                          <FiLock size={10} />
                          <span>Private • Stored locally</span>
                        </div>
                      </div>
                    </div>

                    {/* Create Workspace CTA Button (Reduced width & centered) */}
                    <button
                      disabled={isCreating}
                      onClick={handleCreateOrgAndWorkspace}
                      className="w-fit mx-auto px-10 flex items-center justify-center gap-2 py-2.5 ob-fluid-feature-text font-bold text-white rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all active:scale-[0.98] shadow-lg shadow-purple-600/20 disabled:opacity-75 cursor-pointer mt-1"
                    >
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
                    <div className="grid grid-cols-3 gap-0 mt-2 select-none w-full pt-5 border-t border-white/5 divide-x divide-white/10">
                      
                      {/* Column 1 */}
                      <div className="flex items-start gap-2.5 px-4">
                        <div className="w-7 h-7 rounded-full bg-neutral-800/40 text-neutral-400 flex items-center justify-center shrink-0 mt-0.5 border border-white/5">
                          <FaShieldHalved size={11} />
                        </div>
                        <div className="flex flex-col text-left">
                          <strong className="text-neutral-200 font-semibold text-[10.5px] md:text-[11.5px] tracking-wide">Local-first</strong>
                          <span className="text-[9.5px] md:text-[10.5px] text-neutral-500 mt-0.5">Stored on this device</span>
                          <span className="text-[9.5px] md:text-[10.5px] text-neutral-500">Private • Stored locally</span>
                        </div>
                      </div>

                      {/* Column 2 */}
                      <div className="flex items-start gap-2.5 px-4">
                        <div className="w-7 h-7 rounded-full bg-neutral-800/40 text-neutral-400 flex items-center justify-center shrink-0 mt-0.5 border border-white/5">
                          <FiCloud size={12} />
                        </div>
                        <div className="flex flex-col text-left">
                          <strong className="text-neutral-200 font-semibold text-[10.5px] md:text-[11.5px] tracking-wide">Optional backup</strong>
                          <span className="text-[9.5px] md:text-[10.5px] text-neutral-500 mt-0.5">Connect Drive anytime</span>
                        </div>
                      </div>

                      {/* Column 3 */}
                      <div className="flex items-start gap-2.5 px-4">
                        <div className="w-7 h-7 rounded-full bg-neutral-800/40 text-neutral-400 flex items-center justify-center shrink-0 mt-0.5 border border-white/5">
                          <FiCode size={12} />
                        </div>
                        <div className="flex flex-col text-left">
                          <strong className="text-neutral-200 font-semibold text-[10.5px] md:text-[11.5px] tracking-wide">Open source</strong>
                          <span className="text-[9.5px] md:text-[10.5px] text-neutral-500 mt-0.5">Built with community love ❤️</span>
                          <a 
                            href="https://github.com/cmdOS-App/cmdOS" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-neutral-400 hover:text-neutral-300 font-medium flex items-center justify-start gap-1.5 mt-1 transition-colors cursor-pointer text-[9.5px]"
                          >
                            <FaGithub size={10} className="mb-[0.5px] opacity-80" /> Explore source code <FiArrowUpRight size={9} />
                          </a>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>

              <OnboardingFooter currentStep={3} onBack={() => setStep('theme')} />
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
              className="tutorial-overlay-scroll w-[900px] h-auto min-h-[380px] rounded-[32px] flex flex-col shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] cursor-default relative overflow-hidden bg-[var(--color-tutorialCardBg)] border border-[var(--color-borderDefault)] text-neutral-300"
              style={{ zoom: 1.25 }}
              onClick={e => e.stopPropagation()}>
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-5 right-5 p-2 rounded-full hover:bg-red-500/10 text-neutral-400 hover:text-red-400 transition-colors z-10"
                title="Close">
                <FaTimes size={20} />
              </button>

              <div className="absolute top-5 left-10 z-10">
                <span className="text-[14px] font-bold text-neutral-500 tabular-nums">Step 3/3</span>
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
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute inset-0 z-[100000] h-screen w-screen flex flex-col items-center justify-start overflow-hidden bg-transparent"
              onClick={(e) => e.stopPropagation()}
            >
              <FeaturePresentationCard onClose={onClose} onBack={isReturningUser || initialStep === 'presentation' ? undefined : () => setStep('organization')} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>,
      document.body
  );
});

export default OnboardingCards;

