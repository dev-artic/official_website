#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const {
  getDataSourceId,
  getNotionPage,
  getNotionToken,
  inferQuarterlyIssueProperties,
  parseIssueBlocks,
  queryQuarterlyPagesRaw,
  updateNotionPageProperties,
} = require("../functions/quarterly_notion");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  fs.readFileSync(filePath, "utf8").split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separator = trimmed.indexOf("=");
    if (separator < 0) return;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
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

function pageTitle(page) {
  return Object.values(page.properties || {})
    .find((prop) => prop.type === "title")
    ?.title?.map((item) => item.plain_text || "")
    .join("")
    .trim() || page.url || page.id;
}

async function normalizePage({ token, page, args }) {
  const parsedBlocks = await parseIssueBlocks(token, page.id, { includeSourceMetadata: false });
  const inferred = inferQuarterlyIssueProperties(page, parsedBlocks);
  const title = pageTitle(page);
  const status = page.properties?.["Publication Status"]?.status?.name || "";
  const uploadConfirmed = page.properties?.["업로드 확정"]?.checkbox === true;
  const isTemplateItself = /template/i.test(title);

  if (!inferred.diagnostics.albumCount && !args.allowEmpty) {
    return { status: "skipped", title, reason: "no album rows" };
  }
  if (isTemplateItself && !args.includeTemplateDrafts && !args.pageId) {
    return { status: "skipped", title, reason: "template draft" };
  }
  if (status === "완료" && uploadConfirmed && !args.includePublished && !args.pageId) {
    return { status: "skipped", title, reason: "already published" };
  }

  if (args.dryRun) {
    return { status: "dry-run", title, inferred: inferred.diagnostics, properties: inferred.properties };
  }

  const result = await updateNotionPageProperties(token, page.id, inferred.properties);
  return { status: "updated", pageId: result.id, title: inferred.properties["Issue Title"], inferred: inferred.diagnostics };
}

async function main() {
  const repoRoot = path.resolve(__dirname, "..");
  loadEnvFile(path.join(repoRoot, "functions/.env.local"));
  loadEnvFile(path.join(repoRoot, "functions/.env"));

  const args = parseArgs(process.argv.slice(2));
  const token = getNotionToken();
  if (!token) {
    throw new Error("NOTION_API_KEY or NOTION_TOKEN is required.");
  }

  const pages = args.pageId
    ? [await getNotionPage(token, String(args.pageId))]
    : await queryQuarterlyPagesRaw(token, getDataSourceId());

  const results = [];
  for (const page of pages) {
    try {
      results.push(await normalizePage({ token, page, args }));
    } catch (err) {
      results.push({ status: "error", title: pageTitle(page), error: err.message });
    }
  }

  const summary = results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({ summary, results }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
