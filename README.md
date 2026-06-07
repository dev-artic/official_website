<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="images/logo-white.png">
    <source media="(prefers-color-scheme: light)" srcset="images/logo-black.png">
    <img alt="artic." src="images/logo-black.png" width="220">
  </picture>
</p>

<p align="center">
  <strong>Art, Culture, and Archive.</strong><br>
  아티스트의 raw하고 순수한 최초의 메시지를 조명하는 프리미엄 에디토리얼 웹진 & 아카이빙 플랫폼.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Architecture-Modular%20Templates-black?style=flat" alt="Arch">
  <img src="https://img.shields.io/badge/Local%20Staging-Node%20server.js-lightgrey?style=flat" alt="Staging">
  <img src="https://img.shields.io/badge/Database-Firestore%20%26%20Notion-blue?style=flat" alt="DB">
  <img src="https://img.shields.io/badge/Backend-Cloud%20Functions%20Node.js%2022-orange?style=flat" alt="Backend">
</p>

---

## 🏛️ 아키텍처 및 디자인 템플릿 아카이빙 (Modular Repository Layout)

artic. 서비스는 중복 마크업을 제거하고 디자인의 일관성을 완벽히 통제할 수 있도록 **컴파일 엔진 기반 디자인 템플릿 구조**로 설계되었습니다.

```
Homepage/
├── index.html            # [빌드본] 메인 홈 화면 (컴파일 결과물)
├── src/                  # [원본 소스] 각 페이지별 고유 콘텐츠 조각 및 메타데이터
│   ├── index.html        # 메인 홈 화면 본문 소스
│   ├── about.html        # About 페이지 본문 소스
│   ├── contact.html      # Contact 페이지 본문 소스
│   ├── quarterly.html    # Quarterly 페이지 본문 소스
│   ├── projects.html     # Projects 페이지 본문 소스
│   └── projects/         # [물리적 슬라이싱 구조] 개별 프로젝트 상세 페이지 콘텐츠 프래그먼트
│       ├── deus-ex-machina/
│       ├── gagosian-party-music/
│       ├── neutral-interview/
│       ├── tasting-note/
│       └── the-root/
│           ├── meta.json     # 프로젝트 메타데이터 (제목, 아티스트, 커버 아트 경로 등)
│           ├── left.html     # 왼쪽 열 레이아웃 (플레이어 위젯, 스트리밍 바로가기 등)
│           ├── right.html    # 오른쪽 열 레이아웃 (유튜브 아코디언 아카이브 등)
│           ├── styles.css    # 프로젝트별 고유 CSS 스타일 재정의
│           ├── scripts.js    # 프로젝트별 개별 클라이언트 JS 제어 스크립트
│           └── popup.html    # [선택] 프로젝트별 고유 구매 모달 팝업 바디
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
├── functions/            # [백엔드 API] Node.js 22 기반 Firebase Cloud Functions 코드베이스
│   ├── index.js                # checkout/waitlist/products/admin/quarterlyContents/quarterlyAdmin API 및 Firestore trigger
│   ├── order_inventory.js      # 주문 배송 상태별 재고 차감/복구 판단 로직
│   ├── quarterly_notion.js     # Notion `분기별 결산` data source adapter
│   ├── quarterly_admin.js      # Quarterly admin 진단/수정 API 및 Firestore media override 병합
│   └── templates/              # 결제/구독 메일 HTML 템플릿
├── projects.json         # 메인 프리뷰 렌더링용 단일 데이터 소스
└── server.js             # [로컬 스테이징] 정적 파일 서버 및 Firebase Emulator API 프록시
```

---

## ⚡ 개발, 컴파일 및 로컬 스테이징 워크플로우 (Development Operations)

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

        NodeServ -->|브라우저 로드| AutoSwitch
        AutoSwitch -->|Localhost 접속 시| FirebaseEmul
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
* **템플릿 중심 개발**:
  * 상단 네비게이션, 푸터, 레이아웃 등 여러 페이지에 중복되는 구조는 `templates/layouts/` 마스터 쉘이나 `templates/global/` 파츠에서 일괄 관리합니다.
  * 각 페이지의 본문 내용은 `src/` 폴더 아래의 파일(예: `src/about.html` 또는 `src/projects/deus-ex-machina.html`)에 Front Matter와 함께 최소한의 스타일/스크립트/마크업으로 기재합니다.
* **정적 컴파일러 실행**:
  * 소스 작성이 완료되면 아래 명령어로 페이지 빌드를 가동합니다.
    ```bash
    npm run build
    # 또는: node scripts/build_pages.js
    ```
  * 이 스크립트는 `templates/`에 구성된 디자인 요소들을 `src/` 본문과 결합하여 최종 HTML을 빌드하고, 각 컴포넌트의 스타일시트 선언부를 HTML의 `<head>` 영역으로 자동 통합하는 렌더링 최적화를 수행합니다.
* **백엔드 API 로직 개발**:
  * 대기명단 가입, 결제 주문, 상품 조회, Quarterly Notion 아카이브 조회는 **`functions/index.js`** 파일에서 Node.js 22 기반 Firebase Functions로 설계 및 작성됩니다.
  * 주문 상태별 재고 변경 규칙은 **`functions/order_inventory.js`** 에 분리되어 있으며, `npm run test:inventory`로 회귀 테스트합니다.
  * Quarterly 아카이브는 **`functions/quarterly_notion.js`** 에서 Notion `분기별 결산` data source를 read-only로 조회하고, 공개 가능한 row만 7-tier webzine JSON으로 정규화합니다. Notion database view를 직접 호출하지 않고 data source query를 사용하므로, 웹 노출 조건은 Notion view 필터가 아니라 adapter의 publish gate가 기준입니다.

---

### 2️⃣ 로컬 스테이징 검증 단계 (Local Staging & Testing Phase)
실서버 배포 전, 로컬 환경에서 정적 라우팅 및 데이터 적재, 이메일 발송 기능을 완벽히 사전 검증합니다.

1. **통합 로컬 개발 서버 구동**:
   * 백엔드 에뮬레이터와 프론트엔드 정적 프록시 서버를 동시에 실행합니다 (Java JRE 설치 필요).
     ```bash
     npm run dev
     ```
   * 이 명령어는 `concurrently`를 통해 아래의 두 프로세스를 한 번에 가동합니다:
     * **Firebase Emulator**: `localhost:5001` (Functions), `localhost:8080` (Firestore), `localhost:4000` (Emulator UI)
     * **Node Proxy Server**: `localhost:8000` (정적 파일 서빙 및 API 프록시)
2. **에뮬레이터 연동 확인**:
   * 브라우저에서 `http://localhost:8000`에 접속하여 프론트엔드 기능을 이용하면, 모든 API 요청이 로컬 에뮬레이터 백엔드로 자동 라우팅(Proxy)되어 100% 동일한 비즈니스 로직으로 실행됩니다.
   * UAT가 필요한 경우 `?artic_uat=production`을 붙여 localhost에서도 production Cloud Functions를 명시적으로 사용할 수 있습니다. 이 모드는 실제 Firestore/SMTP에 영향을 줄 수 있으므로 승인된 QA에서만 사용합니다.
   * 로컬 에뮬레이터로 되돌릴 때는 `?artic_uat=local`을 사용하거나 `localStorage`의 `artic-api-env` 값을 제거합니다.
3. **가상 적재 데이터 및 이메일 확인**:
   * 폼 입력 제출 시 에뮬레이터 UI(`http://localhost:4000/firestore`)에서 실시간으로 저장된 가상 데이터를 조회할 수 있습니다.
   * 가입/결제 완료 시 발송되는 이메일 HTML 파일은 루트 디렉토리의 `scratch/` 폴더에 `last-customer-waitlist.html` 등의 미리보기 파일로 자동 생성되므로 브라우저에서 디자인을 검토할 수 있습니다.
4. **필수 검증 명령**:
   ```bash
   npm run build
   node scripts/validate_templates.js
   node --check server.js
   node --check functions/index.js
   node --check functions/order_inventory.js
   node --check scripts/test_order_inventory_transitions.js
   npm run test:inventory
   ```

---

### 🛡️ 로컬 및 실서버의 완전 격리 구조 (Environment Isolation)

서비스의 안전한 유지보수 및 실서버 가동성(Availability) 보장을 위해 두 환경은 물리적으로 철저히 분리되어 있습니다:

*   **로컬 개발 환경 (Local Staging)**:
    *   **접속 도메인**: 웹사이트 `http://localhost:8000` | 어드민 `http://localhost:8000/admin` | 에뮬레이터 UI `http://localhost:4000`
    *   **데이터베이스**: PC 로컬 메모리상에서만 상주하는 **가상 Firestore DB** (`localhost:8080`)
    *   **안전성**: 로컬 어드민과 폼 테스트 과정에서 데이터를 등록, 변경, 삭제하더라도 실제 인터넷 실서버 DB에는 전혀 영향이 없습니다.
    *   **메일**: 메일 서버를 실제로 거치지 않고, 루트의 `scratch/` 폴더 내에 HTML Preview 파일을 생성하여 검증합니다.
*   **실서버 운영 환경 (Production)**:
    *   **접속 도메인**: 웹사이트 `https://artic.live` | 어드민 `https://artic.live/admin`
    *   **데이터베이스**: 구글 클라우드에 구성된 **실제 운영 Firestore DB** (Firebase Console을 통해 접근)
    *   **특징**: 실제 사용자들의 가입 및 주문 정보가 적재되며, 결제 및 대기자 신청 완료 시 지정된 메일 발송 서버(SMTP)를 거쳐 메일 발신이 이루어집니다.
    *   **런타임**: Firebase Cloud Functions는 Node.js 22 런타임으로 배포됩니다.
    *   **Admin Secret**: 운영 admin bearer token은 Firebase Secret Manager의 `ADMIN_TOKEN`으로 관리합니다. 로컬 보관용 token은 `functions/.env.local`에 둘 수 있으며, 이 파일은 Git에 커밋하지 않습니다.
    *   **Notion Secret**: Quarterly 아카이브 조회용 Notion integration token은 Firebase Secret Manager의 `NOTION_API_KEY`로 관리합니다. `분기별 결산` database는 해당 integration에 공유되어 있어야 하며, data source ID는 `NOTION_QUARTERLY_DATA_SOURCE_ID`로 override할 수 있습니다.
*   **환경 변수 및 라우팅 자동화**:
    *   클라이언트 단의 공통 스크립트(`js/shared.js` 등)가 브라우저의 현재 호스트명(`window.location.hostname`)을 감지합니다.
    *   호스트가 `localhost` 또는 `127.0.0.1`일 때는 로컬 백엔드 주소(`http://localhost:8000/api`)로 통신하고, `artic.live` 도메인일 때는 실제 클라우드 백엔드 주소로 API 호출 경로가 자동 전환되므로 빌드 시 별도로 소스코드를 수정할 필요가 없습니다.
    *   `?artic_uat=production` / `?artic_uat=local` 쿼리로 QA 중 API 라우팅을 명시적으로 전환할 수 있습니다.

---

### 3️⃣ 배포 단계 (Deployment Phase)
* **0. README 동기화 게이트 (절대 규칙)**:
  * production 배포 전에는 반드시 `README.md`를 처음부터 끝까지 읽고, 이번 변경으로 달라진 아키텍처/환경변수/명령어/QA 플로우/운영 제약이 있으면 함께 수정합니다.
  * README 수정이 필요한 경우 배포 코드와 같은 커밋 또는 같은 배포 단위로 커밋/푸시합니다.
  * README 수정이 필요 없다고 판단한 경우에도 “전체 README 검토 완료, 변경 없음”을 배포 보고에 명시합니다.
* **A. 프론트엔드 배포 (GitHub Pages)**:
  * 로컬에서 컴파일러(`npm run build`) 실행 후, 결과물과 `src/` 소스를 원격 저장소에 커밋 및 푸시합니다.
    ```bash
    git add .
    git commit -m "feat: compile static changes and update about sections"
    git push origin main
    ```
  * GitHub Actions가 감지 후 `CNAME`에 등록된 커스텀 도메인 `artic.live`를 타겟으로 정적 사이트를 배포합니다.
* **B. 백엔드 Functions 배포**:
  * 에뮬레이터에서 완벽히 검증된 백엔드 비즈니스 로직을 Firebase CLI로 프로덕션 인프라에 업데이트합니다.
    ```bash
    # 전체 함수 배포
    npx firebase-tools deploy --only functions
    
    # 또는 특정 함수만 빠르게 배포 (예: waitlist)
    npx firebase-tools deploy --only functions:waitlist
    ```
  * admin 함수는 Secret Manager의 `ADMIN_TOKEN`에 의존하므로, token을 회전한 뒤에는 아래 순서로 반영합니다.
    ```bash
    # 값은 출력하지 않고 stdin으로 입력
    printf "%s" "$ADMIN_TOKEN" | npx firebase-tools functions:secrets:set ADMIN_TOKEN --project artic-official-home
    npx firebase-tools deploy --only functions:admin --project artic-official-home
    ```
  * quarterlyContents/quarterlyAdmin 함수는 Secret Manager의 `NOTION_API_KEY`에 의존합니다. Notion integration token을 회전하거나 처음 연결할 때는 아래 순서로 반영합니다.
    ```bash
    # 값은 출력하지 않고 stdin으로 입력
    printf "%s" "$NOTION_API_KEY" | npx firebase-tools functions:secrets:set NOTION_API_KEY --project artic-official-home
    npx firebase-tools deploy --only functions:quarterlyContents,functions:quarterlyAdmin --project artic-official-home
    ```
  * 배포 후 다음 smoke를 확인합니다.
    ```bash
    npx firebase-tools functions:list --project artic-official-home
    curl -sS https://products-4n2xy6gsxa-uc.a.run.app
    curl -sS https://quarterlycontents-4n2xy6gsxa-uc.a.run.app
    ```
* **C. 유튜브 플레이리스트 갱신 자동화 (GitHub Actions Workflow)**:
  * 매주 월요일 오전 9시(KST) 크론 트리거 또는 수동 작동을 통해 `.github/workflows/update-playlists.yml`가 실행됩니다.
  * 워크플로우가 자동으로 `scripts/update_playlists.py`를 실행해 유튜브 API로 최신 비디오들을 가져와 `src/projects/[slug]/left.html` 및 `right.html` 소스를 갱신하고, 즉시 `npm run build`를 기동하여 최종 HTML들을 다시 빌드한 뒤 원격지에 자동 커밋 및 푸시를 적용합니다.

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
  * **데이터 매핑**: 로컬 Firebase Emulator 또는 실서버 Cloud Functions `/waitlist` API를 경유하여 Firestore `subscribers` 컬렉션에 적재됩니다.
* **`checkout-form-popup.html` [주문 폼 - popup 타입]**:
  * **사용처**: `deus-ex-machina/` 등 LP/CD 구매 팝업 모달.
  * **데이터 매핑**: 로컬 Firebase Emulator 또는 실서버 Cloud Functions `/checkout` API를 경유하여 Firestore `orders` 컬렉션에 적재됩니다.
  * **재고 규칙**: 주문 생성과 `paid` 상태에서는 재고를 유지하고, `shipped` 진입 시 차감, `delivered`에서는 유지, `paid/pending`으로 되돌릴 때 복구합니다.

### 4. Quarterly Webzine 컴포넌트 (`templates/components/quarterly/`)
  * **`content-archive.html` [Notion-driven archive feed]**:
  * **사용처**: `quarterly/` waitlist hero 아래 archive 섹션.
  * **데이터 매핑**: 로컬에서는 `/api/quarterly-contents`가 `server.js` 안에서 `functions/quarterly_notion.js` adapter를 직접 호출하고, 운영에서는 `https://quarterlycontents-4n2xy6gsxa-uc.a.run.app`을 호출합니다.
  * **로컬 live Notion 필수**: `functions/.env.local` 또는 `functions/.env`에 `NOTION_API_KEY`/`NOTION_TOKEN`이 없으면 로컬 `/api/quarterly-contents`는 실패합니다. snapshot fallback은 사용하지 않습니다. Notion에서 아티스트명/앨범명 오타를 고친 뒤 로컬에 즉시 반영되는지 확인하려면 응답 헤더 `X-artic-Data-Source: local-notion-live`를 확인합니다.
  * **Notion 기준**: `분기별 결산` data source에서 `업로드 확정 = true`, `Publication Status = 완료`, `Source Format != Template Draft`인 row만 공개 archive로 변환합니다.
  * **Notion query 방식**: 현재 웹/API는 특정 Notion view URL을 읽지 않고 `collection://7ae145b9-b8bb-4a0c-94c0-b804ab1c9357` data source를 직접 query합니다. 반환 JSON에는 `sourceName`, `sourceId`, `queryMode: data_source_direct`, `view: null`, `publishFilter`가 포함됩니다.
  * **반영 속도**: 로컬과 운영 모두 stale data를 줄이기 위해 live Notion을 직접 조회합니다. 운영 `quarterlyContents` 응답은 `Cache-Control: no-store`로 반환합니다. Notion API 자체/브라우저 hard refresh 지연을 제외하면 새 요청마다 live Notion을 다시 조회합니다.
  * **ACHA 파싱 규칙**: issue 본문에서 `TIER n - 라벨`, `티어 n`, 숫자+라벨, 라벨 단독 heading을 tier heading으로 인식하고, heading 아래 Notion table을 앨범 목록으로 정규화합니다. 빈 tier heading도 JSON에 유지되므로 상세 페이지에서 0개 앨범 tier가 누락되지 않습니다.
  * **Featured article 연결**: companion/featured article은 issue 본문의 child page와 table `Companion Essay` 셀의 Notion page mention을 모두 수집합니다. table mention에는 album/artist/tier 힌트를 함께 저장해 article 제목이 앨범명과 다르더라도 올바른 앨범 카드에 매칭되도록 합니다. child article 본문이 Notion table 편집본이면 `문체 수정 버전` 컬럼을 공개 본문으로 읽습니다.
  * **Media enrichment**: Notion `분기별 결산` 원문은 album/artist image URL을 필수 필드로 갖지 않습니다. 웹 API는 `functions/data/quarterly_media_cache.json`의 verified media cache를 명시적으로 적용하고, 응답의 `mediaEnrichment`에 source, updatedAt, 적용 개수를 남깁니다. Album cover는 `verified: true`인 cache record만 렌더링하며, Bugs 이미지 URL은 album/artist 모두 `/images/1000/` 고화질 경로로 정규화합니다. 운영에서는 Firestore `quarterly_media_overrides` 컬렉션의 admin 수정값을 static cache보다 우선 적용합니다.
  * **Quarterly admin**: `/admin`의 Quarterly 탭은 `quarterlyAdmin` function을 호출해 live Notion 파싱 결과, tier/album/article diagnostics, cover health, Now artic. 분기 매칭 상태를 확인합니다. 수정은 admin bearer token 인증 후에만 가능하며, featured article 본문은 Notion child page에 paragraph blocks로 저장하고, album cover override는 Firestore `quarterly_media_overrides`에 저장합니다. Bugs 후보 검색은 preview만 반환하며, 사용자가 `Save Override`를 눌러야 Firestore에 기록됩니다. Notion 쓰기는 dashboard가 읽은 `last_edited_time`과 저장 직전 Notion page 상태를 비교해 중간 변경이 있으면 `409`로 거부하고, 빈 article 본문 저장은 기본 차단합니다. Cover resolution 기준은 출처가 아니라 픽셀 크기이며, URL path에서 `1000x1000`, `1200x1200`, Bugs `/images/1000/` 같은 요청 해상도를 읽어 최단 변이 `1000px` 미만일 때만 low-res로 분류합니다. Apple Music 등 외부 고해상도 이미지는 low-res가 아니라 review 대상으로 표시하고, 운영자가 Firestore `quarterly_media_review_overrides`에 resolved 상태를 마킹할 수 있습니다.
  * **분기 정렬 기준**: Archive 노출 순서는 `Year + Quarter`를 1차 기준으로 최신순 정렬하고, 같은 분기 안에서만 `Published At`을 보조 기준으로 사용합니다.
  * **렌더링 모델**: 첫 화면은 기존 waitlist 영역을 유지하고, 스크롤 아래에서 분기별 issue shelf를 최신순으로 렌더링합니다. 각 분기 shelf 안에는 ACHA와 Now artic. 모듈이 함께 배치됩니다.
  * **확장 정보구조**: Gagosian Quarterly의 섹션형 hub 구조를 참고해 `Issues`, `Essays`, `Interviews`, `Videos`, `Studio Visits` 같은 section taxonomy를 수용할 수 있게 두었습니다. 현재 artic. 고유 구조의 중심은 7-tier album framework입니다.
  * **ACHA naming**: 분기별 앨범 결산 콘텐츠는 웹에서는 `ACHA`(Album Critic Highlight Archive)로 표기합니다. Archive row는 `/quarterly/acha/?issue=<slug>` detail shell로 연결되며, 이 상세 페이지는 전체 티어/앨범 리스트, 한줄평, 추천곡, 에디터 노트, companion essay, Bugs 커버 출처를 함께 렌더링합니다.
  * **커버 identity resolver**: live Notion 응답을 `scratch/quarterly_live_contents.json`로 저장한 뒤, Bugs/Apple Music provider album identity를 검증해 누락 cover만 보강합니다. 자동 검색이 불확실한 항목은 임의 fallback을 넣지 않고 cache에 실패 사유를 남깁니다. provider ID가 확인된 예외 표기는 `scripts/resolve_quarterly_album_art.js`의 manual ID map에 명시합니다.
    ```bash
    node scripts/crawl_bugs_album_art.js --archive=scratch/quarterly_live_contents.json --cache=scratch/bugs_album_art_cache.json --artistCache=scratch/bugs_artist_image_cache.json --missingOnly=true --artists=true
    node scripts/resolve_quarterly_album_art.js --archive=scratch/quarterly_live_contents.json --cache=functions/data/quarterly_media_cache.json --missingOnly=true
    ```
    수집 후 `scratch/bugs_album_art_cache.json`과 `scratch/bugs_artist_image_cache.json`을 `functions/data/quarterly_media_cache.json` 형태로 병합하고, 배포 전에는 아래 검증 gate를 통과해야 합니다.
    ```bash
    node scripts/verify_quarterly_media_cache.js --archive=scratch/quarterly_live_contents.json --cache=functions/data/quarterly_media_cache.json --write=true
    ```
  * **Now artic. 수집**: `instagram.com/artic.live` 공개 reels 목록은 캡션을 노출하지 않으므로, `node scripts/crawl_instagram_now_artic.js`는 각 reel 상세 페이지의 meta description을 열어 `실시간`, `오늘자`, `어제자` 캡션 후보를 읽습니다. Instagram이 headless/public session에 로그인 게이트를 걸면 링크 수집 결과가 0개일 수 있으므로, 안정 운영 전에는 Notion 수동 입력 또는 로그인된 승인 세션 기반 수집을 병행 검토합니다.
    ```bash
    NOW_ARTIC_REEL_URLS="https://www.instagram.com/artic.live/reel/..." node scripts/crawl_instagram_now_artic.js
    ```
    ```bash
    node scripts/crawl_instagram_now_artic.js
    ```

### 5. 프로젝트 특화 컴포넌트 (`templates/components/projects/`)
* **`player.html`**: 중앙 오디오 플레이 위젯 및 프로그레스바 트랙.
* **`lyric-and-tracklist.html`**: 드래그 잠금식 트랙리스트 및 실시간 싱크 가사 카러셀 뷰포트.
* **`featured-video.html`**: 커스텀 비주얼 포스터와 재생용 중앙 버튼이 포함된 단일 추천 비디오 위젯.

---

## ✍️ 신규 프로젝트 추가 가이드 (물리 분할 프래그먼트 및 데이터 템플릿화)

모든 프로젝트 목록 메타데이터는 **/projects.json** 단일 소스로 관리되며, 추가 절차는 다음과 같이 템플릿화되었습니다.

### Step 1. 프로젝트 콘텐츠 소스 작성 (프래그먼트 분할형)
1. `src/projects/` 폴더 아래에 신규 프로젝트명으로 폴더(예: `src/projects/my-new-release/`)를 생성합니다.
2. 폴더 내부에 다음 파일들을 작성합니다:

#### 1) **meta.json** (메타데이터 설정)
`path_depth`와 제목, 아티스트, 커버 아트, 장르 등을 정의합니다.
```json
{
  "path_depth": "../",
  "title": "My New Release",
  "artist": "Artist Name",
  "meta": "LP \u00b7 2026",
  "cover_image": "album-art.png"
}
```

#### 2) **left.html** (왼쪽 컬럼 내용)
```html
<main class="links-container expanded">
  <div class="mobile-toggle-header">
    <span class="archive-group-label stream-label">Latest Release</span>
    <span class="toggle-icon"></span>
  </div>
  <div class="toggle-content">
    <div class="static-content">
      <!-- 최신 영상 자동 업데이트 영역 -->
    </div>
    
    <div class="project-brief" style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 16px;">
      <p class="brief-desc-ko">앨범 소개 내용이 이곳에 들어갑니다.</p>
    </div>
  </div>
</main>
```

#### 3) **right.html** (오른쪽 컬럼 내용 - 유튜브 아카이브 등)
```html
<section class="archive-section">
  <div class="archive-group expanded">
    <div class="mobile-toggle-header">
      <span class="archive-group-label film-label">episodes</span>
      <span class="toggle-icon"></span>
    </div>
    <div class="archive-list toggle-content">
      <!-- 에피소드 아카이브 엔트리가 쌓일 곳 -->
    </div>
  </div>
</section>
```

#### 4) **styles.css** 및 **scripts.js** (프로젝트 고유의 스타일 및 클라이언트 스크립트)
* 필요 시 커스텀 스타일이나 오디오/비디오 제어 이벤트를 작성합니다. 없더라도 빈 파일로 생성해 둡니다.

---

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

---

### Step 3. 빌드 및 테스트
1. 로컬에서 컴파일러를 돌려 페이지를 빌드합니다.
   ```bash
   node scripts/build_pages.js
   ```
2. `my-new-release/index.html` 파일이 프래그먼트 조각들과 `project-detail.html` 레이아웃 마스터를 조합하여 정상적으로 컴파일되었는지 검증하고 로컬 스테이징(`server.js`) 서버를 켜서 확인합니다.
3. 깃에 추가 후 푸시합니다.
   ```bash
   git add projects.json src/projects/my-new-release/ my-new-release/
   git commit -m "feat: add my-new-release project via split fragments"
   git push origin main
   ```

---

## 📋 다음 실행할 작업 (To-Do List)

- [x] admin 페이지 백단 연동 및 프론트 정보노출 + 메일 템플릿에 사용되는 정보 호출 연결 여부 확인 (Orders/Subscribers 삭제 API 및 어드민 연동 완료)
- [x] 팝업 정보 로드 오류 재점검 및 모바일 / 데스크탑 레이아웃 소폭 개선 (데스크탑 620px 고정/슬라이드 흔들림 개선, 모바일 컨테이너 스크롤 지원 및 결제 버튼 하단 여백 추가 완료)
- [x] 메일 발송 잘 되고 있는지 테스트발송해서 확인 (어드민 수령 메일 단일화 완료)
- [x] 음악 가사등록 시스템이 어떻게 구축되어있는지 확인 (벅스 가사 크롤링 자동화 및 100ms 싱크 에디팅 시스템 개선 완료)
- [ ] 프로젝트 등록 방식도 어드민으로 옮길지 고민
