const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');

const ROOT_DIR = path.resolve(__dirname, '..');
const ARCHIVE_PATH = path.join(ROOT_DIR, 'scratch', 'quarterly_contents_snapshot.json');
const NOW_ARTIC_PATH = path.join(ROOT_DIR, 'scratch', 'now_artic_snapshot.json');
const FUNCTIONS_NOW_ARTIC_PATH = path.join(ROOT_DIR, 'functions', 'data', 'quarterly_now_artic.json');
const NOW_ARTIC_IMAGE_DIR = path.join(ROOT_DIR, 'images', 'quarterly', 'now-artic');

const INSTAGRAM_PROFILE_URL = 'https://www.instagram.com/artic.live/';
const INSTAGRAM_REELS_URL = 'https://www.instagram.com/artic.live/reels/';

/**
 * Keyword classification tiers.
 *
 * - PRIMARY: original strict "실시간 보도" keywords → label inherits the keyword itself.
 * - EVENT:   broader live-event / venue indicators → label "현장".
 *
 * A caption must contain at least one keyword from either tier to be included.
 */
const PRIMARY_KEYWORDS = ['실시간', '오늘자', '어제자'];
const EVENT_KEYWORDS   = [
  '현장', '셋로그',
  '콘서트', '공연', '라이브', '리스닝', '페스티벌',
  '단독 공연', '단독공연',
  'Venue', 'venue',
];
const ALL_KEYWORDS = [...PRIMARY_KEYWORDS, ...EVENT_KEYWORDS];

/**
 * Captions matching any EXCLUDE pattern are unconditionally skipped,
 * even if they contain a positive keyword.
 */
const EXCLUDE_PATTERNS = [
  '#보도자료',
  'TASTING NOTE',
  'tasting note',
  'Tasting Note',
  'Source |',      // source-attribution posts (인물/작품 소개), not live events
  'Source|',
];

const MAX_REELS = Number(process.env.NOW_ARTIC_MAX_REELS || 60);
const SCROLL_PASSES = Number(process.env.NOW_ARTIC_SCROLL_PASSES || 12);
const DIRECT_REEL_URLS = String(process.env.NOW_ARTIC_REEL_URLS || '')
  .split(/[\s,]+/)
  .map((url) => url.trim())
  .filter(Boolean);
const HEADLESS = process.env.NOW_ARTIC_HEADLESS !== 'false';
const DEPLOY = process.argv.includes('--deploy');
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

function verbose(...args) { if (VERBOSE) console.log('  [verbose]', ...args); }

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function shell(cmd) {
  console.log(`  $ ${cmd}`);
  const output = execSync(cmd, { cwd: ROOT_DIR, stdio: 'pipe', encoding: 'utf8' }).trim();
  if (output) console.log(output);
  return output;
}

function labelFromCaption(caption) {
  const text = String(caption || '');
  // Exclusion takes precedence
  if (EXCLUDE_PATTERNS.some((pattern) => text.includes(pattern))) return '';
  // Primary keywords → use the keyword itself as the label
  const primary = PRIMARY_KEYWORDS.find((kw) => text.includes(kw));
  if (primary) return primary;
  // Event keywords → unified "현장" label
  return EVENT_KEYWORDS.some((kw) => text.includes(kw)) ? '현장' : '';
}

function parseInstagramMetaDescription(description) {
  const text = String(description || '').trim();
  const dateMatch = text.match(/\son\s+([A-Z][a-z]+ \d{1,2}, 20\d{2}):\s*"/);
  const captionMatch = text.match(/:\s*"([\s\S]*)"\s*\.?\s*$/);
  const rawCaption = captionMatch ? captionMatch[1] : text;
  const caption = rawCaption
    .replace(/\\"/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

  let date = '';
  if (dateMatch) {
    const parsed = new Date(`${dateMatch[1]} 00:00:00 UTC`);
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed.toISOString().slice(0, 10);
    }
  }

  return { caption, date };
}

function quarterFromDate(value) {
  const date = new Date(`${value || ''}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return {};
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return {
    year: date.getUTCFullYear(),
    quarter: `Q${quarter}`,
    issue: `${date.getUTCFullYear()} Q${quarter}`,
  };
}

function getInstagramShortcode(url) {
  return String(url || '').match(/instagram\.com\/(?:[^/?#]+\/)?(?:p|reel|tv)\/([^/?#]+)/i)?.[1] || '';
}

function getInstagramEmbedUrl(url) {
  const match = String(url || '').match(/instagram\.com\/(?:[^/?#]+\/)?(p|reel|tv)\/([^/?#]+)/i);
  return match ? `https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/embed/` : '';
}

// Only extract identifiable event names; unknown titles need editorial review.
function deriveEventTitle(caption) {
  const text = String(caption || '')
    .replace(/\(@[\w.]+\)/g, '')
    .replace(/@[\w.]+/g, '')
    .split(/\bVenue\b|\bThanks to\b/i)[0].trim();
  const concert = text.match(/(?:^|[.\n]\s*)([^.\n]*?(?:단독\s*(?:공연|콘서트))\s*[\[《][^\]》]+[\]》])/);
  if (concert) return concert[1].trim();
  const live = text.match(/\b20\d{2}\s+[^.\n]*?\b(?:LIVE|CONCERT|FESTIVAL)\b[^.\n]*/i);
  if (live) return live[0].trim();
  const exhibition = text.match(/([가-힣A-Za-z]+)\s*작가(?:의)?\s*개인전\s*(《[^》]+》|\[[^\]]+\])/);
  if (exhibition) return `${exhibition[1]} 개인전 ${exhibition[2]}${/오프닝 퍼포먼스/.test(text) ? ' 오프닝 퍼포먼스' : ''}`;
  return '';
}

/**
 * Extract venue from caption patterns like "Venue @somewhere" or "venue @somewhere".
 */
function deriveVenue(caption) {
  const match = String(caption || '').match(/\bVenue\s*\|?\s*@?(\S[^\n]*?)(?:\s+Thanks|\s*$)/i);
  if (!match) return '';
  return match[1].replace(/@/g, '').replace(/\|/g, '').trim();
}

async function downloadPreviewImage(imageUrl, shortcode) {
  if (!imageUrl || !shortcode) return '';
  // Skip if already downloaded
  const targetPath = path.join(NOW_ARTIC_IMAGE_DIR, `${shortcode}.jpg`);
  if (fs.existsSync(targetPath)) {
    verbose(`Preview already exists: ${shortcode}.jpg`);
    return `/images/quarterly/now-artic/${shortcode}.jpg`;
  }
  if (DRY_RUN) return imageUrl;
  const response = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      Referer: 'https://www.instagram.com/',
    },
  });
  if (!response.ok) {
    throw new Error(`Instagram preview returned ${response.status}`);
  }
  fs.mkdirSync(NOW_ARTIC_IMAGE_DIR, { recursive: true });
  fs.writeFileSync(targetPath, Buffer.from(await response.arrayBuffer()));
  return `/images/quarterly/now-artic/${shortcode}.jpg`;
}

async function collectReelUrls(page) {
  const allUrls = new Set();

  for (const profileUrl of [INSTAGRAM_REELS_URL, INSTAGRAM_PROFILE_URL]) {
    const isReels = profileUrl === INSTAGRAM_REELS_URL;
    console.log(isReels ? 'Phase 1: Scanning /reels/ page...' : 'Phase 2: Scanning main profile page...');
    await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 3000));

    for (let i = 0; i < SCROLL_PASSES; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await new Promise((r) => setTimeout(r, 1200));
    }

    const links = await page.evaluate(() => [...new Set(
      Array.from(document.querySelectorAll('a[href*="/reel/"], a[href*="/p/"]'), (a) => a.href).filter(Boolean)
    )]);
    const previousCount = allUrls.size;
    links.forEach((url) => allUrls.add(url));
    console.log(isReels
      ? `  Found ${links.length} URLs from /reels/`
      : `  Found ${links.length} URLs from profile (${allUrls.size - previousCount} new)`);
  }

  const urls = Array.from(allUrls).slice(0, MAX_REELS);
  console.log(`Total unique URLs to scan: ${urls.length}`);
  return urls;
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Now artic. — Instagram Crawl & Update Pipeline');
  console.log(`  ${new Date().toISOString()}`);
  console.log(`  Keywords: ${ALL_KEYWORDS.join(', ')}`);
  console.log(`  Headless: ${HEADLESS} | Deploy: ${DEPLOY} | Dry-run: ${DRY_RUN}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (DEPLOY && !DRY_RUN) {
    if (shell('git branch --show-current') !== 'main') throw new Error('--deploy requires the main branch');
    const staged = shell('git diff --cached --name-only').split('\n').filter(Boolean);
    if (staged.some((file) => file !== 'functions/data/quarterly_now_artic.json' && !file.startsWith('images/quarterly/now-artic/'))) {
      throw new Error('Commit unrelated staged changes before --deploy');
    }
  }

  const existingPayload = loadJson(FUNCTIONS_NOW_ARTIC_PATH, { items: [] });
  const existingItems = Array.isArray(existingPayload.items) ? existingPayload.items : [];
  console.log(`Existing items: ${existingItems.length}`);

  const browser = await puppeteer.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let items = [];
  let scanned = 0;
  const excludedShortcodes = new Set();

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 900 });

    // Determine reel URLs to scan
    let reelUrls = DIRECT_REEL_URLS;
    if (!reelUrls.length) {
      reelUrls = await collectReelUrls(page);
    } else {
      console.log(`Using ${reelUrls.length} direct reel URL(s) from environment`);
    }

    // Visit each URL and parse caption
    console.log('\nScanning individual reel/post pages...');
    for (let i = 0; i < reelUrls.length; i++) {
      const url = reelUrls[i];
      scanned += 1;
      const shortcode = getInstagramShortcode(url);

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise((r) => setTimeout(r, 1400));

        const detail = await page.evaluate(() => {
          const getMeta = (sel) => document.querySelector(sel)?.getAttribute('content') || '';
          return {
            description: getMeta('meta[property="og:description"]') || getMeta('meta[name="description"]'),
            title: getMeta('meta[property="og:title"]') || document.title,
            imageUrl: getMeta('meta[property="og:image"]') || getMeta('meta[name="twitter:image"]'),
          };
        });

        const parsed = parseInstagramMetaDescription(detail.description || detail.title);
        const caption = parsed.caption;
        const label = labelFromCaption(caption);

        if (!label) {
          if (EXCLUDE_PATTERNS.some((pattern) => caption.includes(pattern))) excludedShortcodes.add(shortcode);
          verbose(`[${i}] SKIP (no keyword) ${parsed.date || '?'} | ${caption.slice(0, 80)}...`);
          continue;
        }

        console.log(`  ✅ [${i}] ${label} | ${parsed.date || '?'} | ${caption.slice(0, 80)}...`);

        // Merge with existing item (preserves manual overrides like eventTitle, venue)
        const existingItem = existingItems.find(
          (item) => getInstagramShortcode(item.url || item.embedUrl) === shortcode
        ) || {};

        let imageUrl = detail.imageUrl;
        try {
          imageUrl = await downloadPreviewImage(detail.imageUrl, shortcode) || detail.imageUrl;
        } catch (err) {
          console.warn(`  ⚠ Unable to download preview for ${shortcode}:`, err.message);
        }

        items.push({
          ...existingItem,
          label,
          caption: caption.slice(0, 260),
          fullCaption: caption,
          eventTitle: existingItem.eventTitle || deriveEventTitle(caption),
          venue: existingItem.venue || deriveVenue(caption),
          date: parsed.date,
          ...quarterFromDate(parsed.date),
          imageUrl,
          embedUrl: getInstagramEmbedUrl(url),
          url,
          source: 'Instagram',
        });
      } catch (err) {
        console.warn(`  ⚠ [${i}] Error scanning ${url}: ${err.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  // Also re-include existing items whose shortcodes weren't found in the new scan
  // (they may have scrolled off the visible page but are still valid)
  const newShortcodes = new Set(items.map((item) => getInstagramShortcode(item.url || item.embedUrl)));
  const preserved = existingItems.filter((item) => {
    const sc = getInstagramShortcode(item.url || item.embedUrl);
    return sc && !newShortcodes.has(sc) && !excludedShortcodes.has(sc);
  });
  if (preserved.length) {
    console.log(`\nPreserving ${preserved.length} existing item(s) not found in current scan`);
    items = [...items, ...preserved];
  }

  // Sort by date descending
  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // ── Save results ──────────────────────────────────────────────────────
  const payload = {
    source: 'instagram-public-reel-pages',
    profile: INSTAGRAM_PROFILE_URL,
    crawledAt: new Date().toISOString(),
    keywords: ALL_KEYWORDS,
    scanned,
    directUrls: DIRECT_REEL_URLS.length,
    headless: HEADLESS,
    items,
  };

  console.log(`\n── Results ──`);
  console.log(`Total matched items: ${items.length}`);
  items.forEach((item) => console.log(`  [${item.label}] ${item.date} — ${(item.caption || '').slice(0, 60)}...`));

  if (DRY_RUN) {
    console.log('\n⚠ Dry-run mode — skipping file writes and deployment');
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  saveJson(NOW_ARTIC_PATH, payload);
  saveJson(FUNCTIONS_NOW_ARTIC_PATH, payload);
  console.log(`\nSaved to:\n  ${NOW_ARTIC_PATH}\n  ${FUNCTIONS_NOW_ARTIC_PATH}`);

  const archive = loadJson(ARCHIVE_PATH, null);
  if (archive) {
    archive.nowArtic = items;
    archive.nowArticUpdatedAt = payload.crawledAt;
    saveJson(ARCHIVE_PATH, archive);
    console.log(`  Updated archive snapshot`);
  }

  // ── Build ─────────────────────────────────────────────────────────────
  console.log('\n── Building static site ──');
  shell('node scripts/build_pages.js');
  shell('node scripts/validate_templates.js');
  console.log('✅ Build complete');

  // ── Deploy (optional) ─────────────────────────────────────────────────
  if (DEPLOY) {
    console.log('\n── Deploying ──');

    // Step 1: Git commit + push (triggers GitHub Pages for static assets)
    console.log('\n[1/3] Git commit & push...');
    shell('git add images/quarterly/now-artic/ functions/data/quarterly_now_artic.json');

    const diffResult = shell('git diff --cached --stat');
    if (!diffResult) {
      console.log('  No changes to commit.');
    } else {
      const commitMsg = `chore: update Now artic. data (${items.length} items, ${new Date().toISOString().slice(0, 10)})`;
      shell(`git commit -m "${commitMsg}"`);
    }

    shell('git push origin main');
    console.log('  ✅ Pushed to GitHub → Pages deploy will trigger automatically');

    // Step 2: Deploy Firebase Functions (bundles updated JSON)
    console.log('\n[2/3] Deploying Firebase Functions...');
    shell('npx firebase-tools deploy --only functions:quarterlyContents --project artic-official-home --non-interactive');
    console.log('  ✅ Firebase Functions deployed');

    console.log('\n[3/3] Invalidating Firestore cache...');
    shell('npx firebase-tools firestore:delete quarterly_cache/archive --project artic-official-home --yes');
    console.log('  ✅ Firestore cache cleared');

    console.log('\n══════════════════════════════════════════');
    console.log('  ✅ Full deployment complete!');
    console.log('  Static site: https://artic.live/quarterly/');
    console.log('  API: https://quarterlycontents-4n2xy6gsxa-uc.a.run.app');
    console.log('══════════════════════════════════════════');
  } else {
    console.log('\n── Next steps (run with --deploy to automate) ──');
    console.log('  1. git add & commit & push → triggers GitHub Pages deploy');
    console.log('  2. npx firebase-tools deploy --only functions:quarterlyContents --project artic-official-home');
    console.log('  3. /admin → Quarterly → Publish Archive (or delete quarterly_cache/archive)');
  }

  console.log(`\n${JSON.stringify({ items: items.length, output: NOW_ARTIC_PATH, functionsOutput: FUNCTIONS_NOW_ARTIC_PATH }, null, 2)}`);
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

module.exports = { run, labelFromCaption, parseInstagramMetaDescription, quarterFromDate,
  getInstagramShortcode, getInstagramEmbedUrl, deriveEventTitle, deriveVenue, collectReelUrls };
