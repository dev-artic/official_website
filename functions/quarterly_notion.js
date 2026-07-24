const NOTION_VERSION = "2026-03-11";
const DEFAULT_DATA_SOURCE_ID = "7ae145b9-b8bb-4a0c-94c0-b804ab1c9357";
const NOTION_API_BASE = "https://api.notion.com/v1";

const TIER_CANON = [
  {
    rank: 1,
    label: "ㅠㅠ",
    stars: 7,
    summary: "분기 최고의 앨범들, 탁월한 완성도",
    criteria: [
      "\"오직 그 앨범만의\" 고유한 아이디어 & 사운드 & 서사",
      "아티스트에게도, 장르적으로도 기념비적인 앨범",
    ],
  },
  {
    rank: 2,
    label: "워",
    stars: 6,
    summary: "완성도 이상의 아이디어 & 사운드 & 표현력",
    criteria: [],
  },
  {
    rank: 3,
    label: "오",
    stars: 5,
    summary: "아티스트 팬들의 기다림을 해소",
    criteria: [
      "장르적 문법에 충실하면서 새로움을 제공",
      "추천할 만한 좋은 완성도와 짜임새",
    ],
  },
  {
    rank: 4,
    label: "좋네",
    stars: 4,
    summary: "\"GOOD\" 앨범 / 긍정적 반응을 할 수 있는 앨범",
    criteria: ["일정 수준의 완성도와 개성이 담긴 앨범"],
  },
  {
    rank: 5,
    label: "괜찮네",
    stars: 3,
    summary: "적은 부분 좋은 포인트를 발견할 수 있는 앨범",
    criteria: [],
  },
  {
    rank: 6,
    label: "음",
    stars: 2,
    summary: "독창성과 완성도가 부족하여 좋은 반응을 하기 어려운 앨범",
    criteria: [],
  },
  {
    rank: 7,
    label: "이건 좀",
    stars: 1,
    summary: "모호한 기획의도와 방향성, 완성도가 심하게 떨어지는 앨범",
    criteria: [],
  },
];

function getNotionToken(secretValue = "") {
  return secretValue || process.env.NOTION_API_KEY || process.env.NOTION_TOKEN || "";
}

function getDataSourceId() {
  return String(process.env.NOTION_QUARTERLY_DATA_SOURCE_ID || DEFAULT_DATA_SOURCE_ID).replace(/^collection:\/\//, "");
}

function textFromRichText(items) {
  if (!Array.isArray(items)) return "";
  return items.map((item) => item.plain_text || item.text?.content || "").join("").trim();
}

function getTextProperty(properties, name) {
  const prop = properties?.[name];
  if (!prop) return "";
  if (prop.type === "title") return textFromRichText(prop.title);
  if (prop.type === "rich_text") return textFromRichText(prop.rich_text);
  if (Array.isArray(prop.title)) return textFromRichText(prop.title);
  if (Array.isArray(prop.rich_text)) return textFromRichText(prop.rich_text);
  return "";
}

function getSelectName(properties, name) {
  const prop = properties?.[name];
  return prop?.select?.name || prop?.status?.name || "";
}

function getMultiSelectNames(properties, name) {
  const prop = properties?.[name];
  return Array.isArray(prop?.multi_select) ? prop.multi_select.map((item) => item.name).filter(Boolean) : [];
}

function getDateValue(properties, name) {
  const prop = properties?.[name];
  return prop?.date?.start || "";
}

function getNumberValue(properties, name) {
  const value = properties?.[name]?.number;
  return Number.isFinite(value) ? value : null;
}

function getCheckboxValue(properties, name) {
  return properties?.[name]?.checkbox === true;
}

function notionPageUrl(id) {
  return `https://app.notion.com/p/${String(id || "").replace(/-/g, "")}`;
}

function normalizeMediaKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, "");
}

function makeAlbumMediaKey(album, artist) {
  return `${normalizeMediaKey(artist)}::${normalizeMediaKey(album)}`;
}

function getHighResolutionMediaUrl(url) {
  return String(url || "")
    .replace(/\/album\/images\/\d+\//, "/album/images/1000/")
    .replace(/\/artist\/images\/\d+\//, "/artist/images/1000/");
}

function normalizeCompareValue(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getTierByRank(rank) {
  return TIER_CANON.find((tier) => tier.rank === Number(rank)) || null;
}

function getTierByLabel(label) {
  return TIER_CANON.find((tier) => tier.label === label) || null;
}

function normalizeTierHeading(text) {
  const normalized = String(text || "").trim();
  const compact = normalized.replace(/\s+/g, "");
  const byExactLabel = TIER_CANON.find((tier) => compact === tier.label);
  if (byExactLabel) {
    return {
      rank: byExactLabel.rank,
      label: byExactLabel.label,
    };
  }

  const patterns = [
    /(?:tier|티어)\s*([1-7])\s*(?:[-:–—.)]\s*)?(.+)?$/i,
    /^([1-7])\s*(?:tier|티어)?\s*(?:[-:–—.)]\s*)?(.+)$/i,
  ];
  const match = patterns.map((pattern) => normalized.match(pattern)).find(Boolean);
  if (!match) return null;
  const rank = Number(match[1]);
  const canon = getTierByRank(rank);
  return {
    rank,
    label: canon?.label || String(match[2] || "").trim(),
  };
}

function parseQuarterValue(value) {
  const text = String(value || "").trim();
  const match = text.match(/([1-4])\s*Q|Q\s*([1-4])/i);
  if (match) return Number(match[1] || match[2]);
  const number = Number(text);
  return number >= 1 && number <= 4 ? number : 0;
}

function parseIssueQuarter(issue) {
  const explicitYear = Number(issue?.year || 0);
  const explicitQuarter = parseQuarterValue(issue?.quarter);
  if (explicitYear && explicitQuarter) {
    return { year: explicitYear, quarter: explicitQuarter };
  }

  const issueText = String(issue?.issue || issue?.title || "").trim();
  const fromIssue = issueText.match(/(20\d{2})\s*(?:Q([1-4])|([1-4])Q)/i);
  if (fromIssue) {
    return { year: Number(fromIssue[1]), quarter: Number(fromIssue[2] || fromIssue[3]) };
  }

  const date = new Date(`${issue?.date || ""}T00:00:00`);
  if (!Number.isNaN(date.getTime())) {
    return {
      year: date.getFullYear(),
      quarter: Math.floor(date.getMonth() / 3) + 1,
    };
  }

  return { year: 0, quarter: 0 };
}

function compareQuarterlyIssues(a, b) {
  const qa = parseIssueQuarter(a);
  const qb = parseIssueQuarter(b);
  const byQuarter = ((qb.year * 10) + qb.quarter) - ((qa.year * 10) + qa.quarter);
  if (byQuarter !== 0) return byQuarter;
  return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
}

function parseQuarterToken(value) {
  const text = String(value || "");
  const match = text.match(/(?:^|\D)([1-4])\s*Q/i) || text.match(/Q\s*([1-4])/i) || text.match(/([1-4])\s*분기/);
  const quarter = Number(match?.[1] || 0);
  return quarter >= 1 && quarter <= 4 ? quarter : 0;
}

function quarterFromDate(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return 0;
  return Math.floor(date.getUTCMonth() / 3) + 1;
}

function quarterLabel(quarter) {
  const numericQuarter = Number(quarter);
  return numericQuarter >= 1 && numericQuarter <= 4 ? `${numericQuarter}Q` : "";
}

function quarterEndDate(year, quarter) {
  const numericYear = Number(year);
  const numericQuarter = Number(quarter);
  if (!numericYear || numericQuarter < 1 || numericQuarter > 4) return "";
  const monthDay = {
    1: "03-31",
    2: "06-30",
    3: "09-30",
    4: "12-31",
  }[numericQuarter];
  return `${numericYear}-${monthDay}`;
}

function slugifyQuarterlyIssue(year, quarter, region = "Korea", category = "Korean Albums") {
  const regionText = String(region || "").trim().toLowerCase();
  const categoryText = String(category || "").trim().toLowerCase();
  if (regionText === "korea" && /korean\s+albums?/.test(categoryText)) {
    return `${year}-q${quarter}-korean-albums`;
  }
  const raw = `${region} ${category}`
    .toLowerCase()
    .replace(/\bkorea\s+korean\b/g, "korean")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${year}-q${quarter}-${raw || "korean-albums"}`;
}

function parseReleaseYearQuarter(value) {
  const text = String(value || "").trim();
  const match = text.match(/(20\d{2})[-./년\s]+(\d{1,2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) return null;
  return { year, quarter: Math.floor((month - 1) / 3) + 1 };
}

function inferYearQuarterFromAlbums(tiers = []) {
  const counts = new Map();
  (tiers || []).forEach((tier) => {
    (tier.items || []).forEach((item) => {
      const parsed = parseReleaseYearQuarter(item.releaseDate);
      if (!parsed) return;
      const key = `${parsed.year}::${parsed.quarter}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });
  let best = null;
  counts.forEach((count, key) => {
    const [year, quarter] = key.split("::").map(Number);
    if (!best || count > best.count || (count === best.count && year * 10 + quarter > best.year * 10 + best.quarter)) {
      best = { year, quarter, count };
    }
  });
  return best || null;
}

function inferQuarterlyIssueProperties(page, parsedBlocks = {}) {
  const properties = page?.properties || {};
  const title = getTextProperty(properties, "Issue Title")
    || getTextProperty(properties, "Name")
    || "";
  const issueText = getTextProperty(properties, "Issue") || title;
  const existingYear = getNumberValue(properties, "Year") || Number((issueText.match(/20\d{2}/) || [])[0]) || 0;
  const existingQuarter = parseQuarterToken(getSelectName(properties, "Quarter"))
    || parseQuarterToken(issueText)
    || quarterFromDate(getDateValue(properties, "Published At"))
    || quarterFromDate(getDateValue(properties, "아카이빙일"));
  const inferredFromAlbums = inferYearQuarterFromAlbums(parsedBlocks.tiers || []);
  const createdAt = page?.created_time || page?.last_edited_time || "";
  const createdDate = createdAt ? new Date(createdAt) : null;
  const fallbackYear = createdDate && !Number.isNaN(createdDate.getTime()) ? createdDate.getUTCFullYear() : new Date().getUTCFullYear();
  const fallbackQuarter = createdDate && !Number.isNaN(createdDate.getTime()) ? Math.floor(createdDate.getUTCMonth() / 3) + 1 : Math.floor(new Date().getUTCMonth() / 3) + 1;
  const year = inferredFromAlbums?.year || existingYear || fallbackYear;
  const quarter = inferredFromAlbums?.quarter || existingQuarter || fallbackQuarter;
  const quarterText = quarterLabel(quarter);
  const category = getSelectName(properties, "Category") || "Korean Albums";
  const region = getSelectName(properties, "Region") || "Korea";
  const language = getSelectName(properties, "Language") || "ko";
  const albumCount = (parsedBlocks.tiers || []).reduce((sum, tier) => sum + (tier.items || []).filter((item) => item.album || item.artist).length, 0);
  const essays = parsedBlocks.companionEssays || [];
  const inferredCompanionLabels = Array.from(new Set(essays.map((essay) => essay.tierLabel).filter(Boolean)));
  const companionLabels = inferredCompanionLabels.length
    ? inferredCompanionLabels
    : getMultiSelectNames(properties, "Companion Essay Tier Labels");
  const publishedAt = quarterEndDate(year, quarter);
  const issue = `${year} ${quarterText}`.trim();
  const issueTitle = `${issue} 한국앨범 결산`;
  const excerpt = `${year}년 ${quarter}분기 한국 앨범을 7단계 티어 체계로 정리한 quarterly archive.`;
  const seoDescription = `artic. quarterly archive for ${issue} Korean albums.`;
  const slug = slugifyQuarterlyIssue(year, quarter, region, category);

  return {
    properties: {
      Name: issueTitle,
      "Issue Title": issueTitle,
      Slug: slug,
      Issue: issue,
      Excerpt: excerpt,
      "SEO Description": seoDescription,
      Year: year,
      Quarter: quarterText,
      Category: category,
      Region: region,
      Language: language,
      "Published At": publishedAt,
      "아카이빙일": publishedAt,
      "Source Format": "Structured Table",
      "Publication Status": "완료",
      "Tier Model": "Seven-Level Albums",
      "Has Companion Essays": essays.length > 0,
      "Companion Essay Count": essays.length,
      "Companion Essay Tier Labels": companionLabels,
      "업로드 확정": albumCount > 0,
    },
    diagnostics: {
      inferredFromAlbums: Boolean(inferredFromAlbums),
      albumCount,
      essayCount: essays.length,
      year,
      quarter,
      issue,
      slug,
    },
  };
}

function blockPlainText(block) {
  const type = block?.type;
  const value = block?.[type];
  if (!value) return "";
  if (Array.isArray(value.rich_text)) return textFromRichText(value.rich_text);
  if (Array.isArray(value.text)) return textFromRichText(value.text);
  if (type === "child_page") return value.title || "";
  return "";
}

function getBlockRichText(block) {
  const type = block?.type;
  const value = block?.[type];
  return Array.isArray(value?.rich_text) ? value.rich_text : [];
}

function extractUrlsFromRichText(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => item.href || item.text?.link?.url || "").filter(Boolean);
}

function getBlockExternalUrl(block) {
  const type = block?.type;
  const value = block?.[type] || {};
  return value.url || value.link?.url || "";
}

function isInstagramUrl(value) {
  return /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\//i.test(String(value || ""));
}

function findInstagramUrlFromBlocks(blocks) {
  for (const block of blocks || []) {
    const candidates = [
      block.url,
      block.text,
      ...(block.urls || []),
    ].filter(Boolean);
    const match = candidates.find(isInstagramUrl);
    if (match) {
      const urlMatch = String(match).match(/https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[^/?#\s]+/i);
      return urlMatch ? urlMatch[0] : match;
    }
  }
  return "";
}

function getBlockImageUrl(block) {
  const image = block?.image;
  if (!image) return "";
  if (image.type === "external") return image.external?.url || "";
  if (image.type === "file") return image.file?.url || "";
  return "";
}

function normalizeEssayBlocks(blocks, tableRowsByBlockId = {}) {
  return (blocks || []).flatMap((block) => {
    const text = blockPlainText(block);
    const urls = extractUrlsFromRichText(getBlockRichText(block));
    const externalUrl = getBlockExternalUrl(block) || urls[0] || "";
    if (block.type === "image") {
      return {
        type: "image",
        text: textFromRichText(block.image?.caption || []),
        url: getBlockImageUrl(block),
      };
    }

    if (block.type === "table") {
      return parseEssayTableRows(tableRowsByBlockId[block.id] || []);
    }

    if (externalUrl && (!text || isInstagramUrl(externalUrl) || text.trim() === externalUrl)) {
      return {
        type: "external_link",
        text: isInstagramUrl(externalUrl) ? "" : text,
        url: externalUrl,
        urls,
      };
    }

    if (!text) return null;
    return {
      type: block.type,
      text,
      url: externalUrl,
      urls,
    };
  }).filter(Boolean);
}

function essayContentFromBlocks(blocks) {
  return normalizeEssayBlocks(blocks)
    .filter((block) => block.text)
    .map((block) => block.text)
    .join("\n\n")
    .trim();
}

function essayExcerptFromContent(content, limit = 220) {
  const normalized = String(content || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > limit ? `${normalized.slice(0, limit).trim()}...` : normalized;
}

function normalizeHeader(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function hasDisplayValue(value) {
  const normalized = String(value || "").trim();
  return normalized && !["없음", "none", "n/a", "-"].includes(normalized.toLowerCase());
}

function normalizeMatchText(value) {
  return String(value || "").replace(/[\s\-_()[\]]+/g, "").toLowerCase();
}

function flattenIssueAlbums(issue) {
  return (issue.tiers || []).flatMap((tier) => (tier.items || []).map((item) => {
    item.tierRank = tier.rank;
    item.tierLabel = tier.label;
    return item;
  }));
}

function findEssayAlbum(issue, essay) {
  const albums = flattenIssueAlbums(issue);
  const essayAlbum = normalizeMatchText(essay.album);
  const essayArtist = normalizeMatchText(essay.artist);
  if (essayAlbum || essayArtist) {
    const directMatch = albums.find((item) => {
      const albumMatches = !essayAlbum || normalizeMatchText(item.album) === essayAlbum;
      const artistMatches = !essayArtist || normalizeMatchText(item.artist) === essayArtist;
      return albumMatches && artistMatches;
    });
    if (directMatch) return directMatch;
  }

  const title = normalizeMatchText(essay.title);
  return albums.find((item) => {
    const tierMatches = !essay.tierRank || Number(item.tierRank) === Number(essay.tierRank);
    const titleMatches = title.includes(normalizeMatchText(item.album)) || title.includes(normalizeMatchText(item.artist));
    return hasDisplayValue(item.companionEssay) && tierMatches && titleMatches;
  }) || albums.find((item) => hasDisplayValue(item.companionEssay) && (!essay.tierRank || Number(item.tierRank) === Number(essay.tierRank)));
}

function enrichQuarterlyMedia(archive, mediaCache = {}) {
  const albumArt = mediaCache.albumArt || mediaCache.albums || {};
  const artistImages = mediaCache.artistImages || mediaCache.artists || {};
  let albumImageCount = 0;
  let unverifiedAlbumImageCount = 0;
  let artistImageCount = 0;

  (archive.issues || []).forEach((issue) => {
    (issue.tiers || []).forEach((tier) => {
      (tier.items || []).forEach((item) => {
        const cached = albumArt[makeAlbumMediaKey(item.album, item.artist)];
        if (!cached?.imageUrl) return;
        if (cached.verified !== true) {
          unverifiedAlbumImageCount += 1;
          return;
        }
        item.imageUrl = getHighResolutionMediaUrl(cached.imageUrl);
        item.imageSourceUrl = cached.albumUrl || cached.sourceUrl || item.imageSourceUrl || "";
        item.imageSource = cached.source || "Bugs";
        albumImageCount += 1;
      });
    });

    (issue.essays || []).forEach((essay) => {
      const album = findEssayAlbum(issue, essay);
      const artist = album?.artist || essay.artist;
      const cached = artistImages[normalizeMediaKey(artist)];
      if (!cached?.imageUrl) return;
      const imageUrl = getHighResolutionMediaUrl(cached.imageUrl);
      essay.artistImageUrl = imageUrl;
      essay.artistImageSourceUrl = cached.artistUrl || cached.sourceUrl || essay.artistImageSourceUrl || "";
      essay.artistImageSource = cached.source || "Bugs";
      if (album) {
        album.artistImageUrl = imageUrl;
        album.artistImageSourceUrl = essay.artistImageSourceUrl;
        album.artistImageSource = essay.artistImageSource;
      }
      artistImageCount += 1;
    });
  });

  archive.mediaEnrichment = {
    source: mediaCache.source || "Bugs media cache",
    updatedAt: mediaCache.updatedAt || "",
    albumImageCount,
    unverifiedAlbumImageCount,
    artistImageCount,
  };
  return archive;
}

function attachNowArtic(archive, nowArticPayload = null) {
  const items = Array.isArray(nowArticPayload)
    ? nowArticPayload
    : Array.isArray(nowArticPayload?.items)
      ? nowArticPayload.items
      : [];

  archive.nowArtic = items;
  archive.nowArticUpdatedAt = nowArticPayload?.crawledAt || nowArticPayload?.updatedAt || "";
  archive.nowArticSource = nowArticPayload?.source || "";
  return archive;
}

function normalizeExternalLinksPayload(payload = null) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function linkMatchesIssue(link, issue) {
  const issueKeys = [
    issue?.id,
    issue?.slug,
    issue?.issue,
    issue?.title,
  ].filter(Boolean).map(normalizeMatchText);
  const linkKeys = [
    link.issueId,
    link.issueSlug,
    link.issue,
    link.issueTitle,
  ].filter(Boolean).map(normalizeMatchText);
  return !linkKeys.length || linkKeys.some((key) => issueKeys.includes(key));
}

function linkMatchesEssay(link, issue, essay) {
  const album = findEssayAlbum(issue, essay);
  const essayKeys = [
    essay?.id,
    essay?.title,
    essay?.album,
    essay?.artist,
    album?.album,
    album?.artist,
  ].filter(Boolean).map(normalizeMatchText);
  const linkKeys = [
    link.essayId,
    link.essayTitle,
    link.album,
    link.artist,
  ].filter(Boolean).map(normalizeMatchText);
  return linkKeys.length && linkKeys.every((key) => essayKeys.includes(key));
}

function applyQuarterlyExternalLinks(archive, payload = null) {
  const links = normalizeExternalLinksPayload(payload);
  if (!links.length) return archive;

  (archive.issues || []).forEach((issue) => {
    (issue.essays || []).forEach((essay) => {
      const matched = links.find((link) => linkMatchesIssue(link, issue) && linkMatchesEssay(link, issue, essay));
      if (!matched) return;
      essay.instagramUrl = essay.instagramUrl || matched.instagramUrl || matched.instagramPostUrl || "";
      essay.externalUrl = essay.externalUrl || matched.url || "";
    });
  });

  archive.externalLinksUpdatedAt = payload?.updatedAt || "";
  archive.externalLinksSource = payload?.source || "";
  return archive;
}

function extractPageMentions(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const pageId = item?.mention?.type === "page" ? item.mention.page?.id : "";
    if (!pageId) return null;
    return {
      id: pageId,
      title: item.plain_text || item.text?.content || "Untitled",
      url: notionPageUrl(pageId),
    };
  }).filter(Boolean);
}

function normalizeTableCell(cell) {
  return {
    text: textFromRichText(cell),
    pageMentions: extractPageMentions(cell),
  };
}

function cellText(cell) {
  if (typeof cell === "string") return cell;
  return cell?.text || "";
}

function getCellByHeader(headers, cells, names, fallbackIndex) {
  const normalizedNames = names.map(normalizeHeader);
  const index = headers.findIndex((header) => normalizedNames.includes(normalizeHeader(header)));
  const targetIndex = index >= 0 ? index : fallbackIndex;
  return cells[targetIndex] || { text: "", pageMentions: [] };
}

function getAlbumColumnIndexes(headers) {
  const findIndex = (names, fallbackIndex) => {
    const normalizedNames = names.map(normalizeHeader);
    const index = headers.findIndex((header) => normalizedNames.includes(normalizeHeader(header)));
    return index >= 0 ? index : fallbackIndex;
  };

  return {
    album: findIndex(["앨범", "Album"], 0),
    artist: findIndex(["아티스트", "Artist"], 1),
    genre: findIndex(["장르", "Genre"], 2),
    releaseDate: findIndex(["발매일", "Release Date"], 3),
    comment: findIndex(["한줄평", "Comment"], 4),
    tracks: findIndex(["추천 수록곡", "추천수록곡", "Tracks"], 5),
    note: findIndex(["에디터 노트", "에디터노트", "Editor Note"], 6),
  };
}

function mapAlbumRow(headers, cells, source = null) {
  const byHeader = {};
  headers.forEach((header, index) => {
    byHeader[normalizeHeader(header)] = cellText(cells[index]);
  });

  const companionCell = getCellByHeader(headers, cells, ["Companion Essay", "Essay", "Featured Article", "Featured Essay"], 7);
  const rawAlbum = byHeader["앨범"] || byHeader["album"] || cellText(cells[0]);
  const album = rawAlbum ? rawAlbum.replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim() : rawAlbum;
  const artist = byHeader["아티스트"] || byHeader["artist"] || cellText(cells[1]);
  const genre = byHeader["장르"] || byHeader["genre"] || cellText(cells[2]);
  const releaseDate = byHeader["발매일"] || byHeader["releasedate"] || cellText(cells[3]);
  const comment = byHeader["한줄평"] || byHeader["comment"] || cellText(cells[4]);
  const tracks = byHeader["추천수록곡"] || byHeader["tracks"] || cellText(cells[5]);
  const note = byHeader["에디터노트"] || byHeader["editornote"] || cellText(cells[6]);
  const companionEssay = cellText(companionCell);
  const companionEssayPages = companionCell.pageMentions || [];

  if (![album, artist, genre, releaseDate, comment, tracks, note, companionEssay].some(Boolean)) {
    return null;
  }

  const row = {
    album,
    artist,
    genre,
    releaseDate,
    comment,
    tracks,
    note,
    companionEssay,
    companionEssayPages,
  };

  if (source) {
    row._source = {
      type: "notion_table_row",
      tableBlockId: source.tableBlockId || "",
      rowBlockId: source.rowBlockId || "",
      lastEditedTime: source.lastEditedTime || "",
      headers: source.headers || headers,
      columnIndexes: getAlbumColumnIndexes(headers),
    };
  }

  return row;
}

function parseTableRows(tableRowBlocks, options = {}) {
  const rows = tableRowBlocks
    .filter((block) => block.type === "table_row")
    .map((block) => ({
      block,
      cells: (block.table_row?.cells || []).map(normalizeTableCell),
    }));

  if (!rows.length) return [];
  const firstRow = rows[0].cells.map((cell) => normalizeHeader(cellText(cell)));
  const hasHeader = firstRow.includes("앨범") || firstRow.includes("album");
  const headers = hasHeader
    ? rows[0].cells.map(cellText)
    : ["앨범", "아티스트", "장르", "발매일", "한줄평", "추천 수록곡", "에디터 노트", "Companion Essay"];
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map((row) => mapAlbumRow(
    headers,
    row.cells,
    options.includeSourceMetadata ? {
      tableBlockId: options.tableBlockId || "",
      rowBlockId: row.block.id,
      lastEditedTime: row.block.last_edited_time || "",
      headers,
    } : null,
  )).filter((row) => row && row.album);
}

function parseEssayTableRows(tableRowBlocks) {
  const rows = tableRowBlocks
    .filter((block) => block.type === "table_row")
    .map((block) => (block.table_row?.cells || []).map(normalizeTableCell));

  if (!rows.length) return [];

  const headerCells = rows[0].map((cell) => normalizeHeader(cellText(cell)));
  const preferredIndex = [
    "문체수정버전(artic청자톤)",
    "문체수정버전",
    "수정버전",
    "본문",
    "content",
  ].map((name) => headerCells.indexOf(name)).find((index) => index >= 0);
  const textIndex = preferredIndex === undefined ? 0 : preferredIndex;

  return rows.slice(1).map((row) => {
    const preferredText = cellText(row[textIndex]).trim();
    const fallbackText = row.map(cellText).find((value) => value.trim()) || "";
    const text = (preferredText || fallbackText).trim();
    if (!text) return null;
    return {
      type: "paragraph",
      text,
    };
  }).filter(Boolean);
}

function parseQuarterlyBlocks(blocks, tableRowsByBlockId = {}, options = {}) {
  const tiersByRank = new Map();
  const companionEssaysById = new Map();
  let currentTier = null;

  function ensureTier(rank) {
    if (!tiersByRank.has(rank)) {
      const tier = getTierByRank(rank);
      tiersByRank.set(rank, {
        rank,
        label: tier?.label || "",
        items: [],
      });
    }
    return tiersByRank.get(rank);
  }

  function addCompanionEssay(essay) {
    if (!essay?.id) return;
    const existing = companionEssaysById.get(essay.id) || {};
    companionEssaysById.set(essay.id, {
      ...existing,
      ...essay,
      title: essay.title || existing.title || "Untitled",
      url: essay.url || existing.url || notionPageUrl(essay.id),
    });
  }

  for (const block of blocks || []) {
    const heading = normalizeTierHeading(blockPlainText(block));
    if (heading) {
      currentTier = heading;
      ensureTier(heading.rank);
      continue;
    }

    if (block.type === "table" && currentTier) {
      const tableRows = tableRowsByBlockId[block.id] || [];
      const items = parseTableRows(tableRows, {
        includeSourceMetadata: options.includeSourceMetadata,
        tableBlockId: block.id,
      });
      const tier = ensureTier(currentTier.rank);
      tier.items.push(...items);
      items.forEach((item) => {
        (item.companionEssayPages || []).forEach((essayPage) => {
          addCompanionEssay({
            ...essayPage,
            source: "table_mention",
            album: item.album,
            artist: item.artist,
            tierRank: tier.rank,
            tierLabel: tier.label,
          });
        });
      });
      continue;
    }

    if (block.type === "child_page") {
      addCompanionEssay({
        id: block.id,
        title: block.child_page?.title || "Untitled",
        url: notionPageUrl(block.id),
        source: "child_page",
      });
    }
  }

  return {
    tiers: Array.from(tiersByRank.values())
      .sort((a, b) => a.rank - b.rank),
    companionEssays: Array.from(companionEssaysById.values()),
  };
}

function normalizeIssuePage(page, parsedBlocks) {
  const properties = page.properties || {};
  const publicationStatus = getSelectName(properties, "Publication Status");
  const sourceFormat = getSelectName(properties, "Source Format");
  const publishedAt = getDateValue(properties, "Published At") || getDateValue(properties, "아카이빙일");
  const year = getNumberValue(properties, "Year");
  const quarter = getSelectName(properties, "Quarter");
  const issue = getTextProperty(properties, "Issue") || [year, quarter].filter(Boolean).join(" ");
  const title = getTextProperty(properties, "Issue Title") || getTextProperty(properties, "Name") || page.url || "Quarterly";
  const companionLabels = getMultiSelectNames(properties, "Companion Essay Tier Labels");
  const parsedEssays = parsedBlocks.companionEssays || [];

  const essays = parsedEssays.map((essay, index) => {
    const tier = getTierByLabel(companionLabels[index]) || getTierByLabel(companionLabels[0]);
    return {
      ...essay,
      tierRank: essay.tierRank || tier?.rank || null,
      tierLabel: essay.tierLabel || tier?.label || "",
    };
  });

  const nonEmptyTierCount = (parsedBlocks.tiers || []).filter((tier) => (tier.items || []).length > 0).length;
  const expectedEssayCount = getNumberValue(properties, "Companion Essay Count");
  const warnings = [];
  if ((parsedBlocks.tiers || []).length < TIER_CANON.length) {
    warnings.push(`Only ${(parsedBlocks.tiers || []).length} tier headings parsed from the page body.`);
  }
  if (expectedEssayCount && expectedEssayCount !== essays.length) {
    warnings.push(`Companion Essay Count is ${expectedEssayCount}, but ${essays.length} essay page(s) were parsed.`);
  }

  return {
    id: page.id,
    title,
    lastEditedTime: page.last_edited_time || "",
    slug: getTextProperty(properties, "Slug"),
    issue,
    year,
    quarter,
    date: publishedAt,
    category: getSelectName(properties, "Category"),
    region: getSelectName(properties, "Region"),
    language: getSelectName(properties, "Language"),
    excerpt: getTextProperty(properties, "Excerpt"),
    publicationStatus,
    sourceFormat,
    tierModel: getSelectName(properties, "Tier Model"),
    hasCompanionEssays: getCheckboxValue(properties, "Has Companion Essays"),
    companionEssayCount: getNumberValue(properties, "Companion Essay Count") || essays.length,
    companionEssayTierLabels: companionLabels,
    tiers: parsedBlocks.tiers || [],
    essays,
    diagnostics: {
      tierHeadingCount: (parsedBlocks.tiers || []).length,
      nonEmptyTierCount,
      albumCount: (parsedBlocks.tiers || []).reduce((sum, tier) => sum + (tier.items || []).length, 0),
      essayCount: essays.length,
      warnings,
    },
  };
}

function shouldPublishPage(page) {
  const properties = page.properties || {};
  const status = getSelectName(properties, "Publication Status");
  const sourceFormat = getSelectName(properties, "Source Format");
  return getCheckboxValue(properties, "업로드 확정")
    && sourceFormat !== "Template Draft"
    && ["완료", "Published", "Ready"].includes(status);
}

async function notionRequest(pathname, { method = "GET", body, token } = {}) {
  const response = await fetch(`${NOTION_API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = payload.message || `Notion API request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function getNotionPage(token, pageId) {
  return notionRequest(`/pages/${pageId}`, { token });
}

async function getNotionBlock(token, blockId) {
  return notionRequest(`/blocks/${blockId}`, { token });
}

function getNotionPageTitle(page) {
  const properties = page?.properties || {};
  const titleProp = Object.values(properties).find((prop) => prop?.type === "title");
  return textFromRichText(titleProp?.title || []);
}

function assertExpectedPageTitle(page, expectedTitle) {
  const expected = normalizeCompareValue(expectedTitle);
  if (!expected) return;
  const actual = normalizeCompareValue(getNotionPageTitle(page));
  
  // Relax check if the actual title already matches the "Issue Title" property 
  // (meaning it was already updated by a previous auto-fill, but the frontend sent the old template title).
  const issueTitleProp = normalizeCompareValue(getTextProperty(page.properties, "Issue Title"));
  if (actual !== expected && actual !== issueTitleProp) {
    const error = new Error(`Notion page title mismatch. Expected "${expectedTitle}", got "${getNotionPageTitle(page)}".`);
    error.status = 409;
    throw error;
  }
}

function assertExpectedLastEditedTime(page, expectedLastEditedTime) {
  const expected = String(expectedLastEditedTime || "").trim();
  if (!expected) return;
  const actual = String(page?.last_edited_time || "").trim();
  if (actual && actual !== expected) {
    const error = new Error("Notion page changed after the admin dashboard loaded. Refresh diagnostics before saving.");
    error.status = 409;
    throw error;
  }
}

function richTextFromPlainText(value) {
  const text = String(value || "");
  return text ? [{ type: "text", text: { content: text.slice(0, 2000) } }] : [];
}

function writableRichTextItem(item) {
  if (!item || typeof item !== "object") return null;
  const base = {
    type: item.type,
  };
  if (item.annotations) base.annotations = item.annotations;

  if (item.type === "text") {
    base.text = {
      content: item.text?.content || item.plain_text || "",
    };
    if (item.text?.link?.url) {
      base.text.link = { url: item.text.link.url };
    }
    return base;
  }

  if (item.type === "mention" && item.mention) {
    base.mention = item.mention;
    return base;
  }

  if (item.type === "equation" && item.equation) {
    base.equation = item.equation;
    return base;
  }

  return item.plain_text ? { type: "text", text: { content: item.plain_text } } : null;
}

function writableRichTextCell(cell) {
  if (!Array.isArray(cell)) return [];
  return cell.map(writableRichTextItem).filter(Boolean);
}

async function updateNotionTableRowCells(token, rowBlockId, updatesByIndex, options = {}) {
  const block = await getNotionBlock(token, rowBlockId);
  if (block.type !== "table_row") {
    const error = new Error("Notion block is not a table row.");
    error.status = 400;
    throw error;
  }
  assertExpectedLastEditedTime(block, options.expectedLastEditedTime);

  const currentCells = block.table_row?.cells || [];
  const expectedCells = options.expectedCells || {};
  Object.entries(expectedCells).forEach(([index, expectedValue]) => {
    const actualValue = textFromRichText(currentCells[Number(index)] || []);
    if (normalizeCompareValue(actualValue) !== normalizeCompareValue(expectedValue)) {
      const error = new Error("Notion table row changed after the admin dashboard loaded. Refresh diagnostics before saving.");
      error.status = 409;
      throw error;
    }
  });

  const nextCells = currentCells.map((cell) => writableRichTextCell(cell));
  Object.entries(updatesByIndex || {}).forEach(([index, value]) => {
    const numericIndex = Number(index);
    if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= nextCells.length) {
      const error = new Error("Album metadata column index is out of range.");
      error.status = 400;
      throw error;
    }
    nextCells[numericIndex] = richTextFromPlainText(value);
  });

  return notionRequest(`/blocks/${rowBlockId}`, {
    method: "PATCH",
    token,
    body: {
      table_row: {
        cells: nextCells,
      },
    },
  });
}

function splitTextForNotionParagraphs(content) {
  const normalized = String(content || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks = [];
  paragraphs.forEach((paragraph) => {
    if (paragraph.length <= 1900) {
      chunks.push(paragraph);
      return;
    }
    for (let index = 0; index < paragraph.length; index += 1900) {
      chunks.push(paragraph.slice(index, index + 1900).trim());
    }
  });
  return chunks;
}

function buildNotionPropertyValue(currentProperty, value) {
  const type = currentProperty?.type;
  if (type === "rich_text") {
    return { rich_text: richTextFromPlainText(value) };
  }
  if (type === "title") {
    return { title: richTextFromPlainText(value) };
  }
  if (type === "number") {
    const numberValue = Number(value);
    return { number: Number.isFinite(numberValue) ? numberValue : null };
  }
  if (type === "checkbox") {
    return { checkbox: value === true || value === "true" };
  }
  if (type === "date") {
    return { date: value ? { start: String(value) } : null };
  }
  if (type === "select") {
    return { select: value ? { name: String(value) } : null };
  }
  if (type === "status") {
    return { status: value ? { name: String(value) } : null };
  }
  if (type === "multi_select") {
    const values = Array.isArray(value) ? value : String(value || "").split(",");
    return { multi_select: values.map((name) => String(name || "").trim()).filter(Boolean).map((name) => ({ name })) };
  }
  return null;
}

async function updateNotionPageProperties(token, pageId, properties, options = {}) {
  const page = await getNotionPage(token, pageId);
  assertExpectedPageTitle(page, options.expectedTitle);
  assertExpectedLastEditedTime(page, options.expectedLastEditedTime);

  const allowed = new Set([
    "Name",
    "Slug",
    "Excerpt",
    "SEO Description",
    "Issue",
    "Issue Title",
    "Publication Status",
    "Published At",
    "Year",
    "Quarter",
    "Category",
    "Region",
    "Language",
    "Tier Model",
    "Has Companion Essays",
    "Companion Essay Count",
    "Companion Essay Tier Labels",
    "업로드 확정",
  ]);
  const nextProperties = {};

  Object.entries(properties || {}).forEach(([name, value]) => {
    if (!allowed.has(name)) return;
    
    // If the requested property is "Name", map it to the actual title property key of the database
    let targetName = name;
    if (name === "Name") {
      const titlePropEntry = Object.entries(page.properties || {}).find(([_, prop]) => prop?.type === "title");
      if (titlePropEntry) {
        targetName = titlePropEntry[0];
      }
    }

    const currentProperty = page.properties?.[targetName];
    if (!currentProperty) return;
    const nextValue = buildNotionPropertyValue(currentProperty, value);
    if (nextValue) nextProperties[targetName] = nextValue;
  });

  if (!Object.keys(nextProperties).length) {
    const error = new Error("No supported Notion properties were provided.");
    error.status = 400;
    throw error;
  }

  return notionRequest(`/pages/${pageId}`, {
    method: "PATCH",
    token,
    body: { properties: nextProperties },
  });
}

async function replaceNotionPagePlainText(token, pageId, content, options = {}) {
  const page = await getNotionPage(token, pageId);
  assertExpectedPageTitle(page, options.expectedTitle);
  assertExpectedLastEditedTime(page, options.expectedLastEditedTime);

  const children = await listBlockChildren(token, pageId);
  await Promise.all(children
    .filter((block) => block.type !== "child_page")
    .map((block) => notionRequest(`/blocks/${block.id}`, {
      method: "PATCH",
      token,
      body: { archived: true },
    })));

  const paragraphs = splitTextForNotionParagraphs(content);
  if (!paragraphs.length) {
    return { pageId, archivedBlockCount: children.length, appendedBlockCount: 0 };
  }

  let appendedBlockCount = 0;
  for (let index = 0; index < paragraphs.length; index += 100) {
    const batch = paragraphs.slice(index, index + 100);
    const appended = await notionRequest(`/blocks/${pageId}/children`, {
      method: "PATCH",
      token,
      body: {
        children: batch.map((paragraph) => ({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: richTextFromPlainText(paragraph) },
        })),
      },
    });
    appendedBlockCount += appended.results?.length || batch.length;
  }

  return {
    pageId,
    archivedBlockCount: children.filter((block) => block.type !== "child_page").length,
    appendedBlockCount,
  };
}

async function appendNotionPagePlainText(token, pageId, content, options = {}) {
  const page = await getNotionPage(token, pageId);
  assertExpectedPageTitle(page, options.expectedTitle);
  assertExpectedLastEditedTime(page, options.expectedLastEditedTime);

  const paragraphs = splitTextForNotionParagraphs(content);
  let appendedBlockCount = 0;
  for (let index = 0; index < paragraphs.length; index += 100) {
    const batch = paragraphs.slice(index, index + 100);
    const appended = await notionRequest(`/blocks/${pageId}/children`, {
      method: "PATCH",
      token,
      body: {
        children: batch.map((paragraph) => ({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: richTextFromPlainText(paragraph) },
        })),
      },
    });
    appendedBlockCount += appended.results?.length || batch.length;
  }

  return { pageId, appendedBlockCount };
}

async function queryQuarterlyPages(token, dataSourceId = getDataSourceId()) {
  const pages = [];
  let startCursor = undefined;

  do {
    const payload = await notionRequest(`/data_sources/${dataSourceId}/query`, {
      method: "POST",
      token,
      body: {
        page_size: 100,
        start_cursor: startCursor,
        sorts: [{ property: "Published At", direction: "descending" }],
      },
    });
    pages.push(...(payload.results || []));
    startCursor = payload.has_more ? payload.next_cursor : undefined;
  } while (startCursor);

  return pages.filter(shouldPublishPage);
}

async function queryQuarterlyPagesRaw(token, dataSourceId = getDataSourceId()) {
  const pages = [];
  let startCursor = undefined;

  do {
    const payload = await notionRequest(`/data_sources/${dataSourceId}/query`, {
      method: "POST",
      token,
      body: {
        page_size: 100,
        start_cursor: startCursor,
        sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
      },
    });
    pages.push(...(payload.results || []));
    startCursor = payload.has_more ? payload.next_cursor : undefined;
  } while (startCursor);

  return pages;
}

async function listBlockChildren(token, blockId) {
  const blocks = [];
  let startCursor = undefined;
  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (startCursor) query.set("start_cursor", startCursor);
    const payload = await notionRequest(`/blocks/${blockId}/children?${query.toString()}`, { token });
    blocks.push(...(payload.results || []));
    startCursor = payload.has_more ? payload.next_cursor : undefined;
  } while (startCursor);
  return blocks;
}

async function listBlockTree(token, blockId, options = {}) {
  const blocks = await listBlockChildren(token, blockId);
  const output = [];

  for (const block of blocks) {
    output.push(block);
    const shouldSkipChildren = block.type === "table" || (options.skipChildPages && block.type === "child_page");
    if (block.has_children && !shouldSkipChildren) {
      output.push(...await listBlockTree(token, block.id, options));
    }
  }

  return output;
}

async function parseIssueBlocks(token, pageId, options = {}) {
  const blocks = await listBlockTree(token, pageId, { skipChildPages: true });
  const tableBlocks = blocks.filter((block) => block.type === "table" && block.has_children);
  const tableRowsByBlockId = {};

  await Promise.all(tableBlocks.map(async (block) => {
    tableRowsByBlockId[block.id] = await listBlockChildren(token, block.id);
  }));

  const parsed = parseQuarterlyBlocks(blocks, tableRowsByBlockId, {
    includeSourceMetadata: options.includeSourceMetadata,
  });
  parsed.companionEssays = await Promise.all((parsed.companionEssays || []).map(async (essay) => {
    try {
      const essayPage = await getNotionPage(token, essay.id);
      const essayBlocks = await listBlockTree(token, essay.id);
      const essayTableBlocks = essayBlocks.filter((block) => block.type === "table" && block.has_children);
      const essayTableRowsByBlockId = {};
      await Promise.all(essayTableBlocks.map(async (block) => {
        essayTableRowsByBlockId[block.id] = await listBlockChildren(token, block.id);
      }));
      const normalizedBlocks = normalizeEssayBlocks(essayBlocks, essayTableRowsByBlockId);
      const content = normalizedBlocks
        .filter((block) => block.text)
        .map((block) => block.text)
        .join("\n\n")
        .trim();
      return {
        ...essay,
        lastEditedTime: essayPage.last_edited_time || "",
        blocks: normalizedBlocks,
        content,
        excerpt: essayExcerptFromContent(content),
        instagramUrl: essay.instagramUrl || findInstagramUrlFromBlocks(normalizedBlocks),
      };
    } catch (err) {
      return {
        ...essay,
        blocks: [],
        content: "",
        excerpt: "",
        diagnostics: {
          warning: `Unable to fetch companion essay page: ${err.message}`,
        },
      };
    }
  }));

  return parsed;
}

async function fetchQuarterlyContents({ token, dataSourceId = getDataSourceId(), mediaCache = null, nowArtic = null, externalLinks = null, includeSourceMetadata = false, existingCache = null, includeDrafts = false }) {
  if (!token) {
    const error = new Error("NOTION_API_KEY is not configured");
    error.status = 500;
    throw error;
  }

  const pages = includeDrafts ? await queryQuarterlyPagesRaw(token, dataSourceId) : await queryQuarterlyPages(token, dataSourceId);
  
  // Create a map of existing cached issues for fast lookup
  const cachedIssuesMap = new Map();
  if (existingCache && Array.isArray(existingCache.issues)) {
    existingCache.issues.forEach((issue) => {
      if (issue && issue.id) {
        cachedIssuesMap.set(issue.id, issue);
      }
    });
  }

  const issues = await Promise.all(pages.map(async (page) => {
    const cachedIssue = cachedIssuesMap.get(page.id);
    const liveLastEditedTime = page.last_edited_time || "";
    
    // Check if the issue page itself has changed
    const issuePageChanged = !cachedIssue || cachedIssue.lastEditedTime !== liveLastEditedTime;
    
    if (!issuePageChanged) {
      let essaysChanged = false;
      const cachedEssays = cachedIssue.essays || [];
      
      const checkedEssays = await Promise.all(cachedEssays.map(async (cachedEssay) => {
        try {
          const liveEssayPage = await getNotionPage(token, cachedEssay.id);
          const liveEssayLastEdited = liveEssayPage.last_edited_time || "";
          if (cachedEssay.lastEditedTime !== liveEssayLastEdited) {
            essaysChanged = true;
            console.log(`[INCREMENTAL] Essay updated in Notion: "${cachedEssay.title}" (${cachedEssay.id}). Re-fetching blocks.`);
            
            // Re-fetch and parse the essay blocks
            const essayBlocks = await listBlockTree(token, cachedEssay.id);
            const essayTableBlocks = essayBlocks.filter((block) => block.type === "table" && block.has_children);
            const essayTableRowsByBlockId = {};
            await Promise.all(essayTableBlocks.map(async (block) => {
              essayTableRowsByBlockId[block.id] = await listBlockChildren(token, block.id);
            }));
            const normalizedBlocks = normalizeEssayBlocks(essayBlocks, essayTableRowsByBlockId);
            const content = normalizedBlocks
              .filter((block) => block.text)
              .map((block) => block.text)
              .join("\n\n")
              .trim();
              
            return {
              ...cachedEssay,
              lastEditedTime: liveEssayLastEdited,
              blocks: normalizedBlocks,
              content,
              excerpt: essayExcerptFromContent(content),
              instagramUrl: cachedEssay.instagramUrl || findInstagramUrlFromBlocks(normalizedBlocks),
            };
          }
          return cachedEssay;
        } catch (err) {
          console.warn(`[INCREMENTAL] Failed to verify essay page ${cachedEssay.id}:`, err.message);
          return cachedEssay; // Fallback to cached essay on error
        }
      }));
      
      if (!essaysChanged) {
        console.log(`[INCREMENTAL] Reusing cached ACHA issue: "${cachedIssue.title}" (${page.id})`);
        return cachedIssue;
      } else {
        console.log(`[INCREMENTAL] Reusing cached ACHA issue: "${cachedIssue.title}" (${page.id}) with updated essays.`);
        return {
          ...cachedIssue,
          essays: checkedEssays,
          lastEditedTime: liveLastEditedTime
        };
      }
    }

    console.log(`[INCREMENTAL] ACHA issue page changed or not cached: "${page.url || page.id}". Fetching all blocks and essays.`);
    const parsedBlocks = await parseIssueBlocks(token, page.id, { includeSourceMetadata });
    return normalizeIssuePage(page, parsedBlocks);
  }));

  issues.sort(compareQuarterlyIssues);

  const archive = {
    source: "notion",
    sourceName: "분기별 결산",
    sourceId: dataSourceId,
    queryMode: "data_source_direct",
    view: null,
    publishFilter: {
      uploadConfirmed: true,
      publicationStatuses: ["완료", "Published", "Ready"],
      excludedSourceFormats: ["Template Draft"],
    },
    updatedAt: new Date().toISOString(),
    tierCanon: TIER_CANON,
    issues,
  };

  const enrichedArchive = mediaCache ? enrichQuarterlyMedia(archive, mediaCache) : archive;
  return attachNowArtic(applyQuarterlyExternalLinks(enrichedArchive, externalLinks), nowArtic);
}

module.exports = {
  DEFAULT_DATA_SOURCE_ID,
  NOTION_VERSION,
  TIER_CANON,
  fetchQuarterlyContents,
  compareQuarterlyIssues,
  getDataSourceId,
  getNotionToken,
  getNotionPage,
  enrichQuarterlyMedia,
  getHighResolutionMediaUrl,
  makeAlbumMediaKey,
  normalizeIssuePage,
  inferQuarterlyIssueProperties,
  appendNotionPagePlainText,
  parseIssueBlocks,
  parseQuarterlyBlocks,
  parseTableRows,
  queryQuarterlyPagesRaw,
  replaceNotionPagePlainText,
  shouldPublishPage,
  updateNotionPageProperties,
  updateNotionTableRowCells,
};
