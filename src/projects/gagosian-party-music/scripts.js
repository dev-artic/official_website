// == Instagram Reel Embed Toggle with UI Cropping ==
    (function() {
      const poster = document.getElementById('reel-poster');
      if (poster) {
        const wrapper = poster.parentElement;
        poster.addEventListener('click', function(e) {
          e.stopPropagation();
          poster.style.opacity = '0';
          
          setTimeout(() => {
            // Replace with cropped Instagram Reel responsive embed
            wrapper.innerHTML = `
              <iframe class="video-embed-iframe" src="https://www.instagram.com/reel/C_kspT5yBi4/embed/" allowtransparency="true" frameborder="0" scrolling="no" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>
            `;
          }, 300);
        });
      }
    })();

    // == YouTube Playlist Player Integration ==
    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    var ytPlayer;
    var currentActiveEntry = null;
    var fadeInterval = null;

    function onYouTubeIframeAPIReady() {
      const ytDiv = document.createElement('div');
      ytDiv.id = 'yt-hidden-player';
      ytDiv.style.position = 'fixed';
      ytDiv.style.bottom = '-100px';
      ytDiv.style.right = '-100px';
      ytDiv.style.width = '1px';
      ytDiv.style.height = '1px';
      ytDiv.style.opacity = '0.01';
      ytDiv.style.pointerEvents = 'none';
      ytDiv.style.zIndex = '-9999';
      document.body.appendChild(ytDiv);

      ytPlayer = new YT.Player('yt-hidden-player', {
        height: '1',
        width: '1',
        videoId: '',
        playerVars: {
          'autoplay': 0,
          'controls': 0,
          'rel': 0,
          'showinfo': 0,
          'modestbranding': 1,
          'playsinline': 1
        },
        events: {
          'onStateChange': onPlayerStateChange,
          'onError': onPlayerError
        }
      });
    }

    const playIconHTML = '<svg class="archive-icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    const pauseIconHTML = '<svg class="archive-icon" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

    function setEntryState(entry, state) {
      const iconWrapper = entry.querySelector('.archive-item-left');
      if (!iconWrapper) return;
      const oldIcon = iconWrapper.querySelector('.archive-icon');
      if (oldIcon) oldIcon.remove();

      if (state === 'playing') {
        entry.classList.add('playing');
        entry.classList.remove('paused');
        iconWrapper.insertAdjacentHTML('afterbegin', pauseIconHTML);
      } else if (state === 'paused') {
        entry.classList.add('paused');
        entry.classList.remove('playing');
        iconWrapper.insertAdjacentHTML('afterbegin', playIconHTML);
      } else {
        entry.classList.remove('playing', 'paused');
        iconWrapper.insertAdjacentHTML('afterbegin', playIconHTML);
      }
    }

    function fadeIn(player, durationMs, callback) {
      if (fadeInterval) clearInterval(fadeInterval);
      try {
        player.setVolume(0);
      } catch(e) {}
      
      var start = 0;
      var end = 100;
      var step = 5;
      var intervalTime = durationMs / (end / step);
      
      var currentVol = start;
      fadeInterval = setInterval(function() {
        currentVol += step;
        if (currentVol >= end) {
          currentVol = end;
          clearInterval(fadeInterval);
          fadeInterval = null;
          try {
            player.setVolume(end);
          } catch(e) {}
          if (callback) callback();
        } else {
          try {
            player.setVolume(currentVol);
          } catch(e) {}
        }
      }, intervalTime);
    }

    function fadeOut(player, durationMs, callback) {
      if (fadeInterval) clearInterval(fadeInterval);
      
      var start = 100;
      try {
        start = player.getVolume();
      } catch(e) {}
      
      if (start <= 0) {
        if (callback) callback();
        return;
      }
      
      var end = 0;
      var step = 5;
      var intervalTime = durationMs / (start / step);
      
      var currentVol = start;
      fadeInterval = setInterval(function() {
        currentVol -= step;
        if (currentVol <= end) {
          currentVol = end;
          clearInterval(fadeInterval);
          fadeInterval = null;
          try {
            player.setVolume(0);
          } catch(e) {}
          if (callback) callback();
        } else {
          try {
            player.setVolume(currentVol);
          } catch(e) {}
        }
      }, intervalTime);
    }

    function onPlayerStateChange(event) {
      if (!currentActiveEntry) return;

      // Handle icons and states based on API feedback
      if (event.data === YT.PlayerState.PLAYING) {
        setEntryState(currentActiveEntry, 'playing');
      } else if (event.data === YT.PlayerState.PAUSED) {
        setEntryState(currentActiveEntry, 'paused');
      } else if (event.data === YT.PlayerState.ENDED) {
        setEntryState(currentActiveEntry, 'stopped');
        currentActiveEntry = null;
      }
    }

    function onPlayerError(event) {
      console.error('YouTube Player Error:', event.data);
      if (currentActiveEntry) {
        setEntryState(currentActiveEntry, 'stopped');
        currentActiveEntry = null;
      }
    }

    const PLAYLIST_TRACKS = [
      { vid: "51r5f5OdIY0", artist: "Nile Rodgers & CHIC", title: "Good Times" },
      { vid: "ZbxEyWGvWO4", artist: "The Whispers", title: "And the Beat Goes On" },
      { vid: "9PQHaStCgBE", artist: "Tom Misch", title: "Beautiful Escape" },
      { vid: "EvDIZ-1anVQ", artist: "Randy Crawford", title: "Street Life" },
      { vid: "1Y151-ov0cY", artist: "Stuart Bascombe", title: "Mainline" },
      { vid: "RAYQTfFh4xk", artist: "Nile Rodgers & CHIC", title: "Le Freak" },
      { vid: "rgf_ZFCZocA", artist: "McFadden & Whitehead", title: "Ain't No Stoppin' Us Now" },
      { vid: "z8UYBunE6Kk", artist: "Piper", title: "Summer Breeze" },
      { vid: "ICXxNH_BoZk", artist: "Change", title: "The Glow of Love (feat. Luther Vandross)" },
      { vid: "Bj1_gLzdcUE", artist: "Choices", title: "Less Is More" },
      { vid: "Omnpu8mzX4c", artist: "George Benson", title: "Give Me the Night" },
      { vid: "3ie4rWdvhXY", artist: "Llorca", title: "The Novel Sound" },
      { vid: "AnA9h85rBZc", artist: "Kraak & Smaak", title: "Don't Want This to Be Over" },
      { vid: "J39Io-vmmOk", artist: "Jamiroquai", title: "Little L" },
      { vid: "V4Vr38Fll4k", artist: "Supershy", title: "Feel Like Makin' Love" },
      { vid: "minW-Z3dbBU", artist: "Breakbot", title: "Fantasy" },
      { vid: "lTA1h9mJ4Rg", artist: "Jamiroquai", title: "Falling" },
      { vid: "pinUhF0AXRk", artist: "Third World", title: "Now That We Found Love" },
      { vid: "_3r72o_f-z8", artist: "The Blackbyrds", title: "Rock Creek Park" },
      { vid: "okOEKnPR0EE", artist: "First Choice", title: "Double Cross" },
      { vid: "ASBFDoTTH0w", artist: "The Salsoul Orchestra", title: "Ooh I Love It (Love Break)" },
      { vid: "di0nmSdQbsU", artist: "Pomplamoose", title: "I Can't Stop Feeling Billie Jean's Face" },
      { vid: "HPyNLCThd60", artist: "Brian Culbertson", title: "Step into Love" },
      { vid: "rd4ng8X1xiY", artist: "Cory Wong (feat. Tom Misch)", title: "Cosmic Sans" },
      { vid: "HJ4e93eU-0E", artist: "Pomplamoose", title: "Jamiroquai Bee Gees Mashup" },
      { vid: "8naZ82JUj-4", artist: "The Greyboy Allstars", title: "Soul Dream" },
      { vid: "8RWrCQeS_LE", artist: "Jafunk (feat. Adi Oasis)", title: "Yellow Daze" },
      { vid: "nhyUICuE65Y", artist: "Donna Summer", title: "Bad Girls" },
      { vid: "NLgcLmyrQIU", artist: "The Greyboy Allstars", title: "Fried Grease" },
      { vid: "jUs7P8YO9EI", artist: "Stevie Wonder", title: "Fun Day (Remix)" },
      { vid: "bOckbm7TCu4", artist: "SWV", title: "Use Your Heart" },
      { vid: "IlMoGkt7enw", artist: "SWV", title: "Right Here" },
      { vid: "9B-UGyvgnPs", artist: "Total", title: "Can't You See" },
      { vid: "p1p8OdHz94Q", artist: "Xscape", title: "Who Can I Run To" },
      { vid: "eq43GTVoAuw", artist: "Brownstone", title: "If You Love Me" },
      { vid: "munm6lzoR3I", artist: "Groove Theory", title: "Tell Me" },
      { vid: "5-Nkknmx44Q", artist: "Janet Jackson", title: "That's The Way Love Goes" },
      { vid: "LIljpItwhVY", artist: "TLC", title: "Creep" }
    ];

    function renderPlaylist() {
      const container = document.getElementById('playlist-container');
      if (!container) return;

      container.innerHTML = PLAYLIST_TRACKS.map((track, idx) => `
        <div class="archive-entry" data-vid="${track.vid}" style="animation-delay: ${(3.3 + idx * 0.03).toFixed(2)}s;">
          <a class="archive-item" href="javascript:void(0)">
            <div class="archive-item-left">
              <svg class="archive-icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <div class="archive-item-text">
                <span class="archive-item-type">${track.artist}</span>
                <span class="archive-item-title">${track.title}</span>
              </div>
            </div>
          </a>
          <div class="archive-embed"></div>
        </div>
      `).join('');
      
      bindPlaylistClickHandlers();
    }

    function bindPlaylistClickHandlers() {
      document.querySelectorAll('#playlist-container .archive-entry[data-vid]').forEach(entry => {
        const itemLink = entry.querySelector('.archive-item');
        if (!itemLink) return;
        itemLink.addEventListener('click', (e) => {
          e.preventDefault();
          const vid = entry.dataset.vid;
          if (!vid || !ytPlayer || typeof ytPlayer.getPlayerState !== 'function') return;

          if (currentActiveEntry === entry) {
            const state = ytPlayer.getPlayerState();
            if (state === YT.PlayerState.PLAYING) {
              setEntryState(entry, 'paused');
              fadeOut(ytPlayer, 600, () => {
                ytPlayer.pauseVideo();
              });
            } else {
              setEntryState(entry, 'playing');
              ytPlayer.playVideo();
              fadeIn(ytPlayer, 600);
            }
          } else {
            const prevEntry = currentActiveEntry;
            if (prevEntry) {
              setEntryState(prevEntry, 'stopped');
              const state = ytPlayer.getPlayerState();
              if (state === YT.PlayerState.PLAYING) {
                fadeOut(ytPlayer, 400, () => {
                  currentActiveEntry = entry;
                  setEntryState(entry, 'playing');
                  ytPlayer.loadVideoById(vid);
                  ytPlayer.playVideo();
                  fadeIn(ytPlayer, 600);
                });
                return;
              }
            }
            
            currentActiveEntry = entry;
            setEntryState(entry, 'playing');
            ytPlayer.loadVideoById(vid);
            ytPlayer.playVideo();
            fadeIn(ytPlayer, 600);
          }
        });
      });
    }

    // Initialize playlist rendering
    renderPlaylist();

    // == Mobile Accordion Toggle ==
    document.querySelectorAll('.mobile-toggle-header').forEach(header => {
      header.addEventListener('click', function() {
        if (window.innerWidth <= 767) {
          const parent = this.parentElement;
          parent.classList.toggle('expanded');
        }
      });
    });