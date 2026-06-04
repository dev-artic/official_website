"""
playlist_config.py
==================
모든 프로젝트 YouTube 플레이리스트 설정을 이곳에서 관리합니다.

프로젝트 추가 방법:
  PROJECTS 리스트에 딕셔너리 하나 추가 후 완료.
  playlist_id_env 값으로 GitHub Secret 이름을 지정하면,
  해당 환경변수가 없을 경우 해당 프로젝트를 스킵합니다.
"""

PROJECTS = [

    # ─────────────────────────────────────────────────────────────
    # Project : The Root  (Bokos x artic.)
    # ─────────────────────────────────────────────────────────────
    {
        "id":               "the-root",
        "left_path":        "src/projects/the-root/left.html",
        "right_path":       "src/projects/the-root/right.html",
        "playlist_id_env":  "THE_ROOT_PLAYLIST_ID",
        "playlist_id":      "PLz166z7qN-0yOh9VmQndP_dG4iHzLm9g1",
        "has_latest_release": True,
        "archive_section":  "archive-group",
        "index_base":       0,
    },

    # TASTING NOTE  (artic. 오리지널 시리즈)
    # ─────────────────────────────────────────────────────────────
    {
        "id":               "tasting-note",
        "left_path":        "src/projects/tasting-note/left.html",
        "right_path":       "src/projects/tasting-note/right.html",
        "playlist_id_env":  "TASTING_NOTE_PLAYLIST_ID",
        "playlist_id":      "PL5pgihOzM4-RbM38hhEY6JbQCex-BlOCj",
        "has_latest_release": True,
        "archive_section":  "archive-group",
        "index_base":       1,
    },

    # 중립적인인터뷰 (artic. x Bokos)
    # ─────────────────────────────────────────────────────────────
    {
        "id":               "neutral-interview",
        "left_path":        "src/projects/neutral-interview/left.html",
        "right_path":       "src/projects/neutral-interview/right.html",
        "playlist_id_env":  "NEUTRAL_INTERVIEW_PLAYLIST_ID",
        "playlist_id":      "PL5pgihOzM4-QUtVSXe1k5EilGNAWifH_c",
        "has_latest_release": True,
        "archive_section":  "archive-group",
        "index_base":       1,
    },

]
