const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Evaluate helpers without starting a browser, writing data, or deploying.
function loadHelpers(file) {
  const source = fs.readFileSync(file, 'utf8').split('\nif (require.main === module)')[0];
  const context = vm.createContext({
    require: (name) => name === 'puppeteer' ? {} : require(name),
    __dirname,
    process: { env: { NOW_ARTIC_SCROLL_PASSES: '2', NOW_ARTIC_MAX_REELS: '3' }, argv: [] },
    console: { log() {} },
    setTimeout: (callback) => callback(),
  });
  vm.runInContext(source, context);
  return context;
}

async function check(file) {
  const helpers = loadHelpers(file);
  const captions = ['', null, '실시간 공연', '오늘자 라이브', '어제자 콘서트', '현장',
    'venue somewhere', 'VENUE somewhere', '실시간 #보도자료', '공연 TASTING NOTE',
    '라이브 Source | artist', '라이브 Source| artist'];
  const labels = captions.map((caption) => helpers.labelFromCaption(caption));
  assert.deepEqual(labels, ['', '', '실시간', '오늘자', '어제자', '현장', '현장', '', '', '', '', '']);
  const metadata = captions.map((caption) => helpers.parseInstagramMetaDescription(
    `artic on September 20, 2026: "  ${caption || ''}  \\n next line " .`
  ));
  const titles = captions.map((caption) => helpers.deriveEventTitle(caption));
  assert.equal(helpers.parseInstagramMetaDescription('artic on April 1, 2026: "공연"').date, '2026-04-01');
  assert.equal(helpers.quarterFromDate('2026-04-01').quarter, 'Q2');
  assert.equal(helpers.getInstagramEmbedUrl('https://www.instagram.com/shop/reel/abc/'), 'https://www.instagram.com/reel/abc/embed/');
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../functions/data/quarterly_now_artic.json')));
  for (const item of data.items.slice(0, 3)) assert.equal(helpers.deriveEventTitle(item.fullCaption), item.eventTitle);
  assert.equal(helpers.deriveEventTitle('artic.이 현장에 함께했습니다.'), '');
  const venues = ['Venue | @club Thanks everyone', 'venue @club', '', null]
    .map((caption) => helpers.deriveVenue(caption));
  assert.equal(venues[0], 'club');

  const reels = 'https://www.instagram.com/artic.live/reels/';
  const profile = 'https://www.instagram.com/artic.live/';
  const calls = [];
  const page = {
    async goto(url, options) { calls.push([url, options]); this.url = url; },
    async evaluate(callback) {
      return vm.runInNewContext(`(${callback})()`, {
        window: { innerHeight: 900, scrollBy: (...args) => calls.push(args) },
        document: { querySelectorAll: () => (this.url === reels
          ? ['a', 'a', '', 'b'] : ['b', 'c', 'd', 'c']).map((href) => ({ href })) },
      });
    },
  };
  const urls = await helpers.collectReelUrls(page);
  assert.equal(JSON.stringify(urls), JSON.stringify(['a', 'b', 'c']));
  assert.deepEqual(calls.map((call) => call[0]), [reels, 0, 0, profile, 0, 0]);
  return JSON.stringify({ labels, metadata, titles, venues, urls, calls });
}

(async () => {
  const actual = await check(path.join(__dirname, 'crawl_instagram_now_artic.js'));
  if (process.argv[2]) assert.equal(actual, await check(process.argv[2]));
  console.log('Instagram crawler regression checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
