# Developer & AI Agent Guidelines (CLAUDE.md)

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
