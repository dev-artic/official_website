#!/usr/bin/env python3
"""
update_playlists.py
===================
모든 artic. 프로젝트의 YouTube 플레이리스트를 일괄 동기화.

playlist_config.py에 등록된 프로젝트를 순회하며:
  1. YouTube API로 플레이리스트 최신 목록 조회
  2. HTML에 없는 새 영상만 에피소드 목록에 추가
  3. Latest Release 섹션을 최신 영상으로 교체

환경변수:
  YOUTUBE_API_KEY  - YouTube Data API v3 키 (GitHub Secret)
  각 프로젝트별 playlist_id_env에 지정된 변수명 (선택적 오버라이드)
"""

import os
import re
import sys
from datetime import datetime

try:
    import requests
except ImportError:
    print("ERROR: 'requests' 패키지가 필요합니다. pip install requests")
    sys.exit(1)

# playlist_config.py는 이 스크립트와 같은 scripts/ 디렉터리에 위치
sys.path.insert(0, os.path.dirname(__file__))
from playlist_config import PROJECTS

YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")


# ─────────────────────────────────────────────────────────────
# 1. YouTube 플레이리스트 전체 항목 가져오기
# ─────────────────────────────────────────────────────────────
def fetch_playlist_items(playlist_id: str) -> list[dict]:
    url = "https://www.googleapis.com/youtube/v3/playlistItems"
    items = []
    next_page = None

    while True:
        params = {
            "part": "snippet",
            "playlistId": playlist_id,
            "maxResults": 50,
            "key": YOUTUBE_API_KEY,
        }
        if next_page:
            params["pageToken"] = next_page

        resp = requests.get(url, params=params, timeout=15)
        if resp.status_code != 200:
            print(f"  [ERROR] API 호출 실패 (상태 코드 {resp.status_code}): {playlist_id}")
            return []
        data = resp.json()

        for item in data.get("items", []):
            snippet = item["snippet"]
            vid = snippet.get("resourceId", {}).get("videoId", "")
            if not vid or vid == "deleted":
                continue

            title = snippet.get("title", "")
            if not title or title.lower() in ("deleted video", "private video"):
                continue

            pub_raw = snippet.get("publishedAt", "")
            try:
                pub_dt = datetime.fromisoformat(pub_raw.replace("Z", "+00:00"))
                pub_str = pub_dt.strftime("%Y.%m.%d")
            except Exception:
                pub_str = ""

            items.append({
                "videoId":     vid,
                "title":       title,
                "description": snippet.get("description", ""),
                "publishedAt": pub_str,
                "publishedAtRaw": pub_raw
            })

        next_page = data.get("nextPageToken")
        if not next_page:
            break

    return items


# ─────────────────────────────────────────────────────────────
# 2. 기존 HTML에서 videoId 파싱 (중복 방지)
# ─────────────────────────────────────────────────────────────
def parse_existing_video_ids(html: str) -> list[str]:
    return re.findall(r'class="archive-entry[^"]*"\s+data-vid="([^"]+)"', html)


# ─────────────────────────────────────────────────────────────
# 3. 새 에피소드 HTML 블록 생성
# ─────────────────────────────────────────────────────────────
def build_episode_html(item: dict, ep_label: str) -> str:
    vid   = item["videoId"]
    title = item["title"]
    date  = item["publishedAt"]
    description = item.get("description", "")

    # YouTube 설명의 Guest 필드를 우선 사용하고, 없을 때만 제목을 보조 정보로 사용.
    guest = ep_label
    guest_match = re.search(r"(?im)^\s*Guest\s*\|\s*(.+?)\s*$", description)
    if guest_match:
        guest = guest_match.group(1).strip()
    elif " | " in title:
        candidate = title.split(" | ")[0].strip()
        if len(candidate) > 20:
            guest = candidate[:20] + "…"
        elif len(candidate) > 0:
            guest = candidate
    elif "EP." in title:
        guest = "Episode"

    return f"""
            <!-- {ep_label} (auto-synced) -->
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


# ─────────────────────────────────────────────────────────────
# 4. Latest Release 섹션을 최신 에피소드로 교체
# ─────────────────────────────────────────────────────────────
def update_latest_release(html: str, newest: dict) -> str:
    vid   = newest["videoId"]
    title = newest["title"]
    date  = newest["publishedAt"]

    new_block = f"""          <div class="archive-entry active" data-vid="{vid}">
            <a class="archive-item latest-featured-item" href="javascript:void(0)">
              <div class="archive-item-left">
                <div class="archive-item-text">
                  <div class="archive-item-title-row">
                    <span class="archive-item-title">{title}</span>
                    <span class="archive-item-date">{date}</span>
                  </div>
                </div>
              </div>
            </a>
            <div class="archive-embed open">
              <div class="custom-video-poster" data-vid="{vid}" style="opacity: 0; transition: opacity 0.8s ease;">
                <img class="poster-thumbnail" src="https://img.youtube.com/vi/{vid}/maxresdefault.jpg" alt="Video Cover">
                <div class="poster-play-btn">
                  <svg viewBox="0 0 24 24"><polygon points="8 5 19 12 8 19 8 5"/></svg>
                </div>
              </div>
            </div>
          </div>"""

    # We use a stack-based parser to find the matching closing tag for <div class="static-content">
    start_tag = '<div class="static-content">'
    idx = html.find(start_tag)
    if idx == -1:
        return html

    start_search = idx + len(start_tag)
    depth = 1
    pos = start_search
    while depth > 0 and pos < len(html):
        next_open = html.find('<div', pos)
        next_close = html.find('</div>', pos)

        if next_close == -1:
            break

        if next_open != -1 and next_open < next_close:
            depth += 1
            pos = next_open + 4
        else:
            depth -= 1
            pos = next_close + 6

    if depth == 0:
        before = html[:start_search]
        after = html[pos - 6:]
        return before + "\n" + new_block + "\n        " + after

    return html


# ─────────────────────────────────────────────────────────────
# 4.5 Starring 섹션을 에피소드 출연자로 자동 업데이트
# ─────────────────────────────────────────────────────────────
def update_starring_section(left_html: str, right_html: str) -> str:
    raw_guests = re.findall(r'<span class="archive-item-type">([^<]+)</span>', right_html)

    unique_guests = []
    seen = set()
    for g in raw_guests:
        g_clean = g.strip()
        g_lower = g_clean.lower()
        if not g_clean:
            continue
        if g_lower in {"teaser", "pilot", "episode", "bokos", "artic.", "deleted video"}:
            continue
        if re.match(r'^ep.\d+', g_lower):
            continue
        if g_clean not in seen:
            seen.add(g_clean)
            unique_guests.append(g_clean)

    if not unique_guests:
        return left_html

    starring_str = " &nbsp;•&nbsp; ".join(unique_guests)
    starring_pattern = r'(<div class="project-starring"[^>]*>\s*<span[^>]*>STARRING</span>\s*<p[^>]*>).*?(</p>\s*</div>)'
    updated = re.sub(starring_pattern, r'\1\n            ' + starring_str + r'\n          \2', left_html, count=1, flags=re.DOTALL)
    return updated


# ─────────────────────────────────────────────────────────────
# 5. 단일 프로젝트 처리
# ─────────────────────────────────────────────────────────────
def process_project(proj: dict) -> bool:
    """Returns True if HTML files were modified."""
    pid = proj["id"]

    # enabled 키가 명시적으로 False이면 스킵
    if not proj.get("enabled", True):
        print(f"[{pid}] SKIPPED (enabled=False)")
        return False

    # 플레이리스트 ID 결정: 환경변수 우선, fallback은 config 기본값
    playlist_id = os.environ.get(proj.get("playlist_id_env", ""), "") or proj.get("playlist_id", "")
    if not playlist_id:
        print(f"[{pid}] SKIPPED (playlist_id 없음 — {proj.get('playlist_id_env')} Secret을 설정하세요)")
        return False

    # Determine left and right column paths
    left_path = proj.get("left_path", proj.get("html_path", ""))
    right_path = proj.get("right_path", proj.get("html_path", ""))

    if not os.path.exists(left_path) or not os.path.exists(right_path):
        print(f"[{pid}] SKIPPED (파일이 존재하지 않음: {left_path} 또는 {right_path})")
        return False

    print(f"\n[{pid}] ▶ 플레이리스트 {playlist_id} 동기화 시작")

    items = fetch_playlist_items(playlist_id)
    if not items:
        print(f"[{pid}]   항목 없음 또는 API 오류 → 스킵")
        return False
    print(f"[{pid}]   API에서 {len(items)}개 항목 조회")

    # Read right content (Episode list)
    with open(right_path, "r", encoding="utf-8") as f:
        right_html = f.read()

    existing_ids = parse_existing_video_ids(right_html)
    print(f"[{pid}]   기존 videoId {len(existing_ids)}개: {existing_ids[:5]}{'...' if len(existing_ids) > 5 else ''}")

    new_items = [it for it in items if it["videoId"] not in existing_ids]
    print(f"[{pid}]   새 에피소드 {len(new_items)}개")

    right_modified = False

    if new_items:
        new_html_blocks = ""
        index_base = proj.get("index_base", 1)
        num_existing = len(set(existing_ids))
        for i, item in enumerate(new_items):
            ep_num = num_existing + i + index_base
            if index_base == 0:
                if ep_num == 0:
                    ep_label = "Teaser"
                else:
                    ep_label = f"EP.{ep_num}"
            else:
                if num_existing + i == 0:
                    ep_label = "Pilot"
                else:
                    ep_label = f"EP.{ep_num}"
            new_html_blocks += build_episode_html(item, ep_label)

        # archive-list 닫힘 태그 직전에 삽입
        # 패턴: 마지막 archive-entry 블록 닫힘 이후, archive-list 닫힘 직전
        # 만약 archive-list 닫힘 직전 패턴이 매칭되지 않으면 닫는 태그 직전 fallback
        insert_pattern = r'(</div>\s*\n\s*)([ \t]*</div>\s*\n\s*</div>\s*\n\s*</section>)'
        def inserter(m):
            return m.group(1) + new_html_blocks + "\n\n" + m.group(2)

        new_right_html = re.sub(insert_pattern, inserter, right_html, count=1, flags=re.DOTALL)
        if new_right_html == right_html:
            # Fallback if the outer wrapping element is slightly different in right.html
            insert_pattern_fallback = r'(</div>\s*\n\s*)([ \t]*</div>\s*\n\s*</section>)'
            new_right_html = re.sub(insert_pattern_fallback, inserter, right_html, count=1, flags=re.DOTALL)

        if new_right_html != right_html:
            right_html = new_right_html
            right_modified = True
            print(f"[{pid}]   {len(new_items)}개 에피소드 추가 완료")
        else:
            print(f"[{pid}]   WARNING: archive-list 삽입 위치를 찾지 못함 — HTML 구조 확인 필요")

    # Read left content (Latest Release & Starring)
    with open(left_path, "r", encoding="utf-8") as f:
        left_html = f.read()

    left_modified = False

    # Latest Release 업데이트 (업로드일 데이터가 가장 최근인 항목)
    if proj.get("has_latest_release") and items:
        newest = max(items, key=lambda x: x.get("publishedAtRaw", ""))
        new_left_html = update_latest_release(left_html, newest)
        if new_left_html != left_html:
            left_html = new_left_html
            left_modified = True
            print(f"[{pid}]   Latest Release → {newest['title'][:40]}")

    # Starring 리스트 최신화 (right_html을 바탕으로 left_html 업데이트)
    new_left_html = update_starring_section(left_html, right_html)
    if new_left_html != left_html:
        left_html = new_left_html
        left_modified = True
        print(f"[{pid}]   Starring List Updated")

    # Write changes
    if right_modified:
        with open(right_path, "w", encoding="utf-8") as f:
            f.write(right_html)
        print(f"[{pid}]   ✅ {right_path} 저장 완료")

    if left_modified:
        with open(left_path, "w", encoding="utf-8") as f:
            f.write(left_html)
        print(f"[{pid}]   ✅ {left_path} 저장 완료")

    return right_modified or left_modified


# ─────────────────────────────────────────────────────────────
# 6. 메인 — 모든 프로젝트 순회
# ─────────────────────────────────────────────────────────────
def main():
    if not YOUTUBE_API_KEY:
        print("ERROR: YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.")
        sys.exit(1)

    print("=" * 60)
    print("artic. YouTube Playlist Auto-Sync (Split Files)")
    print(f"대상 프로젝트: {len(PROJECTS)}개")
    print("=" * 60)

    changed_files = []

    for proj in PROJECTS:
        left_path = proj.get("left_path", proj.get("html_path", ""))
        right_path = proj.get("right_path", proj.get("html_path", ""))
        
        # Determine files changed
        if process_project(proj):
            changed_files.append(left_path)
            changed_files.append(right_path)

    print("\n" + "=" * 60)
    if changed_files:
        unique_changed = sorted(list(set(changed_files)))
        print(f"✅ 업데이트된 파일 ({len(unique_changed)}개):")
        for p in unique_changed:
            print(f"   - {p}")
        # GitHub Actions에서 참조할 output
        output_file = os.environ.get("GITHUB_OUTPUT", "")
        if output_file:
            with open(output_file, "a") as f:
                f.write("changed=true\n")
                f.write(f"changed_files={' '.join(unique_changed)}\n")
    else:
        print("변경 없음 — 모든 프로젝트가 최신 상태입니다.")
        output_file = os.environ.get("GITHUB_OUTPUT", "")
        if output_file:
            with open(output_file, "a") as f:
                f.write("changed=false\n")
    print("=" * 60)


if __name__ == "__main__":
    main()
