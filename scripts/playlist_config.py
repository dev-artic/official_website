"""
playlist_config.py
==================
모든 프로젝트의 YouTube 플레이리스트 설정을 한 곳에서 관리합니다.

새 프로젝트 추가 방법:
  PROJECTS 리스트에 딕셔너리 하나 추가 → 완료.
  playlist_id_env 값으로 GitHub Secret 이름을 지정하면
  해당 환경변수가 없을 경우 해당 프로젝트는 스킵됩니다.
"""

PROJECTS = [

    # ─────────────────────────────────────────────────────────
    # Project : The Root  (Bokos x artic.)
    # 비정기 업로드, 주 1회 배치
    # ─────────────────────────────────────────────────────────
    {
        "id":               "the-root",
        "html_path":        "the-root/index.html",
        "playlist_id_env":  "THE_ROOT_PLAYLIST_ID",     # GitHub Secret 이름
        "playlist_id":      "PLz166z7qN-0yOh9VmQndP_dG4iHzLm9g1",  # fallback 기본값
        "has_latest_release": True,   # Latest Release 섹션을 최신 영상으로 자동 교체
        "archive_section":  "archive-group",             # 에피소드 accordion 그룹 CSS 클래스
    },

    # ─────────────────────────────────────────────────────────
    # TASTING NOTE  (artic. 오리지널 시리즈)
    # 플레이리스트 ID → THE_ROOT와 동일하게 GitHub Secret으로 관리
    # ─────────────────────────────────────────────────────────
    {
        "id":               "tasting-note",
        "html_path":        "tasting-note/index.html",
        "playlist_id_env":  "TASTING_NOTE_PLAYLIST_ID",  # GitHub Secret 이름
        "playlist_id":      "",                           # ← 여기에 플레이리스트 ID 입력
        "has_latest_release": True,
        "archive_section":  "archive-group",
    },

    # ─────────────────────────────────────────────────────────
    # 중립적인인터뷰  (artic. x Bokos)
    # ─────────────────────────────────────────────────────────
    {
        "id":               "neutral-interview",
        "html_path":        "neutral-interview/index.html",
        "playlist_id_env":  "NEUTRAL_INTERVIEW_PLAYLIST_ID",
        "playlist_id":      "",                           # ← 여기에 플레이리스트 ID 입력
        "has_latest_release": True,
        "archive_section":  "archive-group",
    },

    # ─────────────────────────────────────────────────────────
    # 향후 추가 예시 (비활성 상태 — enabled: False로 스킵)
    # ─────────────────────────────────────────────────────────
    # {
    #     "id":               "new-project",
    #     "html_path":        "new-project/index.html",
    #     "playlist_id_env":  "NEW_PROJECT_PLAYLIST_ID",
    #     "playlist_id":      "PLxxxxxxxxxxxxxxxxxxxxxxxx",
    #     "has_latest_release": True,
    #     "archive_section":  "archive-group",
    #     "enabled":          False,   # True로 변경하면 활성화
    # },

]
