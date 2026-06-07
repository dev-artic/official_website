const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_ARCHIVE_PATH = path.join(ROOT_DIR, 'scratch', 'quarterly_contents_snapshot.json');
const DEFAULT_CACHE_PATH = path.join(ROOT_DIR, 'scratch', 'bugs_album_art_cache.json');
const BUGS_SEARCH_TIMEOUT_MS = 20000;

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    const [key, ...rest] = arg.split('=');
    if (key.startsWith('--')) {
      args[key.slice(2)] = rest.join('=');
    }
  });
  return args;
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '');
}

function makeCacheKey(album, artist) {
  return `${normalize(artist)}::${normalize(album)}`;
}

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

function getHighResolutionBugsImageUrl(url) {
  return String(url || '')
    .replace(/\/album\/images\/\d+\//, '/album/images/1000/')
    .replace(/\/artist\/images\/\d+\//, '/artist/images/1000/');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addUnique(items, value) {
  const normalized = String(value || '').trim();
  if (normalized && !items.includes(normalized)) items.push(normalized);
}

function getArtistQueryVariants(artist) {
  const variants = [];
  const original = String(artist || '').trim();
  addUnique(variants, original);
  addUnique(variants, original.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' '));

  const parentheticalMatches = Array.from(original.matchAll(/\(([^)]+)\)/g));
  parentheticalMatches.forEach((match) => addUnique(variants, match[1]));

  return variants;
}

function getAlbumQueryVariants(album, artist) {
  const variants = [];
  getArtistQueryVariants(artist).forEach((artistVariant) => {
    addUnique(variants, JSON.stringify({ query: `${artistVariant} ${album}`, artist: artistVariant }));
    addUnique(variants, JSON.stringify({ query: `${album} ${artistVariant}`, artist: artistVariant }));
  });
  addUnique(variants, JSON.stringify({ query: album, artist: '' }));
  return variants.map((value) => JSON.parse(value));
}

function hasValue(value) {
  const normalized = String(value || '').trim();
  return normalized && !['없음', 'none', 'n/a', '-'].includes(normalized.toLowerCase());
}

function findEssayAlbum(issue, essay, albums) {
  const essayAlbum = normalize(essay.album);
  const essayArtist = normalize(essay.artist);
  if (essayAlbum || essayArtist) {
    const directMatch = albums.find((item) => {
      const albumMatches = !essayAlbum || normalize(item.album) === essayAlbum;
      const artistMatches = !essayArtist || normalize(item.artist) === essayArtist;
      return albumMatches && artistMatches;
    });
    if (directMatch) return directMatch;
  }

  const title = normalize(essay.title);
  return albums.find((item) => {
    const tierMatches = !essay.tierRank || Number(item.tierRank) === Number(essay.tierRank);
    const titleMatches = title.includes(normalize(item.album)) || title.includes(normalize(item.artist));
    return hasValue(item.companionEssay) && tierMatches && titleMatches;
  }) || albums.find((item) => hasValue(item.companionEssay) && (!essay.tierRank || Number(item.tierRank) === Number(essay.tierRank)));
}

function collectAlbums(archive) {
  const albums = [];
  const seen = new Set();

  (archive.issues || []).forEach((issue) => {
    (issue.tiers || []).forEach((tier) => {
      (tier.items || []).forEach((item) => {
        const album = String(item.album || '').trim();
        const artist = String(item.artist || '').trim();
        if (!album || !artist) return;

        const key = makeCacheKey(album, artist);
        if (seen.has(key)) return;
        seen.add(key);
        albums.push({ album, artist });
      });
    });
  });

  return albums;
}

function collectFeaturedArtists(archive) {
  const artists = [];
  const seen = new Set();

  (archive.issues || []).forEach((issue) => {
    const albums = [];
    (issue.tiers || []).forEach((tier) => {
      (tier.items || []).forEach((item) => {
        if (item.album && item.artist) {
          albums.push({
            ...item,
            tierRank: tier.rank,
            tierLabel: tier.label,
          });
        }
      });
    });

    (issue.essays || []).forEach((essay) => {
      const album = findEssayAlbum(issue, essay, albums);
      const artist = String(album?.artist || '').trim();
      if (!artist) return;
      const key = normalize(artist);
      if (seen.has(key)) return;
      seen.add(key);
      artists.push({ artist, album: album.album });
    });
  });

  return artists;
}

async function searchBugsAlbum(page, album, artist) {
  const queries = getAlbumQueryVariants(album, artist);
  let bestCandidate = null;

  for (const { query, artist: queryArtist } of queries) {
    const searchUrl = `https://music.bugs.co.kr/search/integrated?q=${encodeURIComponent(query)}`;

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: BUGS_SEARCH_TIMEOUT_MS });
    await wait(1200);

    const result = await page.evaluate(({ album, artist }) => {
      const norm = (value) => String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]/g, '');
      const targetAlbum = norm(album);
      const targetArtist = norm(artist);

      function readCandidate(container) {
        const albumLink = container.matches?.('a[href*="/album/"]')
          ? container
          : container.querySelector('a[href*="/album/"]');
        const image = container.matches?.('img') ? container : container.querySelector('img');
        const text = container.textContent || '';
        const imageSrc = image?.getAttribute('src') || image?.getAttribute('data-src') || '';
        const imageAlt = image?.getAttribute('alt') || '';
        const albumUrl = albumLink?.href || '';

        return {
          text,
          imageAlt,
          imageUrl: imageSrc ? new URL(imageSrc, location.href).href : '',
          albumUrl,
          score: 0,
          albumMatched: false,
          artistMatched: false,
        };
      }

      const containers = Array.from(document.querySelectorAll([
        'table.list.albumList tbody tr',
        'table.list.trackList tbody tr',
        'ul.listAlbum li',
        '.albumList li',
        'section[data-comments="앨범"] li',
        'section[data-comments="앨범"] tr',
        '#container li',
        '#container tr',
        '#container a[href*="/album/"]'
      ].join(',')));

      const candidates = containers.map((container) => {
        const candidate = readCandidate(container);
        const normalizedText = norm(`${candidate.text} ${candidate.imageAlt}`);
        candidate.albumMatched = Boolean(targetAlbum && normalizedText.includes(targetAlbum));
        candidate.artistMatched = Boolean(targetArtist && normalizedText.includes(targetArtist));
        if (candidate.albumMatched) candidate.score += 4;
        if (candidate.artistMatched) candidate.score += 3;
        if (candidate.imageUrl) candidate.score += 1;
        if (candidate.albumUrl) candidate.score += 1;
        return candidate;
      }).filter((candidate) => candidate.imageUrl && candidate.albumUrl && candidate.albumMatched);

      candidates.sort((a, b) => b.score - a.score);
      return candidates[0] || null;
    }, { album, artist: queryArtist });

    if (result?.imageUrl && (!bestCandidate || result.score > bestCandidate.score)) {
      bestCandidate = result;
      if (result.artistMatched) break;
    }
  }

  return bestCandidate;
}

async function searchBugsArtist(page, artist) {
  const queries = Array.from(new Set([
    artist,
    String(artist || '').replace(/\s+/g, ''),
  ].map((query) => query.trim()).filter(Boolean)));

  for (const query of queries) {
    const searchUrl = `https://music.bugs.co.kr/search/integrated?q=${encodeURIComponent(query)}`;

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: BUGS_SEARCH_TIMEOUT_MS });
    await wait(1200);

    const result = await page.evaluate(({ artist }) => {
      const norm = (value) => String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]/g, '');
      const targetArtist = norm(artist);

      function readCandidate(container) {
        const artistLink = container.querySelector('a[href*="/artist/"]');
        const image = container.querySelector('img');
        const text = container.textContent || '';
        const imageSrc = image?.getAttribute('src') || image?.getAttribute('data-src') || '';
        const artistUrl = artistLink?.href || '';

        return {
          text,
          imageUrl: imageSrc ? new URL(imageSrc, location.href).href : '',
          artistUrl,
          score: 0,
        };
      }

      const containers = Array.from(document.querySelectorAll([
        'table.list.artistList tbody tr',
        'ul.listArtist li',
        '.artistList li',
        'section[data-comments="아티스트"] li',
        'section[data-comments="아티스트"] tr',
        '#container a[href*="/artist/"]'
      ].join(',')));

      const candidates = containers.map((container) => {
        const candidate = readCandidate(container);
        const normalizedText = norm(candidate.text);
        if (normalizedText.includes(targetArtist)) candidate.score += 4;
        if (candidate.imageUrl) candidate.score += 1;
        if (candidate.artistUrl) candidate.score += 1;
        return candidate;
      }).filter((candidate) => candidate.imageUrl && candidate.artistUrl);

      candidates.sort((a, b) => b.score - a.score);
      return candidates[0] || null;
    }, { artist });

    if (result?.imageUrl) return result;
  }

  return null;
}

function applyCacheToArchive(archive, cache) {
  (archive.issues || []).forEach((issue) => {
    (issue.tiers || []).forEach((tier) => {
      (tier.items || []).forEach((item) => {
        const key = makeCacheKey(item.album, item.artist);
        const cached = cache[key];
        if (!cached) return;
        item.imageUrl = cached.imageUrl || item.imageUrl || '';
        item.imageSourceUrl = cached.albumUrl || item.imageSourceUrl || '';
        item.imageSource = 'Bugs';
      });
    });
  });
  return archive;
}

function applyArtistCacheToArchive(archive, cache) {
  (archive.issues || []).forEach((issue) => {
    const albums = [];
    (issue.tiers || []).forEach((tier) => {
      (tier.items || []).forEach((item) => {
        if (item.album && item.artist) {
          albums.push({
            ...item,
            tierRank: tier.rank,
            tierLabel: tier.label,
          });
        }
      });
    });

    (issue.essays || []).forEach((essay) => {
      const album = findEssayAlbum(issue, essay, albums);
      const cached = cache[normalize(album?.artist)];
      if (!cached) return;
      essay.artistImageUrl = cached.imageUrl || essay.artistImageUrl || '';
      essay.artistImageSourceUrl = cached.artistUrl || essay.artistImageSourceUrl || '';
      if (album) {
        album.artistImageUrl = cached.imageUrl || album.artistImageUrl || '';
        album.artistImageSourceUrl = cached.artistUrl || album.artistImageSourceUrl || '';
      }
    });
  });
  return archive;
}

async function run() {
  const args = parseArgs();
  const archivePath = path.resolve(args.archive || DEFAULT_ARCHIVE_PATH);
  const cachePath = path.resolve(args.cache || DEFAULT_CACHE_PATH);
  const artistCachePath = path.resolve(args.artistCache || path.join(ROOT_DIR, 'scratch', 'bugs_artist_image_cache.json'));
  const limit = args.limit ? Number(args.limit) : Infinity;
  const retryMissing = args.retryMissing === 'true' || args.retryMissing === '1';
  const missingOnly = args.missingOnly === 'true' || args.missingOnly === '1';
  const includeArtists = args.artists !== 'false';

  const archive = loadJson(archivePath, null);
  if (!archive) {
    throw new Error(`Archive JSON not found: ${archivePath}`);
  }

  const cache = loadJson(cachePath, {});
  const albums = collectAlbums(archive).filter(({ album, artist }) => {
    const cached = cache[makeCacheKey(album, artist)];
    if (missingOnly) {
      return !cached?.imageUrl;
    }
    return !cached || (retryMissing && !cached.imageUrl);
  }).slice(0, limit);
  const artistCache = loadJson(artistCachePath, {});
  const artists = includeArtists
    ? collectFeaturedArtists(archive).filter(({ artist }) => !artistCache[normalize(artist)]?.imageUrl)
    : [];

  console.log(`Bugs Album Art Crawler`);
  console.log(`Archive: ${archivePath}`);
  console.log(`Cache: ${cachePath}`);
  console.log(`Pending albums: ${albums.length}`);
  console.log(`Pending featured artists: ${artists.length}`);

  if (!albums.length && !artists.length) {
    applyCacheToArchive(archive, cache);
    applyArtistCacheToArchive(archive, artistCache);
    saveJson(archivePath, archive);
    console.log('No pending albums. Archive refreshed from existing cache.');
    return;
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(BUGS_SEARCH_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(BUGS_SEARCH_TIMEOUT_MS);
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    for (let i = 0; i < albums.length; i += 1) {
      const { album, artist } = albums[i];
      const key = makeCacheKey(album, artist);
      console.log(`[${i + 1}/${albums.length}] ${artist} - ${album}`);

      try {
        const result = await searchBugsAlbum(page, album, artist);
        if (result?.imageUrl) {
          cache[key] = {
            album,
            artist,
            imageUrl: getHighResolutionBugsImageUrl(result.imageUrl),
            albumUrl: result.albumUrl,
            crawledAt: new Date().toISOString(),
          };
          console.log(`  -> ${result.imageUrl}`);
        } else {
          cache[key] = {
            album,
            artist,
            imageUrl: '',
            albumUrl: '',
            crawledAt: new Date().toISOString(),
            error: 'No Bugs album image found',
          };
          console.log('  -> no image found');
        }
      } catch (err) {
        cache[key] = {
          album,
          artist,
          imageUrl: '',
          albumUrl: '',
          crawledAt: new Date().toISOString(),
          error: err.message,
        };
        console.warn(`  -> failed: ${err.message}`);
      }

      saveJson(cachePath, cache);
      await new Promise((resolve) => setTimeout(resolve, 900));
    }

    for (let i = 0; i < artists.length; i += 1) {
      const { artist } = artists[i];
      const key = normalize(artist);
      console.log(`[artist ${i + 1}/${artists.length}] ${artist}`);

      try {
        const result = await searchBugsArtist(page, artist);
        if (result?.imageUrl) {
          artistCache[key] = {
            artist,
            imageUrl: getHighResolutionBugsImageUrl(result.imageUrl),
            artistUrl: result.artistUrl,
            crawledAt: new Date().toISOString(),
          };
          console.log(`  -> ${result.imageUrl}`);
        } else {
          artistCache[key] = {
            artist,
            imageUrl: '',
            artistUrl: '',
            crawledAt: new Date().toISOString(),
            error: 'No Bugs artist image found',
          };
          console.log('  -> no image found');
        }
      } catch (err) {
        artistCache[key] = {
          artist,
          imageUrl: '',
          artistUrl: '',
          crawledAt: new Date().toISOString(),
          error: err.message,
        };
        console.warn(`  -> failed: ${err.message}`);
      }

      saveJson(artistCachePath, artistCache);
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
  } finally {
    await browser.close();
  }

  applyCacheToArchive(archive, cache);
  applyArtistCacheToArchive(archive, artistCache);
  saveJson(archivePath, archive);
  console.log('Archive updated with Bugs album art cache.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
