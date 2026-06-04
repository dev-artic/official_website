const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const PORT = 8000;
const DB_FILE = path.join(__dirname, 'orders.db');

// Initialize database
let db;
try {
  db = new DatabaseSync(DB_FILE);
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      depositor TEXT NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS quarterly_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Local SQLite database initialized successfully.');
} catch (err) {
  console.error('Failed to initialize SQLite database:', err);
}

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
    const dbPath = 'C:\\Users\\LA723SL\\.gemini\\antigravity\\brain\\ddca7f1f-7e16-43a7-9ee5-ead2777abd97\\scratch\\synced_lyrics_estimate.json';
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } else {
      sendJSON(res, 404, { error: 'Lyrics database not found' });
    }
  } catch (e) {
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

    const dbPath = 'C:\\Users\\LA723SL\\.gemini\\antigravity\\brain\\ddca7f1f-7e16-43a7-9ee5-ead2777abd97\\scratch\\synced_lyrics_estimate.json';
    let database = {};
    if (fs.existsSync(dbPath)) {
      database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }

    database[vid] = lyrics;

    fs.writeFileSync(dbPath, JSON.stringify(database, null, 2), 'utf8');
    console.log(`Updated lyrics database in scratch for video: ${vid}`);

    const htmlPath = path.join(__dirname, 'deus-ex-machina', 'index.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf8').replace(/\r\n/g, '\n');

    const databaseJsonStr = JSON.stringify(database, null, 2);
    const databaseJsonIndented = databaseJsonStr.replace(/\n/g, '\n      ');

    const regexLy = /const LYRICS_DATA = \{[\s\S]*?\};\s*var currentIdx = 0;/;
    if (regexLy.test(htmlContent)) {
      htmlContent = htmlContent.replace(regexLy, `const LYRICS_DATA = ${databaseJsonIndented};\n      var currentIdx = 0;`);
      fs.writeFileSync(htmlPath, htmlContent.replace(/\n/g, '\r\n'), 'utf8');
      console.log(`Injected updated lyrics database into deus-ex-machina/index.html`);
      sendJSON(res, 200, { success: true, message: 'Lyrics saved and injected successfully.' });
    } else {
      console.error('ERROR: LYRICS_DATA block target not found in index.html');
      sendJSON(res, 500, { error: 'Failed to inject lyrics into HTML. LYRICS_DATA block not found.' });
    }
  } catch (e) {
    console.error('Error handling save-lyrics:', e);
    sendJSON(res, 500, { error: e.message });
  }
}

function handleCheckout(req, res, bodyText) {
  try {
    const data = JSON.parse(bodyText);
    const { name, email, phone, address, quantity = 1, notes = '' } = data;
    const depositor = data.depositor || name;

    if (!name || !email || !phone || !address) {
      return sendJSON(res, 400, { error: 'Missing required fields' });
    }

    if (db) {
      const insert = db.prepare(`
        INSERT INTO orders (name, email, phone, address, quantity, depositor, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(name, email, phone, address, Number(quantity), depositor, notes);
      console.log(`Checkout successfully saved to local SQLite database for ${name}.`);
    }

    // Mock Email Output
    const total_price = 15000 * Number(quantity) + 3000;
    console.log('\n=== [EMAIL MOCK - Customer] ===');
    console.log(`To: ${email}`);
    console.log(`Subject: [artic.] 1MC1PD: The Interview 寃곗젣 ?붿껌 ?꾨즺`);
    console.log(`Body:
?덈뀞?섏꽭?? ${name}?? artic. ?낅땲??

'1MC1PD: The Interview' 寃곗젣 ?붿껌???묒닔?섏뿀?듬땲??
?꾨옒 怨꾩쥖濡?二쇰Ц 湲덉븸???낃툑??二쇱떆硫??낃툑 ?뺤씤 ??諛곗넚??吏꾪뻾???쒕━寃좎뒿?덈떎.

[二쇰Ц ?뺣낫]
- ?곹뭹紐? 1MC1PD: The Interview (Limited Edition)
- ?섎웾: ${quantity}媛?- 珥?寃곗젣 湲덉븸: ${total_price.toLocaleString()}??(?곹뭹媛 15,000??* ?섎웾 + 諛곗넚鍮?3,000??
- ?낃툑?먮챸: ${depositor}
- 諛곗넚吏 二쇱냼: ${address}
- ?곕씫泥? ${phone}

[?낃툑 怨꾩쥖 ?뺣낫]
- ??? ?좎뒪諭낇겕
- 怨꾩쥖踰덊샇: 1002-1532-0842
- ?덇툑二? 源誘쇱젣

臾몄쓽 ?ы빆???덉쑝??寃쎌슦 admin@artic.live 濡?硫붿씪??蹂대궡二쇱떆湲?諛붾엻?덈떎.
媛먯궗?⑸땲??

??2026 artic. All Rights Reserved.`);
    console.log('================================\n');

    sendJSON(res, 200, { success: true, saved_to_cloud: false });
  } catch (e) {
    console.error('Error handling checkout:', e);
    sendJSON(res, 500, { error: e.message });
  }
}

function handleWaitlist(req, res, bodyText) {
  try {
    const data = JSON.parse(bodyText);
    const { email } = data;

    if (!email) {
      return sendJSON(res, 400, { error: 'Email is required' });
    }

    if (db) {
      // Check duplicate
      const stmt = db.prepare('SELECT 1 FROM quarterly_subscribers WHERE email = ? LIMIT 1');
      const row = stmt.get(email);
      if (row) {
        return sendJSON(res, 400, { error: 'This email is already registered. Stay tuned!' });
      }

      const insert = db.prepare('INSERT INTO quarterly_subscribers (email) VALUES (?)');
      insert.run(email);
      console.log(`Waitlist subscriber successfully saved to SQLite: ${email}`);
    }

    sendJSON(res, 200, { success: true, saved_to_cloud: false });
  } catch (e) {
    console.error('Error handling waitlist:', e);
    sendJSON(res, 500, { error: e.message });
  }
}

const server = http.createServer((req, res) => {
  // Add no-cache headers for development
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  // Handle API requests
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (req.url === '/api/checkout') {
        handleCheckout(req, res, body);
      } else if (req.url === '/api/waitlist') {
        handleWaitlist(req, res, body);
      } else if (req.url === '/api/save-lyrics') {
        handleSaveLyrics(req, res, body);
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

  if (req.method === 'GET' && req.url === '/api/get-lyrics') {
    handleGetLyrics(req, res);
    return;
  }

  // Serve static files
  let safeUrl = req.url.split('?')[0];
  if (safeUrl.endsWith('/')) {
    safeUrl += 'index.html';
  }

  const filePath = path.join(__dirname, safeUrl);

  // Simple path traversal check
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If it's a directory without index.html or file not found
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
  console.log(`Starting Custom artic. Node Server on port ${PORT}...`);
  console.log(`Open http://localhost:${PORT} in your browser to view the site.`);
});