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
if not YOUTUBE_API_KEY:
    print("ERROR: YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.")
    sys.exit(1)


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

    # 출연자 추출: "게스트 | 제목" 패턴이면 앞부분, 없으면 ep_label 사용
    guest = ep_label
    if " | " in title:
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

    guest = "최신 에피소드"
    if " | " in title:
        candidate = title.split(" | ")[0].strip()
        if len(candidate) > 20:
            guest = candidate[:20] + "…"
        elif len(candidate) > 0:
            guest = candidate

    new_block = f"""          <div class="archive-entry" data-vid="{vid}">
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
            <div class="archive-embed">
              <div class="custom-video-poster" data-vid="{vid}">
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
def update_starring_section(html: str) -> str:
    section_match = re.search(r'<section class="archive-section">(.*?)</section>', html, re.DOTALL)
    if not section_match:
        return html

    archive_section_html = section_match.group(1)
    raw_guests = re.findall(r'<span class="archive-item-type">([^<]+)</span>', archive_section_html)

    unique_guests = []
    seen = set()
    for g in raw_guests:
        g_clean = g.strip()
        g_lower = g_clean.lower()
        if not g_clean:
            continue
        if g_lower in {"teaser", "pilot", "episode", "bokos", "artic.", "deleted video"}:
            continue
        if re.match(r'^ep\.\d+', g_lower):
            continue
        if g_clean not in seen:
            seen.add(g_clean)
            unique_guests.append(g_clean)

    if not unique_guests:
        return html

    starring_str = " &nbsp;•&nbsp; ".join(unique_guests)
    starring_pattern = r'(<div class="project-starring"[^>]*>\s*<span[^>]*>STARRING</span>\s*<p[^>]*>).*?(</p>\s*</div>)'
    updated = re.sub(starring_pattern, r'\1\n            ' + starring_str + r'\n          \2', html, count=1, flags=re.DOTALL)
    return updated


# ─────────────────────────────────────────────────────────────
# 5. 단일 프로젝트 처리
# ─────────────────────────────────────────────────────────────
def process_project(proj: dict) -> bool:
    """Returns True if HTML was modified."""
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

    html_path = proj["html_path"]
    if not os.path.exists(html_path):
        print(f"[{pid}] SKIPPED ({html_path} 파일 없음)")
        return False

    print(f"\n[{pid}] ▶ 플레이리스트 {playlist_id} 동기화 시작")

    items = fetch_playlist_items(playlist_id)
    if not items:
        print(f"[{pid}]   항목 없음 또는 API 오류 → 스킵")
        return False
    print(f"[{pid}]   API에서 {len(items)}개 항목 조회")

    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()

    existing_ids = parse_existing_video_ids(html)
    print(f"[{pid}]   HTML의 기존 videoId {len(existing_ids)}개: {existing_ids[:5]}{'...' if len(existing_ids) > 5 else ''}")

    new_items = [it for it in items if it["videoId"] not in existing_ids]
    print(f"[{pid}]   새 에피소드 {len(new_items)}개")

    modified = False

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
        insert_pattern = r'(</div>\s*\n\s*)([ \t]*</div>\s*\n\s*</div>\s*\n\s*</section>)'
        def inserter(m):
            return m.group(1) + new_html_blocks + "\n\n" + m.group(2)

        new_html = re.sub(insert_pattern, inserter, html, count=1, flags=re.DOTALL)
        if new_html != html:
            html = new_html
            modified = True
            print(f"[{pid}]   {len(new_items)}개 에피소드 추가 완료")
        else:
            print(f"[{pid}]   WARNING: archive-list 삽입 위치를 찾지 못함 — HTML 구조 확인 필요")

    # Latest Release 업데이트 (업로드일 데이터가 가장 최근인 항목)
    if proj.get("has_latest_release") and items:
        newest = max(items, key=lambda x: x.get("publishedAtRaw", ""))
        new_html = update_latest_release(html, newest)
        if new_html != html:
            html     = new_html
            modified = True
            print(f"[{pid}]   Latest Release → {newest['title'][:40]}")

    # Starring 리스트 최신화
    new_html = update_starring_section(html)
    if new_html != html:
        html     = new_html
        modified = True
        print(f"[{pid}]   Starring List Updated")

    if modified:
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"[{pid}]   ✅ {html_path} 저장 완료")
    else:
        print(f"[{pid}]   변경 없음 (이미 최신)")

    return modified


# ─────────────────────────────────────────────────────────────
# 6. 메인 — 모든 프로젝트 순회
# ─────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("artic. YouTube Playlist Auto-Sync")
    print(f"대상 프로젝트: {len(PROJECTS)}개")
    print("=" * 60)

    changed_projects = []

    for proj in PROJECTS:
        if process_project(proj):
            changed_projects.append(proj["html_path"])

    print("\n" + "=" * 60)
    if changed_projects:
        print(f"✅ 업데이트된 파일 ({len(changed_projects)}개):")
        for p in changed_projects:
            print(f"   - {p}")
        # GitHub Actions에서 참조할 output
        output_file = os.environ.get("GITHUB_OUTPUT", "")
        if output_file:
            with open(output_file, "a") as f:
                f.write("changed=true\n")
                f.write(f"changed_files={' '.join(changed_projects)}\n")
    else:
        print("변경 없음 — 모든 프로젝트가 최신 상태입니다.")
        output_file = os.environ.get("GITHUB_OUTPUT", "")
        if output_file:
            with open(output_file, "a") as f:
                f.write("changed=false\n")
    print("=" * 60)


if __name__ == "__main__":
    main()
