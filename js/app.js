/**
 * APP CONTROLLER
 * Manages global UI elements, sticky navigation states, and mobile overlays.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Sticky and Glassmorphic Header Toggle on Scroll
  const header = document.querySelector('header');
  
  const handleScroll = () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  // Run scroll handler on load and scroll events
  window.addEventListener('scroll', handleScroll);
  handleScroll();

  // Mobile Menu Toggling
  const burgerBtn = document.querySelector('.burger-menu');
  const mobileOverlay = document.querySelector('.mobile-overlay');
  const mobileLinks = document.querySelectorAll('.mobile-link');

  if (burgerBtn && mobileOverlay) {
    const toggleMobileMenu = () => {
      burgerBtn.classList.toggle('active');
      mobileOverlay.classList.toggle('active');
      
      // Prevent body scrolling when menu is open
      if (mobileOverlay.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    };

    burgerBtn.addEventListener('click', toggleMobileMenu);

    // Close menu when a link is clicked
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        burgerBtn.classList.remove('active');
        mobileOverlay.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  console.log('ARTIC Official Homepage Boilerplate Initialized Successfully.');
});
