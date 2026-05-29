/**
 * REVEAL CONTROLLER - INTERSECTION OBSERVER
 * Handles scroll-triggered fade and slide reveal animations for elements.
 */

document.addEventListener('DOMContentLoaded', () => {
  const revealElements = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    const revealCallback = (entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          // Once revealed, we don't need to observe it anymore
          observer.unobserve(entry.target);
        }
      });
    };

    const revealOptions = {
      root: null, // viewport
      threshold: 0.15, // trigger when 15% of the element is visible
      rootMargin: '0px 0px -50px 0px' // offset bottom trigger slightly
    };

    const observer = new IntersectionObserver(revealCallback, revealOptions);

    revealElements.forEach(element => {
      observer.observe(element);
    });
  } else {
    // Fallback for older browsers
    revealElements.forEach(element => {
      element.classList.add('active');
    });
  }
});
