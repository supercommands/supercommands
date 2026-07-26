import React from 'react';
import { getFaviconUrl } from '../../shared-components/searchBarMain/utilityFunctions/utils';

type IconMode = 'single_link' | 'multi_link' | 'all_ai' | 'fallback';

type AutomationIconMeta = {
  mode: IconMode;
  hosts: string[];
};

const ALL_AI_ICON_HOSTS = ['chatgpt.com', 'gemini.google.com', 'claude.ai', 'perplexity.ai'];
const AI_FAVICON_URLS: Record<string, string> = {
  'chatgpt.com': 'https://chatgpt.com/favicon.ico',
  'gemini.google.com': 'https://gemini.google.com/favicon.ico',
  'claude.ai': 'https://claude.ai/favicon.ico',
  'perplexity.ai': 'https://www.perplexity.ai/favicon.ico',
};

const toHost = (value: string): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const hostname = new URL(withProtocol).hostname.replace(/^www\./i, '').trim();
    return hostname || null;
  } catch {
    return null;
  }
};

const looksLikeUrl = (value: string): boolean => {
  const raw = String(value || '').trim();
  if (!raw) return false;
  return /^https?:\/\//i.test(raw) || /^www\./i.test(raw) || /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(raw);
};

const isAllAiStep = (step: any): boolean => {
  const moduleId = String(step?.moduleId || step?.module_id || step?.module_key || step?.module || step?.type || '')
    .toLowerCase()
    .trim();
  const agentId = String(step?.config?.agentId || step?.config?.id || '')
    .toLowerCase()
    .trim();
  const moduleName = String(step?.config?.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  return (
    step?.config?.isAllAi === true ||
    moduleId === 'all_ai' ||
    moduleId === '5' ||
    agentId === 'all_ai' ||
    agentId === 'all' ||
    moduleName === 'allai'
  );
};

const collectHostsFromStep = (step: any, hosts: Set<string>) => {
  const moduleId = String(step?.moduleId || step?.module_id || step?.module_key || step?.module || step?.type || '')
    .toLowerCase()
    .trim();
  const config = step?.config || {};

  // Special handling for All AI steps to extract specific selected agents
  if (isAllAiStep(step)) {
    const allAiUrls = config?.allAiUrls || {};
    Object.entries(allAiUrls).forEach(([_, urlWithStatus]) => {
      if (typeof urlWithStatus === 'string' && urlWithStatus.includes('cmd_select_status=true')) {
        const host = toHost(urlWithStatus);
        if (host) hosts.add(host);
      }
    });
  }

  if (moduleId === 'open_tab' || moduleId === 'link' || moduleId === 'agent') {
    const urlCandidates: string[] = [];
    if (typeof config.url === 'string') urlCandidates.push(config.url);
    if (typeof config.iconHost === 'string') urlCandidates.push(config.iconHost);
    if (Array.isArray(config.urls)) {
      config.urls.forEach((url: any) => {
        if (typeof url === 'string') urlCandidates.push(url);
      });
    }

    urlCandidates.forEach(url => {
      if (!looksLikeUrl(url)) return;
      const host = toHost(url);
      if (host) hosts.add(host);
    });
  }

  // Installed modules may store urls directly on step objects (execution_steps)
  if (typeof step?.url === 'string' && looksLikeUrl(step.url)) {
    const host = toHost(step.url);
    if (host) hosts.add(host);
  }
};

const walkSteps = (steps: any[], hosts: Set<string>): boolean => {
  let hasAllAi = false;

  (steps || []).forEach(step => {
    if (isAllAiStep(step)) {
      hasAllAi = true;
    }

    collectHostsFromStep(step, hosts);

    const nested = [
      ...(Array.isArray(step?.subSteps) ? step.subSteps : []),
      ...(Array.isArray(step?.sub_steps) ? step.sub_steps : []),
      ...(Array.isArray(step?.config?.steps) ? step.config.steps : []),
    ];

    if (nested.length > 0 && walkSteps(nested, hosts)) {
      hasAllAi = true;
    }
  });

  return hasAllAi;
};

export const resolveAutomationIconMeta = (automation: any): AutomationIconMeta => {
  const cached = automation?.iconMeta;
  if (
    cached &&
    ['single_link', 'multi_link', 'all_ai', 'fallback'].includes(cached.mode) &&
    Array.isArray(cached.hosts)
  ) {
    return { mode: cached.mode, hosts: cached.hosts.filter((host: any) => typeof host === 'string') };
  }

  const steps = Array.isArray(automation?.steps)
    ? automation.steps
    : Array.isArray(automation?.automation_steps)
      ? automation.automation_steps
      : Array.isArray(automation?.execution_steps)
        ? automation.execution_steps
        : [];

  const hosts = new Set<string>();
  const directIconHost =
    typeof automation?.iconHost === 'string'
      ? automation.iconHost
      : typeof automation?.icon_host === 'string'
        ? automation.icon_host
        : '';
  if (directIconHost && looksLikeUrl(directIconHost)) {
    const host = toHost(directIconHost);
    if (host) hosts.add(host);
  }
  const hasAllAi = walkSteps(steps, hosts);
  const uniqueHosts = Array.from(hosts);

  if (hasAllAi) {
    const aiHosts = Array.from(hosts).filter(h => ALL_AI_ICON_HOSTS.includes(h));
    return { mode: 'all_ai', hosts: aiHosts.length > 0 ? aiHosts : ALL_AI_ICON_HOSTS };
  }

  if (uniqueHosts.length === 1) {
    return { mode: 'single_link', hosts: uniqueHosts };
  }

  if (uniqueHosts.length > 1) {
    return { mode: 'multi_link', hosts: uniqueHosts.slice(0, 4) };
  }

  return { mode: 'fallback', hosts: [] };
};

const LightningFallback: React.FC<{ size: number; gradientId: string; glowId: string }> = ({
  size,
  gradientId,
  glowId,
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8AA2FF" />
        <stop offset="52%" stopColor="#7B61FF" />
        <stop offset="100%" stopColor="#4C3BEE" />
      </linearGradient>
      <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="1.6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <rect x="1" y="1" width="22" height="22" rx="5" fill="#0E1124" />
    <path
      d="M13.3 3.7 6.9 13.2h4.2L9.9 20.3l7.2-10h-4.2l.4-6.6Z"
      fill={`url(#${gradientId})`}
      filter={`url(#${glowId})`}
    />
  </svg>
);

interface AutomationDynamicIconProps {
  automation: any;
  size?: number;
  className?: string;
}

const AutomationDynamicIcon: React.FC<AutomationDynamicIconProps> = ({ automation, size = 16, className = '' }) => {
  const meta = resolveAutomationIconMeta(automation);
  const iconId = React.useId().replace(/:/g, '');
  const gradientId = `automation-bolt-gradient-${iconId}`;
  const glowId = `automation-bolt-glow-${iconId}`;
  const [fallbackMode, setFallbackMode] = React.useState<Record<string, boolean>>({});

  const resolveIconSrc = (host: string) => AI_FAVICON_URLS[host] || getFaviconUrl(host);

  const renderFallbackTile = (label: string, index = 0, total = 1) => {
    const offsetRatio = 0.55;
    const dotSize = total > 1 ? Math.floor(size / (1 + offsetRatio * (total - 1))) : size;
    const offset = total > 1 ? dotSize * offsetRatio : 0;
    const totalWidth = total > 1 ? dotSize + (total - 1) * offset : size;
    const startX = total > 1 ? (size - totalWidth) / 2 : 0;

    return (
      <div
        style={{
          position: total > 1 ? 'absolute' : 'relative',
          left: total > 1 ? startX + index * offset : 0,
          top: total > 1 ? (size - dotSize) / 2 : 0,
          width: dotSize,
          height: dotSize,
          borderRadius: total > 1 ? '50%' : 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0E1124',
          border: '1px solid rgba(138, 162, 255, 0.35)',
          color: '#D7DEFF',
          fontSize: Math.max(8, Math.floor(size / 3)),
          fontWeight: 700,
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}>
        {label}
      </div>
    );
  };

  if (meta.mode === 'single_link' && meta.hosts[0]) {
    const host = meta.hosts[0];
    const isAiHost = ALL_AI_ICON_HOSTS.includes(host);
    return (
      <div className={className} style={{ width: size, height: size, position: 'relative' }}>
        {!fallbackMode[host] ? (
          <img
            src={isAiHost ? resolveIconSrc(host) : getFaviconUrl(host)}
            alt=""
            style={{ width: size, height: size, objectFit: 'cover', borderRadius: 4 }}
            onError={() => setFallbackMode(prev => ({ ...prev, [host]: true }))}
          />
        ) : (
          renderFallbackTile(host.charAt(0).toUpperCase(), 0, 1)
        )}
      </div>
    );
  }

  if (meta.mode === 'multi_link' || meta.mode === 'all_ai') {
    const visibleHosts = meta.hosts.slice(0, 4);
    const count = visibleHosts.length;
    
    const offsetRatio = 0.55; // 45% overlap
    const dotSize = Math.floor(size / (1 + offsetRatio * (count - 1)));
    const offset = dotSize * offsetRatio;
    const totalWidth = dotSize + (count - 1) * offset;
    const startX = (size - totalWidth) / 2;

    return (
      <div className={className} style={{ position: 'relative', width: size, height: size }}>
        {visibleHosts.map((host, index) => {
          const isAiHost = ALL_AI_ICON_HOSTS.includes(host);
          const failed = fallbackMode[host];
          return (
            <div
              key={`${host}-${index}`}
              style={{
                position: 'absolute',
                left: startX + index * offset,
                top: (size - dotSize) / 2,
                width: dotSize,
                height: dotSize,
                borderRadius: '50%',
                overflow: 'hidden',
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.15)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                zIndex: 10 - index,
              }}>
              {!failed ? (
                <img
                  src={isAiHost ? resolveIconSrc(host) : getFaviconUrl(host)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onError={() => setFallbackMode(prev => ({ ...prev, [host]: true }))}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: Math.max(7, Math.floor(dotSize / 3)),
                    fontWeight: 700,
                    color: '#D7DEFF',
                    background: '#0E1124',
                  }}>
                  {host.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={className} style={{ width: size, height: size, display: 'flex', alignItems: 'center' }}>
      <LightningFallback size={size} gradientId={gradientId} glowId={glowId} />
    </div>
  );
};

export default AutomationDynamicIcon;
