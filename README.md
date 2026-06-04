# ARTIC / Official Gallery & Webzine Website

이 리포지토리는 예술 갤러리 및 모던 에디토리얼 웹진 스타일의 초고화질 정적 웹사이트입니다.
중복과 하드코딩을 배제한 **디자인 템플릿 엔진 시스템**이 구축되어 있어, 구조적이고 깔끔한 소스 관리와 효율적인 데이터/용량 최적화를 제공합니다.

---

## 📂 폴더 구조 및 아키텍처 (Repository Directory Layout)

중복 마크업을 제거하고 재사용성을 최대화하도록 템플릿과 소스 콘텐츠 디렉토리가 완벽히 분리되어 있습니다.

```
Homepage/
├── index.html            # [빌드본] 메인 HTML (템플릿 컴파일 결과물)
├── src/                  # [원본 소스] 각 페이지별 고유 콘텐츠 조각 및 메타데이터
│   ├── index.html        # 메인 홈 화면 콘텐츠 소스
│   ├── about.html        # About 페이지 콘텐츠 소스
│   ├── contact.html      # Contact 페이지 콘텐츠 소스
│   ├── quarterly.html    # Quarterly 페이지 콘텐츠 소스
│   ├── projects.html     # Projects 페이지 콘텐츠 소스
│   └── projects/         # 개별 프로젝트 상세 페이지 콘텐츠 소스
│       ├── deus-ex-machina.html
│       ├── gagosian-party-music.html
│       ├── neutral-interview.html
│       ├── tasting-note.html
│       └── the-root.html
├── templates/            # [공통 디자인 템플릿] 일괄 레이아웃 및 조립용 조각들
│   ├── layouts/
│   │   ├── base.html             # 일반 페이지용 마스터 레이아웃 쉘 (HEADER, FOOTER 주입)
│   │   └── project-detail.html   # 프로젝트 상세 페이지용 마스터 레이아웃 쉘 (양열 그리드 구조)
│   ├── global/
│   │   ├── header.html           # 상단 내비게이션 바 및 다크모드/라이트모드 토글 버튼
│   │   ├── footer.html           # 표준 하단 저작권 텍스트
│   │   └── popup.html            # 전역 글래스모피즘 모달/팝업 레이아웃 컨테이너
│   └── components/
│       ├── base/
│       │   ├── project-card.html     # 프로젝트 연도별 그리드 카드 템플릿
│       │   ├── button.html           # 표준 글래스모피즘 호버 버튼 (Follow / YouTube 등)
│       │   └── button-link.html      # 하위 페이지 이동용 밑줄 드로잉/화살표 트랜지션 텍스트 링크 버튼
│       ├── forms/
│       │   ├── waitlist-form-embedded.html # 이메일 대기명단 구독 폼 (quarterly 등 임베드용)
│       │   └── checkout-form-popup.html    # LP/CD 주문용 체크아웃 폼 (deus-ex-machina 등 팝업용)
│       └── projects/
│           ├── player.html                 # 오디오 플레이어 핵심 마크업
│           ├── lyric-and-tracklist.html    # 스와이프 가능한 가사 및 트랙리스트 카러셀
│           ├── streaming-platforms.html    # 음원 사이트 외부 스트리밍 바로가기 카드 레이아웃
│           ├── video-archive.html          # 유튜브 비디오 아코디언 아카이브 래퍼
│           ├── featured-video.html         # 커스텀 썸네일 포스터 및 재생 트리거가 내장된 단일 비디오 레이아웃
│           ├── text-curation.html          # 한/영 대조 텍스트 큐레이션 블록
│           └── music-playlist.html         # VIP 파티 큐레이션 인라인 오디오 플레이 리스트
├── scripts/              # [자동화 및 빌드 스크립트]
│   ├── build_pages.js          # [핵심] src/ 소스들과 templates/ 디자인을 결합해 정적 사이트를 빌드하는 컴파일러
│   ├── create_all_templates.js # templates/ 폴더 내의 각 HTML 템플릿 요소들을 물리적으로 작성/생성해 주는 도구
│   ├── validate_templates.js   # 템플릿 파일들의 정합성과 필수 스키마 주석 유무를 검사하는 도구
│   ├── playlist_config.py      # 유튜브 자동 동기화 대상 프로젝트 설정
│   └── update_playlists.py     # 유튜브 API와 통신하여 최신 에피소드를 src/ 소스 파일에 동기화해 주는 스크립트
├── css/                  # [스타일시트 토큰]
│   ├── design-system.css # [중요] 디자인 시스템 토큰 (색상, 여백, 폰트 변수 및 자동 다크모드 제어)
│   └── animations.css    # cinematic 페이드인, 스크롤 리빌, 마우스오버 줌 트랜지션 등
├── js/                   # [클라이언트 스크립트]
│   └── shared.js         # 다크모드 상태 관리, 모바일 햄버거 토글, 아코디언/카러셀 모션 등 공통 로직
├── functions/            # [백엔드 API] Node.js 기반 Firebase Cloud Functions 코드베이스
├── projects.json         # 메인 프리뷰 렌더링용 단일 데이터 소스
├── server.js             # [로컬 스테이징] 로컬 디바이스용 HTTP 웹 서버 및 SQLite Proxy API 서버
└── orders.db             # 로컬 테스트용 SQLite 가상 주문 데이터베이스
```

---

## 🔄 개발, 테스트 및 배포 프로세스 (Operations & Deployment Process)

artic. 서비스는 정적 콘텐츠와 동적 백엔드 API가 결합한 하이브리드 아키텍처로 구동됩니다.

```mermaid
graph TD
    subgraph 💻 1. 개발 단계 (Development Phase)
        DevSrc[src/ & templates/ 파일 수정]
        DevBackend[functions/index.js 수정 - Node.js]
    end

    subgraph ⚙️ 2. 컴파일 및 빌드 (Compilation)
        NodeBuild[node scripts/build_pages.js 실행] --> FinalHTML[index.html 및 하위 index.html들 생성]
        FinalHTML -.-> StylesHead[스타일 태그를 헤드 영역으로 통합 최적화]
    end

    subgraph 🧪 3. 로컬 스테이징 검증 (Local Staging & Testing)
        NodeServ["로컬 웹/API 서버 가동 <br> server.js :8000"]
        AutoSwitch{"API 호스트 자동 분기 <br> window.location.hostname"}
        FirebaseEmul["Firebase Local Emulator Suite <br> Functions :5001 / Suite UI :4000"]
        LocalFirestore[("가상 Firestore DB <br> Emulator :8080")]
        SQLiteBackup[("SQLite 데이터 백업 <br> orders.db")]

        NodeServ -->|브라우저 로드| AutoSwitch
        AutoSwitch -->|Localhost 접속 시| FirebaseEmul
        AutoSwitch -.->|Firebase emulator 미기동 시 Fallback| SQLiteBackup
        FirebaseEmul -->|데이터 적재| LocalFirestore
    end

    subgraph 🚀 4. 프로덕션 배포 단계 (Production Deploy Phase)
        PushGit[Git Commit & Push] --> GHPages[GitHub Pages 정적 호스팅 <br> artic.live]
        DeployFB[Firebase CLI deploy] --> CloudFunctions[Firebase Cloud Functions API]
    end

    DevSrc --> NodeBuild
    NodeBuild --> NodeServ
    DevBackend --> FirebaseEmul

    FirebaseEmul -->|검증 완료된 Node.js 코드 배포| DeployFB
    NodeBuild -->|빌드된 정적 HTML 커밋 & 푸시| PushGit
```

### 1️⃣ 개발 단계 (Development Phase)
* **프론트엔드/디자인 수정**:
  * 중복 마크업을 직접 고치지 않고, `templates/` 의 마스터 레이아웃(`layouts/base.html`, `project-detail.html`) 이나 공통 템플릿들을 수정합니다.
  * 각 페이지의 본문 내용은 `src/` 폴더 아래의 파일(예: `src/about.html` 또는 `src/projects/deus-ex-machina.html`)에 Front Matter와 함께 최소한의 스타일/스크립트/마크업으로 기재합니다.
* **컴파일 및 빌드 실행**:
  * 소스 작성이 끝나면 프로젝트 루트에서 아래의 컴파일 스크립트를 기동합니다.
    ```bash
    node scripts/build_pages.js
    ```
  * 이 도구는 `templates/`에 기재된 글래스모피즘 모달, 헤더/푸터, 오디오 플레이어, Waitlist/Checkout 폼 등을 `src/` 본문과 결합하여 최종 HTML을 빌드하며, 각 컴포넌트의 스타일시트 선언부를 HTML의 `<head>` 영역으로 자동 추출/병합해 줍니다.
* **백엔드 API 로직 개발**:
  * 대기명단 가입 및 결제 주문 처리는 **`functions/index.js`** 파일에서 Node.js를 기반으로 구현 및 관리됩니다.

---

### 2️⃣ 로컬 스테이징 검증 단계 (Local Staging & Testing Phase)
실서버 배포 전, 로컬 환경에서 정적 라우팅 및 데이터 적재, 이메일 발송 기능을 완벽히 사전 검증합니다.

1. **로컬 스테이징 서버 기동**:
   * 프론트엔드 및 데이터 프록시를 구동하기 위해 아래 명령어를 실행하여 `http://localhost:8000` 주소로 로컬 서버를 실행합니다.
     ```bash
     node server.js
     ```
2. **Firebase 로컬 에뮬레이터 실행**:
   * 로컬에서 Cloud Functions 백엔드와 Firestore를 모의하기 위해 아래 명령어를 구동합니다 (JRE 설치 필요).
     ```bash
     npx firebase-tools emulators:start
     ```
   * 브라우저가 `localhost` 도메인에 있을 경우, 클라이언트 스크립트는 실서비스 백엔드가 아닌 로컬 가상 Functions 서버(`http://127.0.0.1:5001`)로 자동 스위칭됩니다.
3. **SMTP 모의 이메일 및 데이터 체크**:
   * 결제 폼 제출 시 Suite UI(`http://127.0.0.1:4000`) 대시보드에서 가상 적재 데이터와 이메일 발송 로그를 체크합니다.
   * Firebase 에뮬레이터를 켜지 않고 가볍게 UI/정적 빌드 검증을 진행할 때는, `server.js`가 로컬 SQLite 파일인 `orders.db`에 주문 데이터를 대체 보관(Fallback)하여 에러를 방지합니다.

---

### 3️⃣ 배포 단계 (Deployment Phase)
* **A. 프론트엔드 배포 (GitHub Pages)**:
  * 로컬에서 `node scripts/build_pages.js` 실행 후, 컴파일 결과물과 `src/` 소스를 원격 저장소에 커밋 및 푸시합니다.
    ```bash
    git add .
    git commit -m "feat: compile static changes and update about sections"
    git push origin main
    ```
  * GitHub Actions가 감지 후 `CNAME`에 등록된 커스텀 도메인 `artic.live`를 타겟으로 정적 사이트를 배포합니다.
* **B. 백엔드 Functions 배포**:
  * 수정된 비즈니스 로직은 Firebase CLI로 프로덕션 인프라에 배포합니다:
    ```bash
    npx firebase-tools deploy --only functions
    ```
* **C. 유튜브 플레이리스트 갱신 자동화 (GitHub Actions Workflow)**:
  * 매주 월요일 오전 9시(KST) 크론 트리거 또는 수동 작동을 통해 `.github/workflows/update-playlists.yml`가 실행됩니다.
  * 워크플로우가 자동으로 `scripts/update_playlists.py`를 실행해 유튜브 API로 최신 비디오들을 가져와 `src/projects/*.html` 소스를 갱신하고, 즉시 `node scripts/build_pages.js`를 기동하여 최종 HTML들을 다시 빌드한 뒤 원격지에 자동 커밋 및 푸시를 적용합니다.

---

## 🎨 디자인 템플릿 구성 및 사용법

### 1. 글로벌 레이아웃 및 쉘 (`templates/layouts/`)
* **`base.html`**:
  * **사용처**: `index.html` (메인 홈), `about`, `projects`, `contact`, `quarterly` 등 일반 정적 페이지.
  * **구성**: 공통 `<head>`, `<nav>` 네비게이션, 푸터, `shared.js` 스크립트를 내포하고 있으며, 각 페이지의 본문이 `{{CONTENT}}` 자리에 주입됩니다.
* **`project-detail.html`**:
  * **사용처**: `deus-ex-machina`, `tasting-note`, `the-root` 등 개별 프로젝트/앨범 소개 스마트링크 페이지.
  * **구성**: 대형 앨범 아트쇼케이스 커버 영역 및 좌우 2단 그리드 컬럼(`{{LEFT_COLUMN_CONTENT}}`, `{{RIGHT_COLUMN_CONTENT}}`) 레이아웃을 제공합니다.

### 2. 베이스 UI 컴포넌트 (`templates/components/base/`)
* **`button-link.html` [Arrow Text Link]**:
  * **마크업 사용**: `<a href="{url}" class="section-link {class}"><span>{text}</span><svg ...></a>`
  * **특징**: 호버 시 하단에 밑줄이 동적으로 그려지고 화살표 SVG 아이콘이 오른쪽으로 4px 쉬프트하는 모션이 내장되어 있습니다. 홈 화면이나 하위페이지 이동 시 템플릿 바인딩됩니다.
* **`button.html` [Glass Action Button]**:
  * **마크업 사용**: `<a href="{url}" class="about-action"> {svg} {text} </a>`
  * **특징**: 반투명 글래스 배경을 가지고 있으며, 호버 시 배경이 텍스트 색상으로 바뀌고 아이콘 크기가 1.1배 커지는 액션 버튼입니다. Waitlist 가입 버튼이나 Instagram, YouTube 등의 링크용으로 템플릿 바인딩됩니다.

### 3. 백엔드 연동 폼 컴포넌트 (`templates/components/forms/`)
* **`waitlist-form-embedded.html` [구독/대기 폼 - embedded 타입]**:
  * **사용처**: `quarterly/` 등 페이지 내부 임베드 섹션.
  * **데이터 매핑**: 로컬 SQLite `quarterly_subscribers` 테이블 및 실서버 Cloud Functions `/waitlist` API를 경유하여 Firestore `quarterly_subscribers` 컬렉션에 적재됩니다.
* **`checkout-form-popup.html` [주문 폼 - popup 타입]**:
  * **사용처**: `deus-ex-machina/` 등 LP/CD 구매 팝업 모달.
  * **데이터 매핑**: 로컬 SQLite `orders` 테이블 및 실서버 Cloud Functions `/checkout` API를 경유하여 Firestore `orders` 컬렉션에 적재됩니다.

### 4. 프로젝트 특화 컴포넌트 (`templates/components/projects/`)
* **`player.html`**: 중앙 오디오 플레이 위젯 및 프로그레스바 트랙.
* **`lyric-and-tracklist.html`**: 드래그 잠금식 트랙리스트 및 실시간 싱크 가사 카러셀 뷰포트.
* **`featured-video.html`**: 커스텀 비주얼 포스터와 재생용 중앙 버튼이 포함된 단일 추천 비디오 위젯.

---

## ✍️ 신규 프로젝트 추가 가이드 (단일 데이터 소스 템플릿화)

모든 프로젝트 목록 메타데이터는 **/projects.json** 단일 소스로 관리되며, 추가 절차는 다음과 같이 템플릿화되었습니다.

### Step 1. 프로젝트 콘텐츠 소스 작성
1. `src/projects/` 폴더 아래에 신규 프로젝트명으로 소스 파일(예: `src/projects/my-new-release.html`)을 작성합니다.
2. 상단에 Front Matter 설정(타이틀, 레이아웃 등)을 기재합니다:
   ```html
   ---
   layout: project-detail
   title: "My New Release"
   subtitle: "LP / Album"
   description: "Artist's new visual critique and tracks."
   cover_image: "album-art.png"
   ---
   <style>
     /* 프로젝트 고유의 스타일 정의 */
   </style>

   <div slot="left">
     {{STREAMING_PLATFORMS}}
     {{PLAYER}}
     {{LYRIC_AND_TRACKLIST}}
     <button id="order-open-btn" class="about-action">BUY ALBUM</button>
   </div>

   <div slot="right">
     {{VIDEO_ARCHIVE}}
     {{TEXT_CURATION}}
   </div>

   <div slot="popup">
     <div class="checkout-modal-header"><h2>주문하기</h2></div>
     {{CHECKOUT_FORM}}
     <button id="chk-submit" class="about-action" style="width:100%">입금 확인 요청</button>
   </div>

   <script>
     /* 플레이어 이벤트를 트리거하는 커스텀 스크립트 작성 */
   </script>
   ```

### Step 2. projects.json 메타데이터 추가
`/projects.json` 파일의 최상단에 새 프로젝트 메타데이터를 **prepend** 합니다 (최신작 순서 정렬):
```json
  {
    "id": "my-new-release",
    "title": "My New Release",
    "client": "artic.",
    "category": "LP",
    "year": 2026,
    "cover_image": "../my-new-release/album-art.png",
    "slug": "/my-new-release/"
  }
```

### Step 3. 빌드 및 테스트
1. 로컬에서 컴파일러를 돌려 페이지를 빌드합니다.
   ```bash
   node scripts/build_pages.js
   ```
2. `my-new-release/index.html` 파일이 템플릿 기반으로 정상적으로 컴파일되어 빌드되었는지 확인하고 로컬 스테이징(`server.js`)을 켜서 확인합니다.
3. 깃에 추가 후 푸시합니다.
   ```bash
   git add projects.json src/ my-new-release/
   git commit -m "feat: add my-new-release project via templates"
   git push origin main
   ```
