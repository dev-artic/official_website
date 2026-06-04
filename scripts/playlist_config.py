"""
playlist_config.py
==================
紐⑤뱺 ?꾨줈?앺듃??YouTube ?뚮젅?대━?ㅽ듃 ?ㅼ젙????怨녹뿉??愿由ы빀?덈떎.

???꾨줈?앺듃 異붽? 諛⑸쾿:
  PROJECTS 由ъ뒪?몄뿉 ?뺤뀛?덈━ ?섎굹 異붽? ???꾨즺.
  playlist_id_env 媛믪쑝濡?GitHub Secret ?대쫫??吏?뺥븯硫?  ?대떦 ?섍꼍蹂?섍? ?놁쓣 寃쎌슦 ?대떦 ?꾨줈?앺듃???ㅽ궢?⑸땲??
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
        "html_path":        "src/projects/the-root.html",
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
        "html_path":        "src/projects/tasting-note.html",
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
        "html_path":        "src/projects/neutral-interview.html",
        "playlist_id_env":  "NEUTRAL_INTERVIEW_PLAYLIST_ID",
        "playlist_id":      "PL5pgihOzM4-QUtVSXe1k5EilGNAWifH_c",
        "has_latest_release": True,
        "archive_section":  "archive-group",
        "index_base":       1,
    },

    # ─────────────────────────────────────────────────────────────
    # 향후 추가 예시 (비활성화: enabled: False로 스킵)
    # ─────────────────────────────────────────────────────────────
    # {
    #     "id":               "new-project",
    #     "html_path":        "new-project/index.html",
    #     "playlist_id_env":  "NEW_PROJECT_PLAYLIST_ID",
    #     "playlist_id":      "PLxxxxxxxxxxxxxxxxxxxxxxxx",
    #     "has_latest_release": True,
    #     "archive_section":  "archive-group",
    #     "enabled":          False,
    # },

]