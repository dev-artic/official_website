const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT_DIR = path.resolve(__dirname, '..');
const ARCHIVE_PATH = path.join(ROOT_DIR, 'scratch', 'quarterly_contents_snapshot.json');
const NOW_ARTIC_PATH = path.join(ROOT_DIR, 'scratch', 'now_artic_snapshot.json');
const FUNCTIONS_NOW_ARTIC_PATH = path.join(ROOT_DIR, 'functions', 'data', 'quarterly_now_artic.json');
const INSTAGRAM_REELS_URL = 'https://www.instagram.com/artic.live/reels/';
const KEYWORDS = ['실시간', '오늘자', '어제자'];
const MAX_REELS = Number(process.env.NOW_ARTIC_MAX_REELS || 36);
const SCROLL_PASSES = Number(process.env.NOW_ARTIC_SCROLL_PASSES || 4);
const DIRECT_REEL_URLS = String(process.env.NOW_ARTIC_REEL_URLS || '')
  .split(/[\s,]+/)
  .map((url) => url.trim())
  .filter(Boolean);
const HEADLESS = process.env.NOW_ARTIC_HEADLESS !== 'false';

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function labelFromCaption(caption) {
  return KEYWORDS.find((keyword) => caption.includes(keyword)) || '';
}

function parseInstagramMetaDescription(description) {
  const text = String(description || '').trim();
  const dateMatch = text.match(/\son\s+([A-Z][a-z]+ \d{1,2}, 20\d{2}):\s*"/);
  const captionMatch = text.match(/:\s*"([\s\S]*)"\.?\s*$/);
  const rawCaption = captionMatch ? captionMatch[1] : text;
  const caption = rawCaption
    .replace(/\\"/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

  let date = '';
  if (dateMatch) {
    const parsed = new Date(`${dateMatch[1]} 00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed.toISOString().slice(0, 10);
    }
  }

  return { caption, date };
}

function quarterFromDate(value) {
  const date = new Date(`${value || ''}T00:00:00`);
  if (Number.isNaN(date.getTime())) return {};
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return {
    year: date.getFullYear(),
    quarter: `Q${quarter}`,
    issue: `${date.getFullYear()} Q${quarter}`,
  };
}

function compactCaption(caption) {
  return String(caption || '').replace(/\s+/g, ' ').trim();
}

async function run() {
  const browser = await puppeteer.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 900 });

  try {
    let reelUrls = DIRECT_REEL_URLS;
    if (!reelUrls.length) {
      await page.goto(INSTAGRAM_REELS_URL, { waitUntil: 'networkidle2', timeout: 45000 });
      await new Promise((resolve) => setTimeout(resolve, 2500));

      for (let index = 0; index < SCROLL_PASSES; index += 1) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.6));
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      reelUrls = await page.evaluate((limit) => {
        const seen = new Set();
        return Array.from(document.querySelectorAll('a[href*="/reel/"], a[href*="/p/"]'))
          .map((anchor) => anchor.href)
          .filter((href) => {
            if (!href || seen.has(href)) return false;
            seen.add(href);
            return true;
          })
          .slice(0, limit);
      }, MAX_REELS);
    }

    const items = [];
    for (const url of reelUrls) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await new Promise((resolve) => setTimeout(resolve, 1400));

      const detail = await page.evaluate(() => {
        const getMeta = (selector) => document.querySelector(selector)?.getAttribute('content') || '';
        return {
          description: getMeta('meta[property="og:description"]') || getMeta('meta[name="description"]'),
          title: getMeta('meta[property="og:title"]') || document.title,
          imageUrl: getMeta('meta[property="og:image"]') || getMeta('meta[name="twitter:image"]'),
        };
      });

      const parsed = parseInstagramMetaDescription(detail.description || detail.title);
      const caption = compactCaption(parsed.caption);
      const label = labelFromCaption(caption);
      if (!label) continue;

      items.push({
        label,
        caption: caption.slice(0, 260),
        fullCaption: caption,
        date: parsed.date,
        ...quarterFromDate(parsed.date),
        imageUrl: detail.imageUrl,
        url,
        source: 'Instagram',
      });
    }

    const payload = {
      source: 'instagram-public-reel-pages',
      profile: 'https://www.instagram.com/artic.live/',
      crawledAt: new Date().toISOString(),
      keywords: KEYWORDS,
      scanned: reelUrls.length,
      directUrls: DIRECT_REEL_URLS.length,
      headless: HEADLESS,
      items,
    };

    saveJson(NOW_ARTIC_PATH, payload);
    saveJson(FUNCTIONS_NOW_ARTIC_PATH, payload);

    const archive = loadJson(ARCHIVE_PATH, null);
    if (archive) {
      archive.nowArtic = items;
      archive.nowArticUpdatedAt = payload.crawledAt;
      saveJson(ARCHIVE_PATH, archive);
    }

    console.log(JSON.stringify({ items: items.length, output: NOW_ARTIC_PATH, functionsOutput: FUNCTIONS_NOW_ARTIC_PATH }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  const payload = {
    source: 'instagram-public-page',
    profile: 'https://www.instagram.com/artic.live/',
    crawledAt: new Date().toISOString(),
    keywords: KEYWORDS,
    items: [],
    error: err.message,
  };
  saveJson(NOW_ARTIC_PATH, payload);
  saveJson(FUNCTIONS_NOW_ARTIC_PATH, payload);
  console.error(err);
  process.exit(1);
});
