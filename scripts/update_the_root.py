#!/usr/bin/env python3
"""
update_the_root.py
==================
YouTube 플레이리스트를 가져와 the-root/index.html의 에피소드 목록을 자동 업데이트.

환경변수:
  YOUTUBE_API_KEY  - YouTube Data API v3 키 (GitHub Secret으로 관리)
  PLAYLIST_ID      - 업데이트할 플레이리스트 ID (워크플로우에서 지정)
"""

import os
import re
import sys
import requests
from datetime import datetime, timezone

YOUTUBE_API_KEY = os.environ["YOUTUBE_API_KEY"]
PLAYLIST_ID = os.environ.get("PLAYLIST_ID", "PLz166z7qN-0yOh9VmQndP_dG4iHzLm9g1")
HTML_PATH = "the-root/index.html"

# ─────────────────────────────────────────────
# 1. YouTube API로 플레이리스트 아이템 전체 가져오기
# ─────────────────────────────────────────────
def fetch_playlist_items():
    url = "https://www.googleapis.com/youtube/v3/playlistItems"
    items = []
    next_page = None

    while True:
        params = {
            "part": "snippet",
            "playlistId": PLAYLIST_ID,
            "maxResults": 50,
            "key": YOUTUBE_API_KEY,
        }
        if next_page:
            params["pageToken"] = next_page

        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        for item in data.get("items", []):
            snippet = item["snippet"]
            vid = snippet.get("resourceId", {}).get("videoId", "")
            if not vid or vid == "deleted":
                continue

            pub_raw = snippet.get("publishedAt", "")
            try:
                pub_dt = datetime.fromisoformat(pub_raw.replace("Z", "+00:00"))
                pub_str = pub_dt.strftime("%Y.%m.%d")
            except Exception:
                pub_str = ""

            items.append({
                "videoId": vid,
                "title": snippet.get("title", ""),
                "publishedAt": pub_str,
            })

        next_page = data.get("nextPageToken")
        if not next_page:
            break

    return items


# ─────────────────────────────────────────────
# 2. 기존 HTML에서 이미 있는 videoId 파싱
# ─────────────────────────────────────────────
def parse_existing_video_ids(html: str) -> list[str]:
    # archive-entry의 data-vid 속성에서 추출
    return re.findall(r'class="archive-entry[^"]*"\s+data-vid="([^"]+)"', html)


# ─────────────────────────────────────────────
# 3. 새 에피소드 HTML 블록 생성
# ─────────────────────────────────────────────
def build_episode_html(item: dict, ep_label: str) -> str:
    vid = item["videoId"]
    title = item["title"]
    date = item["publishedAt"]

    # 에피소드 번호에서 출연자 추출 시도 ("|" 이후 패턴)
    # 타이틀에서 게스트 이름 추출: "... | EP.N" 앞부분 첫 명사
    # 단순하게: 타이틀 전체를 type으로 쓰되 너무 길면 자름
    guest = ""
    if " | " in title:
        guest = title.split(" | ")[0].strip()
        if len(guest) > 20:
            guest = guest[:20] + "…"
    elif "EP." in title:
        guest = "Episode"
    else:
        guest = ep_label

    return f"""
            <!-- {ep_label} (auto-added) -->
            <div class="archive-entry" data-vid="{vid}">
              <a class="archive-item" href="javascript:void(0)">
                <div class="archive-item-left">
                  <svg class="archive-icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  <div class="archive-item-text">
                    <span class="archive-item-type">{guest}</span>
                    <div class="archive-item-title-row">
                      <span class="archive-item-title">{title}</span>
                      <span class="archive-item-date">{date}</span>
                    </div>
                  </div>
                </div>
              </a>
              <div class="archive-embed"></div>
            </div>"""


# ─────────────────────────────────────────────
# 4. "Latest Release" 섹션을 최신 에피소드로 교체
# ─────────────────────────────────────────────
def update_latest_release(html: str, newest: dict) -> str:
    vid = newest["videoId"]
    title = newest["title"]
    date = newest["publishedAt"]

    # 출연자 추출
    guest = ""
    if " | " in title:
        guest = title.split(" | ")[0].strip()
        if len(guest) > 20:
            guest = guest[:20] + "…"
    else:
        guest = "최신 에피소드"

    new_block = f"""          <div class="archive-entry active" data-vid="{vid}">
            <a class="archive-item latest-featured-item" href="javascript:void(0)">
              <div class="archive-item-left">
                <div class="archive-item-text">
                  <span class="archive-item-type">{guest}</span>
                  <div class="archive-item-title-row">
                    <span class="archive-item-title">{title}</span>
                    <span class="archive-item-date">{date}</span>
                  </div>
                </div>
              </div>
            </a>
            <div class="archive-embed open">
              <div class="custom-video-poster" data-vid="{vid}">
                <img class="poster-thumbnail" src="https://img.youtube.com/vi/{vid}/maxresdefault.jpg" alt="Video Cover">
                <div class="poster-play-btn">
                  <svg viewBox="0 0 24 24"><polygon points="8 5 19 12 8 19 8 5"/></svg>
                </div>
              </div>
            </div>
          </div>"""

    # static-content 안의 archive-entry 블록 전체 교체
    pattern = r'(<div class="static-content">)\s*<div class="archive-entry active".*?</div>\s*</div>\s*(</div>)'
    replacement = r'\1\n' + new_block + r'\n        \2'
    updated = re.sub(pattern, replacement, html, count=1, flags=re.DOTALL)
    return updated


# ─────────────────────────────────────────────
# 5. 메인
# ─────────────────────────────────────────────
def main():
    print(f"[update_the_root] Fetching playlist: {PLAYLIST_ID}")
    items = fetch_playlist_items()
    print(f"[update_the_root] Total items fetched: {len(items)}")

    with open(HTML_PATH, "r", encoding="utf-8") as f:
        html = f.read()

    existing_ids = parse_existing_video_ids(html)
    print(f"[update_the_root] Existing videoIds in HTML: {existing_ids}")

    # 기존에 없는 새 아이템만 필터
    new_items = [it for it in items if it["videoId"] not in existing_ids]
    print(f"[update_the_root] New items to add: {len(new_items)}")

    if not new_items:
        print("[update_the_root] Nothing to update.")
        return

    # archive-list의 닫는 태그 직전에 새 에피소드 삽입
    insert_marker = '</div>\n\n          </div>\n        </div>\n      </section>'
    new_episodes_html = ""
    for i, item in enumerate(new_items):
        ep_num = len(existing_ids) + i  # EP 번호는 기존 수 + 순서
        # EP.0은 Teaser이므로 offset 적용 (EP.0~은 실제 0-indexed)
        ep_label = f"EP.{ep_num - 1}" if ep_num > 0 else "EP.0"
        new_episodes_html += build_episode_html(item, ep_label)

    # archive-list 닫힘 직전에 삽입
    target = '          </div>\n\n          </div>\n        </div>\n      </section>'
    replacement = new_episodes_html + "\n\n" + target
    if target not in html:
        # 대안: 마지막 archive-entry 다음
        target2 = '</div>\n\n           </div>\n        </div>\n      </section>'
        html = html.replace(target, replacement, 1) if target in html else html

    html = html.replace(target, replacement, 1)

    # 최신 에피소드로 Latest Release 업데이트 (플레이리스트 마지막 = 최신)
    newest = items[-1]
    html = update_latest_release(html, newest)

    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"[update_the_root] Done. Added {len(new_items)} new episode(s).")


if __name__ == "__main__":
    main()
