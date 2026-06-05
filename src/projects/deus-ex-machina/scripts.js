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
        '1mc1pd': {
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
        'lyric-booklet': {
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
            "time": 17.8,
            "text": "이런 모습의 삶도 있어"
          },
          {
            "time": 19.6,
            "text": "이건 지금보다 더 어렸을 때는 가지고 싶던 거"
          },
          {
            "time": 22.2,
            "text": "그런 지금은 모든 후회들의 내일"
          },
          {
            "time": 24.2,
            "text": "되돌아갈 시간도 비슷하게 남겨질 걸"
          },
          {
            "time": 26.5,
            "text": "이런 모습의 삶도 있어"
          },
          {
            "time": 28,
            "text": "멀리서는 빛이 나는 것처럼 보이면서도"
          },
          {
            "time": 30.4,
            "text": "그것만으로 다음에 올 낮을 채우기엔 모자라"
          },
          {
            "time": 33,
            "text": "그걸 미리 봤어도 달라지지 않지만"
          },
          {
            "time": 34.8,
            "text": "우린 알게 될 거야 결국엔"
          },
          {
            "time": 37.4,
            "text": "(I'm from corners but good, tho)"
          },
          {
            "time": 39.6,
            "text": "그리고 너도 알게 될 거야"
          },
          {
            "time": 41.9,
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
            "time": 53.8,
            "text": "그동안 나눈 대화 중 아주 작은 부분이면 좋겠네"
          },
          {
            "time": 56.8,
            "text": "그리고 한 글자라도 널 의심하게 만든다면"
          },
          {
            "time": 59.1,
            "text": "그냥 지나가는 법은 모르게 해"
          },
          {
            "time": 61,
            "text": "난 우산을 두고 나온 날의 비를 기록해"
          },
          {
            "time": 63.2,
            "text": "남아 쓸려 나가지 않은 햇살을 비춰 보게"
          },
          {
            "time": 65.5,
            "text": "기어코 대답을 듣고 싶던 미스터리도"
          },
          {
            "time": 67.9,
            "text": "내 일부분이 돼 담아가 기억 속에"
          },
          {
            "time": 70.2,
            "text": "그러니 이제 남겨두고 와"
          },
          {
            "time": 71.8,
            "text": "시계를 탓하지 않아도 될 이 공간에"
          },
          {
            "time": 74.3,
            "text": "모래같은 신기루에 속아 헤매기보단"
          },
          {
            "time": 76.6,
            "text": "맨눈으로 나와 세상이 마주보게 하네"
          },
          {
            "time": 79.3,
            "text": "무대 위의 멋진 주인공과 객석"
          },
          {
            "time": 81.4,
            "text": "그 사이 낙차에"
          },
          {
            "time": 82.6,
            "text": "등을 돌리려 할 언젠가의 너와 나에게"
          },
          {
            "time": 85.2,
            "text": "작은 구원들이 있기를 바랄게"
          },
          {
            "time": 87.7,
            "text": "이런 모습의 삶도 있어"
          },
          {
            "time": 89.2,
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
            "time": 97.8,
            "text": "멀리서는 빛이 나는 것처럼 보이면서도"
          },
          {
            "time": 100.1,
            "text": "그것만으로 다음에 올 낮을 채우기엔 모자라도"
          },
          {
            "time": 103,
            "text": "이제는 그림자를 담아낼 수 있잖아"
          },
          {
            "time": 105.6,
            "text": "우린 알게 될 거야 결국엔"
          },
          {
            "time": 107.1,
            "text": "(I'm from corners but good, tho)"
          },
          {
            "time": 109.3,
            "text": "그리고 너도 알게 될 거야"
          },
          {
            "time": 111.7,
            "text": "(spill all the questions and doubt on me)"
          },
          {
            "time": 113.6,
            "text": "그렇다면 나도 알게 될 거야"
          },
          {
            "time": 116.4,
            "text": "그러니 분명한 건, 우린 알게 될 거야"
          },
          {
            "time": 121,
            "text": "One, two"
          }
        ],
        "X9mz9ldkaNY": [
          {
            "time": 17.8,
            "text": "변하지 않았단 말이 난 지금 부끄러워"
          },
          {
            "time": 20.5,
            "text": "변하지 않았단 말에 다시 숨으려 들어"
          },
          {
            "time": 25,
            "text": "변하지 않았단 말이 난 지금 부끄러워"
          },
          {
            "time": 27,
            "text": "변하지 않았단 말에 다시 숨으려 들어"
          },
          {
            "time": 33,
            "text": "평화, 그렇게 찾아다녀"
          },
          {
            "time": 35,
            "text": "지친 발로 이끌어도 문 앞에서 망설여"
          },
          {
            "time": 37,
            "text": "비밀번호를 알아서 더 숨이 막혀"
          },
          {
            "time": 40,
            "text": "행복 같은 게 전부 다 꿈일까 봐"
          },
          {
            "time": 42,
            "text": "서울 안 하루 잘 곳은 많아도 쉼은 어디"
          },
          {
            "time": 44,
            "text": "길 잃은 거리보다도 멀어지게 뒀어 집이"
          },
          {
            "time": 47,
            "text": "많게도 느껴지며 마음 붙일 곳은 없어질 때"
          },
          {
            "time": 49,
            "text": "완공돼 학교 앞에 정신병원이"
          },
          {
            "time": 51,
            "text": "주변엔 꿈을 선물한 성공과 입 맞춰"
          },
          {
            "time": 54,
            "text": "영원을 적는 난 끝을 볼 수 있나 과연"
          },
          {
            "time": 56,
            "text": "진혁이 형의 담배가 일몰을 닮아가던 때"
          },
          {
            "time": 59,
            "text": "밤이 퍼지고 목적지가 헷갈려"
          },
          {
            "time": 61,
            "text": "대체 무엇에 혹해 있어?"
          },
          {
            "time": 64,
            "text": "머리 아픈 질문들은 제발 전부 미뤄"
          },
          {
            "time": 66,
            "text": "그때의 변명은 한 달에 50만원"
          },
          {
            "time": 69,
            "text": "308 날짜로 바꿔 천구십다섯"
          },
          {
            "time": 71,
            "text": "여전히 도망쳐, 모두 떠밀려 간다 해도"
          },
          {
            "time": 73,
            "text": "맞는 방향이라는 것은 없다고 해줘"
          },
          {
            "time": 76,
            "text": "누구라도 있음 편할 텐데,"
          },
          {
            "time": 78,
            "text": "그럼 너가 보기에 주변에 아무도 없는 이 삶은 어때?"
          },
          {
            "time": 81,
            "text": "발버둥 (쳐야 해)"
          },
          {
            "time": 83,
            "text": "발버둥 (서울 안에서)"
          },
          {
            "time": 86,
            "text": "발버둥 (쳐야 돼)"
          },
          {
            "time": 88,
            "text": "발버둥"
          },
          {
            "time": 91,
            "text": "변하지 않았단 말이 난 지금 부끄러워"
          },
          {
            "time": 94,
            "text": "변하지 않았단 말에 다시 숨으려 들어"
          },
          {
            "time": 96,
            "text": "여전히, 여전하게 여전해"
          },
          {
            "time": 99,
            "text": "친구들에겐 인스타로 잘 지낸다고 전해"
          },
          {
            "time": 101,
            "text": "네 미래설계와 우리 사이는 많이 변했고"
          },
          {
            "time": 104,
            "text": "작업이란 말은 노림수가 너무 뻔해"
          },
          {
            "time": 107,
            "text": "서울 이곳은 실패한 놈들에게만 가혹해"
          },
          {
            "time": 109,
            "text": "너도 알지, \"그런데 안 미안하냐 가족에겐\""
          },
          {
            "time": 111,
            "text": "이딴 말이나 쓰게 된 난 낙오되고"
          },
          {
            "time": 114,
            "text": "언제든 처음부터 다시 시작할 수 있다고"
          },
          {
            "time": 116,
            "text": "가장 믿음 줘야 했던 나를 이렇게 속여봐도"
          },
          {
            "time": 119,
            "text": "내가 싫어서 먼저 빠져나왔다고"
          },
          {
            "time": 121,
            "text": "누군가 마주칠 수 없을 것 같았어"
          },
          {
            "time": 124,
            "text": "신념은 값싸고 약속들은 다 파토"
          },
          {
            "time": 126,
            "text": "같은 걸 마시고 다른 걸 삼켜"
          },
          {
            "time": 129,
            "text": "너흰 더 위로 난 뱉었어 흰 기포"
          },
          {
            "time": 131,
            "text": "그때의 변명은 만 원권 지폐 백 장이지"
          },
          {
            "time": 134,
            "text": "군자역 지하 작업실 반 년치"
          },
          {
            "time": 136,
            "text": "여전히 도망쳐, 모두 떠밀려 간다 해도"
          },
          {
            "time": 139,
            "text": "맞는 방향이라는 것은 없다고 해줘"
          },
          {
            "time": 141,
            "text": "누구라도 있음 편할 텐데,"
          },
          {
            "time": 144,
            "text": "그럼 너가 보기에"
          },
          {
            "time": 145,
            "text": "주변에 아무도 없는 이 삶은 어때?"
          },
          {
            "time": 148,
            "text": "발버둥 (쳐야 해)"
          },
          {
            "time": 150,
            "text": "발버둥 (서울 안에서)"
          },
          {
            "time": 152,
            "text": "발버둥 (쳐야 돼)"
          },
          {
            "time": 155,
            "text": "발버둥"
          },
          {
            "time": 157,
            "text": "솔직했다면 그건 또 누구의 잘못이야"
          },
          {
            "time": 160,
            "text": "어쩔 수 없지, 중요했으니 가식뿐인 삶보다"
          },
          {
            "time": 162,
            "text": "드러낼수록 약점만 늘어나"
          },
          {
            "time": 165,
            "text": "그렇게 쌓은 성에서 날 깔보다가"
          },
          {
            "time": 167,
            "text": "언젠가 받게 될 인정 하나"
          },
          {
            "time": 170,
            "text": "그거 하나에 내일의 동공을 박고 살아"
          },
          {
            "time": 172,
            "text": "사람으로 치유한다며"
          },
          {
            "time": 174,
            "text": "그 상처 준 장본인도 결국 사람이었네"
          },
          {
            "time": 177,
            "text": "만성, 내 syndrome 병명은 peter pan"
          },
          {
            "time": 180,
            "text": "매일 돌아갈 생각만 하다니 의미 없네"
          },
          {
            "time": 182,
            "text": "속을 바닥까지 봐야 한 컷을 꺼내"
          },
          {
            "time": 185,
            "text": "그 안의 난 되고 싶지 않던 나를 겪게 돼"
          },
          {
            "time": 187,
            "text": "사랑은 잊혀가는 부분의 합"
          },
          {
            "time": 190,
            "text": "네안데르탈인에 대한 내 방식의 답"
          },
          {
            "time": 192,
            "text": "자의로, 죽어가는 건 유통기한까지니까"
          },
          {
            "time": 195,
            "text": "내 자릴 찾아봐야 하지 빨리"
          },
          {
            "time": 197.7,
            "text": "그렇게 매듭지을 결말은"
          },
          {
            "time": 200.2,
            "text": "아름답길 여길 믿었던 것만큼"
          },
          {
            "time": 202.6,
            "text": "작았던 화면 속을 구원삼은"
          },
          {
            "time": 205.1,
            "text": "작았던 소년에게 배신 쳐"
          },
          {
            "time": 207.5,
            "text": "변하지 않았단 말이 난 지금 부끄러워"
          },
          {
            "time": 210,
            "text": "창문 없는 작업실 바닥에 누워"
          },
          {
            "time": 212.6,
            "text": "변하지 않았단 말에 다시 숨으려 들어"
          },
          {
            "time": 215.1,
            "text": "도피를 걸쳐야 마음 편하게 숨을 내쉬어"
          },
          {
            "time": 217.5,
            "text": "발버둥"
          }
        ],
        "ypC5FeYc8wY": [
          {
            "time": 23,
            "text": "무엇인가 사랑한 적 있다면 그 끝은 영원한 겨울"
          },
          {
            "time": 25.7,
            "text": "여기서 그 대상이 누가 아니었단 것은,"
          },
          {
            "time": 28.5,
            "text": "그렇게 내 원 안으로 들인 사람들이 남겨둔"
          },
          {
            "time": 31.2,
            "text": "진동을 맡아 두다 더는 견디기 어려워서"
          },
          {
            "time": 34,
            "text": "질문없이 공허한 대답을 꺼내"
          },
          {
            "time": 36.7,
            "text": "여러 갈래 길서"
          },
          {
            "time": 39.5,
            "text": "하필이면 벼랑 맨 앞으로 이끄는 선택"
          },
          {
            "time": 42.2,
            "text": "그런 게 몇 마디 고해성사로"
          },
          {
            "time": 45,
            "text": "후련해질 일이었대도"
          },
          {
            "time": 47.7,
            "text": "계속 돌아본 꿈은 악몽이라 적었네"
          },
          {
            "time": 50.5,
            "text": "수평을 가만히 들여다봐"
          },
          {
            "time": 53.2,
            "text": "파문이 일면 자리를 옮길 걱정부터 하지"
          },
          {
            "time": 56,
            "text": "우연을 일어난 대로 이해하기 어려워 난,"
          },
          {
            "time": 58.7,
            "text": "삶은 다 이렇단 단념이 먼저 못 박혀 슬펐네"
          },
          {
            "time": 61.5,
            "text": "철썩이는 소리가 나면 떠날 건 실수였나"
          },
          {
            "time": 64.2,
            "text": "발목 깊이로 밀려와도 휩쓸려가"
          },
          {
            "time": 70,
            "text": "완전히 젖었어도 말려 둘 계절은 없어"
          },
          {
            "time": 72.7,
            "text": "마음을 가라앉혀서 만든 기쁨이었을까 봐"
          },
          {
            "time": 75.5,
            "text": "그렇게 기다려 보는 현기증의 출처는"
          },
          {
            "time": 78.2,
            "text": "모두 같은 아픔"
          },
          {
            "time": 81,
            "text": "쓰러진 날 그대로 재우기엔 부족해"
          },
          {
            "time": 83.7,
            "text": "지금의 밝은 밤은"
          },
          {
            "time": 86.5,
            "text": "(난 너무 쉽게 빠져드네 잠으로)"
          },
          {
            "time": 89.2,
            "text": "그렇게 기다려 보는 현기증의 출처는"
          },
          {
            "time": 92,
            "text": "모두 같은 아픔"
          },
          {
            "time": 94.8,
            "text": "쓰러진 날 깨워 주기엔 부족해"
          },
          {
            "time": 97.5,
            "text": "지금의 너무 어두운 아침과 낮은"
          },
          {
            "time": 100.2,
            "text": "누군가 기다려본 적 있다면"
          },
          {
            "time": 103,
            "text": "그 끝은 시간의 침묵"
          },
          {
            "time": 105.8,
            "text": "집주인을 잃은 표지판만이 남아 서 있듯"
          },
          {
            "time": 108.5,
            "text": "해묵은 창틀의 꿈을 꾸지"
          },
          {
            "time": 111.2,
            "text": "낡아 없어지기만을 기다려"
          },
          {
            "time": 114,
            "text": "발자국의 백일몽은"
          },
          {
            "time": 116.8,
            "text": "눈 멀고 크게 부푼 만큼 지나쳤네"
          },
          {
            "time": 119.5,
            "text": "눈 앞과 뒤의 환상들이 뿌옇게 되지, 뭉개져"
          },
          {
            "time": 122.2,
            "text": "알았다고 믿은 세상 밑으로 잠겨들 뿐,"
          },
          {
            "time": 125,
            "text": "내 평화를 가로채가 만든 작품들엔"
          },
          {
            "time": 127.8,
            "text": "정신 못 차리고 헤멨었던 어린 날들이"
          },
          {
            "time": 130.5,
            "text": "날 뚫어보네"
          },
          {
            "time": 133.2,
            "text": "모른 척 눈 가리며 품 안으로 더 숨겨도"
          },
          {
            "time": 136,
            "text": "가시를 걷는 몽유, 그러니 영혼을 아예 묶어줘"
          },
          {
            "time": 138.7,
            "text": "돌아올 그 순간을 세고 찬 방을 비워 두면"
          },
          {
            "time": 141.5,
            "text": "거기서 보낸 지난 봄의 기록은 유서로 남아"
          },
          {
            "time": 144.2,
            "text": "고개를 들었다면 아침이 왔겠지만"
          },
          {
            "time": 147,
            "text": "스스로 해를 걷어 낸 백야의 상태지 난"
          },
          {
            "time": 149.7,
            "text": "유일히 완벽한 건 뒤돌아선 과거뿐이겠지"
          },
          {
            "time": 152.5,
            "text": "난 더 이상 들어가볼 수 없는 풍경일테니"
          }
        ],
        "98P1Utmb-94": [
          {
            "time": 27,
            "text": "띄웠어 검은 달을, 배경엔 하얀 밤 아침은 일러"
          },
          {
            "time": 31.9,
            "text": "세상이 갇힌 둑 뒤엔"
          },
          {
            "time": 36.8,
            "text": "환상들이 쌓이고 있어 거짓말만큼"
          },
          {
            "time": 41.8,
            "text": "내가 사랑했던 불규칙인 널 그대로 두고 싶던"
          },
          {
            "time": 46.7,
            "text": "시간으로 되잠길 유일한 방법은 도피였어"
          },
          {
            "time": 51.6,
            "text": "도착을 잊은 뭔가를 기다리기도 하다가"
          },
          {
            "time": 56.5,
            "text": "조급한 마음은 남은 멍자국들을 뒤쫓아가게 해"
          },
          {
            "time": 61.5,
            "text": "그 무거운 여정 끝에 놓인 의미는"
          },
          {
            "time": 66.4,
            "text": "백야를 헤쳐 지킨 휴식보단 낫길 믿어 의심치 마"
          },
          {
            "time": 71.3,
            "text": "머리가 아파 잊어버린 것들을 떠올리려 할 때면"
          },
          {
            "time": 76.2,
            "text": "거울 깨진 조각처럼 날 들여다보는 파편이 됐어"
          },
          {
            "time": 81.2,
            "text": "그 뒤에 놓인 찢어진 세상이 반사되어"
          },
          {
            "time": 86.1,
            "text": "날 체념하게 해"
          },
          {
            "time": 91,
            "text": "나보다 나은 내게 기댈 수밖에"
          },
          {
            "time": 95.9,
            "text": "달무리가 흩어지네 흐린 새벽을 안은 채"
          },
          {
            "time": 100.8,
            "text": "매번 그리움과 결말은 함께 서는 게 불가능해"
          },
          {
            "time": 105.8,
            "text": "어디로 발을 옮겨 딛어야 할까"
          },
          {
            "time": 110.7,
            "text": "일단 가는 게 맞는 해답이 될 지부터"
          },
          {
            "time": 115.6,
            "text": "알아야겠어"
          },
          {
            "time": 120.5,
            "text": "나의 실패는 후회보다 앞서기를 이번에야말로"
          },
          {
            "time": 125.5,
            "text": "내 실패는 후회를 앞질러가"
          },
          {
            "time": 130.4,
            "text": "먼저 나를 기다려주기를"
          },
          {
            "time": 150,
            "text": "검은 얼룩과 흰 먼지로 더럽혀질 그 미결"
          },
          {
            "time": 153.2,
            "text": "발을 잡아끄는 건 끝내고 두지 못한 계절"
          },
          {
            "time": 156.4,
            "text": "칼끝 같은 바람도 문 앞에 느리게 도착하네 반보다 매번"
          },
          {
            "time": 161.4,
            "text": "이걸 맞출 정확한 박차가 필요해져"
          },
          {
            "time": 164.8,
            "text": "다음의 기약할 날조차 확신할 수 없게 돼 버려서"
          },
          {
            "time": 169,
            "text": "앞으로 가야 되는데 난 돌아볼 버릇을 놓지 못했네 다시 긴 여정을 돕던"
          },
          {
            "time": 175.5,
            "text": "문장은 피부가 되어갔던 옛날 못 고친 입버릇처럼 망설임 시간만 살찌웠나"
          },
          {
            "time": 182.5,
            "text": "앞으로 가야 되는데 난 돌아볼 버릇을 놓지 못했네 다시 긴 여정을 돕던"
          },
          {
            "time": 189,
            "text": "문장은 피부가 되어갔던 옛날 못 고친 입버릇처럼 망설임 시간만 살찌웠나"
          }
        ],
        "BQR87WzBsAo": [
          {
            "time": 54.5,
            "text": "올가미 속 목 감기 시체처럼 맞는 아침 못 견뎌"
          },
          {
            "time": 59,
            "text": "또 다시 손 놓고 찾지 못하고 걸어간 그날같이"
          },
          {
            "time": 61.8,
            "text": "마음은 적셔 고초대 여전히 작품 녹슬 자리"
          },
          {
            "time": 64.5,
            "text": "음성의 전달로 천만희 부정할 영화이길"
          },
          {
            "time": 67.5,
            "text": "크레딧 다 반대 온걸 나을 땐 받대 닻을 세워 영원들은 남게 되는 것"
          },
          {
            "time": 71.2,
            "text": "못 박히면서"
          },
          {
            "time": 73.5,
            "text": "머릿속 다 비웠어"
          },
          {
            "time": 75.5,
            "text": "터질 것 같이 더럽힌 입과 손을 쓸어 담긴 핑계로 모아봤지"
          },
          {
            "time": 77.8,
            "text": "어서 너도 기대 자외선 힘으로 빌어봐"
          },
          {
            "time": 80.5,
            "text": "그딴 거 병신 같다 했던 어젠 이미 터졌어 나다리 가치 사막 위에 삶이 지쳐서 나"
          },
          {
            "time": 85.5,
            "text": "스치듯 비친 우물의 신기루의 짐 같은 꿈은 어떤 가치도 있지 않아"
          },
          {
            "time": 89.8,
            "text": "열병을 앓던 잠을 앓던 나아갈"
          },
          {
            "time": 92,
            "text": "낮게 된 날과 언제나 닿을 수 있을까"
          },
          {
            "time": 94.5,
            "text": "몇 번을 더 겪을 기상과 장면들이 바뀌는 사이에 이명을 끊어줄 우글 만날 수 있을까"
          },
          {
            "time": 104.2,
            "text": "계속해 맨 처음 그를 만날 수 있을까"
          },
          {
            "time": 108,
            "text": "미로 속을 헤맨 다음 그를 만날 수 있을까"
          },
          {
            "time": 111.5,
            "text": "들끓지 않은 술에 취해 걸어가고 싶었어"
          },
          {
            "time": 114,
            "text": "마음이 타버릴지 무섭지 않아도 되도록"
          },
          {
            "time": 116.5,
            "text": "작은 방 속에도 난 넘어갈 수 없는 경계선 앞에"
          },
          {
            "time": 119.8,
            "text": "기도받아 줄 하늘 위는 누군가 있길 바랐네"
          },
          {
            "time": 122.8,
            "text": "얼어붙지 않을 술에 취해 걸어가고 싶었어"
          },
          {
            "time": 125.5,
            "text": "해가 떴는지 더 묻지 않아도 되도록"
          },
          {
            "time": 128.2,
            "text": "그러다 마주친 거대한 그늘은 얼마나 유식할지"
          },
          {
            "time": 131,
            "text": "기도 지을 수 있을 만큼 내게 무너져 있길 바랐네"
          },
          {
            "time": 134,
            "text": "전부 몰아치게 둬야 했으니 결국 그 뒤의 어둠까지 버텨야 하는 일로 보장해"
          },
          {
            "time": 139.8,
            "text": "그걸 모르는 통과의 경계 안아 지 태풍 속 어린 양 자비로 구하소서"
          },
          {
            "time": 145.2,
            "text": "전부 몰아치게 둬야 했으니 결국 그 뒤의 어둠까지 버텨야 하는 일로 보장해"
          },
          {
            "time": 151,
            "text": "그걸 모르는 통과의 경계 안아 지 태풍 속 어린 양 자비로 구하소서"
          },
          {
            "time": 156.5,
            "text": "실수로 늘어놓은 검은 화면에 비춰 투영해 봐"
          },
          {
            "time": 160,
            "text": "사랑하는 때와 것 사람들을 그렇게 다 보내고 나서"
          },
          {
            "time": 163,
            "text": "아무것도 바꿀 수는 없었네라고 후회할 땐 시간의 반대편에 있어"
          },
          {
            "time": 167.8,
            "text": "실수로 멈춘 걸음 검은 하늘을 비춰 투영해 봐"
          },
          {
            "time": 171,
            "text": "사랑하는 때와 것 사람들을 그렇게 다 보내고"
          },
          {
            "time": 174,
            "text": "아무것도 바꿀 수는 없었네라고 후회할 땐 시간의 반대편에 있어"
          }
        ],
        "QXozHrPAVcw": [
          {
            "time": 11.8,
            "text": "우리 다시 시작해"
          },
          {
            "time": 15.5,
            "text": "잘 지난 사랑 노래가 아녀도"
          },
          {
            "time": 20.3,
            "text": "결국엔 후회할까 봐"
          },
          {
            "time": 24,
            "text": "다시 돌아봤을 때"
          },
          {
            "time": 27.5,
            "text": "지나간 사랑 노래라 해도"
          },
          {
            "time": 34,
            "text": "멈춰버린 것들은"
          },
          {
            "time": 37.5,
            "text": "그대로 있어"
          },
          {
            "time": 41.2,
            "text": "slip down to the check, all my dream's been fantasized"
          },
          {
            "time": 43.8,
            "text": "지하의 제일 밑바닥 지옥이지 아메그 경계까지"
          },
          {
            "time": 46,
            "text": "좋은 날들이여 부침반 흘러나쁜 결말이 덮거나 있는 건 못 해 그저 전부 지워져 가길"
          },
          {
            "time": 104.5,
            "text": "slip down to the check, all my dream's been paralyzed"
          },
          {
            "time": 107.5,
            "text": "지하의 제일 밑바닥 지옥이지 아메그 경계까지"
          },
          {
            "time": 110,
            "text": "좋은 날들이여 부침반 흘러나쁜 결말이 덮거나 있는 건 못 해 그저 전부 지워져 가길"
          },
          {
            "time": 116.8,
            "text": "먼 길을 돌아왔지"
          },
          {
            "time": 118.8,
            "text": "이유 같은 건 그전에 갈림길에서 놓고 발을 옮기지 바삐"
          },
          {
            "time": 123.5,
            "text": "모든 정답의 너머에 있는 것 같니"
          },
          {
            "time": 127.8,
            "text": "I need you"
          },
          {
            "time": 131,
            "text": "I need you"
          },
          {
            "time": 151.8,
            "text": "우리 다시 시작해"
          }
        ],
        "U56Yo5BXpXA": [
          {
            "time": 20.5,
            "text": "그때 난 어렸었니 그저 열병이었지"
          },
          {
            "time": 23,
            "text": "이렇게 말할 수 있을 때까지 참 금지"
          },
          {
            "time": 25.8,
            "text": "겨우 식혀낸 뒤 얼굴에 핀 열꽃이"
          },
          {
            "time": 28,
            "text": "더는 화끈거리지 않아서 다행이야"
          },
          {
            "time": 30.8,
            "text": "내 오랜 말 들어주던 사람이"
          },
          {
            "time": 33.2,
            "text": "몇 번의 막을 닫은 후에사야 그의 자릴 찾을 수 있게 됐는지 이제야 이해하지"
          },
          {
            "time": 39,
            "text": "나도 돌아가서 마침내 박수를 보내려고 너"
          },
          {
            "time": 42,
            "text": "회사원이 될까 해 그래"
          },
          {
            "time": 44.2,
            "text": "나도 알아 그것만은 안 하겠다 했는데 이제"
          },
          {
            "time": 47,
            "text": "찾은 고요함 때문에 그때 우리처럼 폼 잡기가 참 쉽지 않네"
          },
          {
            "time": 52,
            "text": "같이 좇던 빛은 이제 보니까"
          },
          {
            "time": 54.6,
            "text": "유난히 길었던 섬광이었나 봐"
          },
          {
            "time": 57.2,
            "text": "꺼진 이 편해 그 체온을 더 할게 만나 가끔 눈을 감으면 전상에 보이긴 하지만"
          },
          {
            "time": 102,
            "text": "오늘도 3호선에선"
          },
          {
            "time": 104.5,
            "text": "잠깐 어둠을 뚫었던 한강을 봤어"
          },
          {
            "time": 107,
            "text": "옆의 소년 핸드폰을 보며 눈치 부리더군"
          },
          {
            "time": 110,
            "text": "왠지 모르겠는데 좀 울적해졌어 그래"
          },
          {
            "time": 113,
            "text": "그때 3호선에서 한강을 봤던 소년은 가사를 썼어"
          },
          {
            "time": 117,
            "text": "그때 적던 말을 보면 눈이 찌푸려지더라"
          },
          {
            "time": 120,
            "text": "더 후회해도 미워하지 않을게"
          },
          {
            "time": 122.5,
            "text": "지금의 난 내가 믿지 않던 모든 것들의 광신도"
          },
          {
            "time": 125,
            "text": "사랑해 마지않는 행진곡"
          },
          {
            "time": 127.5,
            "text": "전해오던 세계에 금이 가고 구멍이 나도 아무렇지 않을지 몰라"
          },
          {
            "time": 131.5,
            "text": "아니 그럴 것 같아"
          },
          {
            "time": 133,
            "text": "변하지 않는 게 있길 바랐던 그때 너의 얼굴을 구겨서 넘겨버릴"
          },
          {
            "time": 137,
            "text": "어리석은 후회로 널 생각했단 말은"
          },
          {
            "time": 139.5,
            "text": "거짓말이야 무대만 깔려있었지 우린 주인공이 아니야"
          },
          {
            "time": 144,
            "text": "아직도 음악 비슷한 걸 다시 보고 싶어"
          },
          {
            "time": 146.5,
            "text": "결과에 지쳐버린 사랑에 나도 지쳐버린 걸까"
          },
          {
            "time": 149,
            "text": "창문 너머에 전해줄 수 없는 전화"
          },
          {
            "time": 151.5,
            "text": "특별히 또는 돌다 보면 조금은 별이 되었더라"
          },
          {
            "time": 154,
            "text": "만약 돌아갈 수 있다면 난 모르겠네 내가 그것까지 버릴 수 있는지"
          },
          {
            "time": 199,
            "text": "넌 그때랑 비슷해 보이는 사람을 조회수 화면 너머에서 보았는지는 끝 모를 실수이길"
          },
          {
            "time": 224,
            "text": "그때 기억나냐고만 갈 수 있는 시간엔"
          },
          {
            "time": 227,
            "text": "성숙함이 더해졌던 어땠을까 생각해도 돌아볼 수"
          },
          {
            "time": 229.8,
            "text": "도 없고 왜만 생길 틈이 없어"
          },
          {
            "time": 231.8,
            "text": "환상들은 파도 그 너머에 박혀있어"
          },
          {
            "time": 235,
            "text": "결국 아침으로 모아도 거뜬해"
          },
          {
            "time": 237.5,
            "text": "이런 노래는 100개도 낼 수 있지"
          },
          {
            "time": 240,
            "text": "또 닫히지 않은 눈 감고 웃기 바쁘진 채로"
          },
          {
            "time": 242.5,
            "text": "낯선 길을 나와 걸을 수 없을 듯해 너 이해하지 이제"
          },
          {
            "time": 246,
            "text": "사랑까지 모르겠어 솔직하자면"
          },
          {
            "time": 248,
            "text": "아직도 내게는 미지의 영역이니까 다른 길 위에"
          },
          {
            "time": 251.5,
            "text": "내게 배신감이 들 때면 위로의 용서라는 것도 조금은 어색해"
          },
          {
            "time": 255.5,
            "text": "다시라는 말을 또 쓰게 된다면"
          },
          {
            "time": 257.5,
            "text": "마지막이라는 말을 마지막으로 쓰게 된다면"
          },
          {
            "time": 300.8,
            "text": "덮어둘 자리에 네가 있으면 좋을 것 같아서"
          },
          {
            "time": 304.5,
            "text": "그리운 이름들이 떠올랐어"
          },
          {
            "time": 306.5,
            "text": "다시라는 말을 또 쓰게 된다면"
          },
          {
            "time": 308.5,
            "text": "마지막이라는 말을 마지막으로 쓰게 된다면"
          },
          {
            "time": 311.5,
            "text": "덮어둘 자리에 네가 온다면 좋을 것 같아서"
          },
          {
            "time": 315,
            "text": "그럴 것 같아서 그렇게 우리 돌려보냈지 그때로"
          },
          {
            "time": 320.5,
            "text": "그렇게 우리 돌려보냈지 그때로"
          }
        ],
        "7OjgubVlMrk": [
          {
            "time": 26.5,
            "text": "젖을 틈 없어 그럼 번한 이야기로 끝난 듯"
          },
          {
            "time": 32,
            "text": "우린 그 지옥을 봐야만 마음이 편해질 것 같아"
          },
          {
            "time": 39.5,
            "text": "몇 번이나 번 번째로 눈을 떠줄 수 없는 건 사랑한 얼굴 또 사랑스러운 씨발소"
          },
          {
            "time": 46.5,
            "text": "진짜로 이게 될 줄은 몰랐어 그랬으면 더"
          },
          {
            "time": 49.5,
            "text": "정신 차리라 너 소리 주머니 명품 주머니 속 넣어 둬"
          },
          {
            "time": 54,
            "text": "몇 번이나 번 번째로 눈을 떠줄 수 없는 건 사랑한 얼굴 또 사랑스러운 씨발소"
          },
          {
            "time": 61,
            "text": "얘 씨발 이것 괜찮은 거 맞냐 묻는 네가 싫었어 나 먼저 일어날게"
          },
          {
            "time": 64.5,
            "text": "기다리는 사람이 있어"
          },
          {
            "time": 109.5,
            "text": "똑똑해졌지 무슨 난 눈으로 감은 이지도 않은 시스템 날"
          },
          {
            "time": 112.5,
            "text": "죽이는 일은 쉽지 값싸게 취해버린 이 날"
          },
          {
            "time": 115.5,
            "text": "높이는 척하며 버리고 가 년들아 사실 너 사랑하단 말 뻔한 걸 고치고 싶다만"
          },
          {
            "time": 120.2,
            "text": "시간은 무의미"
          },
          {
            "time": 122,
            "text": "이상한 점을 찾을 순 없네 우린 거울을 깬 사진인가"
          },
          {
            "time": 126,
            "text": "갑자기 무섭네 등 뒤 소리 내는 발소리가"
          },
          {
            "time": 128,
            "text": "제일 무서워하네라고 말하니 고개를 끄덕거리면서 자기도 그렇지"
          },
          {
            "time": 133.5,
            "text": "그런데 우리 어쩌자 이런 말까지 하게 됐지"
          },
          {
            "time": 136.5,
            "text": "스스로 해를 거둬냈으니 백야의 상태겠지"
          },
          {
            "time": 139.5,
            "text": "얕은잠 속 환상 조각으로 남아 세 되는 잔해들이"
          },
          {
            "time": 143,
            "text": "마음에 내려앉아 질 때마다 가시로 바뀌게 됐지"
          },
          {
            "time": 147,
            "text": "지금은 행복하냐니 무슨 뜬금없는 질문이야"
          },
          {
            "time": 150.5,
            "text": "그래서 더 말하기도 귀찮아"
          },
          {
            "time": 152.8,
            "text": "너는 어때 솔직히 말해봐 그리고 있잖아"
          },
          {
            "time": 155.8,
            "text": "더는 반복하고 싶지 않은 하루가 된 건 처음이야 네 곁"
          },
          {
            "time": 159.8,
            "text": "으로 보내준 사람이 있다면 나의 모든 걸 바칠 수 있어 별거 아닌 걸로도 팔고 건 영혼까지도"
          },
          {
            "time": 206.5,
            "text": "그 마리에 있는 장면은 블러드 다음은 영원의 것 원래 먼지 쌓이는 자리 아무것도 없는걸"
          },
          {
            "time": 213.2,
            "text": "그리고 결국 다시"
          },
          {
            "time": 214.5,
            "text": "비어버린 자리에서 시간은 지나고 똑같이 선 모습을 맞이했어"
          },
          {
            "time": 220.5,
            "text": "같은 이름 위 마크가 지어진 곳 상처들까지 않을 테니 이번엔 후회가 더 쌓일 수 있을 때까지 줘"
          },
          {
            "time": 229.5,
            "text": "똑똑해졌지 무슨 난 눈으로 감은 이지도 않은 시스템 날"
          },
          {
            "time": 233.2,
            "text": "죽이는 일은 쉽지 값싸게 취해버린 이 날"
          },
          {
            "time": 236,
            "text": "높이는 척하며 버리고 가 년들아 사실 사랑했다 말하고 싶었어 그동안 정말 많이"
          },
          {
            "time": 240.8,
            "text": "같은 상처가 생겨도 이번엔 나을 피는 다른 빛을 띠길 바랐어"
          },
          {
            "time": 245.5,
            "text": "같은 장면 수백 번 넘어지면서 배웠어"
          },
          {
            "time": 248.5,
            "text": "절대 일어날 수 없다는 건 알 때까지 네가 지워줘도 참을 수 있을 것 같아"
          },
          {
            "time": 307.5,
            "text": "난 괜찮아 오히려 원하던 선택이잖아"
          },
          {
            "time": 311.8,
            "text": "난 괜찮아 오히려 원하던 선택이잖아 괜찮아 난 오히려 원하던 선택이잖아 괜찮아 난 오히려 원하던 선택이잖아"
          }
        ],
        "_BM0fsBFPCU": [
          {
            "time": 23.5,
            "text": "너와 같이 걸었던 바다의 생각을 하다 뛰어들 마음을 삼켰던 그때 시간"
          },
          {
            "time": 29.8,
            "text": "은은하게 저 멀리 빛으로 수놓아질 때 바라보고 푼 하늘 영원히 한 부분으로 바 가둘 순간은"
          },
          {
            "time": 36.5,
            "text": "검은 밤으로 눈 먼 세계를 채워"
          },
          {
            "time": 39.5,
            "text": "비밀로 남겨야 하는 새벽이 생겨"
          },
          {
            "time": 42.2,
            "text": "이순간이 오래 기억에 남을 것 같아"
          },
          {
            "time": 45,
            "text": "이 순간을 오래 기억할 것 같아"
          },
          {
            "time": 48,
            "text": "별이 잠겨있는 눈동자에 떨어져 있어도 같은 하루를 겪고 있는 것 같네"
          },
          {
            "time": 53,
            "text": "출구 없는 꿈결을 헤맸던 내 앞자리를 위해서나마 줄 누군가의 배역에 목맸던 난 이제 하지만"
          },
          {
            "time": 58.2,
            "text": "나"
          },
          {
            "time": 60.8,
            "text": "다시 못 할 밤의 믿기지 않는다면"
          },
          {
            "time": 63.2,
            "text": "그 불씨는 아침을 맞을 미소를 가두는 가면"
          },
          {
            "time": 66,
            "text": "그리운 기억과 절대 지울 수 없는 장면을"
          },
          {
            "time": 68.5,
            "text": "끊임없이 되풀이했네 그곳을 낙원이라고 여긴 채"
          },
          {
            "time": 71.8,
            "text": "두꺼운 세상이 아직 멈춰있네 언제나처럼 어쩌면 과"
          },
          {
            "time": 75.5,
            "text": "다음을 바꿔 질 구며낸 기억은 수평선으로 빨려 들어가 저무는 한 점이 돼"
          },
          {
            "time": 81,
            "text": "그 뒤의 배경은 달라졌지"
          },
          {
            "time": 83.5,
            "text": "처음 이걸 보는 것처럼 내가 바보 같아도"
          },
          {
            "time": 86.5,
            "text": "멍하니 앉아 모으는 말 없이 바라볼까 해"
          },
          {
            "time": 89.2,
            "text": "후회가 밀려오지 않을 유일한 시간으로 고요한 밤 머리 위에"
          },
          {
            "time": 134.2,
            "text": "빛으로 적히는 파도"
          },
          {
            "time": 136.5,
            "text": "너와 같이 걸었던 바다의 생각을 하다 뛰어들 마음을 삼켰던 그때 시간"
          },
          {
            "time": 142.5,
            "text": "은은하게 저 멀리 빛으로 수놓아질 때 바라보고 푼 하늘 영원히 한 부분으로 바 가둘 순간은"
          },
          {
            "time": 148.8,
            "text": "검은 밤으로 눈 먼 세계를 채워"
          },
          {
            "time": 151.5,
            "text": "비밀로 남겨야 하는 새벽이 생겨"
          },
          {
            "time": 154,
            "text": "이 순간이 오래 기억에 남을 것 같아"
          },
          {
            "time": 157,
            "text": "이 순간을 오래 기억할 것 같아"
          },
          {
            "time": 159.8,
            "text": "네 옆에 아직 내가 있단 건 이곳이 꿈이란 증거"
          },
          {
            "time": 202.5,
            "text": "지나온 말들은 그렇지 다시 못 볼 풍경을 펼친 다음"
          },
          {
            "time": 205.5,
            "text": "모래시계 바닥으로 낙"
          },
          {
            "time": 207.5,
            "text": "일몰을 향해 걷지 않은 순간이 기어이 살아나 내게 벽을 깎게 해줘"
          },
          {
            "time": 212,
            "text": "기록으로 남지 않을 뒷모습도 이젠 번지게 두었지 손을 놓아 쫓아올 그림자를 어떻게 버티겠어"
          },
          {
            "time": 217.5,
            "text": "기도보다 낮은 약속에 걸린 새끼손가락 우울을 가라앉힌 만큼만 내 일을 미워할까"
          },
          {
            "time": 223,
            "text": "가장 먼저 너에게 말할 작별이 가까워져"
          },
          {
            "time": 226,
            "text": "이젠 또 나서 어떤 소식도 알 수 없게 되어도"
          },
          {
            "time": 229,
            "text": "이건 내 결정 중 제일 아름다운 미완성이 될 거야 상처들이 아직 널 숨긴다면 내려와"
          },
          {
            "time": 234.8,
            "text": "하얗게 바랜 재들이 흩어지며 잠겨 길을 낮춰"
          },
          {
            "time": 238.2,
            "text": "철썩여줘 우릴 감싸 안아주도록"
          },
          {
            "time": 241.2,
            "text": "후회가 밀려오지 않을 유일한 시간으로 고요한 밤 머리 위에"
          },
          {
            "time": 245.5,
            "text": "빛으로 적힌 파도"
          },
          {
            "time": 247.8,
            "text": "너와 같이 걸었던 바다의 생각을 하다 뛰어들 마음을 삼켰던 그때 시간"
          },
          {
            "time": 253.8,
            "text": "은은하게 저 멀리 빛으로 수놓아질 때 바라보고 푼 하늘 영원히 한 부분으로 바 가둘 순간은"
          },
          {
            "time": 259.8,
            "text": "검은 밤으로 눈 먼 세계를 채워"
          },
          {
            "time": 302.8,
            "text": "비밀로 남겨야 하는 새벽이 생겨"
          },
          {
            "time": 305.2,
            "text": "이 순간이 오래 기억에 남을 것 같아"
          },
          {
            "time": 308,
            "text": "이 순간을 오래 기억할 것 같아"
          }
        ],
        "PNVFfAzqZGo": [
          {
            "time": 22,
            "text": "Good morning, 서울 미안 내가 늦었네 잠에서 깨기 전은 한강엔 친 새벽보다 뿌옇게"
          },
          {
            "time": 27.5,
            "text": "잘 지내냐 물어보면 답장엔 전부 다 그냥 그렇대 다행이야 그 말을 들을 수 있어서"
          },
          {
            "time": 32.8,
            "text": "빨리 어른이 되고 싶었던 난 지금 그것과 동시에 완전히 반대인 걸 원해"
          },
          {
            "time": 38,
            "text": "그러고서 뭔가 된 척하기엔 뻔뻔해도 원래와 바뀐 내 모습 구분하긴 어렵네"
          },
          {
            "time": 43.2,
            "text": "아이러니하지만, 꿈은 제 모습에 취해 정체될 게 수고 안 돼서면 됐지"
          },
          {
            "time": 49,
            "text": "안개 덮인 네 플랜에 메꿔 회전이 더 멍때네 난 누구의 조급함도 풀지 못했는데"
          },
          {
            "time": 54,
            "text": "하나를 물고 다시 묶어도 야윈 매듭 아침과의 랑데부 편히 만날 수 있을 때쯤"
          },
          {
            "time": 59.2,
            "text": "모든 적응 뒤에도 변하지 않을 하나 약속해 줄래 날 위해 그저 머물러있을 세계를"
          },
          {
            "time": 65.5,
            "text": "안부를 물어볼 때면 들리지 않고 말할 수 있어 거긴 벌써 아침이 왔나요"
          },
          {
            "time": 111.2,
            "text": "누군가의 일상 내겐 기적 기분 하루 새벽이 지나서 동트고 그 다음으로"
          },
          {
            "time": 116.2,
            "text": "I'm fine, turn and tight 끝을 보이는 나 I'm fine, turn and tight"
          },
          {
            "time": 121.8,
            "text": "I'm fine, turn and tight 끝을 보이는 나 I'm fine, turn and tight"
          },
          {
            "time": 127.2,
            "text": "여러 안녕들을 섞어서 이제 내일로 연결하려고 해 잠시만 멈췄다 갈"
          },
          {
            "time": 131.8,
            "text": "어린 결심들을 삼켜낸 채 작별에 매었던 두 발을 풀어"
          },
          {
            "time": 135,
            "text": "날 외롭고 때론 나쁘게 만들던 완벽에게"
          },
          {
            "time": 139.2,
            "text": "뭔갈 기다리던 곳에서 걷게 된다면 그때는 숨기지 않고 꺼낼 상처"
          },
          {
            "time": 143.8,
            "text": "많기도 한 아빠 꽃무릇에 응어릴 기억하시고 일단 털어낼 용기로 남은 길을 걸어가길"
          },
          {
            "time": 149.2,
            "text": "아이러니하지만, 꿈은 제 모습에 취해 정체될 게 수고 안 돼서면 됐지"
          },
          {
            "time": 154.5,
            "text": "헤매던 미로 속 위를 올려다보길 선택해 그 시야 담아 두었다가 다시 꺼내게"
          },
          {
            "time": 159.8,
            "text": "하나를 물고 다시 묶어도 야윈 매듭 아침과의 랑데부 편히 만날 수 있을 때쯤"
          },
          {
            "time": 204.8,
            "text": "조금은 어른이 됐을 네게 하나의 약속해 줄래 그저 점점 나아갈 미래를"
          },
          {
            "time": 211.2,
            "text": "안부를 물어볼 때면 들리지 않고 말할 수 있어 거긴 벌써 아침이 왔나요"
          },
          {
            "time": 216.8,
            "text": "누군가의 일상 내겐 기적 기분 하루 새벽이 지나서 동트고 그 다음으로"
          },
          {
            "time": 222,
            "text": "I'm fine, turn and tight 끝을 보이는 나 I'm fine, turn and tight"
          },
          {
            "time": 227,
            "text": "I'm fine, turn and tight 끝을 보이는 나 I'm fine, turn and tight"
          }
        ],
        "37YNUwxP6-w": [
          {
            "time": 17.8,
            "text": "What's the lost of evergreen, bloom for whatever 모두 기억하려고 했었지"
          },
          {
            "time": 22.2,
            "text": "주인공들이 변한 매 컷의 필름 빈자리에 똑같이 비밀로 채워진"
          },
          {
            "time": 26.5,
            "text": "네 이야기로 꾸민 제빛 단상에도 금은 벗겨지지 너무나 쉽게 그걸로는 누구도 속일 수 없었으니"
          },
          {
            "time": 33.5,
            "text": "혼자만의 멍청한 기대였지"
          },
          {
            "time": 35.5,
            "text": "벌써 다른 대역들이 들어서네 어떤 자의 시는 계속해서 변해"
          },
          {
            "time": 40.8,
            "text": "경건하게 모은 두 손바닥 서로 마주 볼 때 아플 지나던 이는 비웃었네 그런 궤도"
          },
          {
            "time": 44.2,
            "text": "무엇인가 쫓아가고 있었어 좋은 사람 인정 depends on every feature"
          },
          {
            "time": 48.5,
            "text": "누군가는 미쳐, 지쳐버리거나 믿어 난 이 영혼들을 구분하고 싶었어"
          },
          {
            "time": 54,
            "text": "또 다른 누군가는 끝에 대해 얘기하지"
          },
          {
            "time": 56.5,
            "text": "그 다음을 보는 상상부터, 닫힌 문 바깥에 어둠이 공포가 되기까지"
          },
          {
            "time": 62,
            "text": "돌아가겠다는 그 말, 잘 기억했다가 잊어버리기 전에 붙잡아"
          },
          {
            "time": 67.5,
            "text": "이럴 거면 떠나던 첫 발이 건너갔을 때 왜 열여섯 사랑처럼 설렜을까"
          },
          {
            "time": 112.8,
            "text": "느린 꿈 속에 잠긴 시계 위에 물결을 새겨놨지 가로등 불로 내 밤이 풀릴 때 휘청이다 제 갈 길로 다시"
          },
          {
            "time": 118.5,
            "text": "물러서겠지, 그때 가서 후회할 유일한 일 무대 위 마지막까지 남길 바랐던 거였어 스스로 빚어낸 나의 신이"
          },
          {
            "time": 204.5,
            "text": "너와 나의 시간이 또 다시 제대로 흘러가기 시작한다면"
          },
          {
            "time": 214.2,
            "text": "더 이상 과거로 보내지 않을 상상을 더하지 늦었지만 거의 다 왔어"
          },
          {
            "time": 219.5,
            "text": "너무 아팠던 날들을 가둔 붉은 커튼 뒤의 세계를 정리하려 해"
          },
          {
            "time": 224.5,
            "text": "아쉬운 말은 다른 후회가 만들어지기 전에 삼켜 한편에 하루짜리 밤과 별을"
          },
          {
            "time": 229.8,
            "text": "녹이던 내게 백야는 구원 같았어 하얀 핀 조명에 두 눈 먼 사이 넌 얼마나 먼 길을 갔던 걸까"
          },
          {
            "time": 236.5,
            "text": "난 지도 위 표시 안 된 곳에서, 떠나갈 앞길을 계속 지워 나갔어"
          },
          {
            "time": 242.5,
            "text": "돌아가겠단 말에 중독돼 집이 멀어지게 내버려 두고 있었나 봐"
          },
          {
            "time": 248,
            "text": "의미를 잃어버리는 듯한 반복의 계절 잡아두지 못한 잔상들의 색은 바래지게 됐어"
          },
          {
            "time": 254,
            "text": "우린 더함과 같이 잊어가니 바란다는 말과 자주 착각했던 너와 나눴었던 꿈으로 그 위를 덧칠해"
          },
          {
            "time": 299.8,
            "text": "그 정도면 됐어"
          },
          {
            "time": 302.2,
            "text": "영원할 것 같던 진동은 멎어지게 놓아줘 별과 음악과 사랑과 넌 완결을 모를 때 제일 아름답더라고"
          },
          {
            "time": 311.2,
            "text": "영원할 것 같던 진동은 그대로 멎어지게 놓아줘 별과 음악과 사랑과 넌 완결을 모를 때 아름답고"
          },
          {
            "time": 320.5,
            "text": "어떤 기억들은 재가 된 채 남게 돼 비유가 불타서 없어진 세상에서도"
          },
          {
            "time": 326.5,
            "text": "건조하게 누군가의 손이라도 잡게 될 때 거긴 그제야 평범한 꿈을 닮겠네"
          },
          {
            "time": 331,
            "text": "네가 완벽한 줄 알아서 사랑할 수 있었어"
          },
          {
            "time": 333.8,
            "text": "그리고 난 그렇지 않아서 살아갈 수 있었어"
          },
          {
            "time": 336.5,
            "text": "네가 완벽한 줄 알아서 사랑할 수 있었어"
          },
          {
            "time": 339.5,
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
        }, 250);
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