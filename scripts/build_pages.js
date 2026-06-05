const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');
const templatesDir = path.join(baseDir, 'templates');
const srcDir = path.join(baseDir, 'src');

// 1. Read layouts
const baseLayout = fs.readFileSync(path.join(templatesDir, 'layouts/base.html'), 'utf8');
const projectLayout = fs.readFileSync(path.join(templatesDir, 'layouts/project-detail.html'), 'utf8');

// 2. Read global elements
const headerTemplate = fs.readFileSync(path.join(templatesDir, 'global/header.html'), 'utf8');
const footerTemplate = fs.readFileSync(path.join(templatesDir, 'global/footer.html'), 'utf8');
const popupTemplate = fs.readFileSync(path.join(templatesDir, 'global/popup.html'), 'utf8');

// 3. Read component templates raw contents
const buttonLinkRaw = fs.readFileSync(path.join(templatesDir, 'components/base/button-link.html'), 'utf8');
const buttonRaw = fs.readFileSync(path.join(templatesDir, 'components/base/button.html'), 'utf8');
const waitlistFormRaw = fs.readFileSync(path.join(templatesDir, 'components/forms/waitlist-form-embedded.html'), 'utf8');
const checkoutFormRaw = fs.readFileSync(path.join(templatesDir, 'components/forms/checkout-form-popup.html'), 'utf8');
const playerRaw = fs.readFileSync(path.join(templatesDir, 'components/projects/player.html'), 'utf8');
const lyricRaw = fs.readFileSync(path.join(templatesDir, 'components/projects/lyric-and-tracklist.html'), 'utf8');
const productShowcasePopupRaw = fs.readFileSync(path.join(templatesDir, 'components/projects/product-showcase-popup.html'), 'utf8');

// Global Style Collector
let pageStyles = new Set();

// Helper to separate markup and styles of templates
function parseTemplate(rawContent) {
  let styles = '';
  const cleanMarkup = rawContent.replace(/<style>([\s\S]*?)<\/style>/gi, (match, css) => {
    styles += css.trim() + '\n\n';
    return '';
  });
  return { markup: cleanMarkup.trim(), styles: styles.trim() };
}

// Pre-parsed templates
const buttonLinkTpl = parseTemplate(buttonLinkRaw);
const buttonTpl = parseTemplate(buttonRaw);
const waitlistFormTpl = parseTemplate(waitlistFormRaw);
const checkoutFormTpl = parseTemplate(checkoutFormRaw);
const playerTpl = parseTemplate(playerRaw);
const lyricTpl = parseTemplate(lyricRaw);
const productShowcasePopupTpl = parseTemplate(productShowcasePopupRaw);
const headerTpl = parseTemplate(headerTemplate);
const footerTpl = parseTemplate(footerTemplate);
const popupTpl = parseTemplate(popupTemplate);

// Front Matter Parser
function parseFrontMatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, body: content };
  }
  const yaml = match[1];
  const body = match[2];
  const data = {};
  yaml.split('\n').forEach(line => {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join(':').trim().replace(/^["'](.*)["']$/, '$1');
      data[key] = val;
    }
  });
  return { data, body };
}

// Component substitution engine
function replaceComponents(html, depth, isLayoutLevel = false, slug = '') {
  let result = html;

  if (isLayoutLevel) {
    // Compile Header, Footer & Popup templates (adapting path depth)
    const compiledHeader = headerTpl.markup
      .replace(/\{\{PATH_DEPTH\}\}/g, depth)
      .replace(/\{\{NAV_EXTRA_CLASS\}\}/g, (slug === 'index.html' ? '' : 'delayed-reveal'));
    if (headerTpl.styles) pageStyles.add(headerTpl.styles);

    const compiledFooter = footerTpl.markup.replace(/\{\{PATH_DEPTH\}\}/g, depth);
    if (footerTpl.styles) pageStyles.add(footerTpl.styles);

    const compiledPopup = popupTpl.markup.replace(/\{\{PATH_DEPTH\}\}/g, depth);
    if (popupTpl.styles) pageStyles.add(popupTpl.styles);

    result = result.replace(/\{\{HEADER\}\}/g, compiledHeader);
    result = result.replace(/\{\{FOOTER\}\}/g, compiledFooter);
    result = result.replace(/\{\{POPUP\}\}/g, compiledPopup);
  } else {
    // Strip layout placeholders in body content to avoid duplication
    result = result.replace(/\{\{HEADER\}\}/g, '');
    result = result.replace(/\{\{FOOTER\}\}/g, '');
    result = result.replace(/\{\{POPUP\}\}/g, '');
  }

  // Substitute Waitlist form
  if (result.includes('{{WAITLIST_FORM}}')) {
    result = result.replace(/\{\{WAITLIST_FORM\}\}/g, waitlistFormTpl.markup);
    if (waitlistFormTpl.styles) pageStyles.add(waitlistFormTpl.styles);
  }

  // Checkout form substitute
  if (result.includes('{{CHECKOUT_FORM}}')) {
    result = result.replace(/\{\{CHECKOUT_FORM\}\}/g, checkoutFormTpl.markup);
    if (checkoutFormTpl.styles) pageStyles.add(checkoutFormTpl.styles);
  }

  // Audio widgets substitute
  if (result.includes('{{PLAYER}}')) {
    result = result.replace(/\{\{PLAYER\}\}/g, playerTpl.markup);
    if (playerTpl.styles) pageStyles.add(playerTpl.styles);
  }
  if (result.includes('{{LYRIC_AND_TRACKLIST}}')) {
    result = result.replace(/\{\{LYRIC_AND_TRACKLIST\}\}/g, lyricTpl.markup);
    if (lyricTpl.styles) pageStyles.add(lyricTpl.styles);
  }

  // Substitute Product Showcase popup
  if (result.includes('{{PRODUCT_SHOWCASE_POPUP}}')) {
    result = result.replace(/\{\{PRODUCT_SHOWCASE_POPUP\}\}/g, productShowcasePopupTpl.markup);
    if (productShowcasePopupTpl.styles) pageStyles.add(productShowcasePopupTpl.styles);
  }

  // ── DYNAMIC BUTTON TEMPLATIZATION ──
  // 1. Text Link with arrow transition (.section-link)
  const sectionLinkRegex = /<a\s+href="([^"]+)"\s+class="section-link([^"]*)"([^>]*)>\s*<span>([^<]+)<\/span>\s*<svg[^>]*>[^]*?<\/svg>\s*<\/a>/gi;
  if (sectionLinkRegex.test(result)) {
    if (buttonLinkTpl.styles) pageStyles.add(buttonLinkTpl.styles);
    sectionLinkRegex.lastIndex = 0;
    result = result.replace(sectionLinkRegex, (match, url, extraClass, attributes, text) => {
      return buttonLinkTpl.markup
        .replace(/\{\{URL\}\}/g, url)
        .replace(/\{\{CLASS\}\}/g, extraClass.trim())
        .replace(/\{\{TEXT\}\}/g, text.trim())
        .replace(/\{\{TARGET\}\}/g, attributes.trim());
    });
  }

  // 2. Action Button (.about-action)
  const actionButtonRegex = /<a\s+href="([^"]+)"\s+class="about-action"([^>]*)>\s*(<svg[^>]*>[^]*?<\/svg>)\s*([^<]*)\s*<\/a>/gi;
  if (actionButtonRegex.test(result)) {
    if (buttonTpl.styles) pageStyles.add(buttonTpl.styles);
    actionButtonRegex.lastIndex = 0;
    result = result.replace(actionButtonRegex, (match, url, attributes, svgIcon, text) => {
      return buttonTpl.markup
        .replace(/\{\{URL\}\}/g, url)
        .replace(/\{\{TARGET\}\}/g, attributes.trim())
        .replace(/\{\{SVG_ICON\}\}/g, svgIcon.trim())
        .replace(/\{\{TEXT\}\}/g, text.trim());
    });
  }

  return result;
}

// 1. Process Static Pages
const staticPages = [
  { src: 'index.html', dest: 'index.html' },
  { src: 'about.html', dest: 'about/index.html' },
  { src: 'contact.html', dest: 'contact/index.html' },
  { src: 'quarterly.html', dest: 'quarterly/index.html' },
  { src: 'projects.html', dest: 'projects/index.html' },
  { src: 'admin.html', dest: 'admin/index.html' }
];

staticPages.forEach(p => {
  const srcPath = path.join(srcDir, p.src);
  if (!fs.existsSync(srcPath)) return;

  // Reset styles for this page
  pageStyles.clear();

  const rawContent = fs.readFileSync(srcPath, 'utf8');
  const { data, body } = parseFrontMatter(rawContent);

  const depth = data.path_depth || '';

  // Extract <style> blocks from source body
  let srcStyles = '';
  const styleMatch = body.match(/<style>([\s\S]*?)<\/style>/i);
  if (styleMatch) {
    srcStyles = styleMatch[1].trim();
  }

  // Extract <script> blocks from source body
  let additionalScripts = '';
  const scriptMatch = body.match(/<script>([\s\S]*?)<\/script>/i);
  if (scriptMatch) {
    additionalScripts += `<script>\n${scriptMatch[1]}\n</script>`;
  }

  // Strip scripts and styles out of raw body
  let pageContent = body
    .replace(/<style>[\s\S]*?<\/style>/gi, '')
    .replace(/<script>[\s\S]*?<\/script>/gi, '');

  // Perform substitution
  pageContent = replaceComponents(pageContent, depth, false, p.dest);

  // Combine component styles and page custom styles
  if (srcStyles) pageStyles.add(srcStyles);
  
  let additionalHead = data.additional_head || '';
  if (pageStyles.size > 0) {
    additionalHead += `\n<style>\n${Array.from(pageStyles).join('\n\n')}\n</style>`;
  }

  let pageTitle = data.title || 'artic.';
  if (p.dest === 'index.html') {
    pageTitle = 'artic.';
  } else {
    const capitalized = pageTitle.charAt(0).toUpperCase() + pageTitle.slice(1);
    pageTitle = `${capitalized} | artic.`;
  }

  // Assemble base page layout (inject headers at layout-level = true)
  let finalHtml = baseLayout
    .replace(/\{\{PAGE_TITLE\}\}/g, pageTitle)
    .replace(/\{\{META_DESCRIPTION\}\}/g, data.description || '')
    .replace(/\{\{PATH_DEPTH\}\}/g, depth)
    .replace(/\{\{ADDITIONAL_HEAD\}\}/g, additionalHead)
    .replace(/\{\{ADDITIONAL_SCRIPTS\}\}/g, additionalScripts)
    .replace(/\{\{HEADER\}\}/g, replaceComponents('{{HEADER}}', depth, true, p.dest))
    .replace(/\{\{FOOTER\}\}/g, replaceComponents('{{FOOTER}}', depth, true, p.dest))
    .replace(/\{\{CONTENT\}\}/g, pageContent);

  const destFullPath = path.join(baseDir, p.dest);
  const destDir = path.dirname(destFullPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.writeFileSync(destFullPath, finalHtml, 'utf8');
  console.log(`Compiled page source: ${p.src} -> ${p.dest}`);
});

// 2. Process Project Pages
const projectDirs = [
  'deus-ex-machina',
  'gagosian-party-music',
  'neutral-interview',
  'tasting-note',
  'the-root'
];

projectDirs.forEach(slugName => {
  const projectDir = path.join(srcDir, 'projects', slugName);
  if (!fs.existsSync(projectDir)) return;

  // Reset styles for this project
  pageStyles.clear();

  // Load files
  const meta = JSON.parse(fs.readFileSync(path.join(projectDir, 'meta.json'), 'utf8'));
  const stylesContent = fs.readFileSync(path.join(projectDir, 'styles.css'), 'utf8').trim();
  const scriptsContent = fs.readFileSync(path.join(projectDir, 'scripts.js'), 'utf8').trim();
  let leftContent = fs.readFileSync(path.join(projectDir, 'left.html'), 'utf8').trim();
  let rightContent = fs.readFileSync(path.join(projectDir, 'right.html'), 'utf8').trim();

  let popupContent = '';
  const popupPath = path.join(projectDir, 'popup.html');
  if (fs.existsSync(popupPath)) {
    popupContent = fs.readFileSync(popupPath, 'utf8').trim();
  }

  const depth = meta.path_depth || '../';
  const coverImage = meta.cover_image || 'album-art.png';

  // Format script tag
  // Strip HTML comments from components before injecting into JS to avoid backtick-in-comment SyntaxErrors
  function stripHtmlComments(str) {
    return str.replace(/<!--[\s\S]*?-->/g, '');
  }
  let additionalScripts = '';
  if (scriptsContent) {
    const processedScripts = replaceComponents(scriptsContent, depth, false);
    // Strip HTML comments only from injected component regions, not the entire script
    const safeScripts = processedScripts.replace(/<!--[\s\S]*?-->/g, '');
    additionalScripts = `<script>\n${safeScripts}\n</script>`;
  }

  // Inject popup modal
  let projectPopupHtml = '';
  if (popupContent) {
    const substitutedPopupBody = replaceComponents(popupContent, depth, false);
    projectPopupHtml = `<!-- Reusable Glassmorphic Popup/Modal Container -->
<div class="print-modal" id="print-modal">
  <div class="print-modal-backdrop" id="print-modal-backdrop"></div>
  <div class="print-modal-container">
    <button class="print-modal-close" id="print-modal-close" aria-label="Close modal">&times;</button>
    <div class="print-modal-content" id="print-modal-content">
      ${substitutedPopupBody}
    </div>
  </div>
</div>`;
  }

  // Replace components on left and right columns
  leftContent = replaceComponents(leftContent, depth, false);
  rightContent = replaceComponents(rightContent, depth, false);

  // Generate header/footer HTML first (layout-level substitution)
  let headerHtml = replaceComponents('{{HEADER}}', depth, true, slugName);
  let footerHtml = replaceComponents('{{FOOTER}}', depth, true, slugName);

  // Inject header/footer INTO the raw layout BEFORE replaceComponents strips them
  const layoutWithHeaderFooter = projectLayout
    .replace(/\{\{HEADER\}\}/g, headerHtml)
    .replace(/\{\{FOOTER\}\}/g, footerHtml);

  // Now run replaceComponents on the already-injected layout (safe to use false since header/footer are gone)
  const compiledLayout = replaceComponents(layoutWithHeaderFooter, depth, false, slugName);

  // Combine component styles and page custom styles
  if (stylesContent) pageStyles.add(stylesContent);

  let additionalHead = '';
  if (pageStyles.size > 0) {
    additionalHead = `<style>\n${Array.from(pageStyles).join('\n\n')}\n</style>`;
  }

  let finalHtml = compiledLayout
    .replace(/\{\{PROJECT_TITLE\}\}/g, meta.title || '')
    .replace(/\{\{PROJECT_ARTIST\}\}/g, meta.artist || '')
    .replace(/\{\{PROJECT_META\}\}/g, meta.meta || '')

    .replace(/\{\{COVER_IMAGE\}\}/g, coverImage)
    .replace(/\{\{PATH_DEPTH\}\}/g, depth)
    .replace(/\{\{ADDITIONAL_HEAD\}\}/g, additionalHead)
    .replace(/\{\{ADDITIONAL_SCRIPTS\}\}/g, additionalScripts)
    .replace(/\{\{LEFT_COLUMN_CONTENT\}\}/g, leftContent)
    .replace(/\{\{RIGHT_COLUMN_CONTENT\}\}/g, rightContent);

  if (projectPopupHtml) {
    finalHtml = finalHtml.replace('</body>', `  ${projectPopupHtml}\n</body>`);
  }

  // Output compilation result
  const destDir = path.join(baseDir, 'projects', slugName);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const destFullPath = path.join(destDir, 'index.html');
  fs.writeFileSync(destFullPath, finalHtml, 'utf8');
  console.log(`Compiled project detail page: ${slugName} -> projects/${slugName}/index.html`);
});

console.log("All pages compiled successfully with styling injection optimized and duplicate headers resolved!");
