const fs = require('fs');
const path = require('path');

const baseDir = 'c:/Users/LA723SL/.gemini/antigravity/Homepage';
const templatesDir = path.join(baseDir, 'templates');

const REQUIRED_TEMPLATES = [
  'global/header.html',
  'global/footer.html',
  'global/popup.html',
  'layouts/base.html',
  'layouts/project-detail.html',
  'components/base/project-card.html',
  'components/base/button.html',
  'components/base/button-link.html',
  'components/forms/waitlist-form-embedded.html',
  'components/forms/checkout-form-popup.html',
  'components/projects/player.html',
  'components/projects/lyric-and-tracklist.html',
  'components/projects/streaming-platforms.html',
  'components/projects/video-archive.html',
  'components/projects/featured-video.html',
  'components/projects/text-curation.html',
  'components/projects/music-playlist.html'
];

let failed = false;

console.log('=== Starting Template Structural Integrity Verification (Revised) ===');

REQUIRED_TEMPLATES.forEach(tempPath => {
  const fullPath = path.join(templatesDir, tempPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`[ERROR] Missing template file: templates/${tempPath}`);
    failed = true;
    return;
  }

  const stat = fs.statSync(fullPath);
  if (stat.size === 0) {
    console.error(`[ERROR] Template file is empty: templates/${tempPath}`);
    failed = true;
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  console.log(`[PASS] templates/${tempPath} exists and has size ${stat.size} bytes.`);
  
  // Specific assertions
  if (tempPath === 'components/forms/waitlist-form-embedded.html') {
    if (!content.includes('DATABASE SCHEMA MAPPING') || !content.includes('quarterly_subscribers') || !content.includes('Firebase Firestore')) {
      console.warn(`[WARN] templates/${tempPath} might be missing backend mapping info comments.`);
    }
  }
  if (tempPath === 'components/forms/checkout-form-popup.html') {
    if (!content.includes('DATABASE SCHEMA MAPPING') || !content.includes('orders') || !content.includes('Firebase Firestore')) {
      console.warn(`[WARN] templates/${tempPath} might be missing backend mapping info comments.`);
    }
  }
});

console.log('===========================================================');

if (failed) {
  console.error('Validation FAILED! Some template files are missing or empty.');
  process.exit(1);
} else {
  console.log('Validation SUCCESSFUL! All hierarchical templates (including button & featured-video) are structurally integrated.');
  process.exit(0);
}
