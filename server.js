const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const LYRICS_DB_FILE = path.join(__dirname, 'scratch', 'synced_lyrics_estimate.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function handleGetLyrics(req, res) {
  try {
    const dbPath = LYRICS_DB_FILE;
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } else {
      console.log('Lyrics database file not found. Attempting to restore from src/projects/deus-ex-machina/scripts.js...');
      const srcScriptsPath = path.join(__dirname, 'src', 'projects', 'deus-ex-machina', 'scripts.js');
      if (fs.existsSync(srcScriptsPath)) {
        const scriptsContent = fs.readFileSync(srcScriptsPath, 'utf8').replace(/\r\n/g, '\n');
        // Match the LYRICS_DATA block
        const match = scriptsContent.match(/const\s+LYRICS_DATA\s*=\s*(\{[\s\S]*?\});\s*(?:var|let|const)\s+currentIdx/);
        if (match) {
          const lyricsDataStr = match[1];
          const vm = require('vm');
          const sandbox = {};
          vm.runInNewContext('lyrics = ' + lyricsDataStr, sandbox);
          const lyricsData = sandbox.lyrics;

          // Ensure parent directory exists (scratch/)
          const scratchDir = path.dirname(dbPath);
          if (!fs.existsSync(scratchDir)) {
            fs.mkdirSync(scratchDir, { recursive: true });
          }

          // Save to database file to persist
          fs.writeFileSync(dbPath, JSON.stringify(lyricsData, null, 2), 'utf8');
          console.log('Successfully restored lyrics database from scripts.js and saved to scratch/synced_lyrics_estimate.json');
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(lyricsData));
        } else {
          console.error('Failed to parse LYRICS_DATA from scripts.js (regex mismatch)');
          sendJSON(res, 404, { error: 'Lyrics database not found and fallback parser failed' });
        }
      } else {
        console.error('scripts.js not found, cannot fallback');
        sendJSON(res, 404, { error: 'Lyrics database and source scripts.js not found' });
      }
    }
  } catch (e) {
    console.error('Error in handleGetLyrics:', e);
    sendJSON(res, 500, { error: e.message });
  }
}

function handleSaveLyrics(req, res, bodyText) {
  try {
    const data = JSON.parse(bodyText);
    const { vid, lyrics } = data;

    if (!vid || !Array.isArray(lyrics)) {
      return sendJSON(res, 400, { error: 'Missing required fields (vid, lyrics)' });
    }

    const dbPath = LYRICS_DB_FILE;
    let database = {};
    if (fs.existsSync(dbPath)) {
      database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }

    database[vid] = lyrics;

    fs.writeFileSync(dbPath, JSON.stringify(database, null, 2), 'utf8');
    console.log(`Updated lyrics database in scratch for video: ${vid}`);

    // Update the source file scripts.js
    const srcScriptsPath = path.join(__dirname, 'src', 'projects', 'deus-ex-machina', 'scripts.js');
    if (fs.existsSync(srcScriptsPath)) {
      let scriptsContent = fs.readFileSync(srcScriptsPath, 'utf8').replace(/\r\n/g, '\n');
      const databaseJsonStr = JSON.stringify(database, null, 2);
      const databaseJsonIndented = databaseJsonStr.replace(/\n/g, '\n      ');

      const regexLy = /const LYRICS_DATA = \{[\s\S]*?\};\s*var currentIdx = 0;/;
      if (regexLy.test(scriptsContent)) {
        scriptsContent = scriptsContent.replace(regexLy, `const LYRICS_DATA = ${databaseJsonIndented};\n      var currentIdx = 0;`);
        fs.writeFileSync(srcScriptsPath, scriptsContent.replace(/\n/g, '\r\n'), 'utf8');
        console.log(`Injected updated lyrics database into src/projects/deus-ex-machina/scripts.js`);

        // Run build_pages.js compilation
        try {
          const { execSync } = require('child_process');
          execSync('node scripts/build_pages.js', { cwd: __dirname });
          console.log(`Successfully compiled pages after saving lyrics.`);
          sendJSON(res, 200, { success: true, message: 'Lyrics saved and project compiled successfully.' });
        } catch (buildErr) {
          console.error('Failed to run build_pages.js compilation:', buildErr);
          sendJSON(res, 500, { error: 'Lyrics saved to source but build compilation failed: ' + buildErr.message });
        }
      } else {
        console.error('ERROR: LYRICS_DATA block target not found in src/projects/deus-ex-machina/scripts.js');
        sendJSON(res, 500, { error: 'Failed to inject lyrics into scripts.js. LYRICS_DATA block not found.' });
      }
    } else {
      console.error('ERROR: src/projects/deus-ex-machina/scripts.js does not exist.');
      sendJSON(res, 500, { error: 'Failed to inject lyrics. Source scripts.js file not found.' });
    }
  } catch (e) {
    console.error('Error handling save-lyrics:', e);
    sendJSON(res, 500, { error: e.message });
  }
}

async function proxyToEmulator(req, res, bodyText, emulatorPath) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost:8000'}`);
  const emulatorUrl = `http://127.0.0.1:5001/artic-official-home/us-central1/${emulatorPath}${url.search}`;
  console.log(`[PROXY] Forwarding ${req.method} ${req.url} ➔ ${emulatorUrl}`);

  try {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() !== 'host') {
        headers[key] = value;
      }
    }

    const options = {
      method: req.method,
      headers: headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && bodyText !== null) {
      options.body = bodyText;
    }

    const response = await fetch(emulatorUrl, options);
    
    const resHeaders = {};
    response.headers.forEach((value, key) => {
      resHeaders[key] = value;
    });

    res.writeHead(response.status, resHeaders);
    const responseText = await response.text();
    res.end(responseText);
  } catch (err) {
    console.error(`[PROXY ERROR] Failed to connect to emulator at ${emulatorUrl}:`, err);
    sendJSON(res, 502, { error: `Bad Gateway: Local Firebase Emulator Suite is not running or unreachable. Please run 'npm run dev' to start all services. (${err.message})` });
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  // Handle API requests
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (req.url === '/api/checkout') {
        proxyToEmulator(req, res, body, 'checkout');
      } else if (req.url === '/api/waitlist') {
        proxyToEmulator(req, res, body, 'waitlist');
      } else if (req.url === '/api/save-lyrics') {
        handleSaveLyrics(req, res, body);
      } else if (req.url.startsWith('/api/admin/products')) {
        proxyToEmulator(req, res, body, 'admin');
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end();
    return;
  }

  if (req.method === 'GET') {
    if (req.url === '/api/get-lyrics') {
      handleGetLyrics(req, res);
      return;
    } else if (req.url === '/api/products') {
      proxyToEmulator(req, res, null, 'products');
      return;
    } else if (req.url.startsWith('/api/admin/data')) {
      proxyToEmulator(req, res, null, 'admin');
      return;
    }
  }

  // Serve static files
  const requestUrl = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
  let safeUrl = requestUrl.pathname;
  const directoryPath = path.join(__dirname, safeUrl);

  if (!safeUrl.endsWith('/') && directoryPath.startsWith(__dirname)) {
    try {
      if (fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory()) {
        res.writeHead(301, { Location: `${safeUrl}/${requestUrl.search}` });
        res.end();
        return;
      }
    } catch (err) {
      console.error(`Failed to inspect static path ${directoryPath}:`, err);
    }
  }

  if (safeUrl.endsWith('/')) {
    safeUrl += 'index.html';
  }

  const filePath = path.join(__dirname, safeUrl);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    
    if (req.method === 'HEAD') {
      res.end();
    } else {
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Starting Custom artic. Node Proxy Server on port ${PORT}...`);
  console.log(`Open http://localhost:${PORT} in your browser to view the site.`);
});
