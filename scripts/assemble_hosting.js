const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, '_site');
const entries = ['index.html', 'projects.json', 'about', 'admin', 'artic-le', 'contact',
  'css', 'fonts', 'images', 'js', 'projects', 'quarterly'];

function publicFile(source) {
  const relative = path.relative(root, source);
  return !relative.split(path.sep).some(part => part.startsWith('.') || part === 'node_modules')
    && !/(?:^|\/)(?:editor\.html|serviceAccountKey\.json)$/.test(relative)
    && !/\.(?:map|log|db|pyc)$/.test(relative);
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const entry of entries) {
  const source = path.join(root, entry);
  if (!fs.existsSync(source)) throw new Error(`Missing public entry: ${entry}`);
  fs.cpSync(source, path.join(output, entry), { recursive: true, filter: publicFile });
}
console.log('Assembled Firebase Hosting public files in _site/');
