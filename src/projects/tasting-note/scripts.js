// -- Inline video embed toggle (close-first-then-open) --
    (function() {
      // Stagger right column episodes animation delays dynamically
      document.querySelectorAll('.archive-list .archive-entry').forEach((entry, idx) => {
        entry.style.animationDelay = (3.1 + idx * 0.05) + 's';
      });

      let openEntry = null;
      let closeTimeout = null;

      // Preload video thumbnails for instant display
      (function preloadThumbnails() {
        document.querySelectorAll('.archive-entry[data-vid]').forEach(entry => {
          const vid = entry.dataset.vid;
          if (vid) {
            const img = new Image();
            img.src = 'https://img.youtube.com/vi/' + vid + '/maxresdefault.jpg';
          }
        });
      })();

      // Set the default open entry so the JS knows it is open on load
      const initialOpen = document.querySelector('.archive-entry.active');
      if (initialOpen) {
        openEntry = initialOpen;
        const poster = openEntry.querySelector('.custom-video-poster');
        if (poster) {
          const vid = openEntry.dataset.vid;
          const embed = openEntry.querySelector('.archive-embed');
          poster.addEventListener('click', function(e) {
            e.stopPropagation();
            poster.style.opacity = '0';
            setTimeout(() => {
              const iframe = document.createElement('iframe');
              iframe.src = 'https://www.youtube.com/embed/' + vid + '?autoplay=1&rel=0&modestbranding=1';
              iframe.allow = "autoplay; encrypted-media";
              iframe.allowFullscreen = true;
              iframe.style.opacity = '0';
              iframe.style.transition = 'opacity 0.5s ease';
              embed.innerHTML = '';
              embed.appendChild(iframe);
              iframe.offsetHeight; // Force layout reflow
              iframe.style.opacity = '1';
            }, 300);
          });
        }
      }

      function closeEntry(entry, callback) {
        if (closeTimeout) {
          clearTimeout(closeTimeout);
          closeTimeout = null;
        }
        entry.classList.remove('active');
        const embed = entry.querySelector('.archive-embed');
        embed.classList.remove('open');
        closeTimeout = setTimeout(() => {
          embed.innerHTML = '';
          closeTimeout = null;
          if (callback) callback();
        }, 650);
      }

      function openEntryFn(entry) {
        if (closeTimeout) {
          clearTimeout(closeTimeout);
          closeTimeout = null;
        }
        const embed = entry.querySelector('.archive-embed');
        const vid = entry.dataset.vid;
        
        // Render custom video poster with opacity 0 initially for fade-in transition
        embed.innerHTML = `
          <div class="custom-video-poster" data-vid="${vid}" style="opacity: 0; transition: opacity 0.8s ease;">
            <img class="poster-thumbnail" src="https://img.youtube.com/vi/${vid}/maxresdefault.jpg" alt="Video Cover">
            <div class="poster-play-btn">
              <svg viewBox="0 0 24 24"><polygon points="8 5 19 12 8 19 8 5"/></svg>
            </div>
          </div>
        `;
        
        // Clean poster click transition -> loads actual youtube autoplay iframe with fade-in
        embed.querySelector('.custom-video-poster').addEventListener('click', function(e) {
          e.stopPropagation();
          const poster = this;
          poster.style.opacity = '0';
          setTimeout(() => {
            const iframe = document.createElement('iframe');
            iframe.src = 'https://www.youtube.com/embed/' + vid + '?autoplay=1&rel=0&modestbranding=1';
            iframe.allow = "autoplay; encrypted-media";
            iframe.allowFullscreen = true;
            iframe.style.opacity = '0';
            iframe.style.transition = 'opacity 0.5s ease';
            embed.innerHTML = '';
            embed.appendChild(iframe);
            iframe.offsetHeight; // Force layout reflow
            iframe.style.opacity = '1';
          }, 300);
        });

        entry.classList.add('active');
        // Force layout reflow before triggering slide-open animation
        embed.offsetHeight; 
        embed.classList.add('open');
        
        // Delay the fade-in of the poster to allow smooth container unfolding
        setTimeout(() => {
          const poster = embed.querySelector('.custom-video-poster');
          if (poster) {
            poster.offsetHeight; // Force layout reflow
            poster.style.opacity = '1';
          }
        }, 200);
        
        openEntry = entry;
      }

      document.querySelectorAll('.archive-entry[data-vid]').forEach(entry => {
        entry.querySelector('.archive-item').addEventListener('click', (e) => {
          e.preventDefault();

          if (openEntry === entry) {
            closeEntry(entry);
            openEntry = null;
          } else if (openEntry) {
            const toOpen = entry;
            closeEntry(openEntry, () => {
              setTimeout(() => {
                openEntryFn(toOpen);
              }, 150);
            });
          } else {
            openEntryFn(entry);
          }
        });
      });

      // Slowly fade in the Latest Release video poster after stagger finishes
      setTimeout(() => {
        const latestEntry = document.querySelector('.links-container .archive-entry');
        if (latestEntry) {
          const poster = latestEntry.querySelector('.custom-video-poster');
          if (poster) {
            poster.offsetHeight; // Force layout reflow
            poster.style.opacity = '1';
          }
        }
      }, 3500);
    })();

    // ── Mobile Accordion Toggle ──
    document.querySelectorAll('.mobile-toggle-header').forEach(header => {
      header.addEventListener('click', function() {
        if (window.innerWidth <= 767) {
          const parent = this.parentElement;
          parent.classList.toggle('expanded');
        }
      });
    });