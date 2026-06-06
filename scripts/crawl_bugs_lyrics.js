const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Parse CLI arguments: --artist="Artist Name" --album="Album Name"
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(val => {
    const parts = val.split('=');
    if (parts[0].startsWith('--')) {
      const key = parts[0].substring(2);
      args[key] = parts.slice(1).join('=');
    }
  });
  return args;
}

async function run() {
  const args = parseArgs();
  const artist = args.artist || 'arkyteccc';
  const album = args.album || 'deus ex machina';

  console.log(`==================================================`);
  console.log(`Bugs Music Lyrics Auto-Crawler`);
  console.log(`Target Artist : ${artist}`);
  console.log(`Target Album  : ${album}`);
  console.log(`==================================================`);

  const query = `${artist} ${album}`;
  
  // Launch Puppeteer browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set realistic User-Agent to avoid anti-bot blocks
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  try {
    let albumLinkHref = null;
    if (args.albumId) {
      albumLinkHref = `https://music.bugs.co.kr/album/${args.albumId}`;
      console.log(`[Step 1-3] Using directly provided Album ID: ${args.albumId}`);
    } else {
      // 1. Navigate to Bugs home
      console.log(`[Step 1] Navigating to Bugs Music homepage...`);
      await page.goto('https://music.bugs.co.kr/', { waitUntil: 'networkidle2', timeout: 30000 });

      // 2. Search for artist and album
      console.log(`[Step 2] Searching for: "${query}"...`);
      await page.waitForSelector('#headerSearchInput', { visible: true });
      await page.type('#headerSearchInput', query);
      
      // Trigger form submit
      await Promise.all([
        page.keyboard.press('Enter'),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
      ]);

      // 3. Locate the Album and navigate
      console.log(`[Step 3] Locating album in search results...`);
      
      // Find the first album link under album search section
      albumLinkHref = await page.evaluate((albumTitle, artistName) => {
        // Look for Album section headers or lists
        const albumRows = document.querySelectorAll('table.list.albumList tbody tr, .albumList li');
        if (albumRows.length === 0) {
          // Fallback: try finding any link containing album url pattern
          const allAlbumLinks = Array.from(document.querySelectorAll('a[href*="/album/"]'));
          for (let a of allAlbumLinks) {
            const text = a.textContent.toLowerCase();
            if (text.includes(albumTitle.toLowerCase())) {
              return a.href;
            }
          }
          return null;
        }

        // Check rows for match
        for (let row of albumRows) {
          const titleEl = row.querySelector('.albumTitle, a.title, .title');
          const artistEl = row.querySelector('.artist, a.artist, .artistName');
          if (titleEl) {
            const tText = titleEl.textContent.trim().toLowerCase();
            const aText = artistEl ? artistEl.textContent.trim().toLowerCase() : '';
            
            if (tText.includes(albumTitle.toLowerCase()) || albumTitle.toLowerCase().includes(tText)) {
              const link = titleEl.tagName === 'A' ? titleEl : titleEl.querySelector('a');
              if (link) return link.href;
            }
          }
        }
        
        // Secondary fallback: return the first album link found
        const firstRowLink = document.querySelector('table.list.albumList tbody tr .albumTitle a, .albumList li a');
        return firstRowLink ? firstRowLink.href : null;
      }, album, artist);
    }

    if (!albumLinkHref) {
      throw new Error(`Failed to find album "${album}" in Bugs search results.`);
    }

    console.log(`[Step 3] Going to Album page: ${albumLinkHref}`);
    await page.goto(albumLinkHref, { waitUntil: 'networkidle2', timeout: 30000 });

    // 4. Extract track list and 곡정보 track urls
    console.log(`[Step 4] Extracting track list & song links...`);
    await page.waitForSelector('table.list.trackList', { timeout: 10000 });
    
    const tracks = await page.evaluate(() => {
      const trackRows = document.querySelectorAll('table.list.trackList tbody tr');
      const list = [];
      trackRows.forEach(row => {
        const titleEl = row.querySelector('p.title a');
        const infoBtn = row.querySelector('a.trackInfo');
        if (titleEl && infoBtn) {
          list.push({
            title: titleEl.textContent.trim(),
            infoUrl: infoBtn.href
          });
        }
      });
      return list;
    });

    if (tracks.length === 0) {
      throw new Error(`No tracks found on the album page.`);
    }

    console.log(`[Step 4] Found ${tracks.length} tracks in album.`);
    tracks.forEach((t, i) => console.log(`  Track ${i+1}: "${t.title}" -> ${t.infoUrl}`));

    // 5. Navigate to each track page and scrape lyrics
    console.log(`\n[Step 5] Crawling full lyrics for each track...`);
    const scrapedDatabase = {};

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      console.log(`  [${i+1}/${tracks.length}] Scraping: "${track.title}"...`);
      
      await page.goto(track.infoUrl, { waitUntil: 'networkidle2', timeout: 20000 });
      
      // Parse lyrics text
      const lyricsText = await page.evaluate(() => {
        const container = document.querySelector('.lyricsContainer xmp, .lyricsContainer');
        if (!container) return null;
        
        // Remove inner scripts/styles if any
        const cloned = container.cloneNode(true);
        const scripts = cloned.querySelectorAll('script, style');
        scripts.forEach(s => s.remove());
        
        return cloned.textContent.trim();
      });

      if (lyricsText) {
        // Clean lyrics into individual lines and map to initial sync objects {time: 0, text: line}
        const lines = lyricsText
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.startsWith('[') && !line.endsWith(']')); // Skip headers like [Chorus] if desired
        
        const lyricObjects = lines.map(line => ({
          time: 0.0,
          text: line
        }));

        scrapedDatabase[track.title] = lyricObjects;
        console.log(`    -> Success (${lyricObjects.length} lines parsed)`);
      } else {
        console.warn(`    -> No lyrics found for track "${track.title}" (instrumental?)`);
        scrapedDatabase[track.title] = [];
      }
      
      // Friendly sleep to avoid hammering the server
      await new Promise(r => setTimeout(r, 1500));
    }

    // Save final output to scratch/crawled_lyrics_draft.json
    const outputDir = path.join(__dirname, '..', 'scratch');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, 'crawled_lyrics_draft.json');
    fs.writeFileSync(outputPath, JSON.stringify(scrapedDatabase, null, 2), 'utf8');

    console.log(`\n==================================================`);
    console.log(`SUCCESS: All track lyrics crawled successfully!`);
    console.log(`Result draft saved to: ${outputPath}`);
    console.log(`You can copy elements of this JSON file to feed the lyrics editor database.`);
    console.log(`==================================================`);

  } catch (err) {
    console.error(`\n[CRITICAL ERROR] Crawling failed:`, err.message);
  } finally {
    await browser.close();
  }
}

run();
