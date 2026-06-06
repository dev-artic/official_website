#!/bin/bash
# setup.sh - artic. 공식 홈페이지 프로젝트 통합 셋업 스크립트

echo "=================================================="
echo "artic. Official Website - Project Staging Setup"
echo "=================================================="

# 1. Node.js 설치 확인
if ! command -v node &> /dev/null; then
    echo "[!] Node.js가 설치되어 있지 않습니다. Node.js(LTS 버전 20 이상)를 먼저 설치해 주세요."
    exit 1
else
    echo "[✔] Node.js 버전: $(node -v)"
fi

# 2. Firebase CLI 설치 확인 및 설치 안내
if ! command -v firebase &> /dev/null; then
    echo "[i] Firebase CLI가 존재하지 않습니다. 전역 설치를 진행합니다..."
    npm install -g firebase-tools
    if [ $? -ne 0 ]; then
        echo "[!] Firebase CLI 전역 설치에 실패했습니다. 권한 문제일 수 있으니 'sudo npm install -g firebase-tools'로 직접 실행해 보세요."
    fi
else
    echo "[✔] Firebase CLI 버전: $(firebase --version)"
fi

# 3. 루트 디렉토리 npm 의존성 설치 (Puppeteer, Concurrently 등)
echo "[i] 루트 디렉토리 npm 패키지 설치 중..."
npm install

# 4. functions 디렉토리 npm 의존성 설치
if [ -d "functions" ]; then
    echo "[i] functions 디렉토리 npm 패키지 설치 중..."
    cd functions
    npm install
    cd ..
fi

# 5. Firebase 인증 체크
echo "[i] Firebase 로그인 및 인증 상태 확인..."
firebase login

echo "=================================================="
echo "[✔] 셋업 완료!"
echo "개발 서버 실행: npm run dev"
echo "프론트엔드 빌드: npm run build"
echo "가사 크롤러 실행: node scripts/crawl_bugs_lyrics.js --albumId=20639149"
echo "=================================================="
