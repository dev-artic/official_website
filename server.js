const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const PORT = 8000;
const DB_FILE = path.join(__dirname, 'orders.db');
const USER_HOME = process.env.HOME || process.env.USERPROFILE || '';
const LYRICS_DB_FILE = path.join(USER_HOME, '.gemini', 'antigravity', 'brain', 'cb6b594a-9879-4961-846b-0df33fc8b311', 'scratch', 'synced_lyrics_estimate.json');

// Initialize database
let db;
try {
  db = new DatabaseSync(DB_FILE);
  
  // 1. Create orders table
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
      product_id TEXT,
      product_name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrate orders if schema is old
  try {
    db.exec('ALTER TABLE orders ADD COLUMN product_id TEXT;');
  } catch (e) {}
  try {
    db.exec('ALTER TABLE orders ADD COLUMN product_name TEXT;');
  } catch (e) {}

  // 2. Create products table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      inventory INTEGER NOT NULL,
      status TEXT NOT NULL
    );
  `);

  // Seed default products if empty
  const prodCheck = db.prepare("SELECT COUNT(*) as count FROM products").get();
  if (prodCheck.count === 0) {
    const insertProd = db.prepare("INSERT INTO products (id, name, price, inventory, status) VALUES (?, ?, ?, ?, ?)");
    insertProd.run('1mc1pd', '1MC1PD: The Interview', 15000, 10, 'for-sale');
    insertProd.run('lyric-booklet', 'Lyric Booklet', 0, 0, 'not-for-sale');
    console.log('Seeded default products in SQLite.');
  }

  // 3. Create consolidated subscribers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      type TEXT DEFAULT 'quarterly',
      welcome_email_sent INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrate quarterly_subscribers to subscribers if old table exists
  try {
    const qSubscribersTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='quarterly_subscribers'").get();
    if (qSubscribersTableExists) {
      let rows = [];
      try {
        rows = db.prepare("SELECT email, name, created_at FROM quarterly_subscribers").all();
      } catch (e) {
        rows = db.prepare("SELECT email, created_at FROM quarterly_subscribers").all();
      }
      const insertSub = db.prepare("INSERT OR IGNORE INTO subscribers (email, name, type, welcome_email_sent, created_at) VALUES (?, ?, 'quarterly', 1, ?)");
      for (const row of rows) {
        insertSub.run(row.email, row.name || '', row.created_at);
      }
      db.exec("DROP TABLE quarterly_subscribers;");
      console.log('Database migrated: quarterly_subscribers data merged into subscribers table.');
    }
  } catch (migErr) {
    console.error('Migration warning for subscribers:', migErr);
  }

  console.log('Local SQLite database initialized and migrated successfully.');
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
    const dbPath = LYRICS_DB_FILE;
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

    const dbPath = LYRICS_DB_FILE;
    let database = {};
    if (fs.existsSync(dbPath)) {
      database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }

    database[vid] = lyrics;

    fs.writeFileSync(dbPath, JSON.stringify(database, null, 2), 'utf8');
    console.log(`Updated lyrics database in scratch for video: ${vid}`);

    const htmlPath = path.join(__dirname, 'projects', 'deus-ex-machina', 'index.html');
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
    const { product_id, name, email, phone, address, quantity = 1, notes = '' } = data;
    const depositor = data.depositor || name;

    if (!product_id || !name || !email || !phone || !address) {
      return sendJSON(res, 400, { error: 'Missing required fields' });
    }

    if (!db) {
      return sendJSON(res, 500, { error: 'Database not initialized' });
    }

    // 1. Get product info
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(product_id);
    if (!product) {
      return sendJSON(res, 400, { error: 'Product not found' });
    }

    if (product.status !== 'for-sale') {
      return sendJSON(res, 400, { error: 'Product is not available for purchase' });
    }

    if (product.inventory < Number(quantity)) {
      return sendJSON(res, 400, { error: 'Insufficient product inventory' });
    }

    // 2. Decrement inventory
    const newInventory = product.inventory - Number(quantity);
    const newStatus = newInventory === 0 ? 'out-of-stock' : 'for-sale';
    
    const updateProduct = db.prepare("UPDATE products SET inventory = ?, status = ? WHERE id = ?");
    updateProduct.run(newInventory, newStatus, product_id);

    // 3. Insert order
    const insertOrder = db.prepare(`
      INSERT INTO orders (name, email, phone, address, quantity, depositor, notes, product_id, product_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertOrder.run(name, email, phone, address, Number(quantity), depositor, notes, product_id, product.name);

    console.log(`Checkout successfully saved to local SQLite database for ${name}.`);

    // 4. Mock Email Output
    const total_price = product.price * Number(quantity) + 3000;
    console.log('\n=== [EMAIL MOCK - Customer] ===');
    console.log(`To: ${email}`);
    console.log(`Subject: [artic.] ${product.name} 결제 요청 완료`);
    console.log(`Body:
안녕하세요, ${name}님. artic. 입니다.

'${product.name}' 결제 요청이 접수되었습니다.
아래 계좌로 주문 금액을 입금해 주시면 입금 확인 후 배송을 진행해 드리겠습니다.

[주문 정보]
- 상품명: ${product.name}
- 수량: ${quantity}개
- 총 결제 금액: ${total_price.toLocaleString()}원 (상품가 ${product.price.toLocaleString()}원 * 수량 + 배송비 3,000원)
- 입금자명: ${depositor}
- 배송지 주소: ${address}
- 연락처: ${phone}

[입금 계좌 정보]
- 은행: 토스뱅크
- 계좌번호: 1002-1532-0842
- 예금주: 김민제

문의 사항이 있으실 경우 admin@artic.live 로 메일을 보내주시기 바랍니다.
감사합니다.

ⓒ 2026 artic. All Rights Reserved.`);
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
    const { name, email } = data;

    if (!name) {
      return sendJSON(res, 400, { error: 'Name is required' });
    }
    if (!email) {
      return sendJSON(res, 400, { error: 'Email is required' });
    }

    let totalCount = 0;

    if (db) {
      // Check duplicate
      const stmt = db.prepare('SELECT 1 FROM subscribers WHERE email = ? LIMIT 1');
      const row = stmt.get(email);
      if (row) {
        return sendJSON(res, 400, { error: 'This email is already registered. Stay tuned!' });
      }

      const insert = db.prepare("INSERT INTO subscribers (name, email, type, welcome_email_sent) VALUES (?, ?, 'quarterly', 1)");
      insert.run(name, email);
      console.log(`Waitlist subscriber successfully saved to SQLite: ${name} (${email})`);

      // Count total subscribers
      const countStmt = db.prepare("SELECT COUNT(*) as count FROM subscribers WHERE type = 'quarterly'");
      const countResult = countStmt.get();
      totalCount = countResult.count;
    }

    // Mock Email Output - Customer Waitlist
    console.log('\n=== [EMAIL MOCK - Customer Waitlist] ===');
    console.log(`To: ${email}`);
    console.log('Subject: [artic.] Join Waitlist 등록 완료');
    console.log(`Body:
안녕하세요, ${name}님. artic. 입니다.

새로운 소식을 가장 먼저 받아보실 수 있는 대기 명단(Waitlist) 등록이 완료되었습니다.

"Stay tuned.
We will share our official release with you first."

준비가 완료되는 대로 가장 먼저 공개 소식을 전해드리겠습니다.
감사합니다.

ⓒ 2026 artic. All Rights Reserved.`);
    console.log('========================================\n');

    // Mock Email Output - Admin Waitlist
    console.log('=== [EMAIL MOCK - Admin Waitlist] ===');
    console.log('To: admin@artic.live');
    console.log(`Subject: [ADMIN] 새로운 Waitlist 구독 접수 - ${email}`);
    console.log(`Body:
새로운 고객이 Quarterly Join Waitlist에 가입했습니다.

[신청 정보]
- 가입 이름: ${name}
- 가입 이메일: ${email}
- 가입 일시: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (KST)
- 현재 총 등록 인원: ${totalCount}명

SQLite 로컬 데이터베이스 subscribers에 적재되었습니다.`);
    console.log('=====================================\n');

    sendJSON(res, 200, { success: true, saved_to_cloud: false, total_subscribers: totalCount });
  } catch (e) {
    console.error('Error handling waitlist:', e);
    sendJSON(res, 500, { error: e.message });
  }
}

function handleGetProducts(req, res) {
  try {
    const products = db.prepare("SELECT * FROM products").all();
    sendJSON(res, 200, products);
  } catch (e) {
    sendJSON(res, 500, { error: e.message });
  }
}

function checkAdminAuth(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token === 'articadmin2026';
}

function handleAdminData(req, res) {
  if (!checkAdminAuth(req)) {
    return sendJSON(res, 401, { error: 'Unauthorized' });
  }

  try {
    const products = db.prepare("SELECT * FROM products").all();
    const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
    const subscribers = db.prepare("SELECT * FROM subscribers ORDER BY created_at DESC").all();

    sendJSON(res, 200, { products, orders, subscribers });
  } catch (e) {
    sendJSON(res, 500, { error: e.message });
  }
}

function handleAdminSaveProduct(req, res, bodyText) {
  if (!checkAdminAuth(req)) {
    return sendJSON(res, 401, { error: 'Unauthorized' });
  }

  try {
    const data = JSON.parse(bodyText);
    const { id, name, price, inventory, status } = data;

    if (!id || !name || price === undefined || inventory === undefined || !status) {
      return sendJSON(res, 400, { error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      INSERT INTO products (id, name, price, inventory, status)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        price = excluded.price,
        inventory = excluded.inventory,
        status = excluded.status
    `);
    stmt.run(id, name, Number(price), Number(inventory), status);

    sendJSON(res, 200, { success: true });
  } catch (e) {
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
      } else if (req.url === '/api/admin/products') {
        handleAdminSaveProduct(req, res, body);
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
      handleGetProducts(req, res);
      return;
    } else if (req.url === '/api/admin/data') {
      handleAdminData(req, res);
      return;
    }
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