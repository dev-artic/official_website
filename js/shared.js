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

  // Create mobile header bar dynamically for top gradient blur boundary
  const mobileHeader = document.createElement('div');
  mobileHeader.className = 'mobile-header-bar';
  document.body.appendChild(mobileHeader);

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

  // Clear nav-open on bfcache restore (back/forward navigation)
  // Prevents blur overlay from persisting after page transition
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      document.body.classList.remove('nav-open');
    }
  });

  // Safety net: always start with nav closed
  document.body.classList.remove('nav-open');
}

// ── 5. Sub-page Landing Transition Overlay ──
function initSubpageTransition() {
  const mainContent = document.querySelector('.about-content, .container, .contact-wrap, .page-container');
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
  if (document.getElementById('dial-viewport')) {
    items = [document.getElementById('dial-viewport')];
    // Clean up the mask after transition completes to ensure horizontal scrolling works perfectly
    const viewport = document.getElementById('dial-viewport');
    viewport.addEventListener('transitionend', function handler(e) {
      if (e.propertyName === 'mask-position' || e.propertyName === '-webkit-mask-position') {
        viewport.style.maskImage = 'none';
        viewport.style.webkitMaskImage = 'none';
        viewport.removeEventListener('transitionend', handler);
      }
    });
  } else if (document.querySelector('.about-content')) {
    items = Array.from(document.querySelectorAll('.about-row'));
  } else if (document.querySelector('.container')) {
    items = Array.from(document.querySelectorAll('.project-card'));
  } else if (document.querySelector('.contact-wrap')) {
    items = Array.from(document.querySelectorAll('.contact-email'));
  }

  items.forEach((item, index) => {
    item.classList.add('reveal-item');
    if (item.id === 'dial-viewport') {
      item.style.transitionDelay = '0s';
    } else {
      // Staggered delay: starting after the overlay begins fading out (0.9s)
      item.style.transitionDelay = `${0.3 + index * 0.15}s`;
    }
  });

  // Trigger animations
  requestAnimationFrame(() => {
    // Show title text
    transitionOverlay.classList.add('active');

    // Reveal all delayed elements (nav + content) after 200ms behind the curtain of the white overlay
    const delayedElements = document.querySelectorAll('.delayed-reveal');
    if (delayedElements.length > 0) {
      setTimeout(() => {
        delayedElements.forEach(el => el.classList.add('revealed'));
      }, 200);
    }

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

// ── 6. artic.le Text Swap Animation (To Be Updated) ──
function initArticleMenu() {
  const links = document.querySelectorAll('.nav-artic-le');
  if (links.length === 0) return;

  // Insert transition helper style if not already present
  if (!document.getElementById('artic-le-transition-style')) {
    const style = document.createElement('style');
    style.id = 'artic-le-transition-style';
    style.textContent = `
      .nav-artic-le {
        transition: opacity 0.25s ease, color 0.3s ease !important;
      }
      .nav-artic-le.nav-link-fade {
        opacity: 0 !important;
      }
    `;
    document.head.appendChild(style);
  }

  links.forEach(link => {
    let isTransitioning = false;
    
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (isTransitioning) return;
      isTransitioning = true;
      
      // 1. Fade out
      link.classList.add('nav-link-fade');
      
      setTimeout(() => {
        // 2. Change text to "to be updated"
        link.textContent = 'to be updated';
        // 3. Fade back in
        link.classList.remove('nav-link-fade');
        
        // Keep it for 1.5 seconds
        setTimeout(() => {
          // 4. Fade out again
          link.classList.add('nav-link-fade');
          
          setTimeout(() => {
            // 5. Revert text to "artic.le"
            link.textContent = 'artic.le';
            // 6. Fade back in
            link.classList.remove('nav-link-fade');
            isTransitioning = false;
          }, 250); // fade out duration
        }, 1500); // text display duration
      }, 250); // fade out duration
    });
  });
}

// ── 7. Init ──
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.addEventListener('click', toggleTheme);

  initSubpageNav();
  initMobileNav();
  initSubpageTransition();
  initArticleMenu();
});

// Apply theme before DOM ready
initTheme();
