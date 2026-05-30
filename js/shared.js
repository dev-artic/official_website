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

  // Toggle nav-open class on body
  burger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.body.classList.toggle('nav-open');
  });

  // Close sidebar when clicking outside
  document.addEventListener('click', (e) => {
    if (document.body.classList.contains('nav-open') && !nav.contains(e.target) && !burger.contains(e.target)) {
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

// ── 5. Init ──
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.addEventListener('click', toggleTheme);

  initSubpageNav();
  initMobileNav();
});

// Apply theme before DOM ready
initTheme();
