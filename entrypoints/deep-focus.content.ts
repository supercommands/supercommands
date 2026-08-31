import { defineContentScript } from 'wxt/sandbox';

type DeepFocusBlockResponse = {
  ok?: boolean;
  blocked?: boolean;
  sessionId?: string;
  sessionName?: string;
  blockedUrl?: string;
  blockedDomain?: string;
  restrictedWindowBlock?: boolean;
  error?: string;
};

const OVERLAY_ID = 'tasklabs-deep-focus-blocked-overlay';
let overlayGuardObserver: MutationObserver | null = null;
let overlayStopTimer: number | null = null;
let hasStrippedUnderlyingHead = false;

function appendSvgIcon(
  target: HTMLElement,
  paths: string[],
  options: { viewBox?: string; strokeWidth?: string } = {},
) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '1em');
  svg.setAttribute('height', '1em');
  svg.setAttribute('viewBox', options.viewBox || '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', options.strokeWidth || '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  paths.forEach(pathValue => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathValue);
    svg.appendChild(path);
  });
  target.appendChild(svg);
}

function createSvgBase(strokeWidth = '2') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '1em');
  svg.setAttribute('height', '1em');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', strokeWidth);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  return svg;
}

function appendSvgPath(svg: SVGSVGElement, d: string) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
}

function appendSvgCircle(svg: SVGSVGElement, attrs: Record<string, string>) {
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  Object.entries(attrs).forEach(([key, value]) => circle.setAttribute(key, value));
  svg.appendChild(circle);
}

function appendDeepFocusTargetIcon(target: HTMLElement) {
  const svg = createSvgBase();
  appendSvgCircle(svg, { cx: '12', cy: '12', r: '10' });
  appendSvgCircle(svg, { cx: '12', cy: '12', r: '5' });
  appendSvgCircle(svg, { cx: '12', cy: '12', r: '1.5', fill: 'currentColor', stroke: 'none' });
  target.appendChild(svg);
}

function removeOverlay() {
  overlayGuardObserver?.disconnect();
  overlayGuardObserver = null;
  if (overlayStopTimer !== null) {
    window.clearInterval(overlayStopTimer);
    overlayStopTimer = null;
  }
  hasStrippedUnderlyingHead = false;
  document.getElementById(OVERLAY_ID)?.remove();
  document.documentElement.style.removeProperty('overflow');
}

function stopUnderlyingPage(stripHead = false) {
  try {
    window.stop();
  } catch {}
  document.querySelectorAll('video,audio').forEach(media => {
    try {
      (media as HTMLMediaElement).pause();
      (media as HTMLMediaElement).src = '';
      (media as HTMLMediaElement).load();
    } catch {}
  });
  if (stripHead && !hasStrippedUnderlyingHead) {
    document.head?.replaceChildren();
    hasStrippedUnderlyingHead = true;
  }
}

function ensureBlockerBody() {
  if (!document.body) {
    const body = document.createElement('body');
    document.documentElement.appendChild(body);
  }
  document.documentElement.style.background = 'var(--color-modalBg,var(--color-rootBg,#101014))';
  document.body.style.margin = '0';
  document.body.style.minHeight = '100vh';
  document.body.style.background = 'var(--color-modalBg,var(--color-rootBg,#101014))';
  return document.body;
}

function keepOnlyOverlay(overlay: HTMLDivElement) {
  stopUnderlyingPage();
  const body = ensureBlockerBody();

  if (body.children.length !== 1 || body.firstElementChild !== overlay) {
    body.replaceChildren(overlay);
  }
}

function guardBlockedPage(overlay: HTMLDivElement) {
  overlayGuardObserver?.disconnect();
  if (overlayStopTimer !== null) {
    window.clearInterval(overlayStopTimer);
  }

  let guardRunning = false;
  const runGuard = () => {
    if (guardRunning) return;
    guardRunning = true;
    try {
      keepOnlyOverlay(overlay);
    } finally {
      guardRunning = false;
    }
  };

  overlayGuardObserver = new MutationObserver(runGuard);
  overlayGuardObserver.observe(document.documentElement, { childList: true });
  if (document.body) overlayGuardObserver.observe(document.body, { childList: true, subtree: false });
  overlayStopTimer = window.setInterval(stopUnderlyingPage, 300);
  window.setTimeout(() => {
    if (overlayStopTimer !== null) {
      window.clearInterval(overlayStopTimer);
      overlayStopTimer = null;
    }
  }, 8000);
}

function mountOverlay(overlay: HTMLDivElement) {
  const mount = () => {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing === overlay && document.body?.contains(overlay)) return;
    if (existing && existing !== overlay) existing.remove();
    keepOnlyOverlay(overlay);
    guardBlockedPage(overlay);
  };

  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
    setTimeout(mount, 25);
  }

  let attempts = 0;
  const retryMount = window.setInterval(() => {
    attempts++;
    if (!document.body?.contains(overlay)) {
      mount();
    }
    if (document.body?.contains(overlay) || attempts >= 30) {
      window.clearInterval(retryMount);
    }
  }, 100);
}

function showBlockedOverlay(
  payload: Required<Pick<DeepFocusBlockResponse, 'sessionId' | 'sessionName' | 'blockedUrl' | 'blockedDomain'>> &
    Pick<DeepFocusBlockResponse, 'restrictedWindowBlock'>,
) {
  removeOverlay();
  stopUnderlyingPage(true);
  document.documentElement.style.overflow = 'hidden';

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    'min-height:100vh',
    'width:100vw',
    'background:var(--color-rootBg,#ffffff)',
    'color:var(--color-textPrimary,#08090d)',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'padding:14px',
    'box-sizing:border-box',
    'font-family:var(--font-family,var(--font-sans,inherit))',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = [
    'display:flex',
    'flex-direction:row',
    'align-items:center',
    'justify-content:space-between',
    'gap:12px',
    'margin:0 0 16px',
    'padding:0',
    'width:100%',
    'box-sizing:border-box',
    'background:transparent',
  ].join(';');

  const brand = document.createElement('div');
  brand.style.cssText = 'display:flex;align-items:center;gap:8px;min-width:0;font-weight:800;font-size:18px;color:var(--color-textPrimary,#08090d);font-family:var(--font-comfortaa,Comfortaa,Inter,ui-sans-serif,system-ui,sans-serif)';
  const brandIcon = document.createElement('img');
  brandIcon.src = chrome.runtime.getURL('content/cmdOS_logo.png');
  brandIcon.alt = 'cmdOS';
  brandIcon.style.cssText = [
    'width:28px',
    'height:28px',
    'border-radius:6px',
    'object-fit:contain',
    'display:block',
    'flex:0 0 auto',
  ].join(';');
  const brandText = document.createElement('span');
  brandText.textContent = 'cmdOS';
  brand.append(brandIcon, brandText);

  const statusPill = document.createElement('div');
  statusPill.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:8px',
    'min-height:36px',
    'padding:0 12px',
    'white-space:nowrap',
    'border:0',
    'border-radius:10px',
    'background:color-mix(in srgb,var(--color-accent,#5b2cff) 5%,var(--color-rootBg,#ffffff))',
    'color:var(--color-textSecondary,#3f4b66)',
    'font-size:13px',
    'font-weight:600',
    'box-shadow:0 10px 24px rgba(76,44,201,.07)',
  ].join(';');
  const focusIcon = document.createElement('span');
  appendDeepFocusTargetIcon(focusIcon);
  focusIcon.style.cssText = 'color:var(--color-accent,#5b2cff);font-size:18px;line-height:1;font-weight:800;display:inline-flex;align-items:center;justify-content:center';
  const statusText = document.createElement('span');
  statusText.textContent = 'Deep Focus mode';
  const statusDot = document.createElement('span');
  statusDot.textContent = '•';
  statusDot.style.cssText = 'color:var(--color-accent,#5b2cff);font-size:18px;line-height:1';
  const statusOn = document.createElement('span');
  statusOn.textContent = 'ON';
  statusOn.style.cssText = 'color:var(--color-accent,#5b2cff);font-weight:800';
  statusPill.append(focusIcon, statusText, statusDot, statusOn);
  header.append(brand, statusPill);

  const card = document.createElement('div');
  card.style.cssText = [
    'width:100%',
    'max-width:520px',
    'margin:0 auto',
    'padding:20px',
    'border:1px solid var(--color-borderDefault,#e7eaf2)',
    'border-radius:18px',
    'background:var(--color-cardBg,#ffffff)',
    'box-shadow:0 18px 54px rgba(20,31,56,.14)',
    'box-sizing:border-box',
    'text-align:center',
  ].join(';');

  const blockedMark = document.createElement('div');
  blockedMark.textContent = '−';
  blockedMark.style.cssText = [
    'width:50px',
    'height:50px',
    'margin:0 auto',
    'border:2px solid var(--color-error,#ef171e)',
    'border-radius:999px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'color:var(--color-error,#ef171e)',
    'font-size:32px',
    'font-weight:500',
    'line-height:1',
    'box-sizing:border-box',
  ].join(';');

  const title = document.createElement('h1');
  title.textContent = 'Site blocked';
  title.style.cssText = 'margin:18px 0 0;color:var(--color-textPrimary,#08090d);font-size:29px;line-height:36px;font-weight:850;letter-spacing:0';

  const description = document.createElement('p');
  description.textContent = payload.restrictedWindowBlock
    ? 'This window does not have a running Deep Focus session.'
    : 'Deep Focus mode is active.';
  description.style.cssText = 'margin:8px 0 0;color:var(--color-textSecondary,#46536d);font-size:14px;line-height:20px;font-weight:500';

  const makeIcon = (name: 'globe' | 'target' | 'settings' | 'plus' | 'external' | 'plant') => {
    const span = document.createElement('span');
    span.setAttribute('aria-hidden', 'true');
    span.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;line-height:1;color:currentColor';
    const svg = createSvgBase();
    if (name === 'globe') {
      appendSvgCircle(svg, { cx: '12', cy: '12', r: '10' });
      appendSvgPath(svg, 'M2 12h20');
      appendSvgPath(svg, 'M12 2a15.3 15.3 0 0 1 0 20');
      appendSvgPath(svg, 'M12 2a15.3 15.3 0 0 0 0 20');
    } else if (name === 'target') {
      appendSvgCircle(svg, { cx: '12', cy: '12', r: '10' });
      appendSvgCircle(svg, { cx: '12', cy: '12', r: '5' });
      appendSvgCircle(svg, { cx: '12', cy: '12', r: '1.5', fill: 'currentColor', stroke: 'none' });
    } else if (name === 'settings') {
      appendSvgPath(svg, 'M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z');
      appendSvgPath(svg, 'M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.15.38.38.7.7.95.29.22.65.34 1 .34H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z');
    } else if (name === 'plus') {
      appendSvgPath(svg, 'M12 5v14');
      appendSvgPath(svg, 'M5 12h14');
    } else if (name === 'external') {
      appendSvgPath(svg, 'M15 3h6v6');
      appendSvgPath(svg, 'M10 14 21 3');
      appendSvgPath(svg, 'M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5');
    } else if (name === 'plant') {
      appendSvgPath(svg, 'M12 21V9');
      appendSvgPath(svg, 'M12 9C8 9 5 7 4 3c4 0 7 2 8 6Z');
      appendSvgPath(svg, 'M12 14c4 0 7-2 8-6-4 0-7 2-8 6Z');
    }
    span.appendChild(svg);
    return span;
  };

  const domainPill = document.createElement('div');
  domainPill.style.cssText = 'margin:20px auto 18px;display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 14px;border-radius:11px;border:1px solid color-mix(in srgb,var(--color-error,#ef171e) 8%,var(--color-borderDefault,#f1d8dc));background:color-mix(in srgb,var(--color-error,#ef171e) 5%,var(--color-rootBg,#ffffff));color:color-mix(in srgb,var(--color-error,#d70710) 86%,var(--color-textPrimary,#08090d));font-size:18px;font-weight:800;box-shadow:0 8px 20px rgba(239,23,30,.05)';
  const domainIcon = document.createElement('span');
  domainIcon.appendChild(makeIcon('globe'));
  domainIcon.style.cssText = 'font-size:20px;line-height:1;display:inline-flex';
  const domainValue = document.createElement('span');
  domainValue.textContent = payload.blockedDomain || 'Unknown domain';
  domainValue.style.cssText = 'overflow-wrap:anywhere';
  domainPill.append(domainIcon, domainValue);

  const rows = document.createElement('div');
  rows.style.cssText = 'display:grid;gap:10px;margin-top:0';

  const makeActionRow = (iconName: 'globe' | 'target' | 'settings', titleText: string, bodyText: string, controlText: string, controlKind: 'plus' | 'toggle' | 'external', onClick: () => void) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.style.cssText = [
      'width:100%',
      'min-height:68px',
      'display:grid',
      'grid-template-columns:46px 1fr 42px',
      'align-items:center',
      'gap:12px',
      'padding:12px 14px',
      'border:1px solid var(--color-borderDefault,#e7eaf2)',
      'border-radius:12px',
      'background:var(--color-cardBg,#ffffff)',
      'box-shadow:0 10px 28px rgba(20,31,56,.08)',
      'cursor:pointer',
      'text-align:left',
      'box-sizing:border-box',
      'font:inherit',
    ].join(';');
    row.addEventListener('click', onClick);

    const iconWrap = document.createElement('div');
    iconWrap.appendChild(makeIcon(iconName));
    iconWrap.style.cssText = [
      'width:36px',
      'height:36px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-size:26px',
      'font-weight:800',
      controlKind === 'plus'
        ? 'color:var(--color-success,#07965f)'
        : controlKind === 'toggle'
          ? 'color:var(--color-accent,#5b2cff)'
          : 'color:var(--color-textSecondary,#4b5670)',
    ].join(';');

    const copy = document.createElement('div');
    const rowTitle = document.createElement('div');
    rowTitle.textContent = titleText;
    rowTitle.style.cssText = 'color:var(--color-textPrimary,#08090d);font-size:15px;line-height:20px;font-weight:800';
    const rowBody = document.createElement('div');
    rowBody.textContent = bodyText;
    rowBody.style.cssText = 'margin-top:3px;color:var(--color-textSecondary,#46536d);font-size:12px;line-height:17px;font-weight:500';
    copy.append(rowTitle, rowBody);

    const control = document.createElement('div');
    control.textContent = controlText;
    control.style.cssText = [
      'justify-self:end',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-weight:700',
      controlKind === 'toggle'
        ? 'width:44px;height:26px;border-radius:999px;background:var(--color-accent,#5b2cff);color:var(--color-rootBg,#ffffff);font-size:0'
        : controlKind === 'plus'
          ? 'width:34px;height:34px;border-radius:10px;background:var(--color-accent,#5b2cff);color:var(--color-rootBg,#ffffff);font-size:24px;line-height:1;box-shadow:0 10px 20px rgba(91,44,255,.20)'
          : 'width:34px;height:34px;color:var(--color-accent,#5b2cff);font-size:24px;line-height:1',
    ].join(';');
    if (controlKind === 'plus' || controlKind === 'external') {
      control.textContent = '';
      control.appendChild(makeIcon(controlKind));
    }
    if (controlKind === 'toggle') {
      const knob = document.createElement('span');
      knob.style.cssText = 'width:20px;height:20px;border-radius:999px;background:var(--color-rootBg,#ffffff);display:block;margin-left:auto;margin-right:3px;box-shadow:0 4px 10px rgba(20,31,56,.16)';
      control.appendChild(knob);
    }
    row.append(iconWrap, copy, control);
    return row;
  };

  if (!payload.restrictedWindowBlock) {
    rows.append(
      makeActionRow('globe', 'Allow this domain', `Add ${payload.blockedDomain || 'this domain'} to allowed whitelist.`, '+', 'plus', () => {
        sendAction('deep_focus_add_allowed_domain', {
          domain: payload.blockedDomain,
          url: payload.blockedUrl,
        });
      }),
      makeActionRow('target', 'Deep Focus mode', 'Turn it off to access all blocked sites.', '', 'toggle', () => sendAction('deep_focus_turn_off')),
    );
  }

  rows.append(makeActionRow('settings', 'Open PIN tab settings', 'Manage blocked sites, allowed list, and rules.', '↗', 'external', () => sendAction('deep_focus_focus_pinned_tab')));

  const status = document.createElement('div');
  status.style.cssText = [
    'display:none',
    'margin-top:12px',
    'border:1px solid var(--color-borderDefault,#e7eaf2)',
    'border-radius:12px',
    'background:var(--color-hoverBg,#f6f7fb)',
    'padding:8px 10px',
    'color:var(--color-textSecondary,#46536d)',
    'font-size:12px',
    'font-weight:700',
  ].join(';');

  const setStatus = (text: string) => {
    status.textContent = text;
    status.style.display = text ? 'block' : 'none';
  };

  const sendAction = (action: string, extra: Record<string, unknown> = {}) => {
    setStatus('');
    chrome.runtime.sendMessage({ action, sessionId: payload.sessionId, ...extra }, (response: any) => {
      if (chrome.runtime.lastError || !response?.ok) {
        setStatus(chrome.runtime.lastError?.message || response?.error || 'Action failed.');
        return;
      }
      if (action === 'deep_focus_turn_off') {
        removeOverlay();
        return;
      }
      if (action === 'deep_focus_add_allowed_domain') {
        setStatus(`${response.domain || payload.blockedDomain || 'Domain'} added.`);
        setTimeout(removeOverlay, 450);
      }
    });
  };

  const footer = document.createElement('div');
  footer.style.cssText = 'margin:16px auto 0;padding-top:14px;border-top:1px solid var(--color-borderDefault,#e7eaf2);color:var(--color-textSecondary,#46536d);font-size:12px;line-height:17px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:8px';
  const footerIcon = makeIcon('plant');
  footerIcon.style.color = 'var(--color-success,#07965f)';
  footerIcon.style.fontSize = '16px';
  footer.append(footerIcon, document.createTextNode('Life is short. Stay focused on what truly matters.'));

  card.append(header, blockedMark, title, description, domainPill, rows, status, footer);
  overlay.appendChild(card);
  mountOverlay(overlay);
}

function shouldCheckPage() {
  return window.top === window && (window.location.protocol === 'http:' || window.location.protocol === 'https:');
}

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: false,
  runAt: 'document_start',
  main() {
    if (!shouldCheckPage()) return;
    chrome.runtime.sendMessage({ action: 'deep_focus_should_block_url', url: window.location.href }, (response: DeepFocusBlockResponse) => {
      if (chrome.runtime.lastError || !response?.ok || !response.blocked) return;
      showBlockedOverlay({
        sessionId: response.sessionId || '',
        sessionName: response.sessionName || '',
        blockedUrl: response.blockedUrl || window.location.href,
        blockedDomain: response.blockedDomain || window.location.hostname,
        restrictedWindowBlock: response.restrictedWindowBlock === true,
      });
    });
  },
});
