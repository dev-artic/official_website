// -- Inline video embed toggle (close-first-then-open) --
    (function() {
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
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                iframe.style.opacity = '1';
              });
            });
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
    })();

    // ── Print Modal Control ──
    (function() {
      const PRINT_DATA = {
        '1': {
          title: "1MC1PD: The Interview",
          image: "1mc1pd.png",
          artists: "@arkyteccc<br>@poltergeisy_",
          album: "arkyteccc,<br>deus ex machina (2024)",
          dimensions: "130*210",
          status: "Limited Edition",
          statusClass: "request-purchase",
          statusText: "Request Purchase",
          credits: "Designed by @63.46.kr @gyu.dev",
          copyright: "ⓒ 2025 artic. All Rights Reserved."
        },
        '2': {
          title: "Lyric Booklet",
          image: "lyric-booklet.png",
          artists: "@arkyteccc",
          album: "arkyteccc,<br>deus ex machina (2024)",
          dimensions: "148*210",
          status: "Distributed in Listening Party",
          statusClass: "not-for-sale",
          statusText: "Not For Sale",
          credits: "Designed by @gyu.dev @otffbtys",
          copyright: "ⓒ 2025 artic. All Rights Reserved."
        }
      };

      // Fetch dynamic statuses from database to populate PRINT_DATA
      const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname); const apiUrl = isLocal ? '/api/products' : 'https://products-4n2xy6gsxa-uc.a.run.app'; fetch(apiUrl)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch products');
          return res.json();
        })
        .then(products => {
          products.forEach(p => {
            if (PRINT_DATA[p.id]) {
              const item = PRINT_DATA[p.id];
              item.price = p.price;
              if (p.status === 'for-sale') {
                item.statusClass = 'request-purchase';
                item.statusText = 'Request Purchase';
                item.status = `₩${p.price.toLocaleString()} (In Stock: ${p.inventory})`;
              } else if (p.status === 'out-of-stock') {
                item.statusClass = 'out-of-stock';
                item.statusText = 'Out of Stock';
                item.status = 'Out of Stock';
              } else if (p.status === 'sold-out') {
                item.statusClass = 'sold-out';
                item.statusText = 'Sold Out';
                item.status = 'Sold Out';
              } else {
                item.statusClass = 'not-for-sale';
                item.statusText = 'Not For Sale';
                item.status = 'Not For Sale';
              }
            }
          });
        })
        .catch(err => console.error('Error fetching product data:', err));

      const modal = document.getElementById('print-modal');
      const overlay = document.getElementById('print-modal-overlay');
      const closeBtn = document.getElementById('print-modal-close');
      const modalImg = document.getElementById('print-modal-image');
      const modalInfo = document.getElementById('print-modal-info');

      function openModal(key) {
        const data = PRINT_DATA[key];
        if (!data) return;

        // Hide image until it is fully loaded to prevent cached flash
        modalImg.style.opacity = '0';
        modalImg.onload = function() {
          modalImg.style.opacity = '1';
        };
        modalImg.src = data.image;
        modalImg.alt = data.title;
        modal.classList.remove('is-checkout');
        
        let badgeHtml = '';
        if (data.statusClass === 'request-purchase') {
          badgeHtml = `<button type="button" class="print-badge ${data.statusClass}" id="print-action-btn">${data.statusText}</button>`;
        } else {
          badgeHtml = `<span class="print-badge ${data.statusClass}">${data.statusText}</span>`;
        }

        const detailsHtml = `
          <div class="print-info-grid">
            <span class="print-meta-label">Artist</span>
            <span class="print-meta-value">${data.artists}</span>

            <span class="print-meta-label">Project</span>
            <span class="print-meta-value">${data.album}</span>

            <span class="print-meta-label">Dimensions</span>
            <span class="print-meta-value">${data.dimensions}</span>

            <span class="print-meta-label">Status</span>
            <div class="print-meta-value">
              <div style="font-weight: 400; color: var(--text-primary); margin-bottom: 2px;">${data.status}</div>
              ${badgeHtml}
            </div>
          </div>
          <div class="print-modal-info-footer" style="border-top: 1px solid var(--border-color); padding-top: 24px; font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.5;">
            <div>${data.credits}</div>
            <div style="margin-top: 4px;">${data.copyright}</div>
          </div>
        `;

        let checkoutHtml = '';
        if (data.statusClass === 'request-purchase') {
          checkoutHtml = `
            {{CHECKOUT_FORM}}
            <div class="checkout-summary-box">
              <div class="checkout-summary-row">
                <span>상품 금액 (${data.title})</span>
                <span id="chk-summary-price">${(data.price || 15000).toLocaleString()}원</span>
              </div>
              <div class="checkout-summary-row">
                <span>배송비</span>
                <span>3,000원</span>
              </div>
              <div class="checkout-summary-row total">
                <span>총 합계</span>
                <span id="chk-summary-total">${((data.price || 15000) + 3000).toLocaleString()}원</span>
              </div>
              <div style="margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 8px; font-size: 0.55rem; color: var(--text-muted);">
                * 계좌이체로만 결제 가능합니다.
              </div>
            </div>
            <div class="checkout-buttons">
              <button type="button" class="checkout-btn back" id="chk-back-btn">돌아가기</button>
              <button type="button" class="checkout-btn submit" id="chk-submit-btn">결제 요청하기</button>
            </div>
          `;
        }

        modalInfo.innerHTML = `
          <h2 class="print-info-title" style="font-family: var(--font-serif); font-size: 1.6rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em; margin-bottom: 8px;">${data.title}</h2>
          <div class="print-modal-slider-viewport">
            <div class="print-modal-slider-track" id="print-modal-slider-track">
              <div class="print-modal-slide slide-details">
                ${detailsHtml}
              </div>
              <div class="print-modal-slide slide-checkout">
                ${checkoutHtml}
              </div>
              <div class="print-modal-slide slide-success">
                <div class="checkout-success-screen">
                  <div class="face-id-checkmark-wrap">
                    <svg class="face-id-svg" viewBox="0 0 52 52">
                      <circle class="face-id-circle" cx="26" cy="26" r="25" fill="none"/>
                      <path class="face-id-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                    </svg>
                  </div>
                  <h3 style="font-family: var(--font-serif); font-size: 1.2rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">요청 완료</h3>
                  <p style="font-family: var(--font-sans); font-size: 0.75rem; color: var(--text-secondary); line-height: 1.6; max-width: 280px; margin: 12px auto 0 auto; text-align: center;">
                    결제 요청이 완료되었습니다.<br>
                    상세 안내 메일이 <b id="success-email-display"></b> 주소로 발송되었습니다.
                  </p>
                  <button class="checkout-btn success-close-btn" style="margin-top: 24px; max-width: 140px;" id="chk-success-close-btn">닫기</button>
                </div>
              </div>
            </div>
          </div>
        `;

        if (data.statusClass === 'request-purchase') {
          const actionBtn = document.getElementById('print-action-btn');
          const backBtn = document.getElementById('chk-back-btn');
          const submitBtn = document.getElementById('chk-submit-btn');
          const quantitySelect = document.getElementById('chk-quantity');
          const chkName = document.getElementById('chk-name');
          const chkEmail = document.getElementById('chk-email');
          const chkPhone = document.getElementById('chk-phone');
          const chkAddress = document.getElementById('chk-address');
          const chkDepositor = document.getElementById('chk-depositor');

          // Initialize submit button as disabled
          submitBtn.disabled = true;

          function validateRequiredFields() {
            const name = chkName.value.trim();
            const email = chkEmail.value.trim();
            const phone = chkPhone.value.trim();
            const address = chkAddress.value.trim();
            const depositor = chkDepositor.value.trim();

            if (name && email && phone && address && depositor) {
              submitBtn.disabled = false;
            } else {
              submitBtn.disabled = true;
            }
          }

          chkName.addEventListener('input', function() {
            chkDepositor.value = chkName.value;
            validateRequiredFields();
          });
          chkDepositor.addEventListener('input', validateRequiredFields);
          chkEmail.addEventListener('input', validateRequiredFields);
          chkPhone.addEventListener('input', validateRequiredFields);
          chkAddress.addEventListener('input', validateRequiredFields);

          quantitySelect.addEventListener('change', function() {
            const qty = parseInt(quantitySelect.value, 10);
            const prodPrice = (data.price || 15000) * qty;
            const totalPrice = prodPrice + 3000;
            document.getElementById('chk-summary-price').textContent = prodPrice.toLocaleString() + '원';
            document.getElementById('chk-summary-total').textContent = totalPrice.toLocaleString() + '원';
          });

          actionBtn.addEventListener('click', function() {
            modal.classList.add('is-checkout');
          });

          backBtn.addEventListener('click', function() {
            modal.classList.remove('is-checkout');
          });

          let loadingInterval = null;

          submitBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            const name = chkName.value.trim();
            const email = chkEmail.value.trim();
            const phone = chkPhone.value.trim();
            const address = chkAddress.value.trim();
            const quantity = parseInt(quantitySelect.value, 10);
            const depositor = chkDepositor.value.trim() || name;
            const notes = document.getElementById('chk-notes').value.trim();

            if (!name || !email || !phone || !address || !depositor) {
              return;
            }

            submitBtn.disabled = true;
            backBtn.disabled = true;

            // Start dynamic dot loading animation
            let dotCount = 0;
            submitBtn.textContent = '제출 중';
            loadingInterval = setInterval(() => {
              dotCount = (dotCount + 1) % 4;
              submitBtn.textContent = '제출 중' + '.'.repeat(dotCount);
            }, 400);

            const payload = { product_id: key, name, email, phone, address, quantity, depositor, notes };

            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const apiUrl = isLocal 
              ? 'http://127.0.0.1:5001/artic-official-home/us-central1/checkout' 
              : 'https://checkout-4n2xy6gsxa-uc.a.run.app';

            fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            })
            .then(res => {
              if (loadingInterval) clearInterval(loadingInterval);
              if (!res.ok) throw new Error('Network response was not ok');
              return res.json();
            })
            .then(resData => {
              document.getElementById('success-email-display').textContent = email;
              modal.classList.add('is-success');
              
              document.getElementById('chk-success-close-btn').addEventListener('click', closeModal);
            })
            .catch(err => {
              if (loadingInterval) clearInterval(loadingInterval);
              console.error(err);
              alert('오류가 발생했습니다. 다시 시도해 주세요.');
              submitBtn.disabled = false;
              submitBtn.textContent = '결제 요청하기';
              backBtn.disabled = false;
            });
          });
        }

        modal.classList.add('is-active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      }

      function closeModal() {
        modal.classList.remove('is-active');
        modal.classList.remove('is-checkout');
        modal.classList.remove('is-success');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        // Reset/clear content after fade-out completes to avoid caching visual glitch
        setTimeout(function() {
          if (!modal.classList.contains('is-active')) {
            modalImg.src = '';
            modalImg.alt = '';
            modalInfo.innerHTML = '';
          }
        }, 500);
      }

      // Use event delegation on the document for robustness against timing/DOM issues
      document.addEventListener('click', function(e) {
        const archiveItem = e.target.closest('.archive-entry[data-print] .archive-item');
        if (!archiveItem) return;
        e.preventDefault();
        const entry = archiveItem.closest('.archive-entry[data-print]');
        if (!entry) return;
        const key = entry.dataset.print;
        openModal(key);
      });

      if (closeBtn) closeBtn.addEventListener('click', closeModal);
      if (overlay) overlay.addEventListener('click', closeModal);

      // ESC key to close modal
      window.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('is-active')) {
          closeModal();
        }
      });
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

    // ═══════════════════════════════════════════════════
    // PLAY Widget — YouTube IFrame Audio Player
    // ═══════════════════════════════════════════════════
    (function() {
      const pageLoadTime = Date.now();
      const TRACKS = [
        { vid: "DlVMIGT30_c", title: "from corners to switch", duration: "2:26" },
        { vid: "X9mz9ldkaNY", title: "발버둥",                 duration: "3:40" },
        { vid: "ypC5FeYc8wY", title: "기면증",                 duration: "2:30" },
        { vid: "98P1Utmb-94", title: "곁눈박이",               duration: "3:34" },
        { vid: "BQR87WzBsAo", title: "일조량 변환 메트로놈",    duration: "3:23" },
        { vid: "QXozHrPAVcw", title: "043 interlude",          duration: "2:00" },
        { vid: "U56Yo5BXpXA", title: "going through (with Yiloy)", duration: "3:50" },
        { vid: "7OjgubVlMrk", title: "bad therapy",            duration: "3:35" },
        { vid: "_BM0fsBFPCU", title: "오로라",                 duration: "3:39" },
        { vid: "PNVFfAzqZGo", title: "tied.",                  duration: "2:50" },
        { vid: "37YNUwxP6-w", title: "후일담",                 duration: "3:55" }
      ];

      const LYRICS_DATA = {
        "DlVMIGT30_c": [
          {
            "time": 17.6,
            "text": "이런 모습의 삶도 있어"
          },
          {
            "time": 19.7,
            "text": "이건 지금보다 더 어렸을 때는 가지고 싶던 거"
          },
          {
            "time": 22.4,
            "text": "그런 지금은 모든 후회들의 내일"
          },
          {
            "time": 24.3,
            "text": "되돌아갈 시간도 비슷하게 남겨질 걸"
          },
          {
            "time": 26.6,
            "text": "이런 모습의 삶도 있어"
          },
          {
            "time": 28,
            "text": "멀리서는 빛이 나는 것처럼 보이면서도"
          },
          {
            "time": 30.6,
            "text": "그것만으로 다음에 올 낮을 채우기엔 모자라"
          },
          {
            "time": 33.2,
            "text": "그걸 미리 봤어도 달라지지 않지만"
          },
          {
            "time": 35.8,
            "text": "우린 알게 될 거야 결국엔"
          },
          {
            "time": 37.6,
            "text": "(I'm from corners but good, tho)"
          },
          {
            "time": 39.6,
            "text": "그리고 너도 알게 될 거야"
          },
          {
            "time": 42,
            "text": "(spill all the questions and doubt on me)"
          },
          {
            "time": 43.8,
            "text": "그렇다면 나는, 나도 뭐 알게 되겠지"
          },
          {
            "time": 47.4,
            "text": "분명한 것 하나, 우린 알게 될 거야"
          },
          {
            "time": 52.3,
            "text": "지금부터 이 가사는 우리가"
          },
          {
            "time": 54,
            "text": "그동안 나눈 대화 중 아주 작은 부분이면 좋겠네"
          },
          {
            "time": 56.8,
            "text": "그리고 한 글자라도 널 의심하게 만든다면"
          },
          {
            "time": 59.2,
            "text": "그냥 지나가는 법은 모르게 해"
          },
          {
            "time": 60.9,
            "text": "난 우산을 두고 나온 날의 비를 기록해"
          },
          {
            "time": 63.3,
            "text": "남아 쓸려 나가지 않은 햇살을 비춰 보게"
          },
          {
            "time": 65.8,
            "text": "기어코 대답을 듣고 싶던 미스터리도"
          },
          {
            "time": 68,
            "text": "내 일부분이 돼 담아가 기억 속에"
          },
          {
            "time": 70.2,
            "text": "그러니 이제 남겨두고 와"
          },
          {
            "time": 71.9,
            "text": "시계를 탓하지 않아도 될 이 공간에"
          },
          {
            "time": 74.4,
            "text": "모래같은 신기루에 속아 헤매기보단"
          },
          {
            "time": 76.6,
            "text": "맨눈으로 나와 세상이 마주보게 하네"
          },
          {
            "time": 79.4,
            "text": "무대 위의 멋진 주인공과 객석"
          },
          {
            "time": 81.7,
            "text": "그 사이 낙차에"
          },
          {
            "time": 83,
            "text": "등을 돌리려 할 언젠가의 너와 나에게"
          },
          {
            "time": 85.3,
            "text": "작은 구원들이 있기를 바랄게"
          },
          {
            "time": 87.8,
            "text": "이런 모습의 삶도 있어"
          },
          {
            "time": 89.4,
            "text": "이건 지금보다 더 어렸을 때는 가지고 싶던 거"
          },
          {
            "time": 92.1,
            "text": "그런 지금은 모든 후회들의 내일"
          },
          {
            "time": 93.9,
            "text": "되돌아갈 시간도 비슷하게 남겨질 걸"
          },
          {
            "time": 96.3,
            "text": "이런 모습의 삶도 있어"
          },
          {
            "time": 97.9,
            "text": "멀리서는 빛이 나는 것처럼 보이면서도"
          },
          {
            "time": 100.3,
            "text": "그것만으로 다음에 올 낮을 채우기엔 모자라도"
          },
          {
            "time": 102.8,
            "text": "이제는 그림자를 담아낼 수 있잖아"
          },
          {
            "time": 105.5,
            "text": "우린 알게 될 거야 결국엔"
          },
          {
            "time": 107.4,
            "text": "(I'm from corners but good, tho)"
          },
          {
            "time": 109.5,
            "text": "그리고 너도 알게 될 거야"
          },
          {
            "time": 111.8,
            "text": "(spill all the questions and doubt on me)"
          },
          {
            "time": 113.7,
            "text": "그렇다면 나도 알게 될 거야"
          },
          {
            "time": 116.6,
            "text": "그러니 분명한 건, 우린 알게 될 거야"
          }
        ],
        "X9mz9ldkaNY": [
          {
            "time": 16.6,
            "text": "변하지 않았단 말이 난 지금 부끄러워"
          },
          {
            "time": 18.8,
            "text": "변하지 않았단 말에 다시 숨으려 들어"
          },
          {
            "time": 24.9,
            "text": "변하지 않았단 말이 난 지금 부끄러워"
          },
          {
            "time": 26.9,
            "text": "변하지 않았단 말에 다시 숨으려 들어"
          },
          {
            "time": 33.2,
            "text": "평화, 그렇게 찾아다녀"
          },
          {
            "time": 35.2,
            "text": "지친 발로 이끌어도 문 앞에서 망설여"
          },
          {
            "time": 37.3,
            "text": "비밀번호를 알아서 더 숨이 막혀"
          },
          {
            "time": 39.2,
            "text": "행복 같은 게 전부 다 꿈일까 봐"
          },
          {
            "time": 41.1,
            "text": "서울 안 하루 잘 곳은 많아도 쉼은 어디"
          },
          {
            "time": 43.2,
            "text": "길 잃은 거리보다도 멀어지게 뒀어 집이"
          },
          {
            "time": 45.4,
            "text": "많게도 느껴지며 마음 붙일 곳은 없어질 때"
          },
          {
            "time": 47.8,
            "text": "완공돼 학교 앞에 정신병원이"
          },
          {
            "time": 49.6,
            "text": "주변엔 꿈을 선물한 성공과 입 맞춰"
          },
          {
            "time": 51.8,
            "text": "영원을 적는 난 끝을 볼 수 있나 과연"
          },
          {
            "time": 53.7,
            "text": "진혁이 형의 담배가 일몰을 닮아가던 때"
          },
          {
            "time": 56,
            "text": "밤이 퍼지고 목적지가 헷갈려"
          },
          {
            "time": 58,
            "text": "대체 무엇에 혹해 있어?"
          },
          {
            "time": 59.6,
            "text": "머리 아픈 질문들은 제발 전부 미뤄"
          },
          {
            "time": 61.9,
            "text": "그때의 변명은 한 달에 50만원"
          },
          {
            "time": 64,
            "text": "308 날짜로 바꿔 천구십다섯"
          },
          {
            "time": 65.7,
            "text": "여전히 도망쳐, 모두 떠밀려 간다 해도"
          },
          {
            "time": 68.3,
            "text": "맞는 방향이라는 것은 없다고 해줘"
          },
          {
            "time": 70.3,
            "text": "누구라도 있음 편할 텐데,"
          },
          {
            "time": 72.1,
            "text": "그럼 너가 보기에 주변에 아무도 없는 이 삶은 어때?"
          },
          {
            "time": 74.5,
            "text": "발버둥 (쳐야 해)"
          },
          {
            "time": 76.6,
            "text": "발버둥 (서울 안에서)"
          },
          {
            "time": 78.7,
            "text": "발버둥 (쳐야 돼)"
          },
          {
            "time": 80.7,
            "text": "발버둥"
          },
          {
            "time": 91.1,
            "text": "변하지 않았단 말이 난 지금 부끄러워"
          },
          {
            "time": 93.3,
            "text": "변하지 않았단 말에 다시 숨으려 들어"
          },
          {
            "time": 99.1,
            "text": "여전히, 여전하게 여전해"
          },
          {
            "time": 100.7,
            "text": "친구들에겐 인스타로 잘 지낸다고 전해"
          },
          {
            "time": 103.3,
            "text": "네 미래설계와 우리 사이는 많이 변했고"
          },
          {
            "time": 105.5,
            "text": "작업이란 말은 노림수가 너무 뻔해"
          },
          {
            "time": 107.4,
            "text": "서울 이곳은 실패한 놈들에게만 가혹해"
          },
          {
            "time": 109.5,
            "text": "너도 알지, \"그런데 안 미안하냐 가족에겐\""
          },
          {
            "time": 111.7,
            "text": "이딴 말이나 쓰게 된 난 낙오되고"
          },
          {
            "time": 113.7,
            "text": "언제든 처음부터 다시 시작할 수 있다고"
          },
          {
            "time": 116.1,
            "text": "가장 믿음 줘야 했던 나를 이렇게 속여봐도"
          },
          {
            "time": 118.9,
            "text": "내가 싫어서 먼저 빠져나왔다고"
          },
          {
            "time": 120.4,
            "text": "누군가 마주칠 수 없을 것 같았어"
          },
          {
            "time": 122.5,
            "text": "신념은 값싸고 약속들은 다 파토"
          },
          {
            "time": 124.4,
            "text": "같은 걸 마시고 다른 걸 삼켜"
          },
          {
            "time": 125.9,
            "text": "너흰 더 위로 난 뱉었어 흰 기포"
          },
          {
            "time": 128.1,
            "text": "그때의 변명은 만 원권 지폐 백 장이지"
          },
          {
            "time": 130.3,
            "text": "군자역 지하 작업실 반 년치"
          },
          {
            "time": 131.9,
            "text": "여전히 도망쳐, 모두 떠밀려 간다 해도"
          },
          {
            "time": 134.5,
            "text": "맞는 방향이라는 것은 없다고 해줘"
          },
          {
            "time": 136.6,
            "text": "누구라도 있음 편할 텐데,"
          },
          {
            "time": 138.3,
            "text": "그럼 너가 보기에"
          },
          {
            "time": 138.9,
            "text": "주변에 아무도 없는 이 삶은 어때?"
          },
          {
            "time": 140.8,
            "text": "발버둥 (쳐야 해)"
          },
          {
            "time": 142.7,
            "text": "발버둥 (서울 안에서)"
          },
          {
            "time": 144.8,
            "text": "발버둥 (쳐야 돼)"
          },
          {
            "time": 146.8,
            "text": "발버둥"
          },
          {
            "time": 148.9,
            "text": "솔직했다면 그건 또 누구의 잘못이야"
          },
          {
            "time": 151,
            "text": "어쩔 수 없지, 중요했으니 가식뿐인 삶보다"
          },
          {
            "time": 153.7,
            "text": "드러낼수록 약점만 늘어나"
          },
          {
            "time": 155.3,
            "text": "그렇게 쌓은 성에서 날 깔보다가"
          },
          {
            "time": 157.2,
            "text": "언젠가 받게 될 인정 하나"
          },
          {
            "time": 158.9,
            "text": "그거 하나에 내일의 동공을 박고 살아"
          },
          {
            "time": 161.3,
            "text": "사람으로 치유한다며"
          },
          {
            "time": 162.7,
            "text": "그 상처 준 장본인도 결국 사람이었네"
          },
          {
            "time": 165.4,
            "text": "만성, 내 syndrome 병명은 peter pan"
          },
          {
            "time": 167.2,
            "text": "매일 돌아갈 생각만 하다니 의미 없네"
          },
          {
            "time": 169.7,
            "text": "속을 바닥까지 봐야 한 컷을 꺼내"
          },
          {
            "time": 171.5,
            "text": "그 안의 난 되고 싶지 않던 나를 겪게 돼"
          },
          {
            "time": 173.8,
            "text": "사랑은 잊혀가는 부분의 합"
          },
          {
            "time": 175.4,
            "text": "네안데르탈인에 대한 내 방식의 답"
          },
          {
            "time": 177.5,
            "text": "자의로, 죽어가는 건 유통기한까지니까"
          },
          {
            "time": 180.2,
            "text": "내 자릴 찾아봐야 하지 빨리"
          },
          {
            "time": 182,
            "text": "그렇게 매듭지을 결말은"
          },
          {
            "time": 183.5,
            "text": "아름답길 여길 믿었던 것만큼"
          },
          {
            "time": 185.6,
            "text": "작았던 화면 속을 구원삼은"
          },
          {
            "time": 187.5,
            "text": "작았던 소년에게 배신 쳐"
          },
          {
            "time": 189.9,
            "text": "변하지 않았단 말이 난 지금 부끄러워"
          },
          {
            "time": 192.2,
            "text": "창문 없는 작업실 바닥에 누워"
          },
          {
            "time": 194.2,
            "text": "변하지 않았단 말에 다시 숨으려 들어"
          },
          {
            "time": 196.4,
            "text": "도피를 걸쳐야 마음 편하게 숨을 내쉬어"
          },
          {
            "time": 198.6,
            "text": "발버둥"
          }
        ],
        "ypC5FeYc8wY": [
          {
            "time": 22.1,
            "text": "무엇인가 사랑한 적 있다면 그 끝은 영원한 겨울"
          },
          {
            "time": 25.2,
            "text": "여기서 그 대상이 누가 아니었단 것은,"
          },
          {
            "time": 28,
            "text": "그렇게 내 원 안으로 들인 사람들이 남겨둔"
          },
          {
            "time": 31,
            "text": "진동을 맡아 두다 더는 견디기 어려워서"
          },
          {
            "time": 34.1,
            "text": "질문없이 공허한 대답을 꺼내"
          },
          {
            "time": 36.2,
            "text": "여러 갈래 길서"
          },
          {
            "time": 37.2,
            "text": "하필이면 벼랑 맨 앞으로 이끄는 선택"
          },
          {
            "time": 39.6,
            "text": "그런 게 몇 마디 고해성사로"
          },
          {
            "time": 41.9,
            "text": "후련해질 일이었대도"
          },
          {
            "time": 43.4,
            "text": "계속 돌아본 꿈은 악몽이라 적었네"
          },
          {
            "time": 46.2,
            "text": "수평을 가만히 들여다봐"
          },
          {
            "time": 48.2,
            "text": "파문이 일면 자리를 옮길 걱정부터 하지"
          },
          {
            "time": 51.2,
            "text": "우연을 일어난 대로 이해하기 어려워 난,"
          },
          {
            "time": 53.9,
            "text": "삶은 다 이렇단 단념이 먼저 못 박혀 슬펐네"
          },
          {
            "time": 57.1,
            "text": "철썩이는 소리가 나면 떠날 건 실수였나"
          },
          {
            "time": 60.1,
            "text": "발목 깊이로 밀려와도 휩쓸려가"
          },
          {
            "time": 62.8,
            "text": "완전히 젖었어도 말려 둘 계절은 없어"
          },
          {
            "time": 65.6,
            "text": "마음을 가라앉혀서 만든 기쁨이었을까 봐"
          },
          {
            "time": 69.4,
            "text": "그렇게 기다려 보는 현기증의 출처는"
          },
          {
            "time": 72.4,
            "text": "모두 같은 아픔"
          },
          {
            "time": 73.7,
            "text": "쓰러진 날 그대로 재우기엔 부족해"
          },
          {
            "time": 75.7,
            "text": "지금의 밝은 밤은"
          },
          {
            "time": 77.1,
            "text": "(난 너무 쉽게 빠져드네 잠으로)"
          },
          {
            "time": 80,
            "text": "그렇게 기다려 보는 현기증의 출처는"
          },
          {
            "time": 82.8,
            "text": "모두 같은 아픔"
          },
          {
            "time": 84,
            "text": "쓰러진 날 깨워 주기엔 부족해"
          },
          {
            "time": 86.2,
            "text": "지금의 너무 어두운 아침과 낮은"
          },
          {
            "time": 90.4,
            "text": "누군가 기다려본 적 있다면"
          },
          {
            "time": 92.5,
            "text": "그 끝은 시간의 침묵"
          },
          {
            "time": 93.9,
            "text": "집주인을 잃은 표지판만이 남아 서 있듯"
          },
          {
            "time": 96.8,
            "text": "해묵은 창틀의 꿈을 꾸지"
          },
          {
            "time": 98.1,
            "text": "낡아 없어지기만을 기다려"
          },
          {
            "time": 99.9,
            "text": "발자국의 백일몽은"
          },
          {
            "time": 100.9,
            "text": "눈 멀고 크게 부푼 만큼 지나쳤네"
          },
          {
            "time": 102.9,
            "text": "눈 앞과 뒤의 환상들이 뿌옇게 되지, 뭉개져"
          },
          {
            "time": 105.7,
            "text": "알았다고 믿은 세상 밑으로 잠겨들 뿐,"
          },
          {
            "time": 108.2,
            "text": "내 평화를 가로채가 만든 작품들엔"
          },
          {
            "time": 110.8,
            "text": "정신 못 차리고 헤멨었던 어린 날들이"
          },
          {
            "time": 113.2,
            "text": "날 뚫어보네"
          },
          {
            "time": 114.3,
            "text": "모른 척 눈 가리며 품 안으로 더 숨겨도"
          },
          {
            "time": 116.9,
            "text": "가시를 걷는 몽유, 그러니 영혼을 아예 묶어줘"
          },
          {
            "time": 120,
            "text": "돌아올 그 순간을 세고 찬 방을 비워 두면"
          },
          {
            "time": 122.9,
            "text": "거기서 보낸 지난 봄의 기록은 유서로 남아"
          },
          {
            "time": 125.7,
            "text": "고개를 들었다면 아침이 왔겠지만"
          },
          {
            "time": 128,
            "text": "스스로 해를 걷어 낸 백야의 상태지 난"
          },
          {
            "time": 130.7,
            "text": "유일히 완벽한 건 뒤돌아선 과거뿐이겠지"
          },
          {
            "time": 134,
            "text": "난 더 이상 들어가볼 수 없는 풍경일테니"
          }
        ],
        "98P1Utmb-94": [
          {
            "time": 27.9,
            "text": "띄웠어 검은 달을, 배경엔 하얀 밤 아침은 일러"
          },
          {
            "time": 31.3,
            "text": "세상이 갇힌 둑 뒤엔"
          },
          {
            "time": 33,
            "text": "환상들이 쌓이고 있어 거짓말만큼"
          },
          {
            "time": 35.8,
            "text": "내가 사랑했던 불규칙인 널 그대로 두고 싶던"
          },
          {
            "time": 39.2,
            "text": "시간으로 되잠길 유일한 방법은 도피였어"
          },
          {
            "time": 42.6,
            "text": "도착을 잊은 뭔가를 기다리기도 하다가"
          },
          {
            "time": 45.5,
            "text": "조급한 마음은 남은 멍자국들을 뒤쫓아가게 해"
          },
          {
            "time": 49.3,
            "text": "그 무거운 여정 끝에 놓인 의미는"
          },
          {
            "time": 51.9,
            "text": "백야를 헤쳐 지킨 휴식보단 낫길 믿어 의심치 마"
          },
          {
            "time": 55.9,
            "text": "머리가 아파 잊어버린 것들을 떠올리려 할 때면"
          },
          {
            "time": 59.8,
            "text": "거울 깨진 조각처럼 날 들여다보는 파편이 됐어"
          },
          {
            "time": 63.6,
            "text": "그 뒤에 놓인 찢어진 세상이 반사되어"
          },
          {
            "time": 66.6,
            "text": "날 체념하게 해"
          },
          {
            "time": 67.8,
            "text": "나보다 나은 내게 기댈 수밖에"
          },
          {
            "time": 70.3,
            "text": "달무리가 흩어지네 흐린 새벽을 안은 채"
          },
          {
            "time": 73.7,
            "text": "매번 그리움과 결말은 함께 서는 게 불가능해"
          },
          {
            "time": 77.4,
            "text": "어디로 발을 옮겨 딛어야 할까"
          },
          {
            "time": 80.2,
            "text": "일단 가는 게 맞는 해답이 될 지부터"
          },
          {
            "time": 82.6,
            "text": "알아야겠어"
          },
          {
            "time": 112.2,
            "text": "나의 실패는 후회보다 앞서기를 이번에야말로"
          },
          {
            "time": 115.6,
            "text": "내 실패는 후회를 앞질러가"
          },
          {
            "time": 117.7,
            "text": "먼저 나를 기다려주기를"
          },
          {
            "time": 119.3,
            "text": "앞으로 가야 한다 다그친 흉내낸 가짜 믿음"
          },
          {
            "time": 122.3,
            "text": "날 지울 이름과"
          },
          {
            "time": 123.5,
            "text": "그 위에 얹어놓을 기억 겹들을 저주하지"
          },
          {
            "time": 126.2,
            "text": "구석을 찾아 기어가, 진동을 숨긴 날갯짓"
          },
          {
            "time": 129.2,
            "text": "떠나겠단 못 고친 입버릇은 멈춰"
          },
          {
            "time": 131.4,
            "text": "망설일 시간만 살찌웠나"
          },
          {
            "time": 133.1,
            "text": "정해진 방향같은 걸, 어떻게 알 수 있어"
          },
          {
            "time": 136.2,
            "text": "한없이 평행할 시야는 드러나버린 미련같아"
          },
          {
            "time": 140.3,
            "text": "한 뼘 폭 눈 덮인 길을 옆을 보면서 걸어"
          },
          {
            "time": 143.4,
            "text": "아무것도 부정 못 할 내가 되는 게 두려웠어"
          },
          {
            "time": 147,
            "text": "틀린 과거는 없다고 하는 너의 거짓말도 어설퍼"
          },
          {
            "time": 150.5,
            "text": "검은 얼룩과 흰 먼지로 더럽혀질 그 미결"
          },
          {
            "time": 154.4,
            "text": "발을 잡아끄는 건 끝내 거두지 못한 계절"
          },
          {
            "time": 157.6,
            "text": "칼 끝 같은 바람도"
          },
          {
            "time": 159.2,
            "text": "문 앞엔 느리게 도착하네 밤보단 매번"
          },
          {
            "time": 162,
            "text": "이걸 맞출 정확한 박자가 필요해져"
          },
          {
            "time": 164.8,
            "text": "다음을 기약할 낮조차 확신할 수 없게 돼버려서"
          }
        ],
        "BQR87WzBsAo": [
          {
            "time": 22.5,
            "text": "찢어질 듯이 눈 부시다가"
          },
          {
            "time": 24.6,
            "text": "암막으로 덮이지 깜빡거리는 이 낮밤"
          },
          {
            "time": 27.9,
            "text": "찢어질 듯이 눈 부시다가"
          },
          {
            "time": 30,
            "text": "암막으로 덮이지 깜빡거리는 이 낮밤"
          },
          {
            "time": 55.6,
            "text": "올가미 속 목 감긴 시체처럼 맞는 아침"
          },
          {
            "time": 58.2,
            "text": "홑겹 옷가지 손 넣을 곳 찾지 못하고"
          },
          {
            "time": 60.3,
            "text": "걸어간 그 날같지"
          },
          {
            "time": 61.6,
            "text": "마음은 적셔 고쳐도 여전히 작품 녹슬 자리"
          },
          {
            "time": 64.5,
            "text": "음성의 전달로 천만이 부정할 영화이길"
          },
          {
            "time": 67.5,
            "text": "christ 앞 anti 혹은 La Ultima Tentacion"
          },
          {
            "time": 69.9,
            "text": "영원들은 남게 되는 거지 못 박히면서"
          },
          {
            "time": 72.6,
            "text": "머릿속 다 비웠어,"
          },
          {
            "time": 74.1,
            "text": "거지꼴 같이 더럽힌 입과 손을"
          },
          {
            "time": 76.1,
            "text": "으슬하단 핑계로 모아봤지"
          },
          {
            "time": 77.7,
            "text": "어서 너도 기대, 자, 진심으로 빌어봐"
          },
          {
            "time": 80.3,
            "text": "그딴 건 같다 했던 어젠 이미 흩어졌어"
          },
          {
            "time": 83.2,
            "text": "낮달이 갇힌 사막 위 삶에 지쳤어 난"
          },
          {
            "time": 85.9,
            "text": "스치듯 비친 우물의 신기루에 짐 같은 꿈은"
          },
          {
            "time": 88.8,
            "text": "어떤 가치도 있지 않아"
          },
          {
            "time": 90.5,
            "text": "열병을 닮던 잠을 앓다가"
          },
          {
            "time": 92.2,
            "text": "낫게 된 날 과연 깨어났다 할 수 있을까"
          },
          {
            "time": 94.9,
            "text": "몇 번을 더 겪을 기상과"
          },
          {
            "time": 96.5,
            "text": "장면들이 바뀌는 사이에"
          },
          {
            "time": 98,
            "text": "이명을 끊어줄 누굴 만날 수 있을까"
          },
          {
            "time": 105.4,
            "text": "계속 헤맨 다음 그를 만날 수 있을까"
          },
          {
            "time": 108.2,
            "text": "미로 속을 헤맨 다음 그를 만날 수 있을까"
          },
          {
            "time": 111.4,
            "text": "들끓지 않을 술에 취해 걸어가고 싶었어"
          },
          {
            "time": 114,
            "text": "마음이 타 버릴지 무섭지 않아도 되도록"
          },
          {
            "time": 116.4,
            "text": "자각몽 속에도 난 넘어갈 수 없는 경계선 앞에"
          },
          {
            "time": 119.5,
            "text": "기도를 받아줄 하늘 위의 누군가 있길 바랐네"
          },
          {
            "time": 122.5,
            "text": "얼어붙지 않을 술에 취해 걸어가고 싶었어"
          },
          {
            "time": 125.2,
            "text": "해가 떴는지 더 묻지 않아도 되도록"
          },
          {
            "time": 127.4,
            "text": "그러다 마주친 거대한 그늘은"
          },
          {
            "time": 129.7,
            "text": "얼마나 휴식같았게,"
          },
          {
            "time": 131.2,
            "text": "기도를 짓고 싶을 만큼"
          },
          {
            "time": 132.5,
            "text": "내가 무너져 있길 바랐네"
          },
          {
            "time": 134.4,
            "text": "전부 멀어지게 놔둬야 했으니"
          },
          {
            "time": 136.6,
            "text": "결국 그 뒤의 어둠까지 버텨야 하는 일"
          },
          {
            "time": 139.5,
            "text": "너무 당연해, 그걸 모든 풍파를 겪은 뒤 알았지"
          },
          {
            "time": 142.6,
            "text": "태풍 속 어린 양 자비로 구하소서"
          },
          {
            "time": 145.3,
            "text": "전부 멀어지게 놔둬야 했으니"
          },
          {
            "time": 147.7,
            "text": "결국 그 뒤의 어둠까지 버텨야 하는 일"
          },
          {
            "time": 150.6,
            "text": "너무 당연해, 그걸 모든 풍파를 겪은 뒤 알았지"
          },
          {
            "time": 153.8,
            "text": "태풍 속 어린 양 자비로 구하소서"
          },
          {
            "time": 156.1,
            "text": "실수로 누른 홀드, 검은 화면에 비춰 투영해봐"
          },
          {
            "time": 159.3,
            "text": "사랑하는 때와 것, 사람들을 그렇게 다"
          },
          {
            "time": 161.9,
            "text": "보내고 나서 '아무것도 바꿀 수는 없었네' 라고"
          },
          {
            "time": 165.2,
            "text": "후회할 때는 시간의 반대편에 있어"
          },
          {
            "time": 167.4,
            "text": "실수로 멈춘 걸음, 검은 하늘을 비춰 투영해봐"
          },
          {
            "time": 170.9,
            "text": "사랑하는 때와 것, 사람들을 그렇게 다"
          },
          {
            "time": 173.3,
            "text": "보내고 '아무것도 바꿀 수는 없었네' 라고"
          },
          {
            "time": 176.3,
            "text": "후회할 때는 시간의 반대편에 있어"
          }
        ],
        "QXozHrPAVcw": [
          {
            "time": 10.5,
            "text": "우리 다시 시작해"
          },
          {
            "time": 15.2,
            "text": "철 지난 사랑노래가 아니어도"
          },
          {
            "time": 20,
            "text": "결국엔 후회할까 봐"
          },
          {
            "time": 23.2,
            "text": "다시 돌아봤을 때"
          },
          {
            "time": 28,
            "text": "지나간 사랑노랜 아니라 해도"
          },
          {
            "time": 33.6,
            "text": "멈춰버린 것들은 그대로 있어"
          },
          {
            "time": 38.4,
            "text": "Slip down to the dawn,"
          },
          {
            "time": 40.2,
            "text": "my dream's been fantasized"
          },
          {
            "time": 41.6,
            "text": "지하의 제일 밑바닥 지옥이 있다면 그 경계까지"
          },
          {
            "time": 45,
            "text": "좋은 날들을 이어 붙인 밤이 흘러 나쁜 결말이"
          },
          {
            "time": 48,
            "text": "덮거나 잊는 건 못 해 그저 전부 지워져 가길"
          },
          {
            "time": 64.5,
            "text": "Slip down to the dawn,"
          },
          {
            "time": 65.8,
            "text": "my dream's been paralyzed"
          },
          {
            "time": 67.3,
            "text": "지하의 제일 밑바닥 지옥이 있다면 그 경계까지"
          },
          {
            "time": 70.7,
            "text": "좋은 날들을 이어 붙인 밤이 흘러 나쁜 결말이"
          },
          {
            "time": 73.7,
            "text": "덮거나 잊는 건 못 해 그저 전부 지워져 가길"
          },
          {
            "time": 77.4,
            "text": "먼 길을 돌아왔지"
          },
          {
            "time": 79.2,
            "text": "이유같은 건 그 전의 갈림길에서 놓고"
          },
          {
            "time": 82.1,
            "text": "발을 옮기지 바삐"
          },
          {
            "time": 83.9,
            "text": "모든 정답이 너머에 있는 것 같니"
          },
          {
            "time": 88.4,
            "text": "아니지, 아니지"
          },
          {
            "time": 111.8,
            "text": "우리 다시 시작해"
          }
        ],
        "U56Yo5BXpXA": [
          {
            "time": 20.2,
            "text": "그때의 난 어렸었으니, 그저 열병이었지"
          },
          {
            "time": 23.1,
            "text": "이렇게 말할 수 있을 때까지의 담금질"
          },
          {
            "time": 25.7,
            "text": "겨우 식혀낸 뒤, 얼굴에 핀 열꽃이,"
          },
          {
            "time": 28.3,
            "text": "더는 화끈거리지 않았을쯤 다 져버렸네"
          },
          {
            "time": 31.1,
            "text": "내 노랫말, 들어주던 사람이"
          },
          {
            "time": 33.4,
            "text": "몇번의 막을 닫은 후에서야 그의 자릴"
          },
          {
            "time": 35.6,
            "text": "찾아갈 수 있게 됐는지 이제야 이해하지"
          },
          {
            "time": 38.7,
            "text": "나도 돌아가서 마침내 박수를 보내려고 나,"
          },
          {
            "time": 42.1,
            "text": "회사원이 될까 해 그래"
          },
          {
            "time": 44,
            "text": "나도 알아 그것만은 안 하겠다 했는데 이제"
          },
          {
            "time": 47.1,
            "text": "찾은 무게감 때문에 그때의 우리처럼"
          },
          {
            "time": 49.3,
            "text": "붕 뜨기가 참 쉽지 않네"
          },
          {
            "time": 51.7,
            "text": "같이 쫓던 빛은 이제 보니까"
          },
          {
            "time": 54.2,
            "text": "유난히 길었던 섬광이었나 보다"
          },
          {
            "time": 56.7,
            "text": "꺼지니 편해 그치? 오늘도 할 게 많아"
          },
          {
            "time": 59.1,
            "text": "가끔 눈을 감으면 잔상이 보이긴 하지만"
          },
          {
            "time": 62.5,
            "text": "오늘도 3호선에선"
          },
          {
            "time": 64.4,
            "text": "잠깐 어둠을 뚫었던 한강을 봤어"
          },
          {
            "time": 66.6,
            "text": "옆의 소년 핸드폰을 보려 눈 찌푸리더라"
          },
          {
            "time": 69.4,
            "text": "왠진 모르겠는데 좀 울적해졌어 그래"
          },
          {
            "time": 72.9,
            "text": "그때 3호선에선 한강을 봤던 소년은 가사를 썼어"
          },
          {
            "time": 76.8,
            "text": "그때 적던 말을 보면 눈이 찌푸려지더라도"
          },
          {
            "time": 80.4,
            "text": "후회는 해도 미워하진 않을게 이젠"
          },
          {
            "time": 82,
            "text": "지금의 난 내가 믿지 않던 모든 것들의 광신도"
          },
          {
            "time": 84.7,
            "text": "사랑해 마지않아 양가치도"
          },
          {
            "time": 86.8,
            "text": "전에 알던 세계에 금이 가 망가지고 구멍이 나도"
          },
          {
            "time": 89.8,
            "text": "아무렇지 않을지 몰라, 아니 그럴 것 같아"
          },
          {
            "time": 92.6,
            "text": "변하지 않는 게 있다 믿었었던 그 땐"
          },
          {
            "time": 94.9,
            "text": "얼굴을 구겨 속여넘겨 어리석은 후회로"
          },
          {
            "time": 97.5,
            "text": "널 생각했다 말하면, 거짓말이야"
          },
          {
            "time": 100,
            "text": "무대만 깔려 있었지 우린 주인공이 아니야"
          },
          {
            "time": 103.3,
            "text": "아직도 음악 비슷한 걸 하지, 보고 싶어 결과"
          },
          {
            "time": 106,
            "text": "이 지긋한 사랑에 나도 지쳐버린 걸까"
          },
          {
            "time": 108.6,
            "text": "텅 빈 너머에, 더는 대답해볼 수 없는 전화"
          },
          {
            "time": 111.3,
            "text": "특별했던 온도는 죽은 별이 되어 떠나"
          },
          {
            "time": 113.8,
            "text": "만약 돌아갈 수 있다면 아마 넌 모르지"
          },
          {
            "time": 116.2,
            "text": "내가 그 무엇까지 버릴 수 있는지"
          },
          {
            "time": 118.6,
            "text": "'넌 그때랑 비슷해 보이네' 사람 좋은 미소에"
          },
          {
            "time": 121.4,
            "text": "넘어간 그 밤들은 끝 모를 실수이길"
          },
          {
            "time": 142.9,
            "text": "지금은"
          },
          {
            "time": 144.1,
            "text": "\"그때 기억나냐\"로만 갈 수 있는 시간에"
          },
          {
            "time": 146.6,
            "text": "내 성숙함이 더해졌다면 어땠을까 생각해"
          },
          {
            "time": 149.1,
            "text": "돌아볼수록 오해만 생길 틈에 스미네"
          },
          {
            "time": 151.8,
            "text": "환상들은 파도 그 너울 안에 박제되어"
          },
          {
            "time": 154.4,
            "text": "결국 아침으로, 모아둬 고침 새로"
          },
          {
            "time": 157.5,
            "text": "이런 노랜 백 개도 낼 수 있대도"
          },
          {
            "time": 159.7,
            "text": "떠지지 않는 눈과 묶인 발을 진 채로"
          },
          {
            "time": 162,
            "text": "낯선 길을 나와 걸을 순 없었을 듯해"
          },
          {
            "time": 164.5,
            "text": "널 이해하지 이제, 사랑까진 모르겠어"
          },
          {
            "time": 167.2,
            "text": "솔직하자면 아직도 내게는 미지의 영역이니까"
          },
          {
            "time": 170.4,
            "text": "다른 길 위의 네게 배신감이 들 때면"
          },
          {
            "time": 172.6,
            "text": "위로에 용서란 것도 조금 맺혀"
          },
          {
            "time": 175.2,
            "text": "다시란 말을 다시 또 쓰게 된다면"
          },
          {
            "time": 177.5,
            "text": "마지막이란 말을 마지막으로 쓰게 된다면"
          },
          {
            "time": 180.6,
            "text": "덮어놓을 자리에 너가 있으면 좋을 것 같아서"
          },
          {
            "time": 183.5,
            "text": "그리운 이름들이 떠올랐어"
          },
          {
            "time": 185.6,
            "text": "다시란 말을 다시 또 쓰게 된다면"
          },
          {
            "time": 187.8,
            "text": "마지막이란 말을 마지막으로 쓰게 된다면"
          },
          {
            "time": 190.9,
            "text": "덮어놓을 자리에 너가 온다면 좋을 것 같아서"
          },
          {
            "time": 194.5,
            "text": "그럴 것 같아서"
          },
          {
            "time": 196.1,
            "text": "그렇게 우릴 돌려보냈지 그때로"
          },
          {
            "time": 201.4,
            "text": "그렇게 우릴 돌려보냈지 그때로"
          }
        ],
        "7OjgubVlMrk": [
          {
            "time": 26,
            "text": "되돌릴 순 없어 그런 뻔한 이야기로 끝난대도"
          },
          {
            "time": 32.7,
            "text": "우린 그 지옥을 봐야만 마음이 편해질 것 같아"
          },
          {
            "time": 40.5,
            "text": "몇 음 어- 번째로 눈을 떠"
          },
          {
            "time": 42.9,
            "text": "접을 수 없는 건 사랑한 얼굴"
          },
          {
            "time": 44.9,
            "text": "또 사랑스러운 서울"
          },
          {
            "time": 46.6,
            "text": "(진짜로 이게 될 줄은 몰랐어 그랬으면 더,"
          },
          {
            "time": 49.6,
            "text": "정신차리라는 소리 좀 네 명품 주머니 속 넣어둬)"
          },
          {
            "time": 53.5,
            "text": "몇 음 어- 번째로 눈을 떠"
          },
          {
            "time": 56.2,
            "text": "접을 수 없는 건 사랑한 얼굴"
          },
          {
            "time": 58.2,
            "text": "또 사랑스러운 서울"
          },
          {
            "time": 59.9,
            "text": "(야 이거 괜찮은 거 맞냐 묻는 너가 싫었어"
          },
          {
            "time": 62.9,
            "text": "나 먼저 일어날게, 어, 기다리는 사람이 있어)"
          },
          {
            "time": 68.8,
            "text": "똑똑해지긴 무슨"
          },
          {
            "time": 70.2,
            "text": "한눈으로 감은 있지도 않은 시침"
          },
          {
            "time": 72.3,
            "text": "날 죽이는 일은 쉽지 값싸게 취해버리니"
          },
          {
            "time": 75.3,
            "text": "날 눕히는 척하며 버리고 간 인연들아 사실"
          },
          {
            "time": 77.8,
            "text": "널 사랑한다 말할 뻔한 걸 고치고 싶다 많이"
          },
          {
            "time": 80.3,
            "text": "(시간은 무의미)"
          },
          {
            "time": 81.5,
            "text": "이상한 점을 찾을 수 없네"
          },
          {
            "time": 83.1,
            "text": "우린 거울일까 아님 사진인가? 갑자기 무섭네"
          },
          {
            "time": 86.4,
            "text": "등 뒤서 울리는 발소리가, 제일 무서웠네"
          },
          {
            "time": 89.7,
            "text": "라고 말하니 고개를 끄덕거리면서"
          },
          {
            "time": 91.9,
            "text": "자기도 그렇대"
          },
          {
            "time": 93.2,
            "text": "그런데 우리 어쩌다 이런 말까지 하게 됐지?"
          },
          {
            "time": 96.4,
            "text": "스스로 해를 걷어냈으니 백야의 상태겠지"
          },
          {
            "time": 99.7,
            "text": "옅은 잠 속 환상 조각으로"
          },
          {
            "time": 101.8,
            "text": "남았어야 되는 잔해들이"
          },
          {
            "time": 103.4,
            "text": "마음이 내려 앉혀질 때마다 가시로 박히게 됐지"
          },
          {
            "time": 107.1,
            "text": "지금은 행복하냐니, 무슨 뜬금없는 질문이야?"
          },
          {
            "time": 111.1,
            "text": "그래서 더 말하기도 귀찮아"
          },
          {
            "time": 113.1,
            "text": "너는 어때 솔직히 말해봐 그리고 있잖아"
          },
          {
            "time": 116,
            "text": "더는 반복하고 싶지 않지 않은"
          },
          {
            "time": 118,
            "text": "하루가 된 건 처음이야"
          },
          {
            "time": 119.4,
            "text": "네 곁으로 보내준 사람이 있다면은"
          },
          {
            "time": 122.1,
            "text": "나의 모든 걸 바칠 수 있어"
          },
          {
            "time": 123.8,
            "text": "별거 아닌 걸로도 팔고 건 영혼까지도"
          },
          {
            "time": 126.7,
            "text": "그 말에 웃는 장면은 blur 다음은 영원의 것"
          },
          {
            "time": 129.8,
            "text": "원래 먼지 쌓이는 자린 아무것도 없는 거였어"
          },
          {
            "time": 132.5,
            "text": "그리고 결국 다시 비어버린 자리에서"
          },
          {
            "time": 136.6,
            "text": "시간은 지나고 똑같이 선 뒷모습을 맞이했어"
          },
          {
            "time": 139.8,
            "text": "같은 이름 위 말끔히 지워진 곳,"
          },
          {
            "time": 142.2,
            "text": "상처들까지 안을 테니"
          },
          {
            "time": 143.8,
            "text": "이번엔 후회가 더 쌓일 수 있을 때까지 해줘"
          },
          {
            "time": 149.1,
            "text": "똑똑해지긴 무슨"
          },
          {
            "time": 150.2,
            "text": "한눈으로 감은 있지도 않은 시침"
          },
          {
            "time": 152.3,
            "text": "날 죽이는 일은 쉽지 값싸게 취해버리니"
          },
          {
            "time": 155.4,
            "text": "날 눕히는 척하며 버리고 간 인연들아 사실"
          },
          {
            "time": 157.8,
            "text": "사랑했다 말하고 싶었어 그동안 정말 많이"
          },
          {
            "time": 160.4,
            "text": "같은 상처가 생겨도,"
          },
          {
            "time": 162.3,
            "text": "이번에 나올 피는 다른 빛을 띄길 바랐어"
          },
          {
            "time": 165.3,
            "text": "같은 장면 수백 번 엎어지면서 배워도"
          },
          {
            "time": 168.3,
            "text": "절대 일어날 수 없다는 걸"
          },
          {
            "time": 170.4,
            "text": "알 때까지 너가 지워져도 참을 수 있을 것 같아"
          },
          {
            "time": 186.2,
            "text": "난 괜찮아, 오히려 원하던 선택이잖아"
          },
          {
            "time": 189.7,
            "text": "난 괜찮아, 오히려 원하던 선택이잖아"
          },
          {
            "time": 192.8,
            "text": "괜찮아 난, 오히려 원하던 선택이잖아"
          },
          {
            "time": 195.9,
            "text": "괜찮아 난, 오히려 원하던 선택이잖아"
          }
        ],
        "_BM0fsBFPCU": [
          {
            "time": 23.5,
            "text": "너와 같이 걸었던 바다의 생각을 하다"
          },
          {
            "time": 26.2,
            "text": "뛰어들 마음을 잠갔던 그때의 시간"
          },
          {
            "time": 28.6,
            "text": "음의 곱은 양"
          },
          {
            "time": 29.7,
            "text": "저 멀리 빛으로 수놓아질 때 바라보고픈 하늘"
          },
          {
            "time": 32.8,
            "text": "영원의 한 부분으로 박아둘 순간은"
          },
          {
            "time": 35.7,
            "text": "검은 밤으로 눈 먼 세계를 채워"
          },
          {
            "time": 38.3,
            "text": "비밀로 남겨야 하는 새벽이 생겨"
          },
          {
            "time": 40.9,
            "text": "이 순간이 오래 기억에 남을 것 같아"
          },
          {
            "time": 43.7,
            "text": "이 순간을 오래 기억할 것 같아"
          },
          {
            "time": 47.5,
            "text": "별이 담겨있는 눈동자에"
          },
          {
            "time": 49.3,
            "text": "떨어져 있어도 같은 하루를 겪고 있는 것 같네"
          },
          {
            "time": 52.5,
            "text": "출구 없는 꿈결을 헤맸던 내 옆자리를 위해서"
          },
          {
            "time": 55.7,
            "text": "남아줄 누군가의 배역에 목맸던 한때"
          },
          {
            "time": 58.7,
            "text": "하지만 나아가지 못해 밤이 믿기지 않는다면"
          },
          {
            "time": 62.2,
            "text": "그 불신은 아침을 맞을 미소를 가두는 가면"
          },
          {
            "time": 65.4,
            "text": "그리운 기억과 절대 지울 수 없는 장면을"
          },
          {
            "time": 68.4,
            "text": "끊임없이 되풀이했네"
          },
          {
            "time": 69.8,
            "text": "그곳을 낙원이라고 여긴 채"
          },
          {
            "time": 72,
            "text": "두고 온 세상이 아직 멈춰 있네"
          },
          {
            "time": 74.1,
            "text": "언제나처럼 '어쩌면'과 다음을 바꿨지"
          },
          {
            "time": 76.6,
            "text": "꾸며낸 기억은 수평선으로 빨려들어가"
          },
          {
            "time": 79.5,
            "text": "저무는 한 점이 돼, 그 뒤의 배경은 달라졌지"
          },
          {
            "time": 82.9,
            "text": "처음 이걸 보는 것처럼 내가 바보같아도"
          },
          {
            "time": 85.9,
            "text": "멍하니 앉아, 아무 말없이 바라볼까 해"
          },
          {
            "time": 88.6,
            "text": "후회가 밀려오지 않을 유일한 시간으로,"
          },
          {
            "time": 91.2,
            "text": "고요한 밤 머리 위엔 빛으로 적히는 파도"
          },
          {
            "time": 94.9,
            "text": "너와 같이 걸었던 바다의 생각을 하다"
          },
          {
            "time": 97.2,
            "text": "뛰어들 마음을 잠갔던 그때의 시간"
          },
          {
            "time": 99.7,
            "text": "음의 곱은 양"
          },
          {
            "time": 100.8,
            "text": "저 멀리 빛으로 수놓아질 때 바라보고픈 하늘"
          },
          {
            "time": 103.9,
            "text": "영원의 한 부분으로 박아둘 순간은"
          },
          {
            "time": 106.6,
            "text": "검은 밤으로 눈 먼 세계를 채워"
          },
          {
            "time": 109.2,
            "text": "비밀로 남겨야 하는 새벽이 생겨"
          },
          {
            "time": 111.9,
            "text": "이 순간이 오래 기억에 남을 것 같아"
          },
          {
            "time": 114.7,
            "text": "이 순간을 오래 기억할 것 같아"
          },
          {
            "time": 117.9,
            "text": "내 옆에 아직 너가 있단 건"
          },
          {
            "time": 119.4,
            "text": "이곳이 꿈이란 증거지만"
          },
          {
            "time": 121.2,
            "text": "늘 거짓말은 그렇지"
          },
          {
            "time": 122.4,
            "text": "다시 못 볼 풍경을 펼친 다음"
          },
          {
            "time": 124.1,
            "text": "모래시계의 바닥으로 낙하, 일몰을 향해 걷지"
          },
          {
            "time": 127.2,
            "text": "한 순간에 기대어 살 나에게 벽을 갖게 해줘"
          },
          {
            "time": 130.3,
            "text": "기록으로 남지 않을 뒷모습도 이젠 번지게 뒀지"
          },
          {
            "time": 133.3,
            "text": "손을 놓음 쫓아올 그림자를 어떻게 버티겠어"
          },
          {
            "time": 136.4,
            "text": "기도보다 낮은 약속에 걸린 새끼손가락"
          },
          {
            "time": 139.1,
            "text": "우릴 가라앉힐 만큼만 내일을 미워할까"
          },
          {
            "time": 142.2,
            "text": "가장 먼 너에게 말할 작별이 가까워져"
          },
          {
            "time": 145.1,
            "text": "이젠 떠나서 어떤 소식도 알 수 없게 돼도"
          },
          {
            "time": 148.1,
            "text": "이건 내 결정 중"
          },
          {
            "time": 149.2,
            "text": "제일 아름다운 미완성이 될 거야"
          },
          {
            "time": 151.1,
            "text": "상처들이 아직 널 숨긴다면, 내려와"
          },
          {
            "time": 154,
            "text": "하얗게 바랜 재들이 흩어지며 잠겨"
          },
          {
            "time": 156.5,
            "text": "귀를 낮춰 철썩여도 우리 가만하도록"
          },
          {
            "time": 159.5,
            "text": "후회가 밀려오지 않을 유일한 시간으로,"
          },
          {
            "time": 162.4,
            "text": "고요한 밤 머리 위엔 빛으로 적힌 파도"
          },
          {
            "time": 166.1,
            "text": "너와 같이 걸었던 바다의 생각을 하다"
          },
          {
            "time": 168.2,
            "text": "뛰어들 마음을 잠갔던 그때의 시간"
          },
          {
            "time": 170.8,
            "text": "음의 곱은 양"
          },
          {
            "time": 171.8,
            "text": "저 멀리 빛으로 수놓아질 때 바라보고픈 하늘"
          },
          {
            "time": 175,
            "text": "영원의 한 부분으로 박아둘 순간은"
          },
          {
            "time": 177.7,
            "text": "검은 밤으로 눈 먼 세계를 채워"
          },
          {
            "time": 180.3,
            "text": "비밀로 남겨야 하는 새벽이 생겨"
          },
          {
            "time": 182.9,
            "text": "이 순간이 오래 기억에 남을 것 같아"
          },
          {
            "time": 185.9,
            "text": "이 순간을 오래 기억할 것 같아"
          },
          {
            "time": 194.8,
            "text": "이 순간이 오래 기억에 남을 것 같아"
          },
          {
            "time": 197.8,
            "text": "이 순간을 오래 기억할 것 같아"
          }
        ],
        "PNVFfAzqZGo": [
          {
            "time": 21.9,
            "text": "굿모닝 서울, 미안 내가 늦었네"
          },
          {
            "time": 24,
            "text": "잠에서 깨기 전은 한강에 얹힌 새벽보다 뿌옇게"
          },
          {
            "time": 27.3,
            "text": "잘 지냈나 물어보면 답장엔"
          },
          {
            "time": 29,
            "text": "전부 다 그냥 그렇대"
          },
          {
            "time": 30.7,
            "text": "다행이야 그 말을 들을 수 있어서"
          },
          {
            "time": 33,
            "text": "빨리 어른이 되고 싶었던 난"
          },
          {
            "time": 35.1,
            "text": "지금 그것과 동시에 완전히 반대인 걸 원해"
          },
          {
            "time": 38.1,
            "text": "그러고선 뭔가 된 척을 하긴, 뻔뻔해도"
          },
          {
            "time": 41,
            "text": "원래와 바뀐 내 모습 구분하긴 어렵네"
          },
          {
            "time": 43.7,
            "text": "아이러니하지만 꿈은 제 모습에 취해 정체돼"
          },
          {
            "time": 47.3,
            "text": "그게 해소가 안 돼서 몇 해째"
          },
          {
            "time": 49.1,
            "text": "안개 덮힌 늪을 헤맸고 여전히 덤벙대네"
          },
          {
            "time": 51.8,
            "text": "난 누구의 조급함도 풀지 못했는데"
          },
          {
            "time": 54.5,
            "text": "하나를 허물고 다시 묶어둬야 할 매듭"
          },
          {
            "time": 57,
            "text": "아침과의 rendezvous 편히 만날 수 있을 때쯤"
          },
          {
            "time": 59.7,
            "text": "모든 적응 뒤에도 변하지 않을 하날 약속해줄래"
          },
          {
            "time": 62.9,
            "text": "날 위해 그저 머물러 있을 세계를"
          },
          {
            "time": 65.4,
            "text": "안부를 물어볼 때면 틀리지 않고 말할 수 있어"
          },
          {
            "time": 68.8,
            "text": "거긴 벌써 아침이 왔나요"
          },
          {
            "time": 70.6,
            "text": "누군가의 일상 내겐 기적이 깨운 하루"
          },
          {
            "time": 73.3,
            "text": "새벽이 지나서 동 터오고 그 다음으로"
          },
          {
            "time": 76.6,
            "text": "I'm fine, done & tied 끝이 보이네"
          },
          {
            "time": 78.9,
            "text": "Now I'm fine, done and tied"
          },
          {
            "time": 81.9,
            "text": "I'm fine, done & tied 끝이 보이네"
          },
          {
            "time": 84.2,
            "text": "Now I'm fine, done and tied"
          },
          {
            "time": 86.8,
            "text": "여러 안녕들을 섞어서 이젠 내일로 연결하려 해"
          },
          {
            "time": 90.3,
            "text": "잠시만 멈췄다 갈 어린 결심들을 삼켜낸 채"
          },
          {
            "time": 93.6,
            "text": "작별에 매였던 두 발을 풀어"
          },
          {
            "time": 95.6,
            "text": "날 외롭고 때론 아프게 만들던 완벽에게"
          },
          {
            "time": 98.4,
            "text": "뭔가를 기다리던 곳에 서게 된다면"
          },
          {
            "time": 101.1,
            "text": "그때는 숨기지 않고 꺼낼 상처만이"
          },
          {
            "time": 103.7,
            "text": "기도와 맞바꾼 무릎의 흙먼지를 기억하지"
          },
          {
            "time": 106,
            "text": "그 다음 털어낼 용기로 남은 길을 걸어가길"
          },
          {
            "time": 109.5,
            "text": "아이러니하지만, 꿈은 제 모습에 취해 정체돼"
          },
          {
            "time": 112.7,
            "text": "그게 해소가 안 돼서 몇 해째"
          },
          {
            "time": 114.6,
            "text": "헤맸던 미로 속 위를 올려다보길 선택해"
          },
          {
            "time": 117.4,
            "text": "그 시야를 담아두었다가 다시 꺼내게"
          },
          {
            "time": 120,
            "text": "하나를 허물고 다시 묶어둬야 할 매듭"
          },
          {
            "time": 122.5,
            "text": "아침과의 rendezvous 편히 만날 수 있을 때쯤"
          },
          {
            "time": 125.3,
            "text": "조금은 어른이 됐을 내게 하나 약속해줄래"
          },
          {
            "time": 128.4,
            "text": "그저 덤덤히 나아갈 미래를"
          },
          {
            "time": 131,
            "text": "안부를 물어볼 때면 틀리지 않고 말할 수 있어"
          },
          {
            "time": 134.3,
            "text": "거긴 벌써 아침이 왔나요"
          },
          {
            "time": 136,
            "text": "누군가의 일상 내겐 기적이 깨운 하루"
          },
          {
            "time": 138.8,
            "text": "새벽이 지나서 동 터오고 그 다음으로"
          },
          {
            "time": 141.8,
            "text": "I'm fine, done & tied 끝이 보이네"
          },
          {
            "time": 144.3,
            "text": "Now I'm fine, done and tied"
          },
          {
            "time": 147.2,
            "text": "I'm fine, done & tied 끝이 보이네"
          },
          {
            "time": 149.6,
            "text": "Now I'm fine, done and tied"
          },
          {
            "time": 153.1,
            "text": "I'm fine, done and tied"
          }
        ],
        "37YNUwxP6-w": [
          {
            "time": 17.6,
            "text": "What's the lust on evergreen?"
          },
          {
            "time": 19.6,
            "text": "Bloom for whatever, 모두 기억하려 했었지"
          },
          {
            "time": 22.1,
            "text": "주인공들이 변해 맥거핀,"
          },
          {
            "time": 24.1,
            "text": "빈 자리에 똑같이 빈 말로 채워진"
          },
          {
            "time": 26.2,
            "text": "이야기로 꾸민 잿빛 환상의 도금은"
          },
          {
            "time": 28.7,
            "text": "벗겨지지 너무나 쉽게"
          },
          {
            "time": 30.3,
            "text": "그걸로는 누구도 속일 수 없었으니"
          },
          {
            "time": 32.7,
            "text": "혼자만의 멍청한 기대였지"
          },
          {
            "time": 34.6,
            "text": "벌써 다시 대역들이 들어서네"
          },
          {
            "time": 36.6,
            "text": "어떤 자의 신은 계속해서 변해"
          },
          {
            "time": 38.7,
            "text": "경건하게 모은 두 손바닥 서로를 마주볼 때"
          },
          {
            "time": 41.5,
            "text": "옆을 지나던 이는 비웃었네"
          },
          {
            "time": 43.3,
            "text": "그런 걔도 무엇인가 쫓아가고 있어"
          },
          {
            "time": 45.7,
            "text": "돈 사람 인정 depends on every feature"
          },
          {
            "time": 47.9,
            "text": "누군가는 미쳐, 지쳐버리거나 믿어"
          },
          {
            "time": 50.4,
            "text": "난 이 영혼들을 구분하고 싶었어"
          },
          {
            "time": 53.2,
            "text": "또 다른 누군가는 끝에 대해 얘기하지"
          },
          {
            "time": 56.5,
            "text": "그 다음을 보는 상상부터,"
          },
          {
            "time": 58.1,
            "text": "닫힌 문 바깥에 어둠이 공포가 되기까지"
          },
          {
            "time": 61.1,
            "text": "돌아가겠다는 그 말,"
          },
          {
            "time": 62.4,
            "text": "잘 기억했다가 잊어버리기 전에 붙잡아"
          },
          {
            "time": 65.5,
            "text": "이럴 거면 떠나던 첫 발이 건너갔을 때"
          },
          {
            "time": 67.9,
            "text": "왜 열여섯 사랑처럼 설렜을까"
          },
          {
            "time": 70.5,
            "text": "느린 꿈 속에 잠긴 시계 위에 물결을 새겨놨지"
          },
          {
            "time": 74,
            "text": "가로등 불로 내 밤이 풀릴 때 휘청이다"
          },
          {
            "time": 77,
            "text": "제 갈길로 다시"
          },
          {
            "time": 78.6,
            "text": "물러서겠지, 그때 가서 후회할 유일한 일"
          },
          {
            "time": 82,
            "text": "무대 위 마지막까지 남길 바랐던 거였어"
          },
          {
            "time": 85.1,
            "text": "스스로 빚어낸 나의 신이"
          },
          {
            "time": 122.2,
            "text": "너와 나의 시간이 또 다시"
          },
          {
            "time": 124.1,
            "text": "제대로 흘러가기 시작한다면"
          },
          {
            "time": 126.1,
            "text": "더 이상 과거로 보내지 않을 상상을 더하지"
          },
          {
            "time": 129.2,
            "text": "늦었지만 거의 다 왔어"
          },
          {
            "time": 130.8,
            "text": "너무 아팠던 날들을 가둔"
          },
          {
            "time": 132.8,
            "text": "붉은 커튼 뒤의 세계를 정리하려 해"
          },
          {
            "time": 135.2,
            "text": "아쉬운 말은 다른 후회가 만들어지기 전에 삼켜"
          },
          {
            "time": 139.7,
            "text": "한 편에 하루짜리 밤과 별을"
          },
          {
            "time": 141.9,
            "text": "녹이던 내게 백야는 구원같았어"
          },
          {
            "time": 144.1,
            "text": "하얀 핀조명에 두 눈 먼 사이"
          },
          {
            "time": 146,
            "text": "넌 얼마나 먼 길을 갔던 걸까"
          },
          {
            "time": 148.3,
            "text": "난 지도 위 표시 안 된 곳에서,"
          },
          {
            "time": 150.5,
            "text": "떠나갈 앞길을 계속 지워 나갔어"
          },
          {
            "time": 152.6,
            "text": "돌아가겠단 말에 중독돼"
          },
          {
            "time": 154.7,
            "text": "집이 멀어지게 내버려두고 있었나 봐"
          },
          {
            "time": 157.7,
            "text": "의미를 잃어버리는 듯한 반복의 계절"
          },
          {
            "time": 161.3,
            "text": "잡아두지 못한 잔상들의 색은 바래지게 됐어"
          },
          {
            "time": 165.6,
            "text": "우린 더함과 같이 잊어가니"
          },
          {
            "time": 167.7,
            "text": "바란다는 말과 자주 착각했던"
          },
          {
            "time": 169.7,
            "text": "너와 나눴었던 꿈으로 그 위를 덧칠해"
          },
          {
            "time": 173.1,
            "text": "그 정도면 됐어"
          },
          {
            "time": 174.8,
            "text": "영원할 것 같던 진동은 멎어지게 놓아줘"
          },
          {
            "time": 178,
            "text": "별과 음악과 사랑과 넌"
          },
          {
            "time": 180.2,
            "text": "완결을 모를 때 제일 아름다웠더라고"
          },
          {
            "time": 183.1,
            "text": "영원할 것 같던 진동은 그대로 멎어지게 놓아줘"
          },
          {
            "time": 186.8,
            "text": "별과 음악과 사랑과 넌"
          },
          {
            "time": 188.9,
            "text": "완결을 모를 때 아름다웠어"
          },
          {
            "time": 192.4,
            "text": "어떤 기억들은 재가 된 채 남게 돼"
          },
          {
            "time": 196.8,
            "text": "비유가 불타서 없어진 세상에서도"
          },
          {
            "time": 200.8,
            "text": "건조하게 누군가의 손이라도 잡게 될 때"
          },
          {
            "time": 205.4,
            "text": "거긴 그제야 평범한 꿈을 닮겠네"
          },
          {
            "time": 209.4,
            "text": "너가 완벽한 줄 알아서 사랑할 수 있었어"
          },
          {
            "time": 213.9,
            "text": "그리고 난 그렇지 않아서 살아갈 수 있었어"
          },
          {
            "time": 218.2,
            "text": "너가 완벽한 줄 알아서 사랑할 수 있었어"
          },
          {
            "time": 222.7,
            "text": "난 그렇지 않아서 살아갈 수 있어"
          }
        ]
      };
      var currentIdx = 0;
      var lastActiveIdx = -1;
      var ytPlayer = null;
      var isPlaying = false;
      var progressInterval = null;

      // DOM refs
      var widget       = document.getElementById('play-widget');
      var elTrackInfo  = widget ? widget.querySelector('.play-track-info') : null;
      var elLyricsWrap = document.getElementById('play-lyrics-wrap');
      var elNum        = document.getElementById('play-track-num');
      var elTitle    = document.getElementById('play-track-title');
      var elStatus   = document.getElementById('play-track-status');
      var elCurrent  = document.getElementById('play-current');
      var elDuration = document.getElementById('play-duration');
      var elBarFill  = document.getElementById('play-bar-fill');
      var elBarTrack = document.getElementById('play-bar-track');
      var elMainBtn  = document.getElementById('play-main-btn');
      var elMainIcon = document.getElementById('play-main-icon');
      var elPrevBtn  = document.getElementById('play-prev-btn');
      var elNextBtn  = document.getElementById('play-next-btn');

      var isStatusTransitioning = false;
      var fadeInterval = null;
      var hasEverPlayed = false; // tracks whether audio has ever started playing

      function fadeAudio(targetVolume, duration, onComplete) {
        if (!ytPlayer || typeof ytPlayer.getVolume !== 'function') {
          if (onComplete) onComplete();
          return;
        }
        clearInterval(fadeInterval);
        var startVol = ytPlayer.getVolume();
        var startTime = Date.now();
        
        fadeInterval = setInterval(function() {
          var elapsed = Date.now() - startTime;
          var progress = Math.min(1, elapsed / duration);
          var curVol = Math.round(startVol + (targetVolume - startVol) * progress);
          ytPlayer.setVolume(curVol);
          
          if (progress >= 1) {
            clearInterval(fadeInterval);
            if (onComplete) onComplete();
          }
        }, 30);
      }

      function changeStatusWithFade(newStatus, duration, nextStateFn) {
        if (isStatusTransitioning) return;
        isStatusTransitioning = true;
        
        elStatus.classList.add('is-faded');
        var halfDuration = duration / 2;
        
        if (newStatus === 'Paused' || newStatus === 'Ready') {
          fadeAudio(0, halfDuration, function() {
            if (nextStateFn) nextStateFn();
            
            setTimeout(function() {
              elStatus.textContent = newStatus;
              elStatus.classList.remove('is-faded');
              isStatusTransitioning = false;
            }, 50);
          });
        } else if (newStatus === 'Now Playing') {
          if (nextStateFn) nextStateFn();
          if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
            ytPlayer.setVolume(0);
          }
          
          setTimeout(function() {
            elStatus.textContent = newStatus;
            elStatus.classList.remove('is-faded');
            isStatusTransitioning = false;
            
            fadeAudio(100, halfDuration);
          }, halfDuration);
        }
      }

      function pad(n) { return n < 10 ? '0' + n : n; }

      function formatTime(sec) {
        if (!isFinite(sec) || isNaN(sec)) return '0:00';
        var m = Math.floor(sec / 60);
        var s = Math.floor(sec % 60);
        return m + ':' + pad(s);
      }

      function updateTrackUI(idx) {
        var t = TRACKS[idx];
        elNum.textContent   = pad(idx + 1);
        document.dispatchEvent(new CustomEvent('play-track-changed', { detail: { index: idx } }));
        elTitle.textContent = t.title;
        elDuration.textContent = t.duration;
        elCurrent.textContent = '0:00';
        
        // Add resetting class for cubic-bezier progress bar reset transition
        elBarFill.classList.add('is-resetting');
        elBarFill.style.width = '0%';
        
        setTimeout(function() {
          elBarFill.classList.remove('is-resetting');
        }, 450);

        lastActiveIdx = -1;
        var container = document.getElementById('play-lyrics-content');
        if (container) {
          container.innerHTML = '';
          var trackLyrics = LYRICS_DATA[t.vid] || [];
          if (trackLyrics.length === 0) {
            var emptyLine = document.createElement('p');
            emptyLine.className = 'lyric-line active';
            emptyLine.textContent = '가사가 없습니다.';
            container.appendChild(emptyLine);
          } else {
            trackLyrics.forEach(function(line) {
              var lineEl = document.createElement('p');
              lineEl.className = 'lyric-line';
              lineEl.setAttribute('data-time', line.time);
              lineEl.textContent = line.text;
              lineEl.addEventListener('click', function(e) {
                e.stopPropagation();
                if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
                  ytPlayer.seekTo(line.time, true);
                  highlightActiveLyric(line.time);
                }
              });
              container.appendChild(lineEl);
            });
          }
          container.scrollTop = 0;
        }
      }

      function highlightActiveLyric(cur) {
        if (!elLyricsWrap) return;
        var container = document.getElementById('play-lyrics-content');
        if (!container) return;
        var lines = container.querySelectorAll('.lyric-line');
        if (lines.length === 0) return;
        
        var activeIdx = -1;
        for (var i = 0; i < lines.length; i++) {
          var t = parseFloat(lines[i].getAttribute('data-time'));
          if (isNaN(t)) continue;
          if (cur >= t) {
            activeIdx = i;
          } else {
            break;
          }
        }
        
        if (activeIdx !== lastActiveIdx) {
          for (var j = 0; j < lines.length; j++) {
            lines[j].classList.remove('active');
          }
          if (activeIdx !== -1) {
            var activeEl = lines[activeIdx];
            activeEl.classList.add('active');
            
            var topPos = activeEl.offsetTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);
            container.scrollTo({
              top: topPos,
              behavior: 'smooth'
            });
          }
          lastActiveIdx = activeIdx;
        }
      }

      function setPlaying(state) {
        isPlaying = state;
        if (state) {
          widget.classList.add('is-playing');
          if (!isStatusTransitioning) {
            elStatus.textContent = 'Now Playing';
          }
          // Pause icon
          elMainIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
          startProgress();
        } else {
          widget.classList.remove('is-playing');
          if (!isStatusTransitioning) {
            elStatus.textContent = isPlaying === false && ytPlayer ? 'Paused' : 'Ready';
          }
          elMainIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
          stopProgress();
        }
      }

      function startProgress() {
        stopProgress();
        progressInterval = setInterval(function() {
          if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
          try {
            var cur = ytPlayer.getCurrentTime();
            var dur = ytPlayer.getDuration();
            if (dur > 0) {
              elCurrent.textContent = formatTime(cur);
              elBarFill.style.width = ((cur / dur) * 100).toFixed(2) + '%';
              highlightActiveLyric(cur);
            }
          } catch(e) {}
        }, 100);
      }

      function stopProgress() {
        if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
      }

      function loadTrack(idx, autoplay, direction) {
        currentIdx = idx;
        direction = direction || 'next';

        // Trigger direction-specific text transition keyframe animation
        if (elTrackInfo) {
          elTrackInfo.classList.remove('track-anim-out-up', 'track-anim-out-down', 'track-anim-in-up', 'track-anim-in-down');
          
          var outClass = direction === 'prev' ? 'track-anim-out-down' : 'track-anim-out-up';
          elTrackInfo.classList.add(outClass);
          
          setTimeout(function() {
            updateTrackUI(idx);
            
            // Defer setPlaying/status text update to 250ms to match the fade out of track info
            if (autoplay) {
              setPlaying(true);
            } else {
              setPlaying(false);
              elStatus.textContent = 'Ready';
            }
            
            elTrackInfo.classList.remove(outClass);
            
            var inClass = direction === 'prev' ? 'track-anim-in-down' : 'track-anim-in-up';
            elTrackInfo.classList.add(inClass);
          }, 250); // 250ms matches the fade out keyframe animation duration
        } else {
          updateTrackUI(idx);
          if (autoplay) {
            setPlaying(true);
          } else {
            setPlaying(false);
            elStatus.textContent = 'Ready';
          }
        }

        if (!ytPlayer || typeof ytPlayer.loadVideoById !== 'function') return;
        if (autoplay) {
          ytPlayer.loadVideoById(TRACKS[idx].vid);
        } else {
          ytPlayer.cueVideoById(TRACKS[idx].vid);
        }
      }

      // ── YouTube IFrame API ──
      var ytTag = document.createElement('script');
      ytTag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(ytTag);

      window.onYouTubeIframeAPIReady = function() {
        var ytDiv = document.createElement('div');
        ytDiv.id  = 'yt-play-hidden';
        ytDiv.style.cssText = 'position:fixed;bottom:-200px;right:-200px;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-9999;';
        document.body.appendChild(ytDiv);

        ytPlayer = new YT.Player('yt-play-hidden', {
          height: '1', width: '1',
          videoId: TRACKS[0].vid,
          playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: function(event) {
              var elapsed = Date.now() - pageLoadTime;
              var delay = Math.max(0, 3100 - elapsed);
              setTimeout(function() {
                if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
                  // Attempt autoplay (may be blocked by browser policy without user gesture)
                  try { event.target.playVideo(); } catch(e) {}
                  // If browser blocks autoplay, no PLAYING event fires — detect after 1.5s
                  setTimeout(function() {
                    if (!isPlaying) {
                      // Autoplay was blocked: show Ready state so user can click to play
                      elStatus.textContent = 'Ready';
                      widget.classList.remove('is-playing');
                    }
                  }, 1500);
                }
              }, delay);
            },
            onStateChange: function(event) {
              if (event.data === YT.PlayerState.PLAYING) {
                if (ytPlayer && typeof ytPlayer.getVolume === 'function' && !isStatusTransitioning) {
                  ytPlayer.setVolume(100);
                }
                hasEverPlayed = true;
                setPlaying(true);
              } else if (event.data === YT.PlayerState.PAUSED) {
                setPlaying(false);
              } else if (event.data === YT.PlayerState.ENDED) {
                // Auto-advance to next track (next direction animation)
                var next = (currentIdx + 1) % TRACKS.length;
                loadTrack(next, true, 'next');
              }
            }
          }
        });
      };

      // ── Controls ──
      elMainBtn.addEventListener('click', function() {
        if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') return;
        var state = ytPlayer.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
          changeStatusWithFade('Paused', 600, function() {
            ytPlayer.pauseVideo();
          });
        } else {
          // First-ever play (autoplay was blocked): skip fade, start at full volume immediately
          if (!hasEverPlayed) {
            if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
              ytPlayer.setVolume(100);
            }
            ytPlayer.playVideo();
          } else {
            changeStatusWithFade('Now Playing', 600, function() {
              ytPlayer.playVideo();
            });
          }
        }
      });

      elPrevBtn.addEventListener('click', function() {
        var prev = (currentIdx - 1 + TRACKS.length) % TRACKS.length;
        loadTrack(prev, isPlaying, 'prev');
      });

      elNextBtn.addEventListener('click', function() {
        var next = (currentIdx + 1) % TRACKS.length;
        loadTrack(next, isPlaying, 'next');
      });

      // ── Progress bar seek ──
      elBarTrack.addEventListener('click', function(e) {
        if (!ytPlayer || typeof ytPlayer.getDuration !== 'function') return;
        var rect = elBarTrack.getBoundingClientRect();
        var ratio = (e.clientX - rect.left) / rect.width;
        ratio = Math.max(0, Math.min(1, ratio));
        
        // Add seeking transition class for smooth cubic-bezier fill animation
        elBarFill.classList.add('is-seeking');
        elBarFill.style.width = (ratio * 100).toFixed(2) + '%';
        
        try {
          var dur = ytPlayer.getDuration();
          if (dur > 0) ytPlayer.seekTo(dur * ratio, true);
        } catch(err) {}

        setTimeout(function() {
          elBarFill.classList.remove('is-seeking');
        }, 500);
      });

      // ── Toggle Lyrics Area ──
      if (elTrackInfo && elLyricsWrap) {
        elTrackInfo.addEventListener('click', function() {
          elLyricsWrap.classList.toggle('expanded');
        });
      }

      // Initialize UI
      updateTrackUI(0);
      // Open lyrics area on load
      if (elLyricsWrap) elLyricsWrap.classList.add('expanded');

      // ── Carousel logic (inside player IIFE — has access to TRACKS & player) ──
      (function initCarousel() {
        var viewport = document.getElementById('carousel-viewport');
        var carTrack = document.getElementById('carousel-track');
        var dots     = document.querySelectorAll('.carousel-dot');
        if (!viewport || !carTrack) return;

        var currentSlide = 0;
        var isDragging   = false;
        var startX       = 0;
        var startY       = 0;
        var dragDeltaX   = 0;
        var isScrolling  = false;
        var isSwiping    = false;
        var threshold    = 40;

        var inactivityTimeout = null;
        function resetInactivityTimer() {
          if (inactivityTimeout) {
            clearTimeout(inactivityTimeout);
            inactivityTimeout = null;
          }
          if (currentSlide === 1) {
            inactivityTimeout = setTimeout(function() {
              viewport.style.transition = 'opacity 0.4s ease';
              viewport.style.opacity = '0';
              setTimeout(function() {
                carTrack.style.transition = 'none';
                goToSlide(0);
                carTrack.offsetHeight; // force layout
                carTrack.style.transition = '';
                viewport.style.opacity = '1';
                setTimeout(function() {
                  viewport.style.transition = '';
                }, 400);
              }, 400);
            }, 6000);
          }
        }

        function goToSlide(idx) {
          currentSlide = Math.max(0, Math.min(idx, dots.length - 1));
          carTrack.style.transform = 'translateX(' + (-currentSlide * 100) + '%)';
          dots.forEach(function(d, i) {
            d.classList.toggle('active', i === currentSlide);
          });
          if (currentSlide === 0) {
            if (inactivityTimeout) {
              clearTimeout(inactivityTimeout);
              inactivityTimeout = null;
            }
          } else {
            resetInactivityTimer();
          }
        }

        // Dot click
        dots.forEach(function(dot) {
          dot.addEventListener('click', function(e) {
            e.stopPropagation();
            goToSlide(parseInt(dot.getAttribute('data-slide'), 10));
          });
        });

        // ── Mouse drag (desktop swipe) ──────────────────────────────
        viewport.addEventListener('mousedown', function(e) {
          isDragging   = true;
          startX       = e.clientX;
          dragDeltaX   = 0;
          carTrack.style.transition = 'none';
          e.preventDefault();
        });
        window.addEventListener('mousemove', function(e) {
          if (!isDragging) return;
          dragDeltaX = e.clientX - startX;
          var baseOffset = -currentSlide * viewport.offsetWidth;
          carTrack.style.transform = 'translateX(' + (baseOffset + dragDeltaX) + 'px)';
        });
        window.addEventListener('mouseup', function() {
          if (!isDragging) return;
          isDragging = false;
          carTrack.style.transition = '';
          if (dragDeltaX < -threshold) goToSlide(currentSlide + 1);
          else if (dragDeltaX > threshold) goToSlide(currentSlide - 1);
          else goToSlide(currentSlide);
        });

        // ── Touch drag (mobile swipe with mutual scroll lock) ────────
        viewport.addEventListener('touchstart', function(e) {
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
          dragDeltaX = 0;
          isScrolling = false;
          isSwiping = false;
          carTrack.style.transition = 'none';
        }, { passive: true });

        viewport.addEventListener('touchmove', function(e) {
          var currentX = e.touches[0].clientX;
          var currentY = e.touches[0].clientY;
          var diffX = currentX - startX;
          var diffY = currentY - startY;

          // Determine initial drag direction after moving past threshold (8px)
          if (!isScrolling && !isSwiping) {
            var gestureThreshold = 8;
            if (Math.abs(diffX) > gestureThreshold || Math.abs(diffY) > gestureThreshold) {
              if (Math.abs(diffX) > Math.abs(diffY)) {
                isSwiping = true;
              } else {
                isScrolling = true;
              }
            }
          }

          if (isSwiping) {
            // Lock vertical page scroll and drag carousel
            if (e.cancelable) e.preventDefault();
            dragDeltaX = diffX;
            var baseOffset = -currentSlide * viewport.offsetWidth;
            carTrack.style.transform = 'translateX(' + (baseOffset + dragDeltaX) + 'px)';
          }
          // If isScrolling is true, we let the browser handle vertical page scroll naturally
        }, { passive: false });

        viewport.addEventListener('touchend', function() {
          carTrack.style.transition = '';
          if (isSwiping) {
            if (dragDeltaX < -threshold) goToSlide(currentSlide + 1);
            else if (dragDeltaX > threshold) goToSlide(currentSlide - 1);
            else goToSlide(currentSlide);
          } else if (isScrolling) {
            goToSlide(currentSlide);
          }
          isScrolling = false;
          isSwiping = false;
        });

        viewport.addEventListener('touchcancel', function() {
          carTrack.style.transition = '';
          goToSlide(currentSlide);
          isScrolling = false;
          isSwiping = false;
        });

        // ── Render tracklist (TRACKS is accessible here) ─────────────
        var tlContainer = document.getElementById('tracklist-container');
        if (tlContainer && TRACKS && TRACKS.length) {
          TRACKS.forEach(function(t, i) {
            var item = document.createElement('div');
            item.className = 'tracklist-item';
            item.id        = 'tl-item-' + i;
            item.innerHTML =
              '<span class="tl-num">'   + String(i + 1).padStart(2, '0') + '</span>' +
              '<span class="tl-title">' + t.title    + '</span>' +
              '<span class="tl-dur">'   + t.duration + '</span>';
            item.style.opacity = '0.45';

            // Click → switch player track
            item.addEventListener('click', function(e) {
              e.stopPropagation();
              loadTrack(i, true);
            });
            tlContainer.appendChild(item);
          });

          // Mark track 0 as active initially
          var firstItem = tlContainer.querySelector('#tl-item-0');
          if (firstItem) { firstItem.classList.add('tl-active'); firstItem.style.opacity = '1'; }
          
          // Reset inactivity timer on scroll, wheel or touchmove
          tlContainer.addEventListener('scroll', resetInactivityTimer);
          tlContainer.addEventListener('wheel', resetInactivityTimer);
          tlContainer.addEventListener('touchmove', resetInactivityTimer);
        }

        // Reset inactivity timer on drag or click interaction
        viewport.addEventListener('mousedown', resetInactivityTimer);
        viewport.addEventListener('touchstart', resetInactivityTimer);
        window.addEventListener('mousemove', function(e) {
          if (isDragging) resetInactivityTimer();
        });
        viewport.addEventListener('touchmove', function(e) {
          if (isSwiping) resetInactivityTimer();
        });

        // ── Keep tracklist highlight in sync with player ─────────────
        document.addEventListener('play-track-changed', function(e) {
          var idx = e.detail && typeof e.detail.index === 'number' ? e.detail.index : -1;
          if (!tlContainer || idx < 0) return;
          [].forEach.call(tlContainer.querySelectorAll('.tracklist-item'), function(el, i) {
            var isActive = (i === idx);
            el.classList.toggle('tl-active', isActive);
            el.style.opacity = isActive ? '1' : '0.45';
          });
          // Scroll the active item into view inside the tracklist
          var activeEl = document.getElementById('tl-item-' + idx);
          if (activeEl && tlContainer) {
            var containerTop = tlContainer.scrollTop;
            var containerHeight = tlContainer.clientHeight;
            var elemTop = activeEl.offsetTop - tlContainer.offsetTop;
            var elemHeight = activeEl.offsetHeight;
            if (elemTop < containerTop) {
              tlContainer.scrollTo({ top: elemTop, behavior: 'smooth' });
            } else if (elemTop + elemHeight > containerTop + containerHeight) {
              tlContainer.scrollTo({ top: elemTop - containerHeight + elemHeight, behavior: 'smooth' });
            }
          }
        });
      })();
      // ── End Carousel logic ───────────────────────────────────────────

    })();