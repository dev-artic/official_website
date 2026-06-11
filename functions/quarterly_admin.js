const {
  TIER_CANON,
  fetchQuarterlyContents,
  getHighResolutionMediaUrl,
  makeAlbumMediaKey,
  replaceNotionPagePlainText,
  updateNotionPageProperties,
  updateNotionTableRowCells,
} = require("./quarterly_notion");

const {
  applyQuarterlyYoutubeTracks,
  buildYoutubeTrackDiagnostics,
  flattenHighlightedTracks,
  parseHighlightedTracks,
  readQuarterlyYoutubeTrackOverrides,
  resolveYoutubeAlbumTracks,
  saveYoutubeTrackOverride,
} = require("./quarterly_youtube");

const MEDIA_OVERRIDE_COLLECTION = "quarterly_media_overrides";
const MEDIA_REVIEW_COLLECTION = "quarterly_media_review_overrides";
const MIN_COVER_SIDE_PX = 1000;
const BUGS_IMAGE_HOSTS = new Set(["image.bugsm.co.kr", "music.bugs.co.kr"]);
const BUGS_SOURCE_HOSTS = new Set(["music.bugs.co.kr", "www.bugs.co.kr", "bugs.co.kr"]);
const APPLE_IMAGE_HOSTS = new Set(["is1-ssl.mzstatic.com", "is2-ssl.mzstatic.com", "is3-ssl.mzstatic.com", "is4-ssl.mzstatic.com", "is5-ssl.mzstatic.com"]);
const APPLE_SOURCE_HOSTS = new Set(["music.apple.com"]);

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, "");
}

function normalizeIssueKey(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function getQuarterLabel(issue) {
  return [issue?.year, issue?.quarter].filter(Boolean).join(" ") || issue?.issue || "";
}

function flattenAlbums(issue) {
  return (issue.tiers || []).flatMap((tier) => (tier.items || []).map((item) => ({
    ...item,
    tierRank: tier.rank,
    tierLabel: tier.label,
    mediaKey: makeAlbumMediaKey(item.album, item.artist),
  })));
}

function parseQuarterFromIssue(issue) {
  const issueText = String(issue?.issue || `${issue?.year || ""} ${issue?.quarter || ""}`);
  const year = Number(issue?.year) || Number((issueText.match(/20\d{2}/) || [])[0]) || 0;
  const quarterMatch = issueText.match(/(?:Q|분기|\s)([1-4])|([1-4])\s*Q/i);
  const quarter = Number(issue?.quarter?.match?.(/[1-4]/)?.[0] || quarterMatch?.[1] || quarterMatch?.[2] || 0);
  return { year, quarter };
}

function nowItemMatchesIssue(item, issue) {
  const issueKeys = [issue?.issue, issue?.slug, getQuarterLabel(issue)].filter(Boolean).map(normalizeIssueKey);
  const itemKeys = [item?.issue, item?.issueSlug, item?.quarterLabel].filter(Boolean).map(normalizeIssueKey);
  if (itemKeys.some((key) => issueKeys.includes(key))) return true;

  const issueQuarter = parseQuarterFromIssue(issue);
  const itemQuarter = parseQuarterFromIssue(item);
  return issueQuarter.year && issueQuarter.quarter
    && issueQuarter.year === itemQuarter.year
    && issueQuarter.quarter === itemQuarter.quarter;
}

function buildMediaCacheWithOverrides(staticCache = null, overrides = null) {
  const base = staticCache && typeof staticCache === "object" ? JSON.parse(JSON.stringify(staticCache)) : {};
  base.albumArt = {
    ...(base.albums || {}),
    ...(base.albumArt || {}),
    ...(overrides?.albumArt || {}),
  };
  if (base.albums) delete base.albums;
  if (overrides?.updatedAt) base.firestoreOverrideUpdatedAt = overrides.updatedAt;
  return base;
}

function parseHttpUrl(value, fieldName) {
  try {
    const url = new URL(String(value || ""));
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("URL must use http or https.");
    }
    return url;
  } catch (err) {
    const error = new Error(`${fieldName} must be a valid URL.`);
    error.status = 400;
    throw error;
  }
}

function inferImageDimensionsFromUrl(value) {
  const url = String(value || "");
  const squarePathMatch = url.match(/\/(\d{2,5})x(\d{2,5})(?:bb)?\.[a-z0-9]+(?:[?#]|$)/i);
  if (squarePathMatch) {
    return {
      width: Number(squarePathMatch[1]),
      height: Number(squarePathMatch[2]),
      method: "url_path",
    };
  }

  const bugsSizeMatch = url.match(/\/(?:album|artist)\/images\/(\d{2,5})\//i);
  if (bugsSizeMatch) {
    const size = Number(bugsSizeMatch[1]);
    return {
      width: size,
      height: size,
      method: "bugs_path",
    };
  }

  const querySizeMatch = url.match(/[?&](?:w|width)=(\d{2,5}).*?[?&](?:h|height)=(\d{2,5})/i)
    || url.match(/[?&](?:h|height)=(\d{2,5}).*?[?&](?:w|width)=(\d{2,5})/i);
  if (querySizeMatch) {
    return {
      width: Number(querySizeMatch[1]),
      height: Number(querySizeMatch[2]),
      method: "query",
    };
  }

  return null;
}

function getImageSourceType(imageUrl = "", sourceUrl = "") {
  const urls = [imageUrl, sourceUrl].filter(Boolean);
  for (const item of urls) {
    try {
      const host = new URL(item).hostname;
      if (BUGS_IMAGE_HOSTS.has(host) || BUGS_SOURCE_HOSTS.has(host)) return "Bugs";
      if (APPLE_IMAGE_HOSTS.has(host) || APPLE_SOURCE_HOSTS.has(host)) return "Apple Music";
    } catch (err) {
      // Ignore malformed optional URLs here; write actions validate separately.
    }
  }
  return "External";
}

function isReviewResolved(review) {
  return review?.status === "resolved";
}

function buildCoverRecord(album, reviews = {}) {
  const mediaKey = album.mediaKey || makeAlbumMediaKey(album.album, album.artist);
  const imageUrl = album.imageUrl || "";
  const imageSourceUrl = album.imageSourceUrl || album.albumUrl || "";
  const dimensions = inferImageDimensionsFromUrl(imageUrl);
  const minSide = dimensions ? Math.min(dimensions.width, dimensions.height) : null;
  const sourceType = getImageSourceType(imageUrl, imageSourceUrl);
  const review = reviews[mediaKey] || null;

  return {
    album: album.album || "",
    artist: album.artist || "",
    tierRank: album.tierRank || null,
    tierLabel: album.tierLabel || "",
    mediaKey,
    imageUrl,
    imageSourceUrl,
    sourceType,
    dimensions,
    minSide,
    reviewStatus: review?.status || "",
    reviewNote: review?.note || "",
    reviewUpdatedAt: review?.updatedAt || "",
  };
}

function assertAllowedMediaUrl(imageUrl, sourceUrl = "") {
  const image = parseHttpUrl(imageUrl, "imageUrl");
  const allowedImageHost = BUGS_IMAGE_HOSTS.has(image.hostname) || APPLE_IMAGE_HOSTS.has(image.hostname);
  if (!allowedImageHost) {
    const error = new Error("Album cover overrides must use a Bugs or Apple Music image URL.");
    error.status = 400;
    throw error;
  }

  const dimensions = inferImageDimensionsFromUrl(imageUrl);
  if (dimensions && Math.min(dimensions.width, dimensions.height) < MIN_COVER_SIDE_PX) {
    const error = new Error(`Album cover image is below ${MIN_COVER_SIDE_PX}px on its shortest side.`);
    error.status = 400;
    throw error;
  }

  if (sourceUrl) {
    const source = parseHttpUrl(sourceUrl, "sourceUrl");
    const allowedSourceHost = BUGS_SOURCE_HOSTS.has(source.hostname) || APPLE_SOURCE_HOSTS.has(source.hostname);
    if (!allowedSourceHost) {
      const error = new Error("Album cover source URL must point to Bugs or Apple Music.");
      error.status = 400;
      throw error;
    }
  }
}

async function readQuarterlyMediaOverrides(db) {
  const snapshot = await db.collection(MEDIA_OVERRIDE_COLLECTION).get();
  const albumArt = {};
  let updatedAt = "";

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    if (!data.imageUrl) return;
    const key = data.mediaKey || doc.id;
    albumArt[key] = {
      album: data.album || "",
      artist: data.artist || "",
      imageUrl: getHighResolutionMediaUrl(data.imageUrl),
      albumUrl: data.albumUrl || data.sourceUrl || "",
      sourceUrl: data.sourceUrl || data.albumUrl || "",
      source: data.source || "Bugs",
      verified: data.verified !== false,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || "",
    };
    if (albumArt[key].updatedAt > updatedAt) updatedAt = albumArt[key].updatedAt;
  });

  return { source: "Firestore media overrides", updatedAt, albumArt };
}

async function readQuarterlyMediaReviewOverrides(db) {
  const snapshot = await db.collection(MEDIA_REVIEW_COLLECTION).get();
  const reviews = {};
  let updatedAt = "";

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const key = data.mediaKey || doc.id;
    reviews[key] = {
      mediaKey: key,
      album: data.album || "",
      artist: data.artist || "",
      status: data.status || "",
      note: data.note || "",
      sourceType: data.sourceType || "",
      dimensions: data.dimensions || null,
      imageUrl: data.imageUrl || "",
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || "",
      updatedBy: data.updatedBy || "",
    };
    if (reviews[key].updatedAt > updatedAt) updatedAt = reviews[key].updatedAt;
  });

  return { source: "Firestore media review overrides", updatedAt, reviews };
}

function buildIssueDiagnostics(issue, nowArticItems = [], mediaReviews = {}) {
  const albums = flattenAlbums(issue);
  const coverRecords = albums.map((album) => buildCoverRecord(album, mediaReviews));
  const missingCovers = coverRecords.filter((album) => !album.imageUrl && !isReviewResolved(mediaReviews[album.mediaKey]));
  const lowResolutionCovers = coverRecords.filter((album) => album.imageUrl && album.minSide !== null && album.minSide < MIN_COVER_SIDE_PX && !isReviewResolved(mediaReviews[album.mediaKey]));
  const reviewCovers = coverRecords.filter((album) => (
    album.imageUrl
    && album.minSide !== null
    && album.minSide >= MIN_COVER_SIDE_PX
    && album.sourceType !== "Bugs"
    && !isReviewResolved(mediaReviews[album.mediaKey])
  ));
  const unverifiedCovers = coverRecords.filter((album) => (
    album.imageUrl
    && album.minSide === null
    && !isReviewResolved(mediaReviews[album.mediaKey])
  ));
  const featuredArticles = issue.essays || [];
  const missingArticleBodies = featuredArticles.filter((essay) => !String(essay.content || "").trim());
  const matchedNowArtic = nowArticItems.filter((item) => nowItemMatchesIssue(item, issue));
  const warnings = [
    ...(issue.diagnostics?.warnings || []),
  ];

  const tracks = flattenHighlightedTracks(issue);
  const unresolvedTracks = tracks.filter((track) => !track.youtubeId);

  if ((issue.diagnostics?.tierHeadingCount || 0) < TIER_CANON.length) {
    warnings.push("Tier heading count is lower than the canonical 7-tier framework.");
  }
  if (missingCovers.length) {
    warnings.push(`${missingCovers.length} album cover(s) are missing.`);
  }
  if (lowResolutionCovers.length) {
    warnings.push(`${lowResolutionCovers.length} album cover(s) are below ${MIN_COVER_SIDE_PX}px on the shortest side.`);
  }
  if (missingArticleBodies.length) {
    warnings.push(`${missingArticleBodies.length} featured article(s) have no parsed body content.`);
  }
  if (unresolvedTracks.length) {
    warnings.push(`${unresolvedTracks.length} highlighted track(s) have no resolved YouTube audio.`);
  }

  return {
    issueId: issue.id,
    title: issue.title,
    slug: issue.slug,
    issue: issue.issue,
    date: issue.date,
    publicationStatus: issue.publicationStatus,
    sourceFormat: issue.sourceFormat,
    tierHeadingCount: issue.diagnostics?.tierHeadingCount || 0,
    nonEmptyTierCount: issue.diagnostics?.nonEmptyTierCount || 0,
    albumCount: albums.length,
    essayCount: featuredArticles.length,
    coverHealth: {
      total: albums.length,
      ready: albums.length - missingCovers.length - lowResolutionCovers.length,
      missing: missingCovers.length,
      lowResolution: lowResolutionCovers.length,
      review: reviewCovers.length,
      unverified: unverifiedCovers.length,
      minCoverSidePx: MIN_COVER_SIDE_PX,
      missingItems: missingCovers,
      lowResolutionItems: lowResolutionCovers,
      reviewItems: reviewCovers,
      unverifiedItems: unverifiedCovers,
    },
    articleHealth: {
      total: featuredArticles.length,
      ready: featuredArticles.length - missingArticleBodies.length,
      missingBody: missingArticleBodies.length,
    },
    nowArticHealth: {
      matchedCount: matchedNowArtic.length,
    },
    warnings,
  };
}

function buildQuarterlyAdminDiagnostics(archive, mediaReviews = {}) {
  const issues = (archive.issues || []).map((issue) => buildIssueDiagnostics(issue, archive.nowArtic || [], mediaReviews));
  const summary = issues.reduce((acc, issue) => {
    acc.issueCount += 1;
    acc.albumCount += issue.albumCount;
    acc.essayCount += issue.essayCount;
    acc.coverMissing += issue.coverHealth.missing;
    acc.coverLowResolution += issue.coverHealth.lowResolution;
    acc.coverReview += issue.coverHealth.review;
    acc.coverUnverified += issue.coverHealth.unverified;
    acc.articleMissingBody += issue.articleHealth.missingBody;
    acc.warningCount += issue.warnings.length;
    return acc;
  }, {
    issueCount: 0,
    albumCount: 0,
    essayCount: 0,
    coverMissing: 0,
    coverLowResolution: 0,
    coverReview: 0,
    coverUnverified: 0,
    articleMissingBody: 0,
    warningCount: 0,
  });

  return {
    summary,
    issues,
    generatedAt: new Date().toISOString(),
  };
}

async function getQuarterlyAdminPayload({ token, dataSourceId, db, mediaCache, nowArtic, externalLinks, youtubeApiKey = "", existingCache = null }) {
  const overrides = await readQuarterlyMediaOverrides(db);
  const reviewOverrides = await readQuarterlyMediaReviewOverrides(db);
  const youtubeOverrides = await readQuarterlyYoutubeTrackOverrides(db);
  const baseArchive = await fetchQuarterlyContents({
    token,
    dataSourceId,
    mediaCache: buildMediaCacheWithOverrides(mediaCache, overrides),
    nowArtic,
    externalLinks,
    includeSourceMetadata: true,
    existingCache,
  });
  const archive = applyQuarterlyYoutubeTracks(baseArchive, youtubeOverrides.tracks);
  const diagnostics = buildQuarterlyAdminDiagnostics(archive, reviewOverrides.reviews);
  diagnostics.youtubeTrackHealth = buildYoutubeTrackDiagnostics(archive);
  diagnostics.summary.youtubeTrackTotal = diagnostics.youtubeTrackHealth.summary.total;
  diagnostics.summary.youtubeTrackResolved = diagnostics.youtubeTrackHealth.summary.resolved;
  diagnostics.summary.youtubeTrackUnresolved = diagnostics.youtubeTrackHealth.summary.unresolved;

  return {
    archive,
    diagnostics,
    mediaOverrides: {
      count: Object.keys(overrides.albumArt || {}).length,
      updatedAt: overrides.updatedAt,
      collection: MEDIA_OVERRIDE_COLLECTION,
    },
    mediaReviewOverrides: {
      count: Object.keys(reviewOverrides.reviews || {}).length,
      updatedAt: reviewOverrides.updatedAt,
      collection: MEDIA_REVIEW_COLLECTION,
    },
    youtubeTrackOverrides: {
      count: Object.keys(youtubeOverrides.tracks || {}).length,
      updatedAt: youtubeOverrides.updatedAt,
      collection: "quarterly_youtube_track_overrides",
      resolverConfigured: Boolean(youtubeApiKey || process.env.MJ_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_DATA_API_KEY),
    },
  };
}

function extractBugsCandidatesFromHtml(html, album, artist) {
  const targetAlbum = normalize(album);
  const targetArtist = normalize(artist);
  const candidates = [];
  const seen = new Set();
  const linkRegex = /<a[^>]+href=["']([^"']*\/album\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html))) {
    const albumUrl = match[1].startsWith("http") ? match[1] : `https://music.bugs.co.kr${match[1]}`;
    const start = Math.max(0, match.index - 900);
    const end = Math.min(html.length, match.index + match[0].length + 1200);
    const context = html.slice(start, end);
    const imageMatch = context.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/i);
    if (!imageMatch) continue;

    const text = context
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const normalizedText = normalize(text);
    const albumMatched = Boolean(targetAlbum && normalizedText.includes(targetAlbum));
    const artistMatched = Boolean(targetArtist && normalizedText.includes(targetArtist));
    if (!albumMatched) continue;

    const imageUrl = getHighResolutionMediaUrl(imageMatch[1].startsWith("http")
      ? imageMatch[1]
      : `https:${imageMatch[1]}`);
    const key = `${albumUrl}::${imageUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      album,
      artist,
      albumUrl,
      imageUrl,
      source: "Bugs",
      score: 5 + (artistMatched ? 4 : 0),
      albumMatched,
      artistMatched,
      text: text.slice(0, 180),
    });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 5);
}

async function refreshBugsCoverCandidate({ album, artist }) {
  if (!album || !artist) {
    const error = new Error("Missing required fields (album, artist).");
    error.status = 400;
    throw error;
  }

  const queries = [
    `${artist} ${album}`,
    `${album} ${artist}`,
    album,
  ].filter(Boolean);
  const candidates = [];
  const seen = new Set();

  for (const query of queries) {
    const url = `https://music.bugs.co.kr/search/integrated?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; artic-admin/1.0)",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      },
    });
    const html = await response.text();
    extractBugsCandidatesFromHtml(html, album, artist).forEach((candidate) => {
      const key = `${candidate.albumUrl}::${candidate.imageUrl}`;
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push(candidate);
    });
    if (candidates.some((candidate) => candidate.artistMatched)) break;
  }

  return { candidates: candidates.slice(0, 5) };
}

async function handleQuarterlyAdminAction({ body, token, db, fieldValue, youtubeApiKey = "" }) {
  const action = body?.action;

  if (action === "save_album_cover_override") {
    const album = String(body.album || "").trim();
    const artist = String(body.artist || "").trim();
    const imageUrl = getHighResolutionMediaUrl(body.imageUrl);
    const sourceUrl = body.sourceUrl || body.albumUrl || "";
    if (!album || !artist || !imageUrl) {
      const error = new Error("Missing required fields (album, artist, imageUrl).");
      error.status = 400;
      throw error;
    }
    assertAllowedMediaUrl(imageUrl, sourceUrl);

    const mediaKey = body.mediaKey || makeAlbumMediaKey(album, artist);
    const payload = {
      mediaKey,
      album,
      artist,
      imageUrl,
      albumUrl: sourceUrl,
      sourceUrl,
      source: body.source || "Bugs",
      verified: body.verified !== false,
      updatedAt: fieldValue.serverTimestamp(),
      updatedBy: "admin-dashboard",
    };
    await db.collection(MEDIA_OVERRIDE_COLLECTION).doc(mediaKey).set(payload, { merge: true });
    return { success: true, mediaKey, override: { ...payload, updatedAt: new Date().toISOString() } };
  }

  if (action === "refresh_bugs_cover_candidate") {
    return refreshBugsCoverCandidate(body);
  }

  if (action === "refresh_youtube_track_candidates") {
    return resolveYoutubeAlbumTracks({
      album: String(body.album || "").trim(),
      artist: String(body.artist || "").trim(),
      tracks: body.tracks || "",
      apiKey: youtubeApiKey,
    });
  }

  if (action === "save_youtube_track_override") {
    return saveYoutubeTrackOverride({ db, fieldValue, payload: body });
  }

  if (action === "save_cover_review_status") {
    const album = String(body.album || "").trim();
    const artist = String(body.artist || "").trim();
    const mediaKey = body.mediaKey || makeAlbumMediaKey(album, artist);
    const status = String(body.status || "").trim();
    if (!album || !artist || !mediaKey || !["resolved", "needs_review"].includes(status)) {
      const error = new Error("Missing required fields (album, artist, mediaKey, status).");
      error.status = 400;
      throw error;
    }

    const payload = {
      mediaKey,
      album,
      artist,
      status,
      note: String(body.note || "").slice(0, 500),
      sourceType: body.sourceType || "",
      dimensions: body.dimensions || null,
      imageUrl: body.imageUrl || "",
      updatedAt: fieldValue.serverTimestamp(),
      updatedBy: "admin-dashboard",
    };
    await db.collection(MEDIA_REVIEW_COLLECTION).doc(mediaKey).set(payload, { merge: true });
    return { success: true, mediaKey, review: { ...payload, updatedAt: new Date().toISOString() } };
  }

  if (action === "save_album_row_metadata") {
    const rowBlockId = String(body.rowBlockId || "").trim();
    const fields = body.fields || {};
    const columnIndexes = body.columnIndexes || {};
    if (!rowBlockId) {
      const error = new Error("Missing required field (rowBlockId).");
      error.status = 400;
      throw error;
    }

    const allowedFields = new Set(["album", "artist", "genre", "releaseDate", "comment", "tracks", "note"]);
    const updatesByIndex = {};
    const expectedCells = {};
    Object.entries(fields).forEach(([field, value]) => {
      if (!allowedFields.has(field)) return;
      const index = Number(columnIndexes[field]);
      if (!Number.isInteger(index) || index < 0) return;
      updatesByIndex[index] = String(value || "").trim();
      if (body.expectedValues && Object.prototype.hasOwnProperty.call(body.expectedValues, field)) {
        expectedCells[index] = body.expectedValues[field] || "";
      }
    });

    if (!Object.keys(updatesByIndex).length) {
      const error = new Error("No supported album metadata fields were provided.");
      error.status = 400;
      throw error;
    }

    const result = await updateNotionTableRowCells(token, rowBlockId, updatesByIndex, {
      expectedLastEditedTime: body.expectedLastEditedTime || "",
      expectedCells,
    });

    const nextAlbum = String(fields.album || body.expectedValues?.album || "").trim();
    const nextArtist = String(fields.artist || body.expectedValues?.artist || "").trim();
    const previousMediaKey = String(body.previousMediaKey || "").trim();
    const nextMediaKey = nextAlbum && nextArtist ? makeAlbumMediaKey(nextAlbum, nextArtist) : "";
    const response = {
      success: true,
      rowBlockId: result.id,
      mediaKey: nextMediaKey,
      coverPreserved: false,
    };

    if (body.preserveCover !== false && previousMediaKey && nextMediaKey && previousMediaKey !== nextMediaKey && body.imageUrl) {
      try {
        const imageUrl = getHighResolutionMediaUrl(body.imageUrl);
        const sourceUrl = body.sourceUrl || body.albumUrl || "";
        assertAllowedMediaUrl(imageUrl, sourceUrl);
        const payload = {
          mediaKey: nextMediaKey,
          album: nextAlbum,
          artist: nextArtist,
          imageUrl,
          albumUrl: sourceUrl,
          sourceUrl,
          source: body.source || "Bugs",
          verified: true,
          migratedFromMediaKey: previousMediaKey,
          updatedAt: fieldValue.serverTimestamp(),
          updatedBy: "admin-dashboard",
        };
        await db.collection(MEDIA_OVERRIDE_COLLECTION).doc(nextMediaKey).set(payload, { merge: true });
        response.coverPreserved = true;
      } catch (err) {
        response.coverPreserveWarning = err.message;
      }
    }

    return response;
  }

  if (action === "save_article_content") {
    const pageId = body.pageId || body.essayId;
    const content = String(body.content || "").trim();
    if (!pageId) {
      const error = new Error("Missing required field (pageId).");
      error.status = 400;
      throw error;
    }
    if (!content && body.allowEmpty !== true) {
      const error = new Error("Refusing to save an empty article body.");
      error.status = 400;
      throw error;
    }
    const result = await replaceNotionPagePlainText(token, pageId, content, {
      expectedTitle: body.expectedTitle || "",
      expectedLastEditedTime: body.expectedLastEditedTime || "",
    });
    return { success: true, ...result };
  }

  if (action === "save_issue_properties") {
    const pageId = body.pageId || body.issueId;
    if (!pageId) {
      const error = new Error("Missing required field (pageId).");
      error.status = 400;
      throw error;
    }
    const result = await updateNotionPageProperties(token, pageId, body.properties || {}, {
      expectedTitle: body.expectedTitle || "",
      expectedLastEditedTime: body.expectedLastEditedTime || "",
    });
    return { success: true, pageId: result.id };
  }

  if (action === "batch_auto_resolve_youtube_tracks") {
    const issueId = String(body.issueId || "").trim();
    if (!issueId) {
      const error = new Error("Missing required field (issueId).");
      error.status = 400;
      throw error;
    }

    let archive = null;
    try {
      const cacheDoc = await db.collection("quarterly_cache").doc("archive").get();
      if (cacheDoc.exists) {
        archive = cacheDoc.data()?.archive || null;
      }
    } catch (cacheErr) {
      console.warn("Failed to read quarterly cache for batch resolve:", cacheErr.message);
    }

    if (!archive) {
      const error = new Error("Quarterly cache not found. Load admin dashboard first.");
      error.status = 404;
      throw error;
    }

    const issue = (archive.issues || []).find((is) => is.id === issueId);
    if (!issue) {
      const error = new Error("Selected quarterly issue not found.");
      error.status = 404;
      throw error;
    }

    const youtubeOverrides = await readQuarterlyYoutubeTrackOverrides(db);
    const overriddenKeys = new Set(Object.keys(youtubeOverrides.tracks || {}));

    const albums = [];
    (issue.tiers || []).forEach((tier) => {
      (tier.items || []).forEach((item) => {
        albums.push(item);
      });
    });

    let resolvedCount = 0;
    const errors = [];

    for (const album of albums) {
      const parsedTracks = parseHighlightedTracks(album.tracks, album.album, album.artist);
      const unresolvedTracks = parsedTracks.filter((track) => {
        if (track.youtubeId) return false;
        if (overriddenKeys.has(track.trackKey)) return false;
        return true;
      });

      if (unresolvedTracks.length === 0) continue;

      try {
        const result = await resolveYoutubeAlbumTracks({
          album: album.album,
          artist: album.artist,
          tracks: album.tracks || "",
          apiKey: youtubeApiKey,
        });

        for (const candidate of result.candidates || []) {
          const isUnresolved = unresolvedTracks.some((ut) => ut.trackKey === candidate.trackKey);
          if (isUnresolved && candidate.confidence === "high" && candidate.youtubeId) {
            await saveYoutubeTrackOverride({
              db,
              fieldValue,
              payload: {
                ...candidate,
                updatedBy: "admin-batch-auto-resolve",
              },
            });
            resolvedCount++;
          }
        }
      } catch (err) {
        console.error(`Failed to batch resolve album "${album.album}" by "${album.artist}":`, err.message);
        errors.push(`${album.album}: ${err.message}`);
      }
    }

    return {
      success: true,
      resolvedCount,
      errors: errors.length ? errors : null,
    };
  }

  const error = new Error("Unsupported quarterly admin action.");
  error.status = 400;
  throw error;
}

module.exports = {
  MEDIA_OVERRIDE_COLLECTION,
  MEDIA_REVIEW_COLLECTION,
  buildMediaCacheWithOverrides,
  buildQuarterlyAdminDiagnostics,
  getQuarterlyAdminPayload,
  handleQuarterlyAdminAction,
  readQuarterlyMediaOverrides,
  readQuarterlyMediaReviewOverrides,
};
