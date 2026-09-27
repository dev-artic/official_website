const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'crawl_instagram_now_artic.js'), 'utf8');

async function scenario({ dry = false, failAt = '', excluded = false, deploy = false } = {}) {
  const writes = [], commands = [], logs = [];
  let closed = false;
  const old = { url: 'https://www.instagram.com/reel/old/', caption: '공연', eventTitle: 'Curated event', date: '2026-01-01' };
  const page = {
    setUserAgent: async () => {}, setViewport: async () => {},
    goto: async () => { if (failAt === 'post') throw Error('post failure'); },
    evaluate: async () => ({ description: excluded ? '공연 #보도자료' : 'artic on April 1, 2026: "공연"', imageUrl: 'https://example.test/preview.jpg' }),
  };
  const mockRequire = (name) => {
    if (name === 'path') return path;
    if (name === 'fs') return {
      existsSync: (file) => file.endsWith('quarterly_now_artic.json'),
      readFileSync: () => JSON.stringify({ items: [old] }), mkdirSync() {},
      writeFileSync: (file, data) => writes.push({ file, data: String(data) }),
    };
    if (name === 'puppeteer') return { launch: async () => {
      if (failAt === 'launch') throw Error('launch failure');
      return { newPage: async () => { if (failAt === 'setup') throw Error('setup failure'); return page; }, close: async () => { closed = true; } };
    } };
    if (name === 'child_process') return { execSync: (cmd) => {
      commands.push(cmd);
      if (failAt && cmd.includes(failAt)) throw Error('command failure');
      if (cmd === 'git branch --show-current') return 'main';
      return cmd.includes('diff --cached --stat') ? 'data changed' : '';
    } };
    throw Error(`Unexpected module: ${name}`);
  };
  const context = vm.createContext({
    __dirname, Buffer, require: mockRequire, module: { exports: {} },
    process: { env: { NOW_ARTIC_REEL_URLS: old.url }, argv: [...(dry ? ['--dry-run'] : []), ...(deploy ? ['--deploy'] : [])] },
    console: { log: (...args) => logs.push(args.join(' ')), warn() {}, error() {} },
    setTimeout: (callback) => callback(),
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }),
  });
  vm.runInContext(source, context);
  let error;
  try { await context.module.exports.run(); } catch (err) { error = err; }
  const saved = writes.find(({ file }) => file.endsWith('quarterly_now_artic.json'));
  return { writes, commands, logs, closed, error, payload: saved && JSON.parse(saved.data) };
}

(async () => {
  for (const failAt of ['', 'launch', 'setup', 'post']) {
    const result = await scenario({ dry: true, deploy: true, failAt });
    assert.equal(result.writes.length, 0, `dry-run writes: ${failAt}`);
    assert.equal(result.commands.length, 0);
    if (failAt !== 'launch') assert.equal(result.closed, true);
  }
  const excluded = await scenario({ excluded: true });
  assert.deepEqual(excluded.payload.items, []);
  assert.equal(excluded.payload.scanned, 1);
  const success = await scenario();
  assert.equal(success.payload.items[0].eventTitle, 'Curated event');
  assert.equal(success.payload.items[0].date, '2026-04-01');
  const failedPost = await scenario({ failAt: 'post' });
  assert.equal(failedPost.payload.items[0].eventTitle, 'Curated event');
  for (const failAt of ['build_pages', 'validate_templates', 'git add', 'git commit', 'git push', 'deploy --only', 'firestore:delete']) {
    const result = await scenario({ deploy: true, failAt });
    assert.ok(result.error, failAt);
    assert.ok(result.commands.at(-1).includes(failAt), 'stops on first failure');
    assert.ok(!result.logs.some((line) => line.includes('Full deployment complete')));
  }
  const deployed = await scenario({ deploy: true });
  assert.ok(deployed.logs.some((line) => line.includes('Full deployment complete')));
  assert.ok(!deployed.commands.find((cmd) => cmd.startsWith('git add')).includes('scratch/'));
  console.log('Instagram pipeline checks passed (mocked browser, filesystem, and deployment)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
