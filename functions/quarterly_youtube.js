const YOUTUBE_TRACK_COLLECTION = "quarterly_youtube_track_overrides";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const NEGATIVE_VIDEO_TERMS = /\b(cover|karaoke|reaction|instrumental|slowed|sped\s*up|nightcore|loop|1\s*hour|full\s*album|playlist|teaser)\b|가사|커버|노래방/i;
const MUSIC_VIDEO_TERMS = /\b(mv|music\s*video|official\s*video)\b/i;

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\([^)]*(official|audio|topic|provided to youtube|visualizer)[^)]*\)/gi, " ")
    .replace(/\[[^\]]*(official|audio|topic|provided to youtube|visualizer)[^\]]*\]/gi, " ")
    .replace(/(?:official\s*)?(?:audio|mv|music\s*video|visualizer|lyrics?|topic)/gi, " ")
    .replace(/[^a-z0-9가-힣]/g, "");
}

function padTrackNumber(value) {
  const numeric = Number.parseInt(String(value || "").replace(/\D/g, ""), 10);
  if (!numeric) return String(value || "").trim() || "01";
  return numeric < 10 ? `0${numeric}` : String(numeric);
}

function makeAlbumKey(album, artist) {
  return `${normalize(artist)}::${normalize(album)}`;
}

function makeTrackKey({ album, artist, number, title }) {
  return `${makeAlbumKey(album, artist)}::${padTrackNumber(number)}::${normalize(title)}`;
}

function extractYouTubeVideoId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const bracket = raw.match(/\[youtube:([a-zA-Z0-9_-]{11})\]/i);
  if (bracket) return bracket[1];
  const short = raw.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (short) return short[1];
  const watch = raw.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
  if (watch) return watch[1];
  const embed = raw.match(/youtube\.com\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/i);
  if (embed) return embed[1];
  return /^[a-zA-Z0-9_-]{11}$/.test(raw) ? raw : "";
}

function extractTrackMedia(rawValue) {
  const raw = String(rawValue || "");
  const urlMatch = raw.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s)\]]+/i);
  const bracketMatch = raw.match(/\[youtube:[a-zA-Z0-9_-]{11}\]/i);
  const youtubeId = extractYouTubeVideoId(urlMatch?.[0] || bracketMatch?.[0] || "");
  const title = raw
    .replace(urlMatch?.[0] || "", "")
    .replace(bracketMatch?.[0] || "", "")
    .trim();
  return { title, youtubeId };
}

function parseTrackToken(token, index, album = "", artist = "") {
  const media = extractTrackMedia(token);
  const raw = media.title.trim();
  const numbered = raw.match(/^#?\s*([0-9]+)\s+(.+)$/);
  const number = numbered ? padTrackNumber(numbered[1]) : padTrackNumber(index + 1);
  const title = numbered ? numbered[2].trim() : raw;
  return {
    album,
    artist,
    number,
    title,
    youtubeId: media.youtubeId,
    trackKey: makeTrackKey({ album, artist, number, title }),
  };
}

function parseHighlightedTracks(value, album = "", artist = "") {
  const sortTracks = (tracks) => tracks
    .map((track, order) => ({
      ...track,
      _order: order,
      _sortNumber: Number.parseInt(String(track.number || "").replace(/\D/g, ""), 10),
    }))
    .sort((a, b) => {
      const aNumber = Number.isFinite(a._sortNumber) ? a._sortNumber : Number.MAX_SAFE_INTEGER;
      const bNumber = Number.isFinite(b._sortNumber) ? b._sortNumber : Number.MAX_SAFE_INTEGER;
      return aNumber === bNumber ? a._order - b._order : aNumber - bNumber;
    })
    .map(({ _order, _sortNumber, ...track }) => track);

  if (Array.isArray(value)) {
    return sortTracks(value.map((track, index) => {
      if (typeof track === "string") return parseTrackToken(track, index, album, artist);
      const number = padTrackNumber(track.number || track.trackNumber || index + 1);
      const title = String(track.title || track.name || track.track || "").trim();
      return {
        ...track,
        album: track.album || album,
        artist: track.artist || artist,
        number,
        title,
        youtubeId: track.youtubeId || track.youtubeVideoId || track.videoId || extractYouTubeVideoId(track.youtubeUrl || track.youtube || track.videoUrl || track.url || ""),
        trackKey: track.trackKey || makeTrackKey({ album, artist, number, title }),
      };
    }).filter((track) => track.title));
  }

  const raw = String(value || "").trim();
  if (!raw || /^없음$/i.test(raw)) return [];
  return sortTracks(raw
    .split(/\s+\/\s+|\n+/)
    .map((item, index) => parseTrackToken(item, index, album, artist))
    .filter((track) => track.title));
}

async function readQuarterlyYoutubeTrackOverrides(db) {
  const snapshot = await db.collection(YOUTUBE_TRACK_COLLECTION).get();
  const tracks = {};
  let updatedAt = "";

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const key = data.trackKey || doc.id;
    if (!data.youtubeId) return;
    tracks[key] = {
      trackKey: key,
      album: data.album || "",
      artist: data.artist || "",
      number: data.number || "",
      title: data.title || "",
      youtubeId: data.youtubeId || "",
      videoTitle: data.videoTitle || "",
      channelTitle: data.channelTitle || "",
      playlistId: data.playlistId || "",
      playlistTitle: data.playlistTitle || "",
      status: data.status || "resolved",
      confidence: data.confidence || "",
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || "",
      updatedBy: data.updatedBy || "",
    };
    if (tracks[key].updatedAt > updatedAt) updatedAt = tracks[key].updatedAt;
  });

  return { source: "Firestore YouTube track overrides", updatedAt, tracks };
}

function applyQuarterlyYoutubeTracks(archive, youtubeTracks = {}) {
  const clone = JSON.parse(JSON.stringify(archive || {}));
  (clone.issues || []).forEach((issue) => {
    (issue.tiers || []).forEach((tier) => {
      (tier.items || []).forEach((item) => {
        const parsed = parseHighlightedTracks(item.tracks, item.album, item.artist);
        item.highlightedTracks = parsed.map((track) => {
          const override = youtubeTracks[track.trackKey] || null;
          return {
            ...track,
            youtubeId: track.youtubeId || override?.youtubeId || "",
            videoTitle: override?.videoTitle || "",
            channelTitle: override?.channelTitle || "",
            playlistId: override?.playlistId || "",
            playlistTitle: override?.playlistTitle || "",
            audioStatus: track.youtubeId || override?.youtubeId ? "resolved" : "unresolved",
          };
        });
      });
    });
  });
  return clone;
}

function flattenHighlightedTracks(issue) {
  return (issue.tiers || []).flatMap((tier) => (tier.items || []).flatMap((item) => {
    const tracks = item.highlightedTracks || parseHighlightedTracks(item.tracks, item.album, item.artist);
    return tracks.map((track) => ({
      ...track,
      album: item.album || track.album || "",
      artist: item.artist || track.artist || "",
      tierRank: tier.rank,
      tierLabel: tier.label,
      trackKey: track.trackKey || makeTrackKey({
        album: item.album || track.album || "",
        artist: item.artist || track.artist || "",
        number: track.number,
        title: track.title,
      }),
    }));
  }));
}

function buildYoutubeTrackDiagnostics(archive) {
  const issues = (archive.issues || []).map((issue) => {
    const tracks = flattenHighlightedTracks(issue);
    const unresolvedItems = tracks.filter((track) => !track.youtubeId);
    const resolvedItems = tracks.filter((track) => track.youtubeId);
    return {
      issueId: issue.id,
      total: tracks.length,
      resolved: resolvedItems.length,
      unresolved: unresolvedItems.length,
      unresolvedItems,
    };
  });
  const summary = issues.reduce((acc, issue) => {
    acc.total += issue.total;
    acc.resolved += issue.resolved;
    acc.unresolved += issue.unresolved;
    return acc;
  }, { total: 0, resolved: 0, unresolved: 0 });
  return { summary, issues };
}

function getYouTubeApiKey(secretValue = "") {
  return secretValue || process.env.MJ_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_DATA_API_KEY || "";
}

async function youtubeApi(pathname, params, apiKey) {
  const url = new URL(`${YOUTUBE_API_BASE}${pathname}`);
  Object.entries({ ...params, key: apiKey }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `YouTube API request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function scorePlaylist(candidate, album, artist) {
  const title = normalize(candidate.title);
  const channel = normalize(candidate.channelTitle);
  const albumKey = normalize(album);
  const artistKey = normalize(artist);
  let score = 0;
  if (albumKey && title.includes(albumKey)) score += 8;
  if (artistKey && title.includes(artistKey)) score += 5;
  if (artistKey && channel.includes(artistKey)) score += 4;
  if (/topic/i.test(candidate.channelTitle || "")) score += 2;
  if (/album|full|playlist/i.test(candidate.title || "")) score += 1;
  return score;
}

function cleanVideoTitle(value, artist = "") {
  return String(value || "")
    .replace(/\s*-\s*Topic\s*$/i, "")
    .replace(new RegExp(`^\\s*${String(artist || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[-–—]\\s*`, "i"), "")
    .replace(/\s*\([^)]*(official|audio|provided to youtube|topic)[^)]*\)\s*/gi, " ")
    .replace(/\s*\[[^\]]*(official|audio|provided to youtube|topic)[^\]]*\]\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getOfficialSourceScore(candidate, artist) {
  const channelTitle = String(candidate.channelTitle || "");
  const description = String(candidate.description || "");
  const title = String(candidate.title || candidate.videoTitle || "");
  const channel = normalize(channelTitle);
  const artistKey = normalize(artist);
  let score = 0;
  const signals = [];

  if (artistKey && (channel === `${artistKey}topic` || channel === `${artistKey}official`)) {
    score += 16;
    signals.push("artist-channel-exact");
  } else if (artistKey && channel.includes(artistKey) && /topic/i.test(channelTitle)) {
    score += 14;
    signals.push("artist-topic-channel");
  } else if (artistKey && channel.includes(artistKey)) {
    score += 8;
    signals.push("artist-channel-match");
  }

  if (/provided to youtube by/i.test(description)) {
    score += 8;
    signals.push("provided-to-youtube");
  }
  if (/auto-generated by youtube/i.test(description)) {
    score += 4;
    signals.push("auto-generated");
  }
  if (artistKey && normalize(title).includes(artistKey)) {
    score += 3;
    signals.push("artist-in-title");
  }

  return { score, signals };
}

function getVideoPenalty(candidate, trackTitle = "") {
  const haystack = `${candidate.title || candidate.videoTitle || ""} ${candidate.description || ""} ${candidate.channelTitle || ""}`;
  const target = String(trackTitle || "");
  let penalty = 0;
  const signals = [];
  if (NEGATIVE_VIDEO_TERMS.test(haystack)) {
    penalty += 12;
    signals.push("negative-term");
  }
  if (MUSIC_VIDEO_TERMS.test(haystack) && !/mv|music\s*video/i.test(target)) {
    penalty += 4;
    signals.push("music-video");
  }
  if (/\blyrics?\b|가사/i.test(haystack) && !/lyrics?|가사/i.test(target)) {
    penalty += 6;
    signals.push("lyrics");
  }
  return { penalty, signals };
}

function scoreVideoCandidate(track, candidate, album, artist) {
  const videoTitle = candidate.title || candidate.videoTitle || "";
  const cleanedTitle = cleanVideoTitle(videoTitle, artist);
  const normalizedTitle = normalize(cleanedTitle);
  const rawTitle = normalize(videoTitle);
  const targetTitle = normalize(track.title);
  const albumKey = normalize(album);
  const artistKey = normalize(artist);
  const description = normalize(candidate.description || "");
  const official = getOfficialSourceScore(candidate, artist);
  const negative = getVideoPenalty(candidate, track.title);
  let titleScore = 0;
  let contextScore = 0;

  if (targetTitle && normalizedTitle === targetTitle) titleScore += 16;
  else if (targetTitle && rawTitle === targetTitle) titleScore += 14;
  else if (targetTitle && (normalizedTitle.includes(targetTitle) || rawTitle.includes(targetTitle))) titleScore += 11;
  else if (targetTitle && targetTitle.includes(normalizedTitle) && normalizedTitle.length >= 3) titleScore += 8;

  if (artistKey && (rawTitle.includes(artistKey) || description.includes(artistKey))) contextScore += 3;
  if (albumKey && (rawTitle.includes(albumKey) || description.includes(albumKey))) contextScore += 2;
  if (/official\s*audio|provided to youtube/i.test(`${videoTitle} ${candidate.description || ""}`)) contextScore += 3;

  const score = titleScore + contextScore + official.score - negative.penalty;
  const accepted = titleScore >= 8 && official.score >= 8 && negative.penalty < 12 && score >= 18;
  const confidence = accepted && titleScore >= 11 && official.score >= 14 && score >= 28 ? "high" : "review";

  return {
    score,
    titleScore,
    officialScore: official.score,
    penalty: negative.penalty,
    accepted,
    confidence,
    cleanedTitle,
    signals: [...official.signals, ...negative.signals],
  };
}

function matchPlaylistItem(track, items, artist, isOfficialPlaylist = false) {
  const targetTitle = normalize(track.title);
  const targetNumber = Number.parseInt(track.number, 10);
  let best = null;

  items.forEach((item, index) => {
    const videoTitle = item.snippet?.title || "";
    const cleaned = cleanVideoTitle(videoTitle, artist);
    const normalizedTitle = normalize(cleaned);
    let score = 0;
    if (targetTitle && normalizedTitle === targetTitle) score += 12;
    else if (targetTitle && (normalizedTitle.includes(targetTitle) || targetTitle.includes(normalizedTitle))) score += 8;
    
    if (targetNumber && index + 1 === targetNumber) {
      score += 5;
      if (isOfficialPlaylist) score += 15;
    }
    
    const videoChannel = item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || "";
    const isTopic = /topic/i.test(videoChannel);
    
    const normalizedArtist = normalize(artist);
    let isArtistChannel = false;
    if (normalizedArtist) {
      const normalizedChannel = normalize(videoChannel);
      if (normalizedChannel.includes(normalizedArtist)) {
        isArtistChannel = true;
      } else {
        const parts = artist.split(/[^a-zA-Z0-9가-힣]+/g).map(p => normalize(p)).filter(p => p.length >= 2);
        if (parts.some(part => normalizedChannel.includes(part))) {
          isArtistChannel = true;
        }
      }
    }

    if (isTopic) score += 8;
    if (isArtistChannel) score += 5;
    if (videoChannel && !isTopic && !isArtistChannel) {
      score -= 12;
    }

    if (!best || score > best.score) {
      best = {
        score,
        videoId: item.snippet?.resourceId?.videoId || "",
        videoTitle,
        cleanedTitle: cleaned,
        channelTitle: videoChannel,
        position: index + 1,
      };
    }
  });

  return best && best.videoId ? best : null;
}

async function searchOfficialTrackVideos({ album, artist, highlightedTracks, apiClient, apiKey }) {
  const queryMap = new Map();
  highlightedTracks.forEach((track) => {
    [
      `${artist} ${track.title} official audio`,
      `${artist} ${track.title} ${album}`,
    ].forEach((query) => {
      const q = query.replace(/\s+/g, " ").trim();
      if (q) queryMap.set(q.toLowerCase(), { q, tracks: [...(queryMap.get(q.toLowerCase())?.tracks || []), track] });
    });
  });

  const videos = new Map();
  for (const { q } of queryMap.values()) {
    const result = await apiClient("/search", {
      part: "snippet",
      type: "video",
      videoCategoryId: "10",
      maxResults: 6,
      q,
    }, apiKey);
    (result.items || []).forEach((item) => {
      const videoId = item.id?.videoId;
      if (!videoId || videos.has(videoId)) return;
      videos.set(videoId, {
        youtubeId: videoId,
        title: item.snippet?.title || "",
        description: item.snippet?.description || "",
        channelTitle: item.snippet?.channelTitle || "",
      });
    });
  }

  const candidates = [];
  highlightedTracks.forEach((track) => {
    let best = null;
    videos.forEach((video) => {
      const scored = scoreVideoCandidate(track, video, album, artist);
      if (!scored.accepted) return;
      const candidate = {
        ...track,
        youtubeId: video.youtubeId,
        videoTitle: video.title,
        cleanedTitle: scored.cleanedTitle,
        channelTitle: video.channelTitle,
        playlistId: "",
        playlistTitle: "",
        playlistChannelTitle: "",
        confidence: scored.confidence,
        score: scored.score,
        source: "official-video-search",
        resolverSignals: scored.signals,
        officialScore: scored.officialScore,
        titleScore: scored.titleScore,
      };
      if (!best || candidate.score > best.score) best = candidate;
    });
    if (best) candidates.push(best);
  });
  return candidates;
}

async function resolveYoutubeAlbumTracks({ album, artist, tracks, apiKey, youtubeApiClient = youtubeApi }) {
  const key = getYouTubeApiKey(apiKey);
  if (!key) {
    const error = new Error("YouTube API key is not configured.");
    error.status = 500;
    throw error;
  }
  if (!album || !artist) {
    const error = new Error("Missing required fields (album, artist).");
    error.status = 400;
    throw error;
  }

  const highlightedTracks = parseHighlightedTracks(tracks, album, artist);
  const queries = [
    `${artist} ${album} album`,
    `${artist} ${album}`,
    `${album} ${artist}`,
  ];
  const playlistMap = new Map();

  for (const q of queries) {
    const result = await youtubeApiClient("/search", {
      part: "snippet",
      type: "playlist",
      maxResults: 5,
      q,
    }, key);
    (result.items || []).forEach((item) => {
      const playlistId = item.id?.playlistId;
      if (!playlistId || playlistMap.has(playlistId)) return;
      const candidate = {
        playlistId,
        title: item.snippet?.title || "",
        channelTitle: item.snippet?.channelTitle || "",
        description: item.snippet?.description || "",
      };
      candidate.score = scorePlaylist(candidate, album, artist);
      playlistMap.set(playlistId, candidate);
    });
  }

  const playlistCandidates = Array.from(playlistMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const trackCandidates = [];
  for (const playlist of playlistCandidates.slice(0, 3)) {
    const itemsResult = await youtubeApiClient("/playlistItems", {
      part: "snippet",
      playlistId: playlist.playlistId,
      maxResults: 50,
    }, key);
    const items = itemsResult.items || [];
    playlist.itemCount = items.length;
    const isOfficialPlaylist = /topic/i.test(playlist.channelTitle || "") || playlist.score >= 12;
    highlightedTracks.forEach((track) => {
      const match = matchPlaylistItem(track, items, artist, isOfficialPlaylist);
      if (!match || match.score < 8) return;
      trackCandidates.push({
        ...track,
        youtubeId: match.videoId,
        videoTitle: match.videoTitle,
        cleanedTitle: match.cleanedTitle,
        channelTitle: match.channelTitle,
        position: match.position,
        playlistId: playlist.playlistId,
        playlistTitle: playlist.title,
        playlistChannelTitle: playlist.channelTitle,
        confidence: match.score >= 15 && playlist.score >= 10 ? "high" : "review",
        score: match.score + playlist.score,
        source: "album-playlist",
      });
    });
  }

  const officialVideoCandidates = await searchOfficialTrackVideos({
    album,
    artist,
    highlightedTracks,
    apiClient: youtubeApiClient,
    apiKey: key,
  });
  trackCandidates.push(...officialVideoCandidates);

  const bestByTrack = {};
  trackCandidates
    .sort((a, b) => b.score - a.score)
    .forEach((candidate) => {
      if (!bestByTrack[candidate.trackKey]) bestByTrack[candidate.trackKey] = candidate;
    });

  return {
    album,
    artist,
    tracks: highlightedTracks,
    playlistCandidates,
    candidates: Object.values(bestByTrack),
    unresolved: highlightedTracks.filter((track) => !bestByTrack[track.trackKey]),
  };
}

async function saveYoutubeTrackOverride({ db, fieldValue, payload }) {
  const album = String(payload.album || "").trim();
  const artist = String(payload.artist || "").trim();
  const number = padTrackNumber(payload.number || "");
  const title = String(payload.title || "").trim();
  const youtubeId = extractYouTubeVideoId(payload.youtubeId || payload.youtubeUrl || "");
  if (!album || !artist || !number || !title || !youtubeId) {
    const error = new Error("Missing required fields (album, artist, number, title, youtubeId).");
    error.status = 400;
    throw error;
  }
  const trackKey = payload.trackKey || makeTrackKey({ album, artist, number, title });
  const record = {
    trackKey,
    album,
    artist,
    number,
    title,
    youtubeId,
    videoTitle: String(payload.videoTitle || "").trim(),
    channelTitle: String(payload.channelTitle || "").trim(),
    playlistId: String(payload.playlistId || "").trim(),
    playlistTitle: String(payload.playlistTitle || "").trim(),
    status: "resolved",
    confidence: String(payload.confidence || "manual").trim(),
    updatedAt: fieldValue.serverTimestamp(),
    updatedBy: "admin-dashboard",
  };
  await db.collection(YOUTUBE_TRACK_COLLECTION).doc(trackKey).set(record, { merge: true });
  return { success: true, trackKey, record: { ...record, updatedAt: new Date().toISOString() } };
}

module.exports = {
  YOUTUBE_TRACK_COLLECTION,
  applyQuarterlyYoutubeTracks,
  buildYoutubeTrackDiagnostics,
  extractYouTubeVideoId,
  getYouTubeApiKey,
  makeTrackKey,
  parseHighlightedTracks,
  readQuarterlyYoutubeTrackOverrides,
  resolveYoutubeAlbumTracks,
  saveYoutubeTrackOverride,
};
