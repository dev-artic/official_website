const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pages = ['index.html', ...['about', 'admin', 'artic-le', 'contact', 'projects', 'quarterly', 'quarterly/acha',
  'projects/deus-ex-machina', 'projects/gagosian-party-music', 'projects/neutral-interview', 'projects/tasting-note', 'projects/the-root']
  .map((route) => `${route}/index.html`)];
const directives = /@(apply|reference|source|theme|custom-variant)\b/;
assert.ok(!directives.test(fs.readFileSync(path.join(root, 'css/site.css'), 'utf8')));
for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  const links = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)];
  assert.ok(links.some((match) => match[1].endsWith('css/site.css')), page);
  for (const match of links) assert.ok(fs.existsSync(path.resolve(root, path.dirname(page), match[1])), match[1]);
  for (const match of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) assert.ok(!directives.test(match[1]), page);
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => new Function(match[1]), page);
}
console.log(`Compiled styles and inline scripts validated for ${pages.length} pages`);
