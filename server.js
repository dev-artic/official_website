const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const PORT = 8000;
const DB_FILE = path.join(__dirname, 'orders.db');
const USER_HOME = process.env.HOME || process.env.USERPROFILE || '';
const LYRICS_DB_FILE = path.join(__dirname, 'scratch', 'synced_lyrics_estimate.json');

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

        // Run build_pages.js compilation with agy-node
        try {
          const { execSync } = require('child_process');
          execSync('agy-node scripts/build_pages.js', { cwd: __dirname });
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

function getTemplates() {
  const customerPath = path.join(__dirname, 'functions', 'templates', 'customer-email-template.html');
  const adminPath = path.join(__dirname, 'functions', 'templates', 'admin-email-template.html');
  if (fs.existsSync(customerPath) && fs.existsSync(adminPath)) {
    return {
      customerTemplate: fs.readFileSync(customerPath, 'utf8'),
      adminTemplate: fs.readFileSync(adminPath, 'utf8')
    };
  }
  return null;
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

    // Generate HTML previews
    try {
      const templates = getTemplates();
      if (templates) {
        const { customerTemplate, adminTemplate } = templates;
        
        const customerBody = `<p>안녕하세요, <strong>${name}</strong>님. artic. 입니다.</p>
<p><strong>'${product.name}'</strong> 결제 요청이 접수되었습니다.<br>
아래 계좌로 주문 금액을 입금해 주시면 입금 확인 후 배송을 진행해 드리겠습니다.</p>`;

        const customerTable = `<table class="data-table">
  <tr>
    <td class="label">상품명</td>
    <td class="value">${product.name}</td>
  </tr>
  <tr>
    <td class="label">수량</td>
    <td class="value">${quantity}개</td>
  </tr>
  <tr>
    <td class="label">총 결제 금액</td>
    <td class="value"><span class="bold">${total_price.toLocaleString()}원</span> (상품가 ${product.price.toLocaleString()}원 * 수량 + 배송비 3,000원)</td>
  </tr>
  <tr>
    <td class="label">입금자명</td>
    <td class="value">${depositor}</td>
  </tr>
  <tr>
    <td class="label">배송지 주소</td>
    <td class="value">${address}</td>
  </tr>
  <tr>
    <td class="label">연락처</td>
    <td class="value">${phone}</td>
  </tr>
  <tr>
    <td class="label">입금 계좌 정보</td>
    <td class="value"><span class="bold">토스뱅크 1002-1532-0842 (예금주: 김민제)</span></td>
  </tr>
</table>`;

        const customerHtml = customerTemplate
          .replace(/{{TITLE}}/g, `[artic.] ${product.name} 결제 요청 완료`)
          .replace("{{BODY_CONTENT}}", customerBody)
          .replace("{{DATA_TABLE}}", customerTable);

        const scratchDir = path.join(__dirname, 'scratch');
        if (!fs.existsSync(scratchDir)) {
          fs.mkdirSync(scratchDir, { recursive: true });
        }
        fs.writeFileSync(path.join(scratchDir, 'last-customer-checkout.html'), customerHtml, 'utf8');

        // Admin HTML
        const adminBody = `<p>새로운 <strong>'${product.name}'</strong> 결제 요청이 접수되었습니다.</p>`;
        const adminTable = `<table class="data-table">
  <tr>
    <td class="label">신청자명</td>
    <td class="value">${name}</td>
  </tr>
  <tr>
    <td class="label">이메일</td>
    <td class="value">${email}</td>
  </tr>
  <tr>
    <td class="label">연락처</td>
    <td class="value">${phone}</td>
  </tr>
  <tr>
    <td class="label">배송지 주소</td>
    <td class="value">${address}</td>
  </tr>
  <tr>
    <td class="label">수량</td>
    <td class="value">${quantity}개</td>
  </tr>
  <tr>
    <td class="label">입금자명</td>
    <td class="value">${depositor}</td>
  </tr>
  <tr>
    <td class="label">요청사항</td>
    <td class="value">${notes || '(없음)'}</td>
  </tr>
</table>`;

        const adminHtml = adminTemplate
          .replace(/{{TITLE}}/g, "새로운 결제 요청 접수")
          .replace("{{BODY_CONTENT}}", adminBody)
          .replace("{{DATA_TABLE}}", adminTable)
          .replace("{{DB_COLLECTION}}", "orders")
          .replace("{{DB_DOC_ID}}", "local_sqlite_id");

        fs.writeFileSync(path.join(scratchDir, 'last-admin-checkout.html'), adminHtml, 'utf8');

        console.log('\n=== [EMAIL PREVIEW - Checkout HTML] ===');
        console.log(`- Customer: http://localhost:${PORT}/scratch/last-customer-checkout.html`);
        console.log(`- Admin:    http://localhost:${PORT}/scratch/last-admin-checkout.html`);
        console.log('========================================\n');
      }
    } catch (previewErr) {
      console.error('Failed to generate local checkout email previews:', previewErr);
    }

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
    console.log('Subject: [artic.] quarterly artic. 대기명단 등록 완료');
    console.log(`Body:
You are now on the waitlist.

안녕하세요, ${name} 님.
Quarterly. 대기명단 등록이 완료되었습니다.

[등록 정보]
- 이름: ${name}
- 이메일: ${email}
- 등록일: ${regDateFormatted}

Quarterly. is a quarterly publication by artic. that delivers curated albums, artworks, and diverse artistic insights.

Quarterly.는 artic.의 매 분기 발매된 앨범, 작품, 그리고 다양한 예술 소식을 전하는 분기별 정기간행물입니다.
Quarterly.에 대한 새로운 소식을 제일 먼저 받아보세요.

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

    // Generate HTML previews
    try {
      const templates = getTemplates();
      if (templates) {
        const { customerTemplate, adminTemplate } = templates;

        const customerBody = `<p style="text-align: left; margin-bottom: 18px; font-size: 14px; line-height: 1.6; color: #111111;">
  You are now on the waitlist.
</p>
<p style="text-align: left; margin-top: 18px; margin-bottom: 24px; font-size: 13px; line-height: 1.6; color: #777777;">
  안녕하세요, ${name} 님.<br>
  Quarterly. 대기명단 등록이 완료되었습니다.
</p>`;

        const regDateFormatted = new Date().toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          timeZone: "Asia/Seoul"
        });
        const customerTable = `<table class="data-table">
  <tr>
    <td class="label">이름</td>
    <td class="value">${name}</td>
  </tr>
  <tr>
    <td class="label">이메일</td>
    <td class="value">${email}</td>
  </tr>
  <tr>
    <td class="label">등록일</td>
    <td class="value">${regDateFormatted}</td>
  </tr>
</table>
<p style="text-align: left; margin-top: 36px; margin-bottom: 12px; font-size: 12px; line-height: 1.7; color: #111111;">
  Quarterly. is a quarterly publication by artic. that delivers curated albums, artworks, and diverse artistic insights.
</p>
<p style="text-align: left; margin-top: 12px; font-size: 11px; line-height: 1.7; color: #777777;">
  Quarterly.는 artic.의 매 분기 발매된 앨범, 작품, 그리고 다양한 예술 소식을 전하는 분기별 정기간행물입니다.<br>
  Quarterly.에 대한 새로운 소식을 제일 먼저 받아보세요.
</p>`;

        const customerHtml = customerTemplate
          .replace(/{{TITLE}}/g, "THANK YOU.")
          .replace("{{BODY_CONTENT}}", customerBody)
          .replace("{{DATA_TABLE}}", customerTable);

        const scratchDir = path.join(__dirname, 'scratch');
        if (!fs.existsSync(scratchDir)) {
          fs.mkdirSync(scratchDir, { recursive: true });
        }
        fs.writeFileSync(path.join(scratchDir, 'last-customer-waitlist.html'), customerHtml, 'utf8');

        // Admin HTML
        const adminBody = `<p>새로운 고객이 <strong>Quarterly Join Waitlist</strong>에 가입하여 Firestore DB에 등록되었습니다.</p>`;
        const adminTable = `<table class="data-table">
  <tr>
    <td class="label">이름</td>
    <td class="value">${name}</td>
  </tr>
  <tr>
    <td class="label">가입 이메일</td>
    <td class="value">${email}</td>
  </tr>
  <tr>
    <td class="label">가입 일시</td>
    <td class="value">${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (KST)</td>
  </tr>
  <tr>
    <td class="label">현재 총 등록 인원</td>
    <td class="value"><span class="bold">${totalCount}명</span></td>
  </tr>
</table>`;

        const adminHtml = adminTemplate
          .replace(/{{TITLE}}/g, "새로운 Waitlist 가입 알림")
          .replace("{{BODY_CONTENT}}", adminBody)
          .replace("{{DATA_TABLE}}", adminTable)
          .replace("{{DB_COLLECTION}}", "subscribers")
          .replace("{{DB_DOC_ID}}", "local_sqlite_id");

        fs.writeFileSync(path.join(scratchDir, 'last-admin-waitlist.html'), adminHtml, 'utf8');

        console.log('\n=== [EMAIL PREVIEW - Waitlist HTML] ===');
        console.log(`- Customer: http://localhost:${PORT}/scratch/last-customer-waitlist.html`);
        console.log(`- Admin:    http://localhost:${PORT}/scratch/last-admin-waitlist.html`);
        console.log('========================================\n');
      }
    } catch (previewErr) {
      console.error('Failed to generate local waitlist email previews:', previewErr);
    }

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