import * as React from 'react';

interface FeaturePresentationCardProps {
  onClose: () => void;
  onBack?: () => void;
}

export const FeaturePresentationCard: React.FC<FeaturePresentationCardProps> = ({ onClose, onBack }) => {

  const containerStyle = {
    '--bg': '#080b12',
    '--panel': '#101522',
    '--panel-soft': '#0d121d',
    '--text': '#f4f5f7',
    '--muted': '#9ca4b2',
    '--muted-2': '#757e8d',
    '--line': 'rgba(255,255,255,.085)',
    '--accent': '#a57cff',
    '--accent-soft': 'rgba(165,124,255,.11)',
    '--radius': '18px',
    '--max': '1180px',
    width: '100%',
    height: '100%',
    overflowY: 'auto',
    background: `radial-gradient(800px 420px at 75% 8%, rgba(109,72,192,.13), transparent 68%), var(--bg)`,
    color: 'var(--text)',
    fontFamily: '"Inter", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    WebkitFontSmoothing: 'antialiased',
    lineHeight: 1.5,
  } as React.CSSProperties;

  return (
    <div className="presentation-container tutorial-overlay-scroll relative" style={containerStyle}>

      {/* Sticky top-right action controls (Docs & Close button) */}
      <div
        style={{
          position: 'sticky',
          top: '16px',
          float: 'right',
          marginRight: '20px',
          marginTop: '16px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <a
          href="https://www.cmdos.app/docs"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open cmdOS documentation"
          title="Open cmdOS documentation"
          style={{
            background: 'linear-gradient(135deg, rgba(165,124,255,0.18) 0%, rgba(121,81,232,0.15) 100%)',
            border: '1px solid rgba(165,124,255,0.38)',
            borderRadius: '20px',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#f4f5f7',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
            lineHeight: 1,
            boxShadow: '0 4px 14px rgba(165,124,255,0.15)',
            transition: 'color 0.15s, background 0.15s, border-color 0.15s, transform 0.15s, box-shadow 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(165,124,255,0.28) 0%, rgba(121,81,232,0.25) 100%)';
            e.currentTarget.style.borderColor = 'rgba(165,124,255,0.6)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(165,124,255,0.3)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#f4f5f7';
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(165,124,255,0.18) 0%, rgba(121,81,232,0.15) 100%)';
            e.currentTarget.style.borderColor = 'rgba(165,124,255,0.38)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(165,124,255,0.15)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="#d2baff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span>Docs</span>
        </a>

        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#9ca3af',
            fontSize: '16px',
            lineHeight: 1,
            transition: 'color 0.15s, background 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f3f4f6'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .presentation-container * { box-sizing: border-box; }
        .presentation-container .page { width: min(var(--max), calc(100% - 40px)); margin: 0 auto; padding: 30px 0 44px; }
        .presentation-container .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 50px; font-size: 22px; font-weight: 800; letter-spacing: -.025em; }
        .presentation-container .brand-mark { width: 30px; height: 30px; display: block; flex: none; border-radius: 8px; object-fit: cover; }
        .presentation-container .hero { display: grid; grid-template-columns: 1.15fr .85fr; gap: 44px; align-items: start; margin-bottom: 34px; }
        .presentation-container h1 { max-width: 760px; margin: 0 0 22px; font-size: clamp(40px, 5vw, 62px); line-height: 1.05; letter-spacing: -.05em; font-weight: 800; }
        .presentation-container .hero p { max-width: 680px; margin: 0 0 12px; color: var(--muted); font-size: 16px; }
        .presentation-container .hero strong { color: #ddd0ff; font-weight: 700; }
        .presentation-container .section-label { margin-bottom: 10px; color: #d4d7dd; font-size: 13px; font-weight: 700; letter-spacing: .01em; }
        .presentation-container .objects { padding-top: 4px; }
        .presentation-container .objects h2 { margin: 0 0 8px; font-size: 20px; letter-spacing: -.025em; font-weight: 700; }
        .presentation-container .objects p { margin: 0 0 14px; color: var(--muted); font-size: 14px; }
        .presentation-container .object-list { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
        .presentation-container .object-list li { display: flex; align-items: center; gap: 11px; min-height: 39px; border-bottom: 1px solid var(--line); color: #d9dde4; font-size: 14px; }
        .presentation-container .object-icon { width: 22px; flex: none; color: var(--accent); text-align: center; font-size: 14px; }
        .presentation-container .object-list .beta { color: var(--muted-2); font-size: 12px; }
        .presentation-container .command-showcase { width: 100%; margin: 0 0 34px; overflow: hidden; border-radius: 18px; background: #050812; }
        .presentation-container .command-showcase iframe { display: block; width: 100%; height: 410px; border: 0; background: #050812; }
        @media(max-width:980px) { .presentation-container .command-showcase { overflow-x: auto; } .presentation-container .command-showcase iframe { min-width: 1079px; } }
        .presentation-container .footer-everywhere { display: grid; grid-template-columns: 1.7fr repeat(4, 1fr); align-items: center; row-gap: 0; margin: 0 0 18px; padding: 12px 20px; overflow: hidden; border: 1px solid rgba(255,255,255,.10); border-radius: 14px; background: radial-gradient(360px 110px at 0% 50%, rgba(87,72,170,.13), transparent 72%), linear-gradient(180deg, #101626 0%, #0b101c 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,.018), 0 14px 34px rgba(0,0,0,.16); }
        .presentation-container .footer-everywhere__title, .presentation-container .footer-everywhere__item { min-height: 32px; display: flex; align-items: center; }
        .presentation-container .footer-everywhere__title { justify-content: flex-start; padding-right: 18px; color: #f5f6f8; font-size: 15px; font-weight: 750; letter-spacing: -.02em; white-space: nowrap; line-height: 1; }
        .presentation-container .footer-everywhere__item { justify-content: center; gap: 10px; padding: 0 8px; border-left: none; color: #b9c0cb; font-size: 12px; white-space: nowrap; }
        .presentation-container .footer-everywhere__icon { width: 21px; height: 21px; display: grid; place-items: center; flex: none; }
        .presentation-container .footer-everywhere__icon svg { width: 21px; height: 21px; stroke: #e0e3e8; stroke-width: 1.8; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .presentation-container .google-g { width: 22px; height: 22px; display: block; flex: none; }
        .presentation-container .footer-cta { min-height: 258px; display: flex; align-items: center; padding: 38px 44px; overflow: hidden; border: 1px solid rgba(255,255,255,.12); border-radius: 18px; background: radial-gradient(670px 290px at 100% 100%, rgba(53,91,190,.28), transparent 69%), radial-gradient(340px 240px at 0% 50%, rgba(107,76,195,.16), transparent 74%), linear-gradient(180deg, #141b30 0%, #0d1424 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,.02), 0 20px 56px rgba(0,0,0,.26); }
        .presentation-container .footer-cta__inner { display: flex; align-items: center; gap: 48px; width: 100%; }
        .presentation-container .footer-cta__terminal { width: 154px; height: 154px; display: grid; place-items: center; flex: none; border: 4px solid #c5a9ff; border-radius: 34px; background: radial-gradient(circle at 52% 42%, rgba(122,82,225,.22), transparent 66%), #0b1020; box-shadow: 0 0 0 2px rgba(116,79,206,.24), 0 0 24px rgba(190,158,255,.78), 0 0 58px rgba(112,74,211,.35); }
        .presentation-container .footer-cta__terminal svg { width: 78px; height: 78px; overflow: visible; }
        .presentation-container .footer-cta__copy { display: flex; flex-direction: column; align-items: flex-start; }
        .presentation-container .footer-cta__copy h3 { margin: 0 0 12px; color: #f6f7f9; font-size: 36px; line-height: 1.08; font-weight: 650; letter-spacing: -.045em; }
        .presentation-container .footer-cta__copy p { margin: 0 0 24px; color: #b7bec9; font-size: 17px; }
        .presentation-container .footer-cta__button { cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 50px; padding: 0 22px; border: 1px solid rgba(255,255,255,.15); border-radius: 10px; background: linear-gradient(90deg, #6541da 0%, #9b6df0 100%); box-shadow: 0 12px 30px rgba(89,51,183,.28); color: #fff; text-decoration: none; font-size: 15px; font-weight: 750; }
        @media(max-width:980px) { .presentation-container .hero { grid-template-columns: 1fr; } .presentation-container .footer-everywhere { grid-template-columns: 1fr 1fr; padding: 14px 18px 12px; } .presentation-container .footer-everywhere__title { grid-column: 1/-1; } .presentation-container .footer-everywhere__item { justify-content: flex-start; padding: 4px 0; } .presentation-container .footer-cta { min-height: auto; padding: 32px; } .presentation-container .footer-cta__terminal { width: 122px; height: 122px; border-radius: 28px; } .presentation-container .footer-cta__copy h3 { font-size: 30px; } }
        @media(max-width:620px) { .presentation-container .page { width: min(var(--max), calc(100% - 24px)); padding-top: 20px; } .presentation-container .brand { margin-bottom: 34px; } .presentation-container .footer-everywhere { grid-template-columns: 1fr; } .presentation-container .footer-everywhere__title { grid-column: auto; } .presentation-container .footer-cta { padding: 26px; } .presentation-container .footer-cta__inner { flex-direction: column; align-items: flex-start; gap: 26px; } .presentation-container .footer-cta__terminal { width: 100px; height: 100px; border-radius: 24px; } .presentation-container .footer-cta__terminal svg { width: 56px; height: 56px; } .presentation-container .footer-cta__copy h3 { font-size: 27px; } .presentation-container .footer-cta__copy p { font-size: 15px; } .presentation-container .footer-cta__button { width: 100%; } }
      `}</style>


      {/* Main HTML Content converted to JSX */}
      
  <main className="page">
    <div className="brand">
      <img className="brand-mark" src="data:image/png;base64,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" alt="cmdOS icon" />
      <div>cmdOS</div>
    </div>

    <section className="hero">
      <div>
        <h1>The fastest way to access everything on the web</h1>
        <p>Our knowledge and work are scattered across notes, files, links, tab sessions, AI chats, tasks, bookmarks, documents, and more.</p>
        <p>We spend 3–4 hours every week searching, switching between tools, and navigating the web.</p>
        <p><strong>cmdOS turns every part of your work into a command.</strong></p>
      </div>

      <aside className="objects">
        <h2>Objects you can command</h2>
        <p>Create an object, assign it a command, and access it whenever you need it.</p>
        <ul className="object-list">
          <li><span className="object-icon">▤</span>Notes</li>
          <li><span className="object-icon">↗</span>Links</li>
          <li><span className="object-icon">▣</span>Tab sessions</li>
          <li><span className="object-icon">✦</span>AI chat agents</li>
          <li><span className="object-icon">✓</span>To-do tasks</li>
          <li><span className="object-icon">▧</span>Documents</li>
          <li><span className="object-icon">⌘</span>Workflow automations <span className="beta">· Beta</span></li>
          <li><span className="object-icon">•••</span>And more</li>
        </ul>
      </aside>
    </section>

    <section className="command-showcase" aria-label="cmdOS command interface examples">
      <iframe
        title="cmdOS command interface examples"
        srcDoc={`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>cmdOS — Command UI</title>
<style>
:root {
  --bg:#050812;
  --panel:#0b101b;
  --panel-soft:#111725;
  --panel-row:#131a28;
  --border:#31394e;
  --border-soft:#1f2738;
  --text:#f6f7fb;
  --muted:#8d96a8;
  --purple:#9b5cff;
  --purple-soft:#7951e8;
}
* { box-sizing:border-box; }
html,body { margin:0; min-height:100%; background:#050812; }
body {
  color:var(--text);
  font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  display:flex;
  justify-content:center;
  padding:0;
}
.stage {
  width:1079px;
  min-height:410px;
  position:relative;
  overflow:hidden;
  background:
    radial-gradient(circle at 52% 11%, rgba(92,61,182,.10), transparent 28%),
    linear-gradient(180deg,#050812 0%,#080d17 100%);
}
.header {
  position:absolute;
  left:16px;
  top:38px;
  height:84px;
  display:flex;
  align-items:center;
}
.brand-icon {
  width:84px;
  height:84px;
  border-radius:20px;
  border:1px solid #293246;
  background:#090e18;
  display:grid;
  place-items:center;
  overflow:hidden;
}
.brand-icon img { width:54px; height:54px; border-radius:12px; }
.brand-name {
  margin-left:20px;
  font-size:42px;
  line-height:1;
  font-weight:760;
  letter-spacing:-.045em;
}
.tagline {
  margin-left:38px;
  margin-top:1px;
}
.tagline strong {
  display:block;
  font-size:20px;
  line-height:1.2;
  font-weight:500;
  color:#d4d9e3;
}
.tagline span {
  display:block;
  margin-top:5px;
  font-size:15px;
  color:#929bac;
}

.main-panel {
  position:absolute;
  left:70px;
  top:28px;
  width:905px;
  height:292px;
  border:1px solid #39425a;
  border-radius:20px;
  overflow:hidden;
  background:linear-gradient(180deg,rgba(14,20,33,.985),rgba(9,14,24,.985));
  box-shadow:0 24px 70px rgba(0,0,0,.34), 0 0 0 1px rgba(146,91,255,.04);
}
.command-bar {
  height:65px;
  padding:0 27px;
  display:flex;
  align-items:center;
  border-bottom:1px solid #222b3d;
  box-shadow:inset 0 -1px 0 rgba(150,87,255,.34);
}
.command-prefix {
  font-size:28px;
  font-weight:760;
  color:var(--purple);
  margin-right:24px;
}
.command-query {
  font-size:27px;
  line-height:1;
  letter-spacing:-.025em;
  flex:1;
}
.cursor {
  display:inline-block;
  width:1px;
  height:29px;
  margin-left:2px;
  vertical-align:-5px;
  background:#d9dde6;
}
.shortcut {
  font-size:12px;
  color:#b0b7c5;
  background:#171e2a;
  border:1px solid #232c3d;
  border-radius:7px;
  padding:7px 9px;
}
.shortcut-note {
  margin-left:10px;
  font-size:12px;
  color:#717a8b;
}
.section-label {
  height:34px;
  padding:13px 27px 0;
  color:#8c95a6;
  font-size:12px;
}
.primary-row {
  height:58px;
  margin:0 16px;
  padding:0 14px;
  display:flex;
  align-items:center;
  gap:13px;
  border-radius:10px;
  background:rgba(20,27,43,.72);
}
.check {
  width:30px;
  height:30px;
  border-radius:7px;
  border:1px solid #a14ef3;
  display:grid;
  place-items:center;
  color:#d078ff;
  font-size:18px;
  flex:0 0 auto;
}
.primary-copy { flex:1; }
.primary-title {
  font-size:14px;
  font-weight:680;
}
.primary-title .c { color:#ffffff; margin-right:5px; }
.primary-sub {
  margin-top:2px;
  font-size:12px;
  color:#919aab;
}
.enter {
  font-size:12px;
  color:#b9c1cf;
  background:#171e2a;
  padding:6px 9px;
  border-radius:7px;
}
.launch {
  margin-left:5px;
  color:#8791a3;
  font-size:22px;
}

.more-label {
  height:31px;
  padding:12px 27px 0;
  color:#8c95a6;
  font-size:12px;
}
.more-results {
  height:104px;
  padding:0 16px 14px;
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:6px;
}
.result {
  min-height:44px;
  border:1px solid transparent;
  border-radius:9px;
  background:rgba(13,19,32,.56);
  display:flex;
  align-items:center;
  gap:10px;
  padding:7px 10px;
}
.result:hover {
  background:#121a29;
  border-color:#273149;
}
.result-icon {
  width:30px;
  height:30px;
  border-radius:8px;
  background:#fff;
  display:grid;
  place-items:center;
  flex:0 0 auto;
  overflow:hidden;
}
.result-icon img {
  width:20px;
  height:20px;
  object-fit:contain;
}
.result-copy { min-width:0; flex:1; }
.result-title {
  font-size:12px;
  font-weight:670;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.result-title .c {
  color:#ffffff;
  margin-right:4px;
}
.result-sub {
  margin-top:2px;
  font-size:10px;
  color:#818b9d;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.result-arrow {
  color:#697487;
  font-size:15px;
}

.advanced-strip {
  position:absolute;
  left:16px;
  top:334px;
  width:1047px;
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:9px;
}
.advanced-card {
  height:58px;
  border:1px solid #242d40;
  border-radius:11px;
  background:linear-gradient(180deg,#101725,#0b111d);
  display:flex;
  align-items:center;
  gap:8px;
  padding:8px 9px;
  min-width:0;
}
.advanced-icon {
  width:32px;
  height:32px;
  border-radius:8px;
  background:#fff;
  display:grid;
  place-items:center;
  flex:0 0 auto;
  overflow:hidden;
}
.advanced-icon img {
  width:19px;
  height:19px;
  object-fit:contain;
}
.advanced-copy {
  min-width:0;
  flex:1;
}
.advanced-title {
  font-size:11px;
  font-weight:650;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.advanced-title .c {
  color:#ffffff;
  margin-right:4px;
}
.advanced-type {
  margin-left:4px;
  padding:2px 4px;
  border-radius:5px;
  background:#171e2b;
  color:#9ca5b6;
  font-size:8px;
  font-weight:550;
}
.advanced-sub {
  margin-top:3px;
  font-size:9px;
  color:#9099aa;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.icon-stack {
  display:flex;
  align-items:center;
  margin-left:auto;
  padding-left:3px;
}
.icon-stack span {
  width:20px;
  height:20px;
  margin-left:-5px;
  border:2px solid #0b111d;
  border-radius:6px;
  background:#fff;
  display:grid;
  place-items:center;
  overflow:hidden;
}
.icon-stack span:first-child {
  margin-left:0;
}
.icon-stack img {
  width:11px;
  height:11px;
  object-fit:contain;
}
.icon-stack .plus {
  width:auto;
  padding:0 5px;
  background:#1a2231;
  border-color:#263146;
  color:#c7cfdd;
  font-size:8px;
  font-weight:700;
}
@media (max-width:1080px) {
  body { overflow-x:auto; }
  .stage { transform-origin:top left; }
}
</style>
</head>
<body>
<div class="stage">
<section class="main-panel">
    <div class="command-bar">
      <div class="command-prefix">c</div>
      <div class="command-query">daily task<span class="cursor"></span></div>
      <div class="shortcut">Alt + S</div>
      <div class="shortcut-note">to open cmdOS</div>
    </div>

    <div class="section-label">Commands</div>

    <div class="primary-row">
      <div class="check">✓</div>
      <div class="primary-copy">
        <div class="primary-title"><span class="c">c</span>daily task</div>
        <div class="primary-sub">Open your Daily Task list</div>
      </div>
      <div class="enter">Enter</div>
      <div class="launch">↗</div>
    </div>

    <div class="more-label">More results</div>

    <div class="more-results">
      <div class="result">
        <div class="result-icon">
          <img src="https://cdn.simpleicons.org/notion/000000" alt="">
        </div>
        <div class="result-copy">
          <div class="result-title"><span class="c">c</span>meeting notes</div>
          <div class="result-sub">Open today&#x27;s meeting notes</div>
        </div>
        <div class="result-arrow">→</div>
      </div>

      <div class="result">
        <div class="result-icon">
          <img src="https://cdn.simpleicons.org/linear/5E6AD2" alt="">
        </div>
        <div class="result-copy">
          <div class="result-title"><span class="c">c</span>my issues</div>
          <div class="result-sub">Open assigned Linear issues</div>
        </div>
        <div class="result-arrow">→</div>
      </div>

      <div class="result">
        <div class="result-icon">
          <img src="https://cdn.simpleicons.org/googledrive/4285F4" alt="">
        </div>
        <div class="result-copy">
          <div class="result-title"><span class="c">c</span>project plan</div>
          <div class="result-sub">Open project plan in Drive</div>
        </div>
        <div class="result-arrow">→</div>
      </div>

      <div class="result">
        <div class="result-icon">
          <img src="https://www.vectorlogo.zone/logos/slack/slack-icon.svg" alt="">
        </div>
        <div class="result-copy">
          <div class="result-title"><span class="c">c</span>team updates</div>
          <div class="result-sub">Open the team updates channel</div>
        </div>
        <div class="result-arrow">→</div>
      </div>
    </div>
  </section>

  <section class="advanced-strip">
    <article class="advanced-card">
      <div class="advanced-icon">
        <img src="https://cdn.simpleicons.org/notion/000000" alt="Bulk Links">
      </div>
      <div class="advanced-copy">
        <div class="advanced-title"><span class="c">c</span>John&#x27;s Project <span class="advanced-type">Bulk Links</span></div>
        <div class="advanced-sub">Open every project link</div>
      </div>
      <div class="icon-stack">
        <span><img src="https://cdn.simpleicons.org/notion/000000" alt=""></span>
        <span><img src="https://cdn.simpleicons.org/googledrive/4285F4" alt=""></span>
        <span><img src="https://cdn.simpleicons.org/github/000000" alt=""></span>
        <span class="plus">+4</span>
      </div>
    </article>

    <article class="advanced-card">
      <div class="advanced-icon">
        <img src="https://cdn.simpleicons.org/googlechrome/4285F4" alt="Bulk Links">
      </div>
      <div class="advanced-copy">
        <div class="advanced-title"><span class="c">c</span>research pack <span class="advanced-type">Bulk Links</span></div>
        <div class="advanced-sub">Open saved research sources</div>
      </div>
      <div class="icon-stack">
        <span><img src="https://cdn.simpleicons.org/youtube/FF0000" alt=""></span>
        <span><img src="https://cdn.simpleicons.org/reddit/FF4500" alt=""></span>
        <span><img src="https://cdn.simpleicons.org/notion/000000" alt=""></span>
        <span class="plus">+5</span>
      </div>
    </article>

    <article class="advanced-card">
      <div class="advanced-icon">
        <img src="https://cdn.simpleicons.org/googlechrome/4285F4" alt="Session">
      </div>
      <div class="advanced-copy">
        <div class="advanced-title"><span class="c">c</span>launch session <span class="advanced-type">Session</span></div>
        <div class="advanced-sub">Open four apps together</div>
      </div>
      <div class="icon-stack">
        <span><img src="https://www.vectorlogo.zone/logos/slack/slack-icon.svg" alt=""></span>
        <span><img src="https://cdn.simpleicons.org/gmail/EA4335" alt=""></span>
        <span><img src="https://cdn.simpleicons.org/linear/5E6AD2" alt=""></span>
        <span><img src="https://cdn.simpleicons.org/notion/000000" alt=""></span>
      </div>
    </article>

    <article class="advanced-card">
      <div class="advanced-icon">
        <img src="https://www.vectorlogo.zone/logos/slack/slack-icon.svg" alt="Slack">
      </div>
      <div class="advanced-copy">
        <div class="advanced-title"><span class="c">c</span>founder agent <span class="advanced-type">Chat Agent</span></div>
        <div class="advanced-sub">Ask across startup context</div>
      </div>
      <div class="icon-stack">
        <span><img src="https://cdn.simpleicons.org/openai/000000" alt=""></span>
        <span><img src="https://cdn.simpleicons.org/anthropic/D97757" alt=""></span>
        <span><img src="https://cdn.simpleicons.org/googlegemini/8E75B2" alt=""></span>
      </div>
    </article>
  </section>
</div>
</body>
</html>`}
      ></iframe>
    </section>

    <section className="footer-everywhere" aria-label="Works everywhere">
      <div className="footer-everywhere__title">Works everywhere in your browser</div>

      <div className="footer-everywhere__item">
        <span className="footer-everywhere__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3c2.4 2.45 3.7 5.45 3.7 9S14.4 18.55 12 21" />
            <path d="M12 3C9.6 5.45 8.3 8.45 8.3 12S9.6 18.55 12 21" />
          </svg>
        </span>
        <span>Websites</span>
      </div>

      <div className="footer-everywhere__item">
        <span className="footer-everywhere__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
            <path d="M3.5 8.5h17" />
            <path d="M16.5 4.5v4" />
          </svg>
        </span>
        <span>New tabs</span>
      </div>

      <div className="footer-everywhere__item">
        <svg className="google-g" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-4z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20H42V20H24v8h11.3c-.8 2.3-4.2 5.6-4.2 5.6l.1-.1 6.2 5.2C37 39.1 44 34 44 24c0-1.3-.1-2.7-.4-4z"/>
        </svg>
        <span>Browser omnibox</span>
      </div>

      <div className="footer-everywhere__item">
        <span className="footer-everywhere__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M5 3l12.5 9.1-5.3 1.2 3.3 5.3-2.8 1.7-3.2-5.3L6 19z" />
          </svg>
        </span>
        <span>Input fields</span>
      </div>

    </section>

    <section className="footer-cta">
      <div className="footer-cta__inner">
        <div className="footer-cta__terminal" aria-hidden="true">
          <svg viewBox="0 0 88 88">
            <path d="M20 22l24 22-24 22" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M49 67h22" fill="none" stroke="#a87cff" strokeWidth="8" strokeLinecap="round"/>
          </svg>
        </div>

        <div className="footer-cta__copy">
          <h3>Command OS</h3>
          <p>Built for power users who value speed, focus, and complete control.</p>
          <button className="footer-cta__button" onClick={onClose}>
            <span>Start using cmdOS</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>

  </main>

      {/* Footer nav — matches other onboarding cards, sits at bottom of scroll */}
      {onBack && (
        <div style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          height: '64px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
          position: 'relative',
        }}>
          {/* Back button — moved slightly right with extra left padding */}
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              fontSize: '13px',
              fontWeight: 600,
              padding: '8px 16px',
              marginLeft: '60px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#d1d5db')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
          >
            ‹ Back
          </button>

          {/* Progress dots — absolutely centered */}
          <div style={{ display: 'flex', gap: '8px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            {[1,2,3,4].map(i => (
              <span key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: i === 4 ? '#8b5cf6' : '#1f2937', display: 'inline-block' }} />
            ))}
          </div>

          {/* Right spacer to keep dots visually centered */}
          <div style={{ width: '80px' }} />
        </div>
      )}
    </div>
  );
};
