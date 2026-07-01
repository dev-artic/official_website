#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const {
  DEFAULT_DATA_SOURCE_ID,
  NOTION_VERSION,
  TIER_CANON,
} = require("../functions/quarterly_notion");

const NOTION_API_BASE = "https://api.notion.com/v1";
const DEFAULT_TITLE = "ACHA Issue Template Draft";
const DEFAULT_SLUG = "template-acha-issue-draft";
const DEFAULT_NATIVE_TEMPLATE_TITLE = "ACHA Issue Template";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  });
}

function parseArgs(argv) {
  const args = {};
  argv.forEach((arg) => {
    if (!arg.startsWith("--")) return;
    const [key, ...valueParts] = arg.slice(2).split("=");
    args[key] = valueParts.length ? valueParts.join("=") : true;
  });
  return args;
}

function richText(text) {
  const content = String(text || "");
  return content ? [{ type: "text", text: { content } }] : [];
}

function titleValue(text) {
  return { title: richText(text) };
}

function richTextValue(text) {
  return { rich_text: richText(text) };
}

function selectValue(name) {
  return name ? { select: { name } } : null;
}

function statusValue(name) {
  return name ? { status: { name } } : null;
}

function multiSelectValue(names) {
  return {
    multi_select: names.filter(Boolean).map((name) => ({ name })),
  };
}

function paragraph(text) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: richText(text) },
  };
}

function emptyParagraph() {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [] },
  };
}

function heading(level, text) {
  const type = `heading_${level}`;
  return {
    object: "block",
    type,
    [type]: {
      rich_text: richText(text),
      is_toggleable: false,
    },
  };
}

function tableRow(cells) {
  return {
    object: "block",
    type: "table_row",
    table_row: {
      cells: cells.map((cell) => richText(cell)),
    },
  };
}

function albumTable() {
  const headers = [
    "앨범",
    "아티스트",
    "장르",
    "발매일",
    "한줄평",
    "추천 수록곡",
    "에디터 노트",
    "Companion Essay",
  ];
  const emptyInputRow = ["", "", "", "", "", "", "", "없음"];
  return {
    object: "block",
    type: "table",
    table: {
      table_width: headers.length,
      has_column_header: true,
      has_row_header: false,
      children: [tableRow(headers), tableRow(emptyInputRow)],
    },
  };
}

function buildTemplateBlocks() {
  const blocks = [
    heading(2, "입력 원칙"),
    paragraph("이 문서는 분기별 결산 입력 템플릿 구조에 맞춰 정규화된 ACHA 아카이브 초안입니다. 각 티어 제목의 형식은 TIER n - 라벨을 유지합니다."),
  ];

  TIER_CANON.forEach((tier) => {
    blocks.push(heading(2, `TIER ${tier.rank} - ${tier.label}`));
    if (tier.summary) blocks.push(paragraph(tier.summary));
    (tier.criteria || []).forEach((criterion) => {
      blocks.push(paragraph(criterion));
    });
    blocks.push(albumTable());
  });

  blocks.push(heading(2, "Companion Essays"));
  blocks.push(emptyParagraph());

  return blocks;
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function notionRequest(pathname, { method = "GET", body, token }) {
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

async function findExistingTemplate({ token, dataSourceId, slug, title }) {
  const filters = [
    { property: "Slug", rich_text: { equals: slug } },
    { property: "Name", title: { equals: title } },
  ];

  for (const filter of filters) {
    const result = await notionRequest(`/data_sources/${dataSourceId}/query`, {
      method: "POST",
      token,
      body: {
        filter,
        page_size: 1,
      },
    });
    if (Array.isArray(result.results) && result.results.length) {
      return result.results[0];
    }
  }
  return null;
}

async function createTemplatePage({ token, dataSourceId, title, slug, year, quarter }) {
  const properties = {
    Name: titleValue(title),
    "Issue Title": richTextValue(title),
    Slug: richTextValue(slug),
    Issue: richTextValue("Template Draft"),
    Excerpt: richTextValue("ACHA issue source template for Quarterly archive automation."),
    Year: { number: year },
    Quarter: selectValue(quarter),
    Category: selectValue("Korean Albums"),
    Region: selectValue("Korea"),
    Language: selectValue("ko"),
    "Source Format": selectValue("Template Draft"),
    "Publication Status": statusValue("시작 전"),
    "Tier Model": selectValue("Seven-Level Albums"),
    "Has Companion Essays": { checkbox: true },
    "Companion Essay Count": { number: 0 },
    "Companion Essay Tier Labels": multiSelectValue(["ㅠㅠ", "워", "오"]),
    "업로드 확정": { checkbox: false },
  };

  const compactProperties = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value),
  );

  const page = await notionRequest("/pages", {
    method: "POST",
    token,
    body: {
      parent: {
        type: "data_source_id",
        data_source_id: dataSourceId,
      },
      properties: compactProperties,
    },
  });

  const blocks = buildTemplateBlocks();
  for (const batch of chunk(blocks, 90)) {
    await notionRequest(`/blocks/${page.id}/children`, {
      method: "PATCH",
      token,
      body: { children: batch },
    });
  }

  return page;
}

async function replacePageChildren({ token, pageId }) {
  const existingBlocks = [];
  let cursor = "";
  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (cursor) query.set("start_cursor", cursor);
    const result = await notionRequest(`/blocks/${pageId}/children?${query}`, { token });
    existingBlocks.push(...(result.results || []));
    cursor = result.has_more ? result.next_cursor : "";
  } while (cursor);

  for (const block of existingBlocks) {
    await notionRequest(`/blocks/${block.id}`, {
      method: "DELETE",
      token,
    });
  }

  const blocks = buildTemplateBlocks();
  for (const batch of chunk(blocks, 90)) {
    await notionRequest(`/blocks/${pageId}/children`, {
      method: "PATCH",
      token,
      body: { children: batch },
    });
  }

  return {
    archivedBlockCount: existingBlocks.length,
    appendedBlockCount: blocks.length,
  };
}

async function updateTemplatePageProperties({ token, pageId, title, slug, year, quarter }) {
  const properties = {
    Name: titleValue(title),
    "Issue Title": richTextValue(title),
    Slug: richTextValue(slug),
    Issue: richTextValue("Template Draft"),
    Excerpt: richTextValue("ACHA issue source template for Quarterly archive automation."),
    Year: { number: year },
    Quarter: selectValue(quarter),
    Category: selectValue("Korean Albums"),
    Region: selectValue("Korea"),
    Language: selectValue("ko"),
    "Source Format": selectValue("Template Draft"),
    "Publication Status": statusValue("시작 전"),
    "Tier Model": selectValue("Seven-Level Albums"),
    "Has Companion Essays": { checkbox: true },
    "Companion Essay Count": { number: 0 },
    "Companion Essay Tier Labels": multiSelectValue(["워"]),
    "업로드 확정": { checkbox: false },
  };

  const compactProperties = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value),
  );

  return notionRequest(`/pages/${pageId}`, {
    method: "PATCH",
    token,
    body: { properties: compactProperties },
  });
}

async function main() {
  const repoRoot = path.resolve(__dirname, "..");
  loadEnvFile(path.join(repoRoot, "functions/.env.local"));
  loadEnvFile(path.join(repoRoot, "functions/.env"));

  const args = parseArgs(process.argv.slice(2));
  const token = process.env.NOTION_API_KEY || process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error("NOTION_API_KEY or NOTION_TOKEN is required in functions/.env.local, functions/.env, or the shell environment.");
  }

  const dataSourceId = String(args.dataSourceId || process.env.NOTION_QUARTERLY_DATA_SOURCE_ID || DEFAULT_DATA_SOURCE_ID).replace(/^collection:\/\//, "");
  const title = String(args.title || DEFAULT_TITLE);
  const slug = String(args.slug || DEFAULT_SLUG);
  const year = Number(args.year || new Date().getFullYear());
  const quarter = String(args.quarter || "1Q");

  if (args.pageId) {
    const pageId = String(args.pageId).replace(/-/g, "");
    const nativeTitle = String(args.title || DEFAULT_NATIVE_TEMPLATE_TITLE);
    await updateTemplatePageProperties({
      token,
      pageId,
      title: nativeTitle,
      slug,
      year,
      quarter,
    });
    const result = await replacePageChildren({ token, pageId });
    const page = await notionRequest(`/pages/${pageId}`, { token });
    console.log(`Updated ACHA Notion template page: ${page.url}`);
    console.log(`Archived ${result.archivedBlockCount} old block(s), appended ${result.appendedBlockCount} block(s).`);
    return;
  }

  const existing = await findExistingTemplate({ token, dataSourceId, slug, title });
  if (existing && args.replaceExisting) {
    const result = await replacePageChildren({ token, pageId: existing.id });
    console.log(`Updated existing ACHA Notion template draft: ${existing.url}`);
    console.log(`Archived ${result.archivedBlockCount} old block(s), appended ${result.appendedBlockCount} block(s).`);
    return;
  }

  if (existing && !args.duplicate) {
    console.log(`ACHA Notion template draft already exists: ${existing.url}`);
    console.log("Use --replaceExisting to refresh its body, or --duplicate to create another copy.");
    return;
  }

  const page = await createTemplatePage({ token, dataSourceId, title, slug, year, quarter });
  console.log(`Created ACHA Notion template draft: ${page.url}`);
  console.log(`Data source: ${dataSourceId}`);
  console.log(`Slug: ${slug}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
