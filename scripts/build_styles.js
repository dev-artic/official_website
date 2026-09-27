const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cliPackage = require.resolve('@tailwindcss/cli/package.json');
const cli = path.resolve(path.dirname(cliPackage), require(cliPackage).bin.tailwindcss);
const entry = path.join(root, 'css/tailwind.css');

function compile(input, output) {
  execFileSync(process.execPath, [cli, '-i', input, '-o', output, '--minify'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function buildSharedStyles() {
  compile(entry, path.join(root, 'css/site.css'));
}

// Keep template selectors as stable JS hooks while compiling their @apply rules.
function compilePageStyles(html) {
  const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/gi)];
  if (!styles.length) return html;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'artic-css-'));
  try {
    const input = path.join(directory, 'input.css');
    const output = path.join(directory, 'output.css');
    fs.writeFileSync(input, `@reference "${entry}";\n${styles.map((match) => match[1]).join('\n')}`);
    compile(input, output);
    const css = fs.readFileSync(output, 'utf8');
    let first = true;
    return html.replace(/<style>[\s\S]*?<\/style>/gi, () => {
      if (!first) return '';
      first = false;
      return `<style>${css}</style>`;
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

module.exports = { buildSharedStyles, compilePageStyles };
