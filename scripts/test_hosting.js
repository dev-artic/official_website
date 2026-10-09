const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = path.join(root, '_site');
const config = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
assert.equal(config.hosting.public, '_site');
assert.equal(config.hosting.site, 'artic-official-home');
assert.ok(!config.hosting.rewrites, 'Static Hosting must not reroute existing backend APIs');
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Public symlink: ${file}`);
    if (entry.isDirectory()) walk(file);
    else files.push(path.relative(output, file));
  }
}
walk(output);
for (const file of files) {
  assert.ok(!/(^|\/)(?:\.[^/]+|node_modules|functions|src|templates|scripts|scratch|docs)(\/|$)/.test(file), file);
  assert.ok(!/(?:editor\.html|serviceAccountKey\.json|\.env|\.map|\.log|\.db|\.pyc)$/.test(file), file);
}
for (const route of ['', 'about', 'admin', 'artic-le', 'contact', 'projects', 'quarterly', 'quarterly/acha',
  'projects/deus-ex-machina', 'projects/gagosian-party-music', 'projects/neutral-interview', 'projects/tasting-note', 'projects/the-root']) {
  assert.ok(files.includes(path.posix.join(route, 'index.html')), route || '/');
}
const tracked = execFileSync('git', ['ls-files', 'functions/node_modules', '.firebase'], { cwd: root, encoding: 'utf8' });
assert.equal(tracked.trim(), '', 'Dependencies and Firebase local cache must not be Git-tracked');
const bytes = files.reduce((sum, file) => sum + fs.statSync(path.join(output, file)).size, 0);
assert.ok(bytes < 100 * 1024 * 1024, 'Public bundle exceeded the expected 100 MB guard');
console.log(`Hosting checks passed: ${files.length} public files, ${(bytes / 1024 / 1024).toFixed(2)} MiB`);
