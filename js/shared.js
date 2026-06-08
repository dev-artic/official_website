// ── Global Scroll Position Reset on Page Reload ──
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
// Immediate scroll reset (covers normal load)
window.scrollTo(0, 0);
// Also reset on pageshow (covers back/forward bfcache restores and
// cases where the browser defers scroll restoration until after scripts run)
window.addEventListener('pageshow', function(e) {
  window.scrollTo(0, 0);
});

// ── UAT API Routing ──
// Localhost normally uses Firebase emulators. QA can explicitly opt into
// production Cloud Functions with ?artic_uat=production, and reset with
// ?artic_uat=local.
(function initApiRouting() {
  const PROD_API = {
    waitlist: 'https://waitlist-4n2xy6gsxa-uc.a.run.app',
    checkout: 'https://checkout-4n2xy6gsxa-uc.a.run.app',
    products: 'https://products-4n2xy6gsxa-uc.a.run.app',
    quarterlyContents: 'https://quarterlycontents-4n2xy6gsxa-uc.a.run.app',
    imageProxy: 'https://imageproxy-4n2xy6gsxa-uc.a.run.app',
    admin: 'https://admin-4n2xy6gsxa-uc.a.run.app',
    quarterlyAdmin: 'https://quarterlyadmin-4n2xy6gsxa-uc.a.run.app'
  };
  const LOCAL_API = {
    waitlist: '/api/waitlist',
    checkout: '/api/checkout',
    products: '/api/products',
    quarterlyContents: '/api/quarterly-contents',
    imageProxy: '/api/image-proxy',
    admin: '/api/admin/products',
    adminData: '/api/admin/data',
    quarterlyAdmin: '/api/admin/quarterly'
  };

  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const params = new URLSearchParams(window.location.search);
  const uatFlag = (params.get('artic_uat') || params.get('api_env') || '').toLowerCase();
  const urlForcesProduction = ['production', 'prod', 'live'].includes(uatFlag);
  const urlForcesLocal = ['local', 'emulator', 'staging'].includes(uatFlag);

  try {
    if (urlForcesProduction) {
      localStorage.setItem('artic-api-env', 'production');
    } else if (urlForcesLocal) {
      localStorage.removeItem('artic-api-env');
    }
  } catch (err) {
    console.warn('Unable to persist artic API environment preference.', err);
  }

  let forcedProduction = false;
  try {
    forcedProduction = localStorage.getItem('artic-api-env') === 'production';
  } catch (err) {
    forcedProduction = false;
  }

  const useProductionApi = !isLocalHost || urlForcesProduction || (!urlForcesLocal && forcedProduction);
  window.articApiEnv = {
    mode: useProductionApi ? 'production' : 'local',
    isProductionApi: useProductionApi,
    isLocalHost
  };
  document.documentElement.dataset.articApiMode = window.articApiEnv.mode;

  window.getArticApiUrl = function getArticApiUrl(key) {
    if (useProductionApi) {
      if (key === 'adminData') return PROD_API.admin;
      return PROD_API[key] || key;
    }
    return LOCAL_API[key] || key;
  };

  if (isLocalHost && useProductionApi) {
    console.warn('[artic. UAT] Production API mode is enabled on localhost. Real server data and emails may be affected.');
  }
})();

// ── Shared Bezier Scroll Motion ──
function cubicBezierAt(t, p1, p2) {
  const inv = 1 - t;
  return 3 * inv * inv * t * p1 + 3 * inv * t * t * p2 + t * t * t;
}

function solveBezierProgress(progress, x1, y1, x2, y2) {
  let lower = 0;
  let upper = 1;
  let t = progress;

  for (let i = 0; i < 12; i++) {
    const x = cubicBezierAt(t, x1, x2);
    if (Math.abs(x - progress) < 0.001) break;
    if (x < progress) lower = t;
    else upper = t;
    t = (lower + upper) / 2;
  }

  return cubicBezierAt(t, y1, y2);
}

function articSmoothScrollTo(targetY, options = {}) {
  const startY = window.scrollY || window.pageYOffset || 0;
  const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const endY = Math.max(0, Math.min(targetY, maxY));
  const distance = endY - startY;
  const duration = options.duration || Math.min(1100, Math.max(520, Math.abs(distance) * 0.72));
  const start = performance.now();

  if (Math.abs(distance) < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo(0, endY);
    return Promise.resolve();
  }

  return new Promise(resolve => {
    function step(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = solveBezierProgress(progress, 0.16, 1, 0.3, 1);
      window.scrollTo(0, startY + distance * eased);
      if (progress < 1) requestAnimationFrame(step);
      else resolve();
    }

    requestAnimationFrame(step);
  });
}

window.articSmoothScrollTo = articSmoothScrollTo;

function initBezierAnchorScroll() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || link.target || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !url.hash) return;

    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;

    event.preventDefault();
    history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
    const top = target.getBoundingClientRect().top + window.scrollY;
    articSmoothScrollTo(top - 72);
  });
}

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
  const mainContent = document.querySelector('.about-content, .container, .contact-wrap, .page-container, .acha-page');
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
        transition-duration: 0.6s, 0.3s, 0.3s, 0.3s !important;
        transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1), cubic-bezier(0.16, 1, 0.3, 1), cubic-bezier(0.16, 1, 0.3, 1), ease !important;
      }
      .nav-open .nav-bar .nav-artic-le.nav-link-fade,
      .nav-artic-le.nav-link-fade {
        opacity: 0 !important;
        transition-delay: 0s !important;
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
      
      const isMobile = window.innerWidth < 768;

      if (isMobile) {
        // --- Mobile Logic: Expand via bezier on click, revert via pure fade without layout shift ---
        const initialWidth = link.scrollWidth;
        link.style.width = initialWidth + 'px';
        
        // Force layout reflow
        link.offsetHeight;

        link.classList.add('nav-link-fade');
        
        setTimeout(() => {
          link.textContent = 'to be updated';
          const targetWidth = link.scrollWidth;
          link.style.width = targetWidth + 'px';
          
          link.classList.remove('nav-link-fade');
          
          setTimeout(() => {
            link.classList.add('nav-link-fade');
            
            setTimeout(() => {
              // Revert: disable width transition temporarily to reset instantly
              link.style.transition = 'none';
              link.textContent = 'artic.le';
              link.style.width = initialWidth + 'px';
              
              // Force reflow
              link.offsetHeight;
              
              // Restore transition attributes
              link.style.transition = '';
              
              link.classList.remove('nav-link-fade');
              
              setTimeout(() => {
                link.style.width = '';
                isTransitioning = false;
              }, 300); // match fade-in duration
            }, 300); // wait for full fade out (300ms)
          }, 1500); // display duration
        }, 300); // wait for full fade out (300ms)
        
      } else {
        // --- Desktop Logic: Retain width bezier logic alongside text fade ---
        const initialWidth = link.scrollWidth;
        link.style.width = initialWidth + 'px';
        
        // Force layout reflow
        link.offsetHeight;
        
        link.classList.add('nav-link-fade');
        
        setTimeout(() => {
          link.textContent = 'to be updated';
          const targetWidth = link.scrollWidth;
          link.style.width = targetWidth + 'px';
          
          link.classList.remove('nav-link-fade');
          
          setTimeout(() => {
            link.classList.add('nav-link-fade');
            
            setTimeout(() => {
              link.style.width = initialWidth + 'px';
              
              setTimeout(() => {
                link.textContent = 'artic.le';
                link.classList.remove('nav-link-fade');
                
                setTimeout(() => {
                  link.style.width = '';
                  isTransitioning = false;
                }, 300); // matching remaining width transition duration
              }, 300); // contract halfway
            }, 300); // wait for full fade out (300ms)
          }, 1500); // display duration
        }, 300); // wait for full fade out (300ms)
      }
    });
  });
}

// ── Dynamic Height Transitions for centered layouts ──
function initDynamicHeightTransitions() {
  const target = document.querySelector('.about-content, .contact-wrap');
  if (!target) return;

  let lastHeight = target.offsetHeight;
  let lastTop = target.getBoundingClientRect().top + window.scrollY;

  const observer = new ResizeObserver(entries => {
    for (let entry of entries) {
      const newHeight = target.offsetHeight;
      const newRect = target.getBoundingClientRect();
      const newTop = newRect.top + window.scrollY;

      if (newHeight !== lastHeight) {
        const currentTransform = window.getComputedStyle(target).transform;
        let currentY = 0;
        if (currentTransform && currentTransform !== 'none') {
          const matrix = new DOMMatrix(currentTransform);
          currentY = matrix.m42;
        }

        const rawNewTop = newTop - currentY;
        const rawOldTop = lastTop - currentY;
        const layoutShift = rawNewTop - rawOldTop;

        if (Math.abs(layoutShift) > 0.5) {
          target.style.transition = 'none';
          target.style.transform = `translateY(${-layoutShift}px)`;
          
          target.offsetHeight; // force reflow

          target.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
          target.style.transform = 'translateY(0)';
        }

        lastHeight = newHeight;
        lastTop = newTop;
      }
    }
  });

  observer.observe(target);

  target.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'transform') {
      target.style.transition = '';
      target.style.transform = '';
      lastTop = target.getBoundingClientRect().top + window.scrollY;
    }
  });

  window.addEventListener('resize', () => {
    lastHeight = target.offsetHeight;
    lastTop = target.getBoundingClientRect().top + window.scrollY;
  });
}

// ── Waitlist Form Interactivity ──
function initWaitlistForm() {
  const form = document.getElementById('waitlist-form');
  if (!form) return;

  const toggleBtn = document.getElementById('waitlist-toggle-btn');
  const nameInput = document.getElementById('waitlist-name');
  const emailInput = document.getElementById('waitlist-email');
  const submitBtn = document.getElementById('waitlist-submit-btn');
  const messageDiv = document.getElementById('waitlist-message');
  const fieldsWrapper = form.querySelector('.waitlist-fields-wrapper');
  const btnWrapper = document.getElementById('waitlist-btn-wrapper');
  const formWrapper = document.getElementById('waitlist-form-wrapper');
  const messageWrapper = document.getElementById('waitlist-message-wrapper');
  const container = document.querySelector('.waitlist-container');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (btnWrapper) btnWrapper.classList.remove('active');
      if (formWrapper) formWrapper.classList.add('active');
      if (nameInput) {
        setTimeout(() => nameInput.focus(), 250);
      }
    });
  }

  // Input event listeners to clear error outlines instantly
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      nameInput.classList.remove('waitlist-input-error');
    });
  }
  if (emailInput) {
    emailInput.addEventListener('input', () => {
      emailInput.classList.remove('waitlist-input-error');
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';

    let hasError = false;

    // Clear previous validation states
    if (nameInput) nameInput.classList.remove('waitlist-input-error');
    if (emailInput) emailInput.classList.remove('waitlist-input-error');
    if (fieldsWrapper) fieldsWrapper.classList.remove('waitlist-shake');

    // 1. Name validation
    if (!name) {
      if (nameInput) {
        nameInput.classList.add('waitlist-input-error');
        nameInput.focus();
      }
      hasError = true;
    }

    // 2. Email validation (Format check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      if (emailInput) {
        emailInput.classList.add('waitlist-input-error');
        if (!hasError) emailInput.focus();
      }
      hasError = true;
    }

    // Tactile shake response for invalid submissions
    if (hasError) {
      if (fieldsWrapper) {
        // Force reflow to restart keyframe animation
        fieldsWrapper.offsetHeight;
        fieldsWrapper.classList.add('waitlist-shake');
      }
      return;
    }

    // Disable inputs and start submitting visual feedback
    if (nameInput) nameInput.disabled = true;
    if (emailInput) emailInput.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    
    if (container) container.classList.add('submitting');
    form.classList.add('submitting');
    if (messageWrapper) messageWrapper.classList.remove('active');
    
    if (messageDiv) messageDiv.innerHTML = '';

    const apiUrl = window.getArticApiUrl ? window.getArticApiUrl('waitlist') : '/api/waitlist';

    // Promise to ensure the loading line states last at least 800ms for smooth cinematic feel
    const animPromise = new Promise(resolve => setTimeout(resolve, 800));

    const fetchPromise = fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: name, email: email })
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => { throw new Error(err.error || 'Submission failed') });
      }
      return res.json();
    });

    Promise.all([fetchPromise, animPromise])
    .then(([data]) => {
      if (container) container.classList.remove('submitting');
      if (formWrapper) formWrapper.classList.remove('active');

      if (messageDiv) {
        messageDiv.innerHTML = `
          <div class="success-title">artic.</div>
          <div class="success-desc">You have been successfully registered on the quarterly artic. waitlist.</div>
        `;
      }
      if (messageWrapper) messageWrapper.classList.add('active');
    })
    .catch(err => {
      // Restore form fields in case of API errors (e.g. duplicate email)
      if (nameInput) nameInput.disabled = false;
      if (emailInput) emailInput.disabled = false;
      if (submitBtn) submitBtn.disabled = false;
      if (container) container.classList.remove('submitting');
      form.classList.remove('submitting');
      
      if (messageDiv) {
        const message = err.message || 'An error occurred. Please try again.';
        const isDuplicate = message.toLowerCase().includes('already registered');
        const isInvalidAddress = message.toLowerCase().includes('invalid address');
        messageDiv.className = `waitlist-message ${isDuplicate ? 'duplicate' : 'error'}`;
        messageDiv.textContent = isInvalidAddress ? 'invalid address' : message;
      }
      if (messageWrapper) messageWrapper.classList.add('active');
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
  initDynamicHeightTransitions();
  initWaitlistForm();
  initBezierAnchorScroll();
});

// Apply theme before DOM ready
initTheme();
