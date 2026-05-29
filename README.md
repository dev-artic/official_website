# ARTIC / Official Gallery & Webzine Boilerplate

이 리포지토리는 예술 갤러리 및 모던 에디토리얼 웹진 스타일의 초고화질 정적 웹사이트 보일러플레이트입니다. 
가벼운 로드 속도, 높은 디자인 완성도, SEO 강점을 가지며 빌드 엔진(Node.js/Python) 없이도 로컬 브라우저에서 즉시 개발 및 편집이 가능합니다.

---

## 📂 폴더 구조 및 아키텍처

프레임워크 없이도 모듈화된 관리가 가능하도록 구조적으로 설계되었습니다:

```
Homepage/
├── index.html            # 메인 HTML5 뼈대 (웹진의 에디토리얼 그리드 구조)
├── css/
│   ├── main.css          # 모든 CSS 모듈을 모아서 로드하는 진입점
│   ├── design-system.css # [중요] 디자인 토큰 (CSS 변수: 색상, 폰트, 여백 설정 및 자동 다크모드)
│   ├── base.css          # 기본 리셋 및 프리미엄 미니멀 스크롤바 디자인
│   ├── layout.css        # 비대칭 에디토리얼 그리드 및 컨테이너 레이아웃
│   ├── typography.css    # 럭셔리 세리프와 지오메트릭 산세리프 폰트 페어링
│   ├── animations.css    # cinematic 페이드 인, 스크롤 리빌, 마우스 오버 줌 트랜지션
│   └── components/
│       ├── navbar.css    # 반투명 글래스모피즘 플로팅 상단 메뉴
│       ├── gallery.css   # 웹진 카드 및 커스텀 CTA 버튼 스타일
│       └── footer.css    # 미니멀 에디토리얼 하단 영역
└── js/
    ├── app.js            # 상단 메뉴 스크롤 트리거 및 모바일 햄버거 토글 컨트롤러
    └── reveal.js         # Intersection Observer API 기반 고성능 스크롤 페이드 애니메이션
```

---

## 🎨 테마 및 스타일 커스터마이징 (디자인 토큰)

사이트의 전체적인 색상이나 서체, 애니메이션 느낌을 변경하고 싶다면, 개별 CSS를 뒤질 필요 없이 **`css/design-system.css`** 파일만 수정하면 됩니다:

```css
:root {
  /* 폰트 지정 */
  --font-serif: 'Cormorant Garamond', serif; /* 클래식 헤더 */
  --font-sans: 'Inter', sans-serif;         /* 가독성 높은 본문 */

  /* 라이트 모드 컬러 */
  --bg-primary: #FAF9F6;       /* 갤러리 웜 화이트 */
  --text-primary: #111111;     /* 딥 옵시디언 블랙 */
  --accent: #B89047;           /* 샴페인 골드 액센트 */
}

/* 시스템 다크모드 설정 (사용자 OS 설정에 따라 자동 변환) */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #0A0A0A;     /* 벨벳 블랙 */
    --text-primary: #F3F3F3;   /* 리넨 화이트 */
    --accent: #D4AF37;         /* 클래식 골드 */
  }
}
```

---

## ✍️ 웹진 기사(아티클) 추가 방법

새로운 기사나 아트웍 카드를 메인 그리드에 추가하려면, `index.html` 내 `<div class="grid-editorial">` 태그 안에 아래의 에디토리얼 카드 마크업을 복사해서 붙여넣기만 하면 됩니다:

```html
<article class="art-card col-4 reveal">
  <div class="art-card-media zoom-frame">
    <!-- 이미지 태그(<img>)를 넣거나 플레이스홀더 SVG를 배치할 수 있습니다. -->
    <img src="YOUR_IMAGE_PATH.jpg" alt="기사 이미지">
  </div>
  <div class="art-card-details">
    <span class="meta-tag">카테고리 / 이슈 번호</span>
    <a href="#" class="art-card-title"><h4>기사 제목 (세리프)</h4></a>
    <p>기사 본문에 대한 짧은 요약 또는 아티스틱 설명글입니다.</p>
    <span class="text-meta">작성일자</span>
  </div>
</article>
```
* **`.reveal`**: 화면 스크롤 시 아래에서 위로 부드럽게 페이드인되는 시네마틱 애니메이션이 자동으로 적용됩니다.

---

## 🚀 GitHub Pages 배포 가이드 (3분 완성)

이 보일러플레이트는 정적 HTML/CSS 기반이므로, 복잡한 빌드 워크플로우 없이 GitHub 상에서 클릭 몇 번으로 즉시 호스팅 배포가 가능합니다.

### 1단계: 코드를 GitHub 리포지토리에 푸시
현재 로컬에 작성된 뼈대 파일들을 리포지토리의 `main` 브랜치로 커밋 및 푸시합니다.
```bash
git add .
git commit -m "feat: setup premium art gallery and webzine boilerplate"
git push origin main
```

### 2단계: 리포지토리 Pages 설정
1. GitHub 리포지토리 페이지(`https://github.com/dev-artic/official_website`)로 이동합니다.
2. 우측 상단의 **Settings** 탭을 클릭합니다.
3. 좌측 사이드바의 **Code and automation** 아래에서 **Pages**를 선택합니다.
4. **Build and deployment** 섹션의 Source 옵션이 **Deploy from a branch**로 되어 있는지 확인합니다.
5. Branch 설정에서 **`main`** 브랜치와 **`/(root)`** 폴더를 지정한 뒤, 우측의 **Save** 버튼을 누릅니다.

### 3단계: 배포 확인
* 세팅을 완료하면 상단에 `Your site is live at...` 문구와 함께 호스팅 주소가 표시됩니다.
* 몇 초 후 **`https://dev-artic.github.io/official_website/`** 주소로 접속하면, 전 세계 어디서든 모던한 아트 갤러리 웹진 홈페이지를 확인하실 수 있습니다!
