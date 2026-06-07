# Developer & AI Agent Guidelines (AGENTS.md)

This document contains behavioral guidelines, coding standards, build workflows, and project architecture rules for developers and AI agent coding assistants (like Antigravity) working on the **artic.** official website.

---

## 1. Core Development Principles

### A. Templatization & Modularization First
- **Zero Page-Specific Hacks**: Do not write page-specific custom overrides (such as animation delay timeouts `setTimeout`, inline layout hacks, or override margins) inside individual subpages (`src/projects/*/styles.css` or `scripts.js`) if they conflict with global design system tokens or layouts.
- **Template-First Proposal Model**: If a requested styling or layout enhancement is needed, propose modifying the global templates (under `templates/`) instead of hardcoding page-specific styles.
- **Cross-Page Impact Assessment**: Before modifying any template or global design system token (`css/design-system.css`), identify all pages sharing that template/token and evaluate the visual and structural impact on them.
- **Reusability Check**: If a requested layout, form, or widget does not exist, design it as a reusable template/component under `templates/components/` rather than hardcoding it into a single subpage.

### B. Compilation Workflow Integrity
- **No Direct Edits to Compiled Output**: Never edit the compiled HTML files in the root (`index.html`, etc.) or under `projects/<slug>/index.html` directly. These are auto-generated.
- **Source of Truth**: Always edit the source fragments under `src/` and templates under `templates/`, then run the static compiler (`node scripts/build_pages.js`) to generate the output.
- **Global Style Separation**: Keep raw HTML fragments clean. Write CSS inside project-specific `styles.css` files (or global stylesheets) and JavaScript inside project-specific `scripts.js` (or `js/shared.js`). The compiler automatically collects and optimizes these styles into the final `<head>` at compile time.

---

## 2. Project Directory Structure

```
Homepage/
├── index.html            # [Auto-generated] Main Home compiled output
├── src/                  # [Source of Truth] High-level page fragments and metadata
│   ├── index.html        # Home body content and metadata (Front Matter)
│   ├── about.html        # About body content
│   └── projects/         # Individual project detail source folders
│       └── <slug>/
│           ├── meta.json     # Project metadata (slug, title, cover_image, etc.)
│           ├── left.html     # Left-column markup
│           ├── right.html    # Right-column markup
│           ├── styles.css    # Custom project styling overrides (keep minimal)
│           └── scripts.js    # Custom project scripts (keep minimal, no arbitrary delays)
├── templates/            # [Global Templates] Shared layout shells and components
│   ├── layouts/          # base.html (standard shell) & project-detail.html (2-column shell)
│   ├── global/           # header.html (nav/theme), footer.html, popup.html
│   └── components/       # base/ (buttons, links), forms/ (waitlist, checkout), projects/ (widgets)
├── css/                  # design-system.css (globals & dark mode) & animations.css (cinematic scroll reveals)
├── js/                   # shared.js (dark mode manager, mobile hamburger, common behaviors)
└── scripts/              # build_pages.js (compiler), validate_templates.js (linter)
```

---

## 3. Build, Validate & Staging Commands

Always run the following commands to build and verify your changes:

### README Synchronization Gate
Before every production deployment, read `README.md` from top to bottom and update any deployment-relevant documentation that changed with the work (architecture, environment variables, commands, QA flow, backend behavior, admin/product operations, or known limitations). Commit and push the README updates together with the deployed code. If no README changes are needed, explicitly note that the full README was reviewed and no update was required.

### Build Command
Compile all source pages and templates into the final output:
```bash
npm run build
# Or: node scripts/build_pages.js
```

### Validation Command
Verify the structural integrity and validation rules of all template files:
```bash
node scripts/validate_templates.js
```

### Local Development & Staging Server
Start the local Firebase Emulator Suite (Functions & Firestore) alongside the Node proxy server:
```bash
npm run dev
```
- Serves the frontend static files and proxy API server on `http://localhost:8000`.
- Starts the Firebase Emulator Suite on `http://localhost:4000` (Emulator UI), `5001` (Functions), and `8080` (Firestore).
- Automatically proxies backend API requests (`/api/checkout`, `/api/waitlist`, `/api/products`, `/api/admin/*`) to the local emulator, ensuring 100% logic parity with production.
- Generates HTML email previews in the `scratch/` directory when running locally.

*Note: Run browser checks with **Hard Refresh (Cmd+Shift+R or Ctrl+F5)** to bypass cache.*

---

## 4. Environment Isolation & Databases (로컬 및 실서버 환경 격리)

The project is divided into two completely isolated environments to prevent accidental data changes or configuration leaks:

### A. Local Staging Environment (로컬 개발 및 테스트 환경)
- **Local Web Site & Admin**: `http://localhost:8000` (User-facing) and `http://localhost:8000/admin` (Admin control panel).
- **Firebase Emulator UI**: `http://localhost:4000` (Provides a local Firestore DB dashboard on port `8080` and Functions runner on `5001`).
- **Database**: Uses the **Local Firestore Emulator memory**. Any modifications, waitlist additions, or test orders are written to this temporary 가상 데이터베이스, ensuring 100% safety from production data.
- **Local email preview**: Node-generated email notifications automatically generate HTML mockups inside the `scratch/` directory for preview.

### B. Production Environment (실서버 운영 환경)
- **Production Web Site & Admin**: `https://artic.live` and `https://artic.live/admin` (Live site hosted on GitHub Pages).
- **Firebase Database UI**: Accessed via the [Google Firebase Console](https://console.firebase.google.com/project/artic-official-home/firestore/databases/-default-/data).
- **Database**: Uses the **Real Google Cloud Firestore database**. Changes here directly represent live user data.
- **SMTP Config**: Uses the credentials defined in `functions/.env` (which is excluded from Git).

### C. Environment Routing
The client frontend code (via `js/shared.js` and component forms) automatically detects the host name (`window.location.hostname`). If it is `localhost` or `127.0.0.1`, it directs API calls to the local emulator, otherwise to production endpoints. Developers do not need to toggle base URLs manually.

---

## 5. Brand Guidelines

- **Official Brand Name**: **artic.** (always lowercase with a trailing period)
- **Korean Pronunciation/Notation**: **아틱** (Never use "아티크" under any circumstances).

---

## 6. 음원 가사 등록 프로토콜 (Bugs 크롤링 및 싱크 에디터)

신규 프로젝트 혹은 앨범에 가사를 등록하고 재생 싱크를 맞출 때 사용하는 기본 프로토콜입니다.

### 1단계: 벅스(Bugs) 가사 자동 수집 (크롤링)
가장 공식 가사 데이터 보존율이 높은 벅스(Bugs)를 기본 플랫폼으로 이용해 원본 가사 텍스트를 수집합니다.
```bash
# 앨범명과 아티스트로 검색해서 크롤링할 때
node scripts/crawl_bugs_lyrics.js --artist="아티스트명" --album="앨범명"

# 검색 결과가 불안정하여 직접 벅스 앨범 ID(Bugs URL의 8자리 숫자)를 지정하여 크롤링할 때 (추천)
node scripts/crawl_bugs_lyrics.js --albumId=20639149
```
* **결과물**: 수집이 완료되면 `scratch/crawled_lyrics_draft.json` 파일에 0초 타임스탬프로 초기화된 곡별 가사 텍스트가 저장됩니다.

### 2단계: 가사 데이터베이스(JSON) 및 소스 결합
1. 긁어온 텍스트 JSON의 필요한 데이터 배열을 `scratch/synced_lyrics_estimate.json` 또는 `src/projects/deus-ex-machina/scripts.js` 상수의 `LYRICS_DATA` 부분에 맞추어 이식합니다.

### 3단계: 로컬 싱크 에디터를 통한 타임스탬프 스탬핑
1. `npm run dev` 명령으로 개발 서버와 에뮬레이터를 구동합니다.
2. 브라우저에서 `http://localhost:8000/projects/deus-ex-machina/editor.html` 에 진입합니다.
3. 오디오 재생 중에 키보드의 **Enter** 키나 하단의 **스탬프 영역을 탭**하여 가사 한 줄마다의 실시간 타임스탬프를 순차적으로 기록합니다.
4. **Ctrl+S** 혹은 **Save to Server** 버튼을 눌러 소스코드에 변경사항을 즉시 주입하고 컴파일합니다.

---

## 7. 신규 개발자 통합 환경 셋업 스크립트 (`setup.sh`)
새로운 환경에서 개발 및 기동을 수월하게 세팅할 수 있도록 지원하는 일괄 설치 스크립트가 제공됩니다.
```bash
# 실행 권한 부여 후 실행
chmod +x setup.sh
./setup.sh
```
* 이 스크립트는 Node.js 설치 점검, Firebase CLI 전역 설치, 프로젝트 루트 및 Firebase Functions 디렉토리 의존성(`npm install`), Firebase 로그인 인증을 원스톱으로 처리합니다.
