// ── 0. Dynamic Navigation Bar ──
function buildNavigationBar() {
  const nav = document.querySelector('.nav-bar');
  if (!nav) return;

  // Extract and preserve original classes of #nav-home (e.g. 'animate-on-load', 'visible')
  const originalHome = nav.querySelector('#nav-home');
  let homeClasses = 'nav-home';
  if (originalHome) {
    homeClasses = originalHome.className || 'nav-home';
  }

  const pathname = window.location.pathname;

  // Unified Navigator menu definition (shared by both desktop and mobile views)
  const menuItems = [
    { name: 'About', href: '/about/' },
    { name: 'Projects', href: '/projects/' },
    { name: 'artic.le', href: 'javascript:void(0)' },
    { name: 'Quarterly', href: '/quarterly/' },
    { name: 'Contact', href: '/contact/' }
  ];

  const isProjectsActive = pathname.includes('/projects/') || 
                           pathname.includes('/deus-ex-machina/') || 
                           pathname.includes('/gagosian-party-music/') || 
                           pathname.includes('/neutral-interview/') || 
                           pathname.includes('/tasting-note/') || 
                           pathname.includes('/the-root/');

  // Generate Navigation links dynamically
  // --nav-idx CSS custom properties are automatically assigned for modular transition delays
  let linksHtml = `<a href="/" class="${homeClasses}" id="nav-home" style="--nav-idx: 0;">artic.</a>\n`;

  menuItems.forEach((item, index) => {
    const isArticle = item.name === 'artic.le';
    let isActive = false;

    if (!isArticle) {
      if (item.href === '/projects/') {
        isActive = isProjectsActive;
      } else {
        isActive = pathname.includes(item.href);
      }
    }

    const activeClass = isActive ? 'active' : '';
    const articleClass = isArticle ? 'nav-artic-le' : '';

    linksHtml += `    <a href="${item.href}" class="nav-link ${activeClass} ${articleClass}" style="--nav-idx: ${index + 1};">${item.name}</a>\n`;
  });

  nav.innerHTML = linksHtml;
}

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

  // Close nav when clicking a link (except for the artic.le menu to keep overlay waiting)
  nav.querySelectorAll('.nav-link, .nav-home').forEach(link => {
    link.addEventListener('click', () => {
      if (link.classList.contains('nav-artic-le')) {
        return;
      }
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
        display: inline-block !important;
        vertical-align: bottom;
        white-space: nowrap;
        overflow: hidden;
        transition-property: width, opacity, transform, color !important;
        transition-duration: 0.6s, 0.25s, 0.5s, 0.3s !important;
        transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1), ease, cubic-bezier(0.16, 1, 0.3, 1), ease !important;
      }
      .nav-open .nav-bar .nav-artic-le.nav-link-fade,
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
      
      // 1. Lock current width based on scrollWidth
      const initialWidth = link.scrollWidth;
      link.style.width = initialWidth + 'px';
      
      // Force layout reflow
      link.offsetHeight;
      
      // 2. Fade out
      link.classList.add('nav-link-fade');
      
      setTimeout(() => {
        // 3. Change text to "to be updated"
        link.textContent = 'to be updated';
        // 4. Measure new target width and transition width
        const targetWidth = link.scrollWidth;
        link.style.width = targetWidth + 'px';
        
        // 5. Fade back in
        link.classList.remove('nav-link-fade');
        
        // Keep it for 1.5 seconds
        setTimeout(() => {
          // 6. Fade out again
          link.classList.add('nav-link-fade');
          
          setTimeout(() => {
            // 7. Start reverting target width (takes 600ms bezier transition)
            link.style.width = initialWidth + 'px';
            
            // 8. Wait for width transition to contract halfway, then swap text and fade back in
            setTimeout(() => {
              link.textContent = 'artic.le';
              link.classList.remove('nav-link-fade');
              
              // 9. Clear explicit width after transition completely finishes
              setTimeout(() => {
                link.style.width = '';
                isTransitioning = false;
              }, 300); // remaining width duration (600 - 300 = 300ms)
            }, 300); // offset to allow width animation to contract halfway before text fades in
            
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

  // Dynamic Navigation rendering must occur before initializing sub-nav or article behaviors
  buildNavigationBar();

  initSubpageNav();
  initMobileNav();
  initSubpageTransition();
  initArticleMenu();
});

// Apply theme before DOM ready
initTheme();
