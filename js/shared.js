/* -------------------------------------------------------------
 * shared.js — artic. Global Behaviors
 * ------------------------------------------------------------- */

// ── 1. Theme (Dark/Light) ──
function initTheme() {
  const saved = localStorage.getItem('artic-theme');
  if (saved === 'dark') {
    document.body.classList.add('dark-mode');
  } else if (saved === 'light') {
    document.body.classList.remove('dark-mode');
  } else {
    const h = new Date().getHours();
    if (h >= 19 || h < 6) document.body.classList.add('dark-mode');
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('artic-theme', isDark ? 'dark' : 'light');
}

// ── 2. Nav Scroll — Show "artic." at exact scrollTop threshold ──
function initNavScroll(threshold) {
  const navHome = document.getElementById('nav-home');
  if (!navHome) return;

  function check() {
    navHome.classList.toggle('visible', window.scrollY >= threshold);
  }

  window.addEventListener('scroll', check, { passive: true });
  check();
}

// ── 3. Sub-page nav: animate "artic." only when coming from homepage ──
function initSubpageNav() {
  const navHome = document.getElementById('nav-home');
  if (!navHome || !navHome.classList.contains('animate-on-load')) return;

  const wasOnSubpage = sessionStorage.getItem('artic-subpage');

  if (wasOnSubpage) {
    // Already on a sub-page → show immediately, no animation
    navHome.style.transition = 'none';
    navHome.classList.add('visible');
    // Restore transition after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        navHome.style.transition = '';
      });
    });
  } else {
    // Coming from homepage → animate in with bezier
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        navHome.classList.add('visible');
      });
    });
  }

  sessionStorage.setItem('artic-subpage', 'true');
}

// ── 4. Responsive Mobile Sidebar Nav ──
function initMobileNav() {
  const nav = document.querySelector('.nav-bar');
  if (!nav) return;

  // Create hamburger button dynamically
  const burger = document.createElement('button');
  burger.className = 'hamburger-btn';
  burger.setAttribute('aria-label', 'Menu');
  burger.innerHTML = `
    <span class="burger-line line-1"></span>
    <span class="burger-line line-2"></span>
    <span class="burger-line line-3"></span>
  `;
  document.body.appendChild(burger);

  // Create backdrop overlay dynamically
  const overlay = document.createElement('div');
  overlay.className = 'nav-overlay';
  document.body.appendChild(overlay);

  // Toggle nav-open class on body when clicking the burger
  burger.addEventListener('click', (e) => {
    document.body.classList.toggle('nav-open');
  });

  // Close sidebar when clicking the backdrop overlay
  overlay.addEventListener('click', () => {
    document.body.classList.remove('nav-open');
  });

  // Close sidebar when clicking the transparent nav container itself (empty space)
  nav.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-link') && !e.target.closest('.nav-home')) {
      document.body.classList.remove('nav-open');
    }
  });

  // Close nav when clicking a link
  nav.querySelectorAll('.nav-link, .nav-home').forEach(link => {
    link.addEventListener('click', () => {
      document.body.classList.remove('nav-open');
    });
  });
}

// ── 5. Sub-page Landing Transition Overlay ──
function initSubpageTransition() {
  const mainContent = document.querySelector('.about-content, .container, .contact-wrap');
  if (!mainContent) return;

  // Do NOT run on homepage
  if (document.getElementById('hero-logo') || document.querySelector('.logo-split')) {
    return;
  }

  // Determine sub-page title
  let titleText = "";
  const activeNav = document.querySelector('.nav-link.active');
  if (activeNav) {
    titleText = activeNav.textContent.trim();
  } else {
    let docTitle = document.title;
    if (docTitle.includes('|')) docTitle = docTitle.split('|')[0];
    if (docTitle.includes('—')) docTitle = docTitle.split('—')[0];
    titleText = docTitle.trim();
  }
  titleText = titleText.toUpperCase();

  // Create overlay element
  const transitionOverlay = document.createElement('div');
  transitionOverlay.className = 'subpage-transition-overlay';
  transitionOverlay.innerHTML = `
    <div class="subpage-transition-title">${titleText}</div>
  `;
  document.body.appendChild(transitionOverlay);

  // Collect target reveal items
  let items = [];
  if (document.querySelector('.about-content')) {
    items = Array.from(document.querySelectorAll('.about-row'));
  } else if (document.querySelector('.container')) {
    items = Array.from(document.querySelectorAll('.project-card'));
  } else if (document.querySelector('.contact-wrap')) {
    items = Array.from(document.querySelectorAll('.contact-email'));
  }

  items.forEach((item, index) => {
    item.classList.add('reveal-item');
    // Staggered delay: starting after the overlay begins fading out (0.9s)
    item.style.transitionDelay = `${0.3 + index * 0.15}s`;
  });

  // Trigger animations
  requestAnimationFrame(() => {
    // Show title text
    transitionOverlay.classList.add('active');

    // After 0.9s, fade out the overlay
    setTimeout(() => {
      transitionOverlay.classList.add('fade-out');
      
      // Reveal the main content items one by one
      mainContent.classList.add('reveal-active');
      items.forEach(item => item.classList.add('revealed'));
    }, 900);

    // After 1.5s, completely remove overlay
    setTimeout(() => {
      transitionOverlay.style.display = 'none';
      transitionOverlay.remove();
    }, 1500);
  });
}

// ── 6. Init ──
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.addEventListener('click', toggleTheme);

  initSubpageNav();
  initMobileNav();
  initSubpageTransition();
});

// Apply theme before DOM ready
initTheme();
