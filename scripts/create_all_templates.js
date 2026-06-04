const fs = require('fs');
const path = require('path');

const baseDir = 'c:/Users/LA723SL/.gemini/antigravity/Homepage';
const templatesDir = path.join(baseDir, 'templates');

// Utility to create directory recursively if not exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

// 1. Create directories
ensureDir(path.join(templatesDir, 'global'));
ensureDir(path.join(templatesDir, 'layouts'));
ensureDir(path.join(templatesDir, 'components/base'));
ensureDir(path.join(templatesDir, 'components/forms'));
ensureDir(path.join(templatesDir, 'components/projects'));

// -------------------------------------------------------------
// Global Templates
// -------------------------------------------------------------

// global/header.html
const headerContent = `<nav class="nav-bar delayed-reveal">
  <a href="/" class="nav-home visible" id="nav-home">artic.</a>
  <a href="/about/" class="nav-link">About</a>
  <a href="/projects/" class="nav-link">Projects</a>
  <a href="javascript:void(0)" class="nav-link nav-artic-le">artic.le</a>
  <a href="/quarterly/" class="nav-link">Quarterly</a>
  <a href="/contact/" class="nav-link">Contact</a>
</nav>

<!-- Theme Toggle (Integrated inside Header) -->
<button class="theme-toggle" id="theme-toggle" aria-label="Toggle theme">
  <svg class="icon-moon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>
  <svg class="icon-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
</button>
`;

// global/footer.html
const footerContent = `<footer class="about-footer">
  © 2026 artic. All Rights Reserved
</footer>
`;

// global/popup.html
const popupContent = `<!-- Reusable Glassmorphic Popup/Modal Container -->
<div class="print-modal" id="print-modal">
  <div class="print-modal-backdrop" id="print-modal-backdrop"></div>
  <div class="print-modal-container">
    <button class="print-modal-close" id="print-modal-close" aria-label="Close modal">&times;</button>
    <div class="print-modal-content" id="print-modal-content">
      <!-- Injected Component Content -->
    </div>
  </div>
</div>

<style>
  /* ── Popup/Modal Core Styles ── */
  .print-modal {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    z-index: 1000;
    display: none; /* Controlled via JS */
    align-items: center;
    justify-content: center;
    padding: var(--space-md);
  }

  .print-modal.open {
    display: flex;
  }

  .print-modal-backdrop {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background-color: rgba(26, 26, 26, 0.4);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    opacity: 0;
    transition: opacity 0.5s ease;
  }

  .print-modal.open .print-modal-backdrop {
    opacity: 1;
  }

  .print-modal-container {
    position: relative;
    z-index: 2;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    width: 100%;
    max-width: 540px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 30px 90px rgba(0, 0, 0, 0.2);
    opacity: 0;
    transform: scale(0.96) translateY(12px);
    transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease;
  }

  .print-modal.open .print-modal-container {
    opacity: 1;
    transform: scale(1) translateY(0);
  }

  .print-modal-close {
    position: absolute;
    top: 20px;
    right: 20px;
    background: none;
    border: none;
    font-size: 1.5rem;
    font-weight: 300;
    line-height: 1;
    color: var(--text-muted);
    cursor: pointer;
    z-index: 10;
    transition: color 0.3s ease;
  }

  .print-modal-close:hover {
    color: var(--text-primary);
  }

  .print-modal-content {
    width: 100%;
    height: 100%;
  }
</style>
`;

// Write Global files
fs.writeFileSync(path.join(templatesDir, 'global/header.html'), headerContent, 'utf8');
fs.writeFileSync(path.join(templatesDir, 'global/footer.html'), footerContent, 'utf8');
fs.writeFileSync(path.join(templatesDir, 'global/popup.html'), popupContent, 'utf8');

// -------------------------------------------------------------
// Layout Templates
// -------------------------------------------------------------

// layouts/base.html
const baseLayoutContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="{{META_DESCRIPTION}}">
  <meta name="author" content="artic.">
  <title>{{PAGE_TITLE}} — artic.</title>
  <link rel="icon" type="image/png" href="{{PATH_DEPTH}}images/favicon.png">
  <link rel="stylesheet" href="{{PATH_DEPTH}}css/design-system.css">
  <link rel="stylesheet" href="{{PATH_DEPTH}}css/animations.css">
  <script>
    (function(){
      var s = localStorage.getItem('artic-theme');
      if (s === 'dark') document.documentElement.style.background = '#1A1A1A';
      else if (!s) { var h = new Date().getHours(); if (h >= 19 || h < 6) document.documentElement.style.background = '#1A1A1A'; }
    })();
  </script>
  {{ADDITIONAL_HEAD}}
</head>
<body>

  {{HEADER}}
  
  {{CONTENT}}

  {{FOOTER}}

  <script src="{{PATH_DEPTH}}js/shared.js"></script>
  {{ADDITIONAL_SCRIPTS}}
</body>
</html>
`;

// layouts/project-detail.html
const projectLayoutContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="artic. — {{PROJECT_TITLE}} ({{PROJECT_SUBTITLE}})">
  <meta name="author" content="artic.">
  <title>{{PROJECT_TITLE}} — {{PROJECT_SUBTITLE}} | artic.</title>
  <link rel="icon" type="image/png" href="../images/favicon.png">
  <link rel="preload" href="{{COVER_IMAGE}}" as="image">
  <link rel="stylesheet" href="../css/design-system.css">
  <script>
    (function(){
      var s = localStorage.getItem('artic-theme');
      if (s === 'dark') document.documentElement.style.background = '#1A1A1A';
      else if (!s) { var h = new Date().getHours(); if (h >= 19 || h < 6) document.documentElement.style.background = '#1A1A1A'; }
    })();
  </script>
  {{ADDITIONAL_HEAD}}
</head>
<body>

  {{HEADER}}

  <div class="page-container">
    
    <!-- Header Showcase Section -->
    <header class="album-showcase">
      <div class="album-art-wrapper">
        <img class="album-art" src="{{COVER_IMAGE}}" alt="{{PROJECT_TITLE}} Cover Art">
      </div>
      <div class="album-info">
        <h1 class="album-title">{{PROJECT_TITLE}}</h1>
        <p class="album-subtitle">{{PROJECT_SUBTITLE}}</p>
        <p class="album-description">{{PROJECT_DESCRIPTION}}</p>
      </div>
    </header>

    <!-- Two-Column Page Detail Grid Layout -->
    <div class="content-columns">
      <!-- Left (Streaming platforms, players, forms) -->
      <div class="left-column">
        {{LEFT_COLUMN_CONTENT}}
      </div>
      <!-- Right (Episodes, video lists, curation list) -->
      <div class="right-column">
        {{RIGHT_COLUMN_CONTENT}}
      </div>
    </div>

    {{FOOTER}}

  </div>

  <script src="../js/shared.js"></script>
  {{ADDITIONAL_SCRIPTS}}
</body>
</html>
`;

// Write Layout files
fs.writeFileSync(path.join(templatesDir, 'layouts/base.html'), baseLayoutContent, 'utf8');
fs.writeFileSync(path.join(templatesDir, 'layouts/project-detail.html'), projectLayoutContent, 'utf8');

// -------------------------------------------------------------
// Component Templates - Base
// -------------------------------------------------------------

// components/base/project-card.html
const projectCardContent = `<a href="{{SLUG}}" class="project-card-item">
  <div class="project-card-cover">
    <img src="{{COVER_IMAGE}}" alt="{{TITLE}} cover image">
  </div>
  <div class="project-card-info">
    <span class="project-card-client">{{CLIENT}}</span>
    <h3 class="project-card-title">{{TITLE}}</h3>
    <span class="project-card-category">{{CATEGORY}}</span>
    <span class="project-card-year">{{YEAR}}</span>
  </div>
</a>
`;

// components/base/button.html
const buttonContent = `<!-- Reusable Standard Button Component -->
<a href="{{URL}}" class="about-action" {{TARGET}}>
  {{SVG_ICON}}
  {{TEXT}}
</a>

<style>
  /* ── Reusable Button Styles ── */
  .about-action {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    background-color: var(--glass-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border-color);
    border-radius: 0px; /* Sharp corners matching artic. */
    font-family: var(--font-sans);
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--text-primary);
    text-decoration: none;
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    cursor: pointer;
  }

  .about-action:hover {
    background-color: var(--text-primary);
    border-color: var(--text-primary);
    color: var(--bg-primary);
    transform: translateY(-1px);
  }

  .about-action svg {
    width: 10px;
    height: 10px;
    fill: var(--text-primary);
    transition: fill 0.4s ease, transform 0.4s ease;
  }

  .about-action:hover svg {
    fill: var(--bg-primary);
    transform: scale(1.1);
  }
</style>
`;

// components/base/button-link.html
const buttonLinkContent = `<!-- Reusable Text Link Button with Underline Drawing and Arrow Transition -->
<a href="{{URL}}" class="section-link {{CLASS}}" {{TARGET}}>
  <span>{{TEXT}}</span>
  <svg viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
</a>

<style>
  /* ── Reusable Section Link Button Styles ── */
  .section-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-sans);
    font-size: 0.65rem;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--text-muted);
    transition: color 0.3s ease;
    white-space: nowrap;
    position: relative;
    padding-bottom: 2px;
    text-decoration: none; /* Reset underline */
  }

  .section-link::after {
    content: '';
    position: absolute;
    width: calc(100% - 20px);
    transform: scaleX(0);
    height: 1px;
    bottom: 0;
    left: 0;
    background-color: var(--text-primary);
    transform-origin: bottom right;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .section-link:hover::after {
    transform: scaleX(1);
    transform-origin: bottom left;
  }

  .section-link:hover {
    color: var(--text-primary);
  }

  .section-link svg {
    width: 12px;
    height: 12px;
    fill: currentColor;
    transition: transform 0.4s var(--ease-out-expo);
  }

  .section-link:hover svg {
    transform: translateX(4px);
  }
</style>
`;

// Write Base Component files
fs.writeFileSync(path.join(templatesDir, 'components/base/project-card.html'), projectCardContent, 'utf8');
fs.writeFileSync(path.join(templatesDir, 'components/base/button.html'), buttonContent, 'utf8');
fs.writeFileSync(path.join(templatesDir, 'components/base/button-link.html'), buttonLinkContent, 'utf8');

// -------------------------------------------------------------
// Component Templates - Forms (Backend Linked)
// -------------------------------------------------------------

// components/forms/waitlist-form-embedded.html
const waitlistFormContent = `<!--
  [Embedded Form Component] Join the Waitlist
  
  API INTEGRATION SPECIFICATION:
    - Endpoint (Production): POST https://us-central1-artic-official-home.cloudfunctions.net/waitlist
    - Endpoint (Staging/Local): POST http://127.0.0.1:5001/artic-official-home/us-central1/waitlist
    - Method: POST
    - Content-Type: application/json
    - Payload: { "email": "user@example.com" }
    
  DATABASE SCHEMA MAPPING (Firebase Firestore):
    - Collection: \`quarterly_subscribers\`
    - Document Fields:
      - \`email\`: string
      - \`created_at\`: timestamp (ServerValue.TIMESTAMP / serverTimestamp())
      
  DATABASE SCHEMA MAPPING (Local SQLite):
    - Table: \`quarterly_subscribers\`
    - Columns:
      - \`id\`: INTEGER PRIMARY KEY AUTOINCREMENT
      - \`email\`: TEXT NOT NULL
      - \`created_at\`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-->
<div class="waitlist-container">
  <button id="waitlist-toggle-btn" class="about-action">Join the Waitlist</button>
  <form id="waitlist-form" class="waitlist-form">
    <input type="email" id="waitlist-email" placeholder="ENTER YOUR EMAIL ADDRESS" required>
    <button type="submit" id="waitlist-submit-btn" aria-label="Submit email">
      <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    </button>
  </form>
  <div id="waitlist-message" class="waitlist-message"></div>
</div>

<style>
  /* ── Waitlist Form Style ── */
  .waitlist-container {
    position: relative;
    width: 100%;
    margin-top: 10px;
  }

  /* Inherited .about-action svg zoom animation */
  .about-action svg {
    width: 10px;
    height: 10px;
    fill: var(--text-primary);
    transition: fill 0.4s ease, transform 0.4s ease;
  }
  .about-action:hover svg {
    fill: var(--bg-primary);
    transform: scale(1.1);
  }

  .waitlist-form {
    display: none;
    position: relative;
    width: 100%;
    max-width: 320px;
    margin-top: 12px;
    opacity: 0;
    transition: opacity 0.5s ease;
  }

  .waitlist-form.active {
    display: flex;
    opacity: 1;
  }

  .waitlist-form input {
    flex: 1;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border-color);
    padding: 10px 0;
    padding-right: 40px;
    font-family: var(--font-sans);
    font-size: 0.72rem;
    color: var(--text-primary);
    outline: none;
    border-radius: 0;
    transition: border-color 0.4s ease;
  }

  .waitlist-form input:focus {
    border-bottom-color: var(--text-primary);
  }

  .waitlist-form button {
    position: absolute;
    right: 0;
    bottom: 0;
    background: none;
    border: none;
    width: 36px;
    height: 36px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0;
  }

  .waitlist-form button svg {
    width: 10px;
    height: 10px;
    fill: var(--text-muted);
    transition: fill 0.3s ease, transform 0.3s ease;
  }

  .waitlist-form button:hover svg {
    fill: var(--text-primary);
    transform: scale(1.15);
  }

  .waitlist-form button:disabled svg {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .waitlist-message {
    font-family: var(--font-sans);
    font-size: 0.65rem;
    line-height: 1.5;
    margin-top: 10px;
    display: none;
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  .waitlist-message.active {
    display: block;
    opacity: 1;
  }

  .waitlist-message.success {
    color: var(--accent-success, #10B981);
  }

  .waitlist-message.error {
    color: var(--accent-danger, #EF4444);
  }
</style>
`;

// components/forms/checkout-form-popup.html
const checkoutFormContent = `<!--
  [Popup Form Component] Purchase/Order Checkout
  
  API INTEGRATION SPECIFICATION:
    - Endpoint (Production): POST https://us-central1-artic-official-home.cloudfunctions.net/checkout
    - Endpoint (Staging/Local): POST http://localhost:8000/api/checkout (Node server proxy)
    - Method: POST
    - Content-Type: application/json
    - Payload: 
      {
        "name": string,
        "email": string,
        "phone": string,
        "address": string,
        "quantity": number,
        "depositor": string,
        "notes": string
      }
    
  DATABASE SCHEMA MAPPING (Firebase Firestore):
    - Collection: \`orders\`
    - Document Fields:
      - \`name\`: string
      - \`email\`: string
      - \`phone\`: string
      - \`address\`: string
      - \`quantity\`: number
      - \`depositor\`: string
      - \`notes\`: string
      - \`created_at\`: timestamp (ServerValue.TIMESTAMP / serverTimestamp())
      
  DATABASE SCHEMA MAPPING (Local SQLite):
    - Table: \`orders\`
    - Columns:
      - \`id\`: INTEGER PRIMARY KEY AUTOINCREMENT
      - \`name\`: TEXT NOT NULL
      - \`email\`: TEXT NOT NULL
      - \`phone\`: TEXT NOT NULL
      - \`address\`: TEXT NOT NULL
      - \`quantity\`: INTEGER NOT NULL
      - \`depositor\`: TEXT NOT NULL
      - \`notes\`: TEXT
      - \`created_at\`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-->
<div class="checkout-scroll-container">
  <div class="checkout-form-group">
    <label class="checkout-label">이름 *</label>
    <input type="text" id="chk-name" class="checkout-input" required placeholder="성함을 입력하세요">
  </div>
  <div class="checkout-form-group">
    <label class="checkout-label">이메일 *</label>
    <input type="email" id="chk-email" class="checkout-input" required placeholder="example@email.com">
  </div>
  <div class="checkout-form-group">
    <label class="checkout-label">연락처 *</label>
    <input type="tel" id="chk-phone" class="checkout-input" required placeholder="010-0000-0000">
  </div>
  <div class="checkout-form-group">
    <label class="checkout-label">배송지 주소 *</label>
    <input type="text" id="chk-address" class="checkout-input" required placeholder="배송 주소를 입력하세요">
  </div>
  <div class="checkout-form-group">
    <label class="checkout-label">수량 *</label>
    <select id="chk-quantity" class="checkout-select">
      <option value="1">1개 (15,000원 + 배송비 3,000원)</option>
      <option value="2">2개 (30,000원 + 배송비 3,000원)</option>
      <option value="3">3개 (45,000원 + 배송비 3,000원)</option>
      <option value="4">4개 (60,000원 + 배송비 3,000원)</option>
      <option value="5">5개 (75,000원 + 배송비 3,000원)</option>
    </select>
  </div>
  <div class="checkout-form-group">
    <label class="checkout-label">입금자명 <span style="font-size:0.6rem; color:var(--text-muted); font-weight:normal;">(입금자가 주문자명과 다를 경우에만 작성)</span></label>
    <input type="text" id="chk-depositor" class="checkout-input" placeholder="입금자명을 입력하세요">
  </div>
  <div class="checkout-form-group">
    <label class="checkout-label">요청사항</label>
    <textarea id="chk-notes" class="checkout-textarea" placeholder="기타 배송 시 요청사항을 작성하세요"></textarea>
  </div>
</div>

<style>
  /* ── Checkout Form Styling ── */
  .checkout-scroll-container {
    max-height: 380px;
    overflow-y: auto;
    padding-right: 8px;
    padding-bottom: 24px;
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    text-align: left;
  }

  .checkout-scroll-container::-webkit-scrollbar {
    width: 2px;
  }

  .checkout-scroll-container::-webkit-scrollbar-thumb {
    background-color: var(--border-color);
  }

  .checkout-form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .checkout-label {
    font-family: var(--font-sans);
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-primary);
    letter-spacing: 0.05em;
  }

  .checkout-input, .checkout-select, .checkout-textarea {
    width: 100%;
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    padding: 12px 14px;
    border-radius: 4px;
    font-family: var(--font-sans);
    font-size: 0.78rem;
    color: var(--text-primary);
    outline: none;
    transition: border-color 0.3s ease, background-color 0.3s ease;
  }

  .checkout-input:focus, .checkout-select:focus, .checkout-textarea:focus {
    border-color: var(--text-primary);
    background-color: var(--bg-card);
  }

  .checkout-textarea {
    resize: vertical;
    min-height: 70px;
    height: 70px;
  }
</style>
`;

// Write Forms Component files
fs.writeFileSync(path.join(templatesDir, 'components/forms/waitlist-form-embedded.html'), waitlistFormContent, 'utf8');
fs.writeFileSync(path.join(templatesDir, 'components/forms/checkout-form-popup.html'), checkoutFormContent, 'utf8');

// -------------------------------------------------------------
// Component Templates - Projects (Detail Subcomponents)
// -------------------------------------------------------------

// components/projects/player.html
const playerContent = `<!-- Reusable Player Component -->
<div class="play-widget" id="play-widget">
  <div class="play-track-info">
    <span class="play-track-num" id="play-track-num">01</span>
    <div class="play-track-text">
      <span class="play-track-title" id="play-track-title">Track Title</span>
      <span class="play-track-status" id="play-track-status">Ready</span>
    </div>
  </div>
  <div class="play-progress-wrap">
    <span class="play-time" id="play-current">0:00</span>
    <div class="play-bar-track" id="play-bar-track">
      <div class="play-bar-fill" id="play-bar-fill"></div>
    </div>
    <span class="play-time dur" id="play-duration">0:00</span>
  </div>
  <div class="play-controls">
    <button class="play-ctrl-btn" id="play-prev-btn" aria-label="Previous track">
      <svg viewBox="0 0 24 24"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2" fill="none"/></svg>
      Prev
    </button>
    <button class="play-main-btn" id="play-main-btn" aria-label="Play">
      <svg viewBox="0 0 24 24" id="play-main-icon"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    </button>
    <button class="play-ctrl-btn" id="play-next-btn" aria-label="Next track">
      Next
      <svg viewBox="0 0 24 24"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2" fill="none"/></svg>
    </button>
  </div>
</div>
`;

// components/projects/lyric-and-tracklist.html
const lyricAndTracklistContent = `<!-- Swipeable Lyric & Tracklist Carousel with Locked Gestures -->
<div class="play-lyrics-wrap" id="play-lyrics-wrap">
  <div class="carousel-indicators" id="carousel-indicators">
    <div class="carousel-dot active" data-slide="0" title="Lyrics"></div>
    <div class="carousel-dot" data-slide="1" title="Tracklist"></div>
  </div>
  <div class="carousel-viewport" id="carousel-viewport">
    <div class="carousel-track" id="carousel-track">
      <div class="carousel-slide">
        <div class="play-lyrics-content" id="play-lyrics-content"></div>
      </div>
      <div class="carousel-slide">
        <div class="tracklist-container" id="tracklist-container"></div>
      </div>
    </div>
  </div>
</div>
`;

// components/projects/streaming-platforms.html
const streamingPlatformsContent = `<!-- Streaming platformsAvailable on cards -->
<main class="links-container expanded">
  <div class="mobile-toggle-header">
    <span class="stream-group-label stream-label">Available On</span>
    <span class="toggle-icon"></span>
  </div>
  <div class="toggle-content">
    <!-- Links populated dynamically or configured statically per projects -->
    {{STREAMING_PLATFORM_CARDS}}
  </div>
</main>
`;

// components/projects/video-archive.html
const videoArchiveContent = `<!-- YouTube Documentary Video Accordion Archive -->
<div class="archive-group">
  <div class="mobile-toggle-header">
    <span class="archive-group-label film-label">{{ARCHIVE_TITLE}}</span>
    <span class="toggle-icon"></span>
  </div>
  <div class="archive-list toggle-content">
    <!-- Video Entries populated via updating scripts -->
    {{VIDEO_ENTRIES}}
  </div>
</div>
`;

// components/projects/featured-video.html
const featuredVideoContent = `<!-- Reusable Custom Single Video Layout -->
<div class="archive-entry active" data-vid="{{VIDEO_ID}}">
  <a class="archive-item latest-featured-item" href="javascript:void(0)">
    <div class="archive-item-left">
      <div class="archive-item-text">
        <div class="archive-item-title-row">
          <span class="archive-item-title">{{TITLE}}</span>
          <span class="archive-item-date">{{DATE}}</span>
        </div>
      </div>
    </div>
  </a>
  <div class="archive-embed open">
    <div class="custom-video-poster" data-vid="{{VIDEO_ID}}" style="opacity: 0; transition: opacity 0.8s ease;">
      <img class="poster-thumbnail" src="https://img.youtube.com/vi/{{VIDEO_ID}}/maxresdefault.jpg" alt="Video Cover">
      <div class="poster-play-btn">
        <svg viewBox="0 0 24 24"><polygon points="8 5 19 12 8 19 8 5"/></svg>
      </div>
    </div>
  </div>
</div>

<style>
  /* ── Featured Custom Video Poster Styles ── */
  .custom-video-poster {
    position: relative;
    width: 100%;
    aspect-ratio: 16/9;
    cursor: pointer;
    background-color: #000;
    overflow: hidden;
  }

  .poster-thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.8;
    transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease;
  }

  .custom-video-poster:hover .poster-thumbnail {
    transform: scale(1.02);
    opacity: 0.95;
  }

  .poster-play-btn {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background-color: var(--text-primary);
    color: var(--bg-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .poster-play-btn svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
    margin-left: 2px;
  }

  .custom-video-poster:hover .poster-play-btn {
    transform: translate(-50%, -50%) scale(1.1);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  }
</style>
`;

// components/projects/text-curation.html
const textCurationContent = `<!-- Text Curation Block (Bilingual Side-by-Side/Stacked) -->
<div class="archive-group text-curation-group">
  <div class="mobile-toggle-header">
    <span class="archive-group-label">{{CURATION_LABEL}}</span>
    <span class="toggle-icon"></span>
  </div>
  <div class="toggle-content curation-body">
    <h3 class="curation-title">{{CURATION_TITLE}}</h3>
    <span class="curation-subtitle">{{CURATION_SUBTITLE}}</span>
    <p class="curation-text-ko">{{CURATION_BODY_KO}}</p>
    <p class="curation-text-en">{{CURATION_BODY_EN}}</p>
  </div>
</div>
`;

// components/projects/music-playlist.html
const musicPlaylistContent = `<!-- VIP Party Curation Audio Playlist -->
<div class="archive-group music-playlist-group">
  <div class="mobile-toggle-header">
    <span class="archive-group-label">Playlist</span>
    <span class="toggle-icon"></span>
  </div>
  <div class="toggle-content playlist-body">
    <div class="playlist-container" id="playlist-container">
      <!-- Generated items with inline play/pause trigger -->
    </div>
  </div>
</div>
`;

// Write Projects component files
fs.writeFileSync(path.join(templatesDir, 'components/projects/player.html'), playerContent, 'utf8');
fs.writeFileSync(path.join(templatesDir, 'components/projects/lyric-and-tracklist.html'), lyricAndTracklistContent, 'utf8');
fs.writeFileSync(path.join(templatesDir, 'components/projects/streaming-platforms.html'), streamingPlatformsContent, 'utf8');
fs.writeFileSync(path.join(templatesDir, 'components/projects/video-archive.html'), videoArchiveContent, 'utf8');
fs.writeFileSync(path.join(templatesDir, 'components/projects/featured-video.html'), featuredVideoContent, 'utf8');
fs.writeFileSync(path.join(templatesDir, 'components/projects/text-curation.html'), textCurationContent, 'utf8');
fs.writeFileSync(path.join(templatesDir, 'components/projects/music-playlist.html'), musicPlaylistContent, 'utf8');

console.log("All layouts and components design templates created successfully!");
