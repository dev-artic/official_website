const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_ARCHIVE_PATH = path.join(ROOT_DIR, 'scratch', 'quarterly_live_contents.json');
const DEFAULT_MEDIA_CACHE_PATH = path.join(ROOT_DIR, 'functions', 'data', 'quarterly_media_cache.json');

const BUGS_MANUAL_ALBUM_IDS = {
  '시온::socialavoidance': {
    albumId: '4102719',
    resolvedAlbum: 'sociavoidance',
    resolvedArtist: '시온',
    sourceUrl: 'https://music.bugs.co.kr/album/4102719',
    note: 'Notion album spelling is socialavoidance; provider canonical spelling is sociavoidance.',
  },
  "컴필레이션::랩퍼블릭3블록mixtape3": {
    albumId: '20710549',
    resolvedAlbum: "랩:퍼블릭 3블록 MIXTAPE '<3'",
    resolvedArtist: '김하온(HAON), 노윤하, REDDY, 뻘컵(BBULKUP), SINCE, Yang Kyle (양카일), James An, Chaboom(차붐)',
    sourceUrl: 'https://music.bugs.co.kr/album/20710549',
    note: 'Notion artist is generic compilation; Bugs canonical artists are the participating artists.',
  },
};

const APPLE_MANUAL_ALBUM_IDS = {
  'tradel::whenutipsy': {
    collectionId: '1840576721',
    country: 'US',
    note: 'Apple collection ID verified from Apple Music album page.',
  },
  'shinjihang::nong': {
    collectionId: '1798650006',
    country: 'KR',
    note: 'Apple collection ID verified from iTunes Search.',
  },
  'thedeep::kpopbitch': {
    collectionId: '1851949502',
    country: 'US',
    note: 'Notion album spelling is KPOP BITCH; Apple/Bugs canonical spelling is KPOP B!TCH.',
  },
  'doubledownfoggyatthebottm::형동생': {
    collectionId: '1840696059',
    country: 'US',
    note: 'Notion artist spelling is Foggyatthebottm; Apple canonical spelling is Foggyatthebottom.',
  },
  '공공카펫::공공카펫iii': {
    collectionId: '1809302848',
    country: 'KR',
    note: 'Apple canonical album title is GGCP Ⅲ - EP.',
  },
  'nmixx::fe304stickout': {
    collectionId: '1762599144',
    country: 'KR',
    note: 'Apple canonical album title is Fe3O4: STICK OUT.',
  },
};

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    const [key, ...rest] = arg.split('=');
    if (key.startsWith('--')) args[key.slice(2)] = rest.join('=');
  });
  return args;
}

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function normalizeCacheKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '');
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

function makeAlbumKey(album, artist) {
  return `${normalizeCacheKey(artist)}::${normalizeCacheKey(album)}`;
}

function makeManualKey(album, artist) {
  return makeAlbumKey(album, artist);
}

function getHighResolutionAppleArtwork(url) {
  return String(url || '').replace(/\/\d+x\d+bb\.(jpg|png|webp)$/i, '/1200x1200bb.$1');
}

function getBugsAlbumImageUrl(albumId) {
  const id = String(albumId || '').trim();
  if (!/^\d+$/.test(id)) return '';
  return `https://image.bugsm.co.kr/album/images/1000/${id.slice(0, -2)}/${id}.jpg`;
}

function extractAlbums(archive) {
  const seen = new Set();
  const albums = [];
  (archive.issues || []).forEach((issue) => {
    (issue.tiers || []).forEach((tier) => {
      (tier.items || []).forEach((item) => {
        if (!item.album || !item.artist) return;
        const key = makeAlbumKey(item.album, item.artist);
        if (seen.has(key)) return;
        seen.add(key);
        albums.push({ issue: issue.issue, album: item.album, artist: item.artist, key });
      });
    });
  });
  return albums;
}

function getAppleSearchTerms(album, artist) {
  const terms = new Set();
  const cleanArtist = String(artist || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanAlbum = String(album || '').replace(/[<>〈〉]/g, '').replace(/\s+/g, ' ').trim();
  [artist, cleanArtist].filter(Boolean).forEach((artistTerm) => {
    terms.add(`${artistTerm} ${album}`);
    terms.add(`${artistTerm} ${cleanAlbum}`);
  });
  terms.add(album);
  terms.add(cleanAlbum);
  return Array.from(terms).filter(Boolean);
}

function albumMatches(targetAlbum, candidateAlbum) {
  const target = normalizeIdentity(targetAlbum);
  const candidate = normalizeIdentity(candidateAlbum)
    .replace(/ep$/, '')
    .replace(/single$/, '');
  return Boolean(target && candidate && (target === candidate || candidate.includes(target) || target.includes(candidate)));
}

function artistMatches(targetArtist, candidateArtist) {
  const target = normalizeIdentity(targetArtist);
  const candidate = normalizeIdentity(candidateArtist);
  if (!target || !candidate) return false;
  if (target === candidate || candidate.includes(target) || target.includes(candidate)) return true;
  const targetParts = String(targetArtist || '').split(/[,&/]+/).map(normalizeIdentity).filter((part) => part.length >= 2);
  return targetParts.some((part) => candidate.includes(part));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'artic-quarterly-media-resolver/1.0',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function resolveWithApple(album, artist) {
  const terms = getAppleSearchTerms(album, artist);
  const countries = ['KR', 'US'];

  for (const country of countries) {
    for (const term of terms) {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&country=${country}&limit=25`;
      const data = await fetchJson(url);
      const candidates = Array.isArray(data.results) ? data.results : [];
      const verified = candidates.find((candidate) => (
        albumMatches(album, candidate.collectionName)
        && artistMatches(artist, candidate.artistName)
        && candidate.artworkUrl100
        && candidate.collectionViewUrl
      ));
      if (verified) {
        return {
          source: 'Apple Music',
          provider: 'itunes-search',
          providerCountry: country,
          providerAlbumId: String(verified.collectionId || ''),
          album,
          artist,
          resolvedAlbum: verified.collectionName || '',
          resolvedArtist: verified.artistName || '',
          imageUrl: getHighResolutionAppleArtwork(verified.artworkUrl100),
          albumUrl: verified.collectionViewUrl,
          verified: true,
          matchStatus: 'verified',
          crawledAt: new Date().toISOString(),
        };
      }
    }
  }

  return null;
}

async function resolveManualApple(album, artist) {
  const manual = APPLE_MANUAL_ALBUM_IDS[makeManualKey(album, artist)];
  if (!manual) return null;
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(manual.collectionId)}&entity=album&country=${encodeURIComponent(manual.country || 'US')}`;
  const data = await fetchJson(url);
  const candidate = (data.results || []).find((item) => String(item.collectionId || '') === String(manual.collectionId));
  if (!candidate?.artworkUrl100 || !candidate?.collectionViewUrl) {
    throw new Error(`Manual Apple lookup did not return album artwork for ${manual.collectionId}`);
  }
  return {
    source: 'Apple Music',
    provider: 'manual-itunes-collection-id',
    providerCountry: manual.country || '',
    providerAlbumId: String(candidate.collectionId || manual.collectionId),
    album,
    artist,
    resolvedAlbum: candidate.collectionName || '',
    resolvedArtist: candidate.artistName || '',
    imageUrl: getHighResolutionAppleArtwork(candidate.artworkUrl100),
    albumUrl: candidate.collectionViewUrl,
    verified: true,
    matchStatus: 'verified_manual_id',
    note: manual.note,
    crawledAt: new Date().toISOString(),
  };
}

async function resolveManual(album, artist) {
  const manual = BUGS_MANUAL_ALBUM_IDS[makeManualKey(album, artist)];
  if (!manual) return null;
  const imageUrl = getBugsAlbumImageUrl(manual.albumId);
  const response = await fetch(imageUrl, { method: 'HEAD' });
  if (!response.ok) {
    throw new Error(`Manual Bugs image failed ${response.status}: ${imageUrl}`);
  }
  return {
    source: 'Bugs',
    provider: 'manual-bugs-album-id',
    providerAlbumId: manual.albumId,
    album,
    artist,
    resolvedAlbum: manual.resolvedAlbum,
    resolvedArtist: manual.resolvedArtist,
    imageUrl,
    albumUrl: manual.sourceUrl,
    verified: true,
    matchStatus: 'verified_manual_id',
    note: manual.note,
    crawledAt: new Date().toISOString(),
  };
}

async function run() {
  const args = parseArgs();
  const archivePath = path.resolve(args.archive || DEFAULT_ARCHIVE_PATH);
  const cachePath = path.resolve(args.cache || DEFAULT_MEDIA_CACHE_PATH);
  const missingOnly = args.missingOnly !== 'false';
  const archive = loadJson(archivePath, null);
  const mediaCache = loadJson(cachePath, { source: 'Quarterly media cache', albumArt: {}, artistImages: {} });
  mediaCache.albumArt = mediaCache.albumArt || {};
  mediaCache.artistImages = mediaCache.artistImages || {};
  const onlyKeys = new Set(String(args.keys || "").split(",").map((key) => key.trim()).filter(Boolean));

  const albums = extractAlbums(archive).filter((item) => {
    if (onlyKeys.size) return onlyKeys.has(item.key);
    if (!missingOnly) return true;
    return !mediaCache.albumArt[item.key]?.imageUrl;
  });

  console.log(`Quarterly verified album art resolver`);
  console.log(`Archive: ${archivePath}`);
  console.log(`Cache: ${cachePath}`);
  console.log(`Pending albums: ${albums.length}`);

  for (let i = 0; i < albums.length; i += 1) {
    const item = albums[i];
    console.log(`[${i + 1}/${albums.length}] ${item.artist} - ${item.album}`);
    try {
      const resolved = await resolveManual(item.album, item.artist)
        || await resolveManualApple(item.album, item.artist)
        || await resolveWithApple(item.album, item.artist);
      if (resolved) {
        mediaCache.albumArt[item.key] = resolved;
        console.log(`  -> ${resolved.source}: ${resolved.resolvedArtist} - ${resolved.resolvedAlbum}`);
      } else {
        mediaCache.albumArt[item.key] = {
          album: item.album,
          artist: item.artist,
          imageUrl: '',
          albumUrl: '',
          verified: false,
          matchStatus: 'unresolved',
          crawledAt: new Date().toISOString(),
          error: 'No verified album identity match from configured resolvers',
        };
        console.log('  -> unresolved');
      }
    } catch (err) {
      mediaCache.albumArt[item.key] = {
        album: item.album,
        artist: item.artist,
        imageUrl: '',
        albumUrl: '',
        verified: false,
        matchStatus: 'error',
        crawledAt: new Date().toISOString(),
        error: err.message,
      };
      console.warn(`  -> failed: ${err.message}`);
    }
    saveJson(cachePath, {
      ...mediaCache,
      source: 'Verified quarterly media cache',
      updatedAt: new Date().toISOString(),
    });
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
