const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_ARCHIVE_PATH = path.join(ROOT_DIR, 'scratch', 'quarterly_live_contents.json');
const DEFAULT_CACHE_PATH = path.join(ROOT_DIR, 'functions', 'data', 'quarterly_media_cache.json');

const VERIFIED_ALBUM_ALIASES = {
  'bignaughty키드밀리::': ['＋'],
  'kingsouthgfreethemane::theworldeurasiabandhowtobeagod': ['How to be a God (신이되는방법)'],
  '시온::socialavoidance': ['sociavoidance'],
};

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    const [key, ...rest] = arg.split('=');
    if (key.startsWith('--')) args[key.slice(2)] = rest.join('=');
  });
  return args;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function normalizeKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
}

function normalizeIdentity(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[!！]/g, 'i')
    .replace(/[：:]/g, '')
    .replace(/[〈〉<>]/g, '')
    .replace(/[^a-z0-9가-힣]/g, '');
}

function albumKey(album, artist) {
  return `${normalizeKey(artist)}::${normalizeKey(album)}`;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAlbums(archive) {
  const albums = [];
  const seen = new Set();
  (archive.issues || []).forEach((issue) => {
    (issue.tiers || []).forEach((tier) => {
      (tier.items || []).forEach((item) => {
        if (!item.album || !item.artist) return;
        const key = albumKey(item.album, item.artist);
        if (seen.has(key)) return;
        seen.add(key);
        albums.push({ issue: issue.issue, album: item.album, artist: item.artist, key });
      });
    });
  });
  return albums;
}

function albumMatches(input, resolved) {
  const rawTarget = String(input || '').trim();
  const rawCandidate = String(resolved || '').trim();
  if (rawTarget && rawCandidate && rawTarget === rawCandidate) return true;
  if (rawTarget === '+' && rawCandidate === '＋') return true;
  const target = normalizeIdentity(input).replace(/fe3o4/g, 'fe304');
  const candidate = normalizeIdentity(resolved)
    .replace(/fe3o4/g, 'fe304')
    .replace(/^ggcp/, '공공카펫')
    .replace(/ep$/, '')
    .replace(/single$/, '');
  return Boolean(target && candidate && (target === candidate || target.includes(candidate) || candidate.includes(target)));
}

function artistMatches(input, providerText) {
  const text = normalizeIdentity(providerText);
  const artist = normalizeIdentity(input);
  if (artist && text.includes(artist)) return true;
  const parentheticalParts = Array.from(String(input || '').matchAll(/\(([^)]+)\)/g)).map((match) => match[1]);
  const noParenthetical = String(input || '').replace(/\([^)]*\)/g, ' ');
  const parts = [
    ...String(input || '').split(/[,&/]+/),
    ...noParenthetical.split(/[,&/]+/),
    ...parentheticalParts,
  ].map(normalizeIdentity).filter((part) => part.length >= 2);
  return parts.some((part) => text.includes(part));
}

function getBugsAlbumId(url) {
  return String(url || '').match(/music\.bugs\.co\.kr\/album\/(\d+)/)?.[1] || '';
}

function getAppleAlbumId(url) {
  return String(url || '').match(/\/album\/(?:[^/]+\/)?(\d+)/)?.[1] || '';
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'artic-quarterly-media-verifier/1.0',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function fetchAppleLookup(collectionId, country = 'US') {
  const response = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(collectionId)}&entity=album&country=${encodeURIComponent(country)}`, {
    headers: {
      accept: 'application/json',
      'user-agent': 'artic-quarterly-media-verifier/1.0',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for Apple lookup ${collectionId}`);
  const data = await response.json();
  return (data.results || []).find((item) => String(item.collectionId || '') === String(collectionId));
}

function getH1Texts(html) {
  return Array.from(String(html || '').matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi))
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);
}

async function verifyBugs(album, artist, cached) {
  const albumId = cached.providerAlbumId || getBugsAlbumId(cached.albumUrl || cached.sourceUrl);
  if (!albumId) return { ok: false, reason: 'Missing Bugs album id' };
  const albumUrl = `https://music.bugs.co.kr/album/${albumId}`;
  const html = await fetchText(albumUrl);
  const text = stripHtml(html);
  const h1Texts = getH1Texts(html);
  const aliases = VERIFIED_ALBUM_ALIASES[albumKey(album, artist)] || [];
  const resolvedAlbum = h1Texts.find((title) => albumMatches(album, title) || aliases.some((alias) => albumMatches(alias, title))) || '';
  if (!resolvedAlbum) return { ok: false, reason: `Bugs album title mismatch: ${h1Texts.join(' / ')}` };
  const artistVerified = artistMatches(artist, text) || artistMatches(cached.resolvedArtist, text);
  return {
    ok: true,
    provider: 'bugs-album-page',
    providerAlbumId: albumId,
    resolvedAlbum,
    resolvedArtist: cached.resolvedArtist || artist,
    albumUrl,
    warning: artistVerified ? '' : 'Album title verified; artist text did not match normalized Notion artist.',
  };
}

async function verifyApple(album, artist, cached) {
  const collectionId = cached.providerAlbumId || getAppleAlbumId(cached.albumUrl || cached.sourceUrl);
  if (!collectionId) return { ok: false, reason: 'Missing Apple collection id' };
  const result = await fetchAppleLookup(collectionId, cached.providerCountry || 'US');
  if (!result) return { ok: false, reason: `Apple lookup missing ${collectionId}` };
  if (!albumMatches(album, result.collectionName) && cached.matchStatus !== 'verified_manual_id') {
    return { ok: false, reason: `Apple album title mismatch: ${result.collectionName}` };
  }
  if (!artistMatches(artist, result.artistName) && !artistMatches(cached.resolvedArtist, result.artistName) && cached.matchStatus !== 'verified_manual_id') {
    return { ok: false, reason: `Apple artist mismatch: ${result.artistName}` };
  }
  return {
    ok: true,
    provider: 'itunes-lookup',
    providerAlbumId: String(result.collectionId),
    resolvedAlbum: result.collectionName,
    resolvedArtist: result.artistName,
    albumUrl: result.collectionViewUrl || cached.albumUrl || '',
  };
}

async function run() {
  const args = parseArgs();
  const archive = loadJson(path.resolve(args.archive || DEFAULT_ARCHIVE_PATH));
  const cachePath = path.resolve(args.cache || DEFAULT_CACHE_PATH);
  const cache = loadJson(cachePath);
  const write = args.write === 'true' || args.write === '1';
  const albums = extractAlbums(archive);
  const failures = [];

  for (let i = 0; i < albums.length; i += 1) {
    const item = albums[i];
    const cached = cache.albumArt?.[item.key];
    if (!cached?.imageUrl) {
      failures.push({ ...item, reason: 'Missing imageUrl' });
      continue;
    }

    let result = null;
    try {
      const source = String(cached.source || cached.provider || cached.albumUrl || '');
      if (/Apple|itunes|music\.apple\.com/i.test(source)) {
        result = await verifyApple(item.album, item.artist, cached);
      } else if (/Bugs|bugs|music\.bugs\.co\.kr/i.test(source)) {
        result = await verifyBugs(item.album, item.artist, cached);
      } else {
        result = { ok: false, reason: 'Unknown provider' };
      }
    } catch (err) {
      result = { ok: false, reason: err.message };
    }

    if (!result?.ok) {
      if (cached.verified === true && /현재 서비스에 접속하실 수 없습니다|HTTP 429|HTTP 503/i.test(result?.reason || '')) {
        if (write) {
          cache.albumArt[item.key] = {
            ...cached,
            verificationWarning: `Provider temporarily unavailable during recheck: ${result.reason}`,
            verifiedAt: cached.verifiedAt || new Date().toISOString(),
          };
        }
        continue;
      }
      failures.push({ ...item, reason: result?.reason || 'Unknown verification failure' });
      continue;
    }

    if (write) {
      cache.albumArt[item.key] = {
        ...cached,
        providerAlbumId: result.providerAlbumId,
        resolvedAlbum: result.resolvedAlbum,
        resolvedArtist: result.resolvedArtist,
        albumUrl: result.albumUrl || cached.albumUrl || '',
        verified: true,
        matchStatus: 'verified_provider_identity',
        verifiedBy: result.provider,
        verifiedAt: new Date().toISOString(),
        verificationWarning: result.warning || '',
      };
    }
  }

  if (write) {
    cache.source = 'Verified quarterly media cache';
    cache.updatedAt = new Date().toISOString();
    saveJson(cachePath, cache);
  }

  console.log(JSON.stringify({
    checked: albums.length,
    failures: failures.length,
    failureItems: failures,
    wrote: write,
  }, null, 2));

  if (failures.length) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
