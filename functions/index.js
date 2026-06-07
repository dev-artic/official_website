const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const cors = require("cors")({ origin: true });
const fs = require("fs");
const path = require("path");
const {
  VALID_ORDER_STATUSES,
  getInventoryTransition,
} = require("./order_inventory");
const {
  fetchQuarterlyContents,
  getDataSourceId,
  getNotionToken,
} = require("./quarterly_notion");
const {
  buildMediaCacheWithOverrides,
  getQuarterlyAdminPayload,
  handleQuarterlyAdminAction,
  readQuarterlyMediaOverrides,
} = require("./quarterly_admin");

admin.initializeApp();
const db = admin.firestore();
const ADMIN_TOKEN_SECRET = defineSecret("ADMIN_TOKEN");
const NOTION_API_KEY_SECRET = defineSecret("NOTION_API_KEY");
const QUARTERLY_MEDIA_CACHE_FILE = path.join(__dirname, "data", "quarterly_media_cache.json");
const QUARTERLY_NOW_ARTIC_FILE = path.join(__dirname, "data", "quarterly_now_artic.json");
const QUARTERLY_EXTERNAL_LINKS_FILE = path.join(__dirname, "data", "quarterly_external_links.json");

function readQuarterlyMediaCache() {
  try {
    if (!fs.existsSync(QUARTERLY_MEDIA_CACHE_FILE)) return null;
    return JSON.parse(fs.readFileSync(QUARTERLY_MEDIA_CACHE_FILE, "utf8"));
  } catch (err) {
    console.warn("Unable to read quarterly media cache:", err.message);
    return null;
  }
}

function readQuarterlyNowArtic() {
  try {
    if (!fs.existsSync(QUARTERLY_NOW_ARTIC_FILE)) return null;
    return JSON.parse(fs.readFileSync(QUARTERLY_NOW_ARTIC_FILE, "utf8"));
  } catch (err) {
    console.warn("Unable to read quarterly Now artic cache:", err.message);
    return null;
  }
}

function readQuarterlyExternalLinks() {
  try {
    if (!fs.existsSync(QUARTERLY_EXTERNAL_LINKS_FILE)) return null;
    return JSON.parse(fs.readFileSync(QUARTERLY_EXTERNAL_LINKS_FILE, "utf8"));
  } catch (err) {
    console.warn("Unable to read quarterly external links:", err.message);
    return null;
  }
}

function getAdminToken() {
  let secretValue = "";
  try {
    secretValue = ADMIN_TOKEN_SECRET.value();
  } catch (err) {
    secretValue = "";
  }
  return secretValue || process.env.ADMIN_TOKEN || (process.env.FUNCTIONS_EMULATOR === "true" ? "articadmin2026" : "");
}

function parsePositiveInteger(value, fallback = 1) {
  const normalized = value === undefined || value === null || value === "" ? fallback : value;
  const num = Number(normalized);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isValidKoreanMobile(value) {
  return /^01[016789]\d{7,8}$/.test(String(value || "").replace(/\D/g, ""));
}

// Load templates helper
function getTemplates() {
  try {
    const customerPath = path.join(__dirname, "templates", "customer-email-template.html");
    const adminPath = path.join(__dirname, "templates", "admin-email-template.html");
    
    const customerTemplate = fs.readFileSync(customerPath, "utf8");
    const adminTemplate = fs.readFileSync(adminPath, "utf8");
    
    return { customerTemplate, adminTemplate };
  } catch (err) {
    console.error("Error reading template files:", err);
    return { customerTemplate: "", adminTemplate: "" };
  }
}

// SMTP Email helper (Supports both plaintext and HTML body)
async function sendEmail({ to, subject, body, html }) {
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const fromAddr = smtpUser || "admin@artic.live";

  if (process.env.FUNCTIONS_EMULATOR === "true" || !smtpUser || !smtpPassword) {
    console.log("\n=== [EMAIL MOCK] ===");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    if (html) {
      console.log(`HTML Body:\n${html}`);
    } else {
      console.log(`Body:\n${body}`);
    }
    console.log("====================\n");
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    const mailOptions = {
      from: `"artic." <${fromAddr}>`,
      to: to,
      subject: subject,
    };

    if (html) {
      mailOptions.html = html;
    } else if (body) {
      mailOptions.text = body;
    }

    await transporter.sendMail(mailOptions);

    console.log(`Email successfully sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    return false;
  }
}

function savePreviewIfEmulator(fileName, html) {
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    try {
      const scratchDir = path.join(__dirname, "..", "scratch");
      if (!fs.existsSync(scratchDir)) {
        fs.mkdirSync(scratchDir, { recursive: true });
      }
      fs.writeFileSync(path.join(scratchDir, fileName), html, "utf8");
      console.log(`[EMULATOR] Saved email preview to scratch/${fileName}`);
    } catch (err) {
      console.error("[EMULATOR] Failed to save email preview:", err);
    }
  }
}

exports.checkout = onRequest((req, res) => {
  cors(req, res, async () => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const { product_id, name, email, phone, address, quantity, depositor, notes } = req.body;
      const qty = parsePositiveInteger(quantity, 1);
      const depName = depositor || name;
      const chkNotes = notes || "";

      if (!product_id || !name || !email || !phone || !address) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }
      if (!isValidEmail(email)) {
        res.status(400).json({ error: "Invalid email format" });
        return;
      }
      if (!isValidKoreanMobile(phone)) {
        res.status(400).json({ error: "Invalid phone number format" });
        return;
      }
      if (!qty) {
        res.status(400).json({ error: "Quantity must be a positive integer" });
        return;
      }

      // Check product status and stock
      const productRef = db.collection("products").doc(product_id);
      let orderId = "";
      let productName = "";
      let productPrice = 15000;

      await db.runTransaction(async (transaction) => {
        const productDoc = await transaction.get(productRef);
        if (!productDoc.exists) {
          throw new Error("Product not found");
        }
        const pData = productDoc.data();
        if (pData.status !== "for-sale") {
          throw new Error("Product is not available for purchase");
        }
        if (pData.inventory < qty) {
          throw new Error("Insufficient product inventory");
        }

        productName = pData.name;
        productPrice = pData.price;

        // Note: Do NOT decrement inventory here. It will be decremented when admin sets status to 'shipped'.
        const orderData = {
          name,
          email,
          phone,
          address,
          quantity: qty,
          depositor: depName,
          notes: chkNotes,
          product_id,
          product_name: productName,
          price: productPrice,
          status: "pending",
          tracking_number: "",
          inventory_deducted: false,
          created_at: FieldValue.serverTimestamp(),
        };

        const newOrderRef = db.collection("orders").doc();
        orderId = newOrderRef.id;
        transaction.set(newOrderRef, orderData);
      });

      console.log(`Checkout successfully saved to Firestore (ID: ${orderId}).`);
      res.status(200).json({ success: true, saved_to_cloud: true, order_id: orderId });
    } catch (err) {
      console.error("Internal server error during checkout:", err);
      res.status(500).json({ error: err.message });
    }
  });
});

exports.onOrderCreated = functions.firestore
  .document("orders/{docId}")
  .onCreate(async (snapshot, context) => {
    const orderData = snapshot.data();
    if (!orderData) {
      console.log("No data associated with the event");
      return;
    }

    const docId = context.params.docId;
    const { name, email, phone, address, quantity, depositor, notes, product_id, product_name, price } = orderData;
    const qty = quantity || 1;
    const depName = depositor || name;
    const chkNotes = notes || "";

    try {
      const totalPrice = price * qty + 3000;
      const customerSubject = `${product_name} 결제 요청 완료`;
      const customerBody = `안녕하세요, ${name}님. artic. 입니다.

'${product_name}' 결제 요청이 접수되었습니다.
아래 계좌로 주문 금액을 입금해 주시면 입금 확인 후 배송을 진행해 드리겠습니다.

[주문 정보]
- 상품명: ${product_name}
- 수량: ${qty}개
- 총 결제 금액: ${totalPrice.toLocaleString()}원 (상품가 ${price.toLocaleString()}원 * 수량 + 배송비 3,000원)
- 입금자명: ${depName}
- 배송지 주소: ${address}
- 연락처: ${phone}

[입금 계좌 정보]
- 은행: 토스뱅크
- 계좌번호: 1002-1532-0842
- 예금주: 김민제

문의 사항이 있으실 경우 admin@artic.live 로 메일을 보내주시기 바랍니다.
감사합니다.

ⓒ 2026 artic. All Rights Reserved.`;

      const adminEmail = process.env.ADMIN_EMAIL || "admin@artic.live";
      const adminSubject = `[ADMIN] 새로운 결제 요청 접수 - ${name}님`;
      const adminBody = `새로운 '${product_name}' 결제 요청이 접수되었습니다.

[신청 정보]
- 신청자명: ${name}
- 이메일: ${email}
- 연락처: ${phone}
- 배송지 주소: ${address}
- 수량: ${qty}개
- 입금자명: ${depName}
- 요청사항: ${chkNotes}

입금 및 주소를 확인해 주시기 바랍니다.`;

      const { customerTemplate, adminTemplate } = getTemplates();
      let customerHtml = null;
      let adminHtml = null;

      if (customerTemplate) {
        const bodyHtml = `<p style="text-align: center; margin-bottom: 18px; font-size: 14px; line-height: 1.6; color: #111111;">
  Payment request has been received.
</p>
<p style="text-align: center; margin-top: 18px; margin-bottom: 24px; font-size: 13px; line-height: 1.6; color: #777777;">
  안녕하세요, ${name} 님.<br>
  '${product_name}' 결제 요청이 접수되었습니다.<br>
  아래 계좌로 주문 금액을 입금해 주시면 입금 확인 후 배송을 진행해 드리겠습니다.
</p>`;

        const customerTableStyle = "width: 100%; margin: 36px 0; border-collapse: collapse;";
        const customerLabelStyle = "width: 35%; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #888888; text-align: left; padding: 12px 0; border-bottom: 1px solid #f3f3f3; vertical-align: middle;";
        const customerLabelLastStyle = "width: 35%; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #888888; text-align: left; padding: 12px 0; border-bottom: none; vertical-align: middle;";
        const customerValueStyle = "width: 65%; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; font-weight: 400; color: #111111; text-align: right; padding: 12px 0; border-bottom: 1px solid #f3f3f3; vertical-align: middle;";
        const customerValueLastStyle = "width: 65%; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; font-weight: 400; color: #111111; text-align: right; padding: 12px 0; border-bottom: none; vertical-align: middle;";
        const boldStyle = "font-weight: 600; color: #111111;";

        const dataTableHtml = `<table style="${customerTableStyle}">
  <tr>
    <td style="${customerLabelStyle}">상품명</td>
    <td style="${customerValueStyle}">${product_name}</td>
  </tr>
  <tr>
    <td style="${customerLabelStyle}">수량</td>
    <td style="${customerValueStyle}">${qty}개</td>
  </tr>
  <tr>
    <td style="${customerLabelStyle}">총 결제 금액</td>
    <td style="${customerValueStyle}"><span style="${boldStyle}">${totalPrice.toLocaleString()}원</span></td>
  </tr>
  <tr>
    <td style="width: 35%; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 9px; font-weight: 600; text-transform: none; letter-spacing: 0.05em; color: #999999; text-align: left; padding: 12px 0 12px 16px; border-bottom: 1px solid #f3f3f3; vertical-align: middle;">└ 상품 가격 (${price.toLocaleString()}원 × ${qty})</td>
    <td style="width: 65%; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px; font-weight: 400; color: #666666; text-align: right; padding: 12px 0; border-bottom: 1px solid #f3f3f3; vertical-align: middle;">${(price * qty).toLocaleString()}원</td>
  </tr>
  <tr>
    <td style="width: 35%; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 9px; font-weight: 600; text-transform: none; letter-spacing: 0.05em; color: #999999; text-align: left; padding: 12px 0 12px 16px; border-bottom: 1px solid #f3f3f3; vertical-align: middle;">└ 배송비</td>
    <td style="width: 65%; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px; font-weight: 400; color: #666666; text-align: right; padding: 12px 0; border-bottom: 1px solid #f3f3f3; vertical-align: middle;">3,000원</td>
  </tr>
  <tr>
    <td style="${customerLabelStyle}">입금자명</td>
    <td style="${customerValueStyle}">${depName}</td>
  </tr>
  <tr>
    <td style="${customerLabelStyle}">배송지 주소</td>
    <td style="${customerValueStyle}">${address}</td>
  </tr>
  <tr>
    <td style="${customerLabelStyle}">연락처</td>
    <td style="${customerValueStyle}">${phone}</td>
  </tr>
  <tr>
    <td style="${customerLabelLastStyle}">입금 계좌 정보</td>
    <td style="${customerValueLastStyle}"><span style="${boldStyle}">토스뱅크 1002-1532-0842 (예금주: 김민제)</span></td>
  </tr>
</table>`;

        customerHtml = customerTemplate
          .replace(/{{TITLE}}/g, customerSubject)
          .replace("{{BODY_CONTENT}}", bodyHtml)
          .replace("{{DATA_TABLE}}", dataTableHtml);
      }

      if (adminTemplate) {
        const adminBodyStyle = "font-size: 13px; line-height: 1.7; margin: 0 0 20px 0; color: #444444; font-family: -apple-system, BlinkMacSystemFont, sans-serif;";
        const adminBodyHtml = `<p style="${adminBodyStyle}">새로운 <strong>'${product_name}'</strong> 결제 요청이 접수되었습니다.</p>`;

        const adminTableStyle = "width: 100%; margin: 24px 0; border-collapse: collapse; border: 1px solid #eaeaea;";
        const adminLabelStyle = "width: 35%; color: #666666; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; background-color: #fafafa; text-align: left; padding: 10px 14px; border-bottom: 1px solid #eaeaea; vertical-align: top; font-family: -apple-system, BlinkMacSystemFont, sans-serif;";
        const adminLabelLastStyle = "width: 35%; color: #666666; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; background-color: #fafafa; text-align: left; padding: 10px 14px; border-bottom: none; vertical-align: top; font-family: -apple-system, BlinkMacSystemFont, sans-serif;";
        const adminValueStyle = "width: 65%; color: #111111; font-weight: 500; text-align: left; padding: 10px 14px; border-bottom: 1px solid #eaeaea; vertical-align: top; font-size: 12px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, sans-serif;";
        const adminValueLastStyle = "width: 65%; color: #111111; font-weight: 500; text-align: left; padding: 10px 14px; border-bottom: none; vertical-align: top; font-size: 12px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, sans-serif;";

        const adminDataTableHtml = `<table style="${adminTableStyle}">
  <tr>
    <td style="${adminLabelStyle}">신청자명</td>
    <td style="${adminValueStyle}">${name}</td>
  </tr>
  <tr>
    <td style="${adminLabelStyle}">이메일</td>
    <td style="${adminValueStyle}">${email}</td>
  </tr>
  <tr>
    <td style="${adminLabelStyle}">연락처</td>
    <td style="${adminValueStyle}">${phone}</td>
  </tr>
  <tr>
    <td style="${adminLabelStyle}">배송지 주소</td>
    <td style="${adminValueStyle}">${address}</td>
  </tr>
  <tr>
    <td style="${adminLabelStyle}">수량</td>
    <td style="${adminValueStyle}">${qty}개</td>
  </tr>
  <tr>
    <td style="${adminLabelStyle}">입금자명</td>
    <td style="${adminValueStyle}">${depName}</td>
  </tr>
  <tr>
    <td style="${adminLabelLastStyle}">요청사항</td>
    <td style="${adminValueLastStyle}">${chkNotes || "(없음)"}</td>
  </tr>
</table>`;

        adminHtml = adminTemplate
          .replace(/{{TITLE}}/g, "새로운 결제 요청 접수")
          .replace("{{BODY_CONTENT}}", adminBodyHtml)
          .replace("{{DATA_TABLE}}", adminDataTableHtml)
          .replace("{{DB_COLLECTION}}", "orders")
          .replace("{{DB_DOC_ID}}", docId);
      }

      await sendEmail({ to: email, subject: customerSubject, body: customerBody, html: customerHtml });
      await sendEmail({ to: adminEmail, subject: adminSubject, body: adminBody, html: adminHtml });

      if (customerHtml) savePreviewIfEmulator("last-customer-checkout.html", customerHtml);
      if (adminHtml) savePreviewIfEmulator("last-admin-checkout.html", adminHtml);
    } catch (err) {
      console.error(`Error in onOrderCreated trigger for order ${docId}:`, err);
    }
  });

exports.waitlist = onRequest((req, res) => {
  cors(req, res, async () => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const { name, email } = req.body;

      if (!name) {
        res.status(400).json({ error: "Name is required" });
        return;
      }
      if (!email) {
        res.status(400).json({ error: "Email is required" });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ error: "Invalid email format" });
        return;
      }

      const snapshot = await db.collection("subscribers")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        res.status(400).json({ error: "This email is already registered. Stay tuned!" });
        return;
      }

      const regDateFormatted = new Date().toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Seoul",
      });
      const customerSubject = "[artic.] quarterly artic. 대기명단 등록 완료";
      const customerBody = `You are now on the waitlist.

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
ⓒ 2026 artic. All Rights Reserved.`;

      const customerEmailSent = await sendEmail({ to: email, subject: customerSubject, body: customerBody });
      if (!customerEmailSent) {
        res.status(400).json({ error: "invalid address" });
        return;
      }

      const subscriberData = {
        name,
        email,
        type: "quarterly",
        welcome_email_sent: true,
        created_at: FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("subscribers").add(subscriberData);
      console.log(`Waitlist subscriber successfully saved to Firestore (ID: ${docRef.id}).`);

      const adminEmail = process.env.ADMIN_EMAIL || "admin@artic.live";
      const totalSnapshot = await db.collection("subscribers").where("type", "==", "quarterly").get();
      await sendEmail({
        to: adminEmail,
        subject: `[ADMIN] 새로운 Waitlist 구독 접수 - ${email}`,
        body: `새로운 고객이 Quarterly Join Waitlist에 가입했습니다.

[신청 정보]
- 가입 이름: ${name}
- 가입 이메일: ${email}
- 가입 일시: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (KST)
- 현재 총 등록 인원: ${totalSnapshot.size}명

Firestore 컬렉션 subscribers에 적재되었습니다.
문서 ID: ${docRef.id}`,
      });

      res.status(200).json({ success: true, saved_to_cloud: true, id: docRef.id });
    } catch (err) {
      console.error("Internal server error during waitlist submission:", err);
      res.status(500).json({ error: err.message });
    }
  });
});

exports.onSubscriberCreated = functions.firestore
  .document("subscribers/{docId}")
  .onCreate(async (snapshot, context) => {
    const subscriber = snapshot.data();
    if (!subscriber) {
      console.log("No data associated with the event");
      return;
    }

    // Only process quarterly subscribers that haven't sent a welcome email yet
    if (subscriber.type !== "quarterly" || subscriber.welcome_email_sent === true) {
      return;
    }

    const { name, email } = subscriber;
    const docId = context.params.docId;

    try {
      // Format registration date
      let regDateVal = subscriber.created_at;
      let regDateFormatted = "";
      if (regDateVal && typeof regDateVal.toDate === "function") {
        regDateFormatted = regDateVal.toDate().toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          timeZone: "Asia/Seoul",
        });
      } else {
        regDateFormatted = new Date().toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          timeZone: "Asia/Seoul",
        });
      }

      const countSnapshot = await db.collection("subscribers").where("type", "==", "quarterly").get();
      const totalCount = countSnapshot.size;

      const customerSubject = "[artic.] quarterly artic. 대기명단 등록 완료";
      const customerBody = `You are now on the waitlist.

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
ⓒ 2026 artic. All Rights Reserved.`;

      const adminEmail = process.env.ADMIN_EMAIL || "admin@artic.live";
      const adminSubject = `[ADMIN] 새로운 Waitlist 구독 접수 - ${email}`;
      const adminBody = `새로운 고객이 Quarterly Join Waitlist에 가입했습니다.

[신청 정보]
- 가입 이름: ${name}
- 가입 이메일: ${email}
- 가입 일시: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (KST)
- 현재 총 등록 인원: ${totalCount}명

Firestore 컬렉션 subscribers에 적재되었습니다.`;

      const { customerTemplate, adminTemplate } = getTemplates();
      let customerHtml = null;
      let adminHtml = null;

      if (customerTemplate) {
        const bodyHtml = `<p style="text-align: center; margin-bottom: 18px; font-size: 14px; line-height: 1.6; color: #111111;">
  You are now on the waitlist.
</p>
<p style="text-align: center; margin-top: 18px; margin-bottom: 24px; font-size: 13px; line-height: 1.6; color: #777777;">
  안녕하세요, ${name} 님.<br>
  Quarterly. 대기명단 등록이 완료되었습니다.
</p>`;

        const customerTableStyle = "width: 100%; margin: 36px 0; border-collapse: collapse;";
        const customerLabelStyle = "width: 35%; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #888888; text-align: left; padding: 12px 0; border-bottom: 1px solid #f3f3f3; vertical-align: middle;";
        const customerLabelLastStyle = "width: 35%; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #888888; text-align: left; padding: 12px 0; border-bottom: none; vertical-align: middle;";
        const customerValueStyle = "width: 65%; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; font-weight: 400; color: #111111; text-align: right; padding: 12px 0; border-bottom: 1px solid #f3f3f3; vertical-align: middle;";
        const customerValueLastStyle = "width: 65%; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; font-weight: 400; color: #111111; text-align: right; padding: 12px 0; border-bottom: none; vertical-align: middle;";

        const dataTableHtml = `<table style="${customerTableStyle}">
  <tr>
    <td style="${customerLabelStyle}">이름</td>
    <td style="${customerValueStyle}">${name}</td>
  </tr>
  <tr>
    <td style="${customerLabelStyle}">이메일</td>
    <td style="${customerValueStyle}">${email}</td>
  </tr>
  <tr>
    <td style="${customerLabelLastStyle}">등록일</td>
    <td style="${customerValueLastStyle}">${regDateFormatted}</td>
  </tr>
</table>
<p style="text-align: left; margin-top: 36px; margin-bottom: 12px; font-size: 12px; line-height: 1.7; color: #111111;">
  Quarterly. is a quarterly publication by artic. that delivers curated albums, artworks, and diverse artistic insights.
</p>
<p style="text-align: left; margin-top: 12px; font-size: 11px; line-height: 1.7; color: #777777;">
  Quarterly.는 artic.의 매 분기 발매된 앨범, 작품, 그리고 다양한 예술 소식을 전하는 분기별 정기간행물입니다.<br>
  Quarterly.에 대한 새로운 소식을 제일 먼저 받아보세요.
</p>`;

        customerHtml = customerTemplate
          .replace(/{{TITLE}}/g, "THANK YOU.")
          .replace("{{BODY_CONTENT}}", bodyHtml)
          .replace("{{DATA_TABLE}}", dataTableHtml);
      }

      if (adminTemplate) {
        const adminBodyStyle = "font-size: 13px; line-height: 1.7; margin: 0 0 20px 0; color: #444444; font-family: -apple-system, BlinkMacSystemFont, sans-serif;";
        const adminBodyHtml = `<p style="${adminBodyStyle}">새로운 고객이 <strong>Quarterly Join Waitlist</strong>에 가입하여 Firestore DB에 등록되었습니다.</p>`;

        const adminTableStyle = "width: 100%; margin: 24px 0; border-collapse: collapse; border: 1px solid #eaeaea;";
        const adminLabelStyle = "width: 35%; color: #666666; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; background-color: #fafafa; text-align: left; padding: 10px 14px; border-bottom: 1px solid #eaeaea; vertical-align: top; font-family: -apple-system, BlinkMacSystemFont, sans-serif;";
        const adminLabelLastStyle = "width: 35%; color: #666666; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; background-color: #fafafa; text-align: left; padding: 10px 14px; border-bottom: none; vertical-align: top; font-family: -apple-system, BlinkMacSystemFont, sans-serif;";
        const adminValueStyle = "width: 65%; color: #111111; font-weight: 500; text-align: left; padding: 10px 14px; border-bottom: 1px solid #eaeaea; vertical-align: top; font-size: 12px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, sans-serif;";
        const adminValueLastStyle = "width: 65%; color: #111111; font-weight: 500; text-align: left; padding: 10px 14px; border-bottom: none; vertical-align: top; font-size: 12px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, sans-serif;";
        const boldStyle = "font-weight: 600; color: #111111;";

        const adminDataTableHtml = `<table style="${adminTableStyle}">
  <tr>
    <td style="${adminLabelStyle}">이름</td>
    <td style="${adminValueStyle}">${name}</td>
  </tr>
  <tr>
    <td style="${adminLabelStyle}">가입 이메일</td>
    <td style="${adminValueStyle}">${email}</td>
  </tr>
  <tr>
    <td style="${adminLabelStyle}">가입 일시</td>
    <td style="${adminValueStyle}">${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (KST)</td>
  </tr>
  <tr>
    <td style="${adminLabelLastStyle}">현재 총 등록 인원</td>
    <td style="${adminValueLastStyle}"><span style="${boldStyle}">${totalCount}명</span></td>
  </tr>
</table>`;

        adminHtml = adminTemplate
          .replace(/{{TITLE}}/g, "새로운 Waitlist 가입 알림")
          .replace("{{BODY_CONTENT}}", adminBodyHtml)
          .replace("{{DATA_TABLE}}", adminDataTableHtml)
          .replace("{{DB_COLLECTION}}", "subscribers")
          .replace("{{DB_DOC_ID}}", docId);
      }

      const emailSentCustomer = await sendEmail({ to: email, subject: customerSubject, body: customerBody, html: customerHtml });
      await sendEmail({ to: adminEmail, subject: adminSubject, body: adminBody, html: adminHtml });

      if (customerHtml) savePreviewIfEmulator("last-customer-waitlist.html", customerHtml);
      if (adminHtml) savePreviewIfEmulator("last-admin-waitlist.html", adminHtml);

      if (emailSentCustomer) {
        await db.collection("subscribers").doc(docId).update({ welcome_email_sent: true });
        console.log(`Successfully sent waitlist email and updated status for subscriber: ${docId}`);
      }
    } catch (err) {
      console.error(`Error in onSubscriberCreated trigger for subscriber ${docId}:`, err);
    }
  });

exports.quarterlyContents = onRequest({ secrets: [NOTION_API_KEY_SECRET] }, (req, res) => {
  cors(req, res, async () => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      let notionSecret = "";
      try {
        notionSecret = NOTION_API_KEY_SECRET.value();
      } catch (err) {
        notionSecret = "";
      }

      const mediaOverrides = await readQuarterlyMediaOverrides(db);
      const data = await fetchQuarterlyContents({
        token: getNotionToken(notionSecret),
        dataSourceId: getDataSourceId(),
        mediaCache: buildMediaCacheWithOverrides(readQuarterlyMediaCache(), mediaOverrides),
        nowArtic: readQuarterlyNowArtic(),
        externalLinks: readQuarterlyExternalLinks(),
      });
      res.set("X-artic-Data-Source", "notion-live");
      res.set("X-artic-Notion-Query-Mode", data.queryMode || "data_source_direct");
      res.status(200).json(data);
    } catch (err) {
      console.error("Failed to fetch quarterly contents from Notion:", err);
      res.status(err.status || 500).json({
        error: "Failed to fetch quarterly contents",
        message: process.env.FUNCTIONS_EMULATOR === "true" ? err.message : undefined,
      });
    }
  });
});

exports.quarterlyAdmin = onRequest({ secrets: [ADMIN_TOKEN_SECRET, NOTION_API_KEY_SECRET] }, (req, res) => {
  cors(req, res, async () => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const authHeader = req.headers.authorization;
    const adminToken = getAdminToken();
    if (!adminToken) {
      res.status(500).json({ error: "Admin token is not configured" });
      return;
    }
    if (!authHeader || authHeader.replace(/^Bearer\s+/i, "") !== adminToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    let notionSecret = "";
    try {
      notionSecret = NOTION_API_KEY_SECRET.value();
    } catch (err) {
      notionSecret = "";
    }
    const token = getNotionToken(notionSecret);
    if (!token) {
      res.status(500).json({ error: "NOTION_API_KEY is not configured" });
      return;
    }

    try {
      if (req.method === "GET") {
        const payload = await getQuarterlyAdminPayload({
          token,
          dataSourceId: getDataSourceId(),
          db,
          mediaCache: readQuarterlyMediaCache(),
          nowArtic: readQuarterlyNowArtic(),
          externalLinks: readQuarterlyExternalLinks(),
        });
        res.status(200).json(payload);
        return;
      }

      if (req.method === "POST") {
        const result = await handleQuarterlyAdminAction({
          body: req.body || {},
          token,
          db,
          fieldValue: FieldValue,
        });
        res.status(200).json(result);
        return;
      }

      res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
      console.error("Quarterly admin request failed:", err);
      res.status(err.status || 500).json({
        error: err.message || "Quarterly admin request failed",
      });
    }
  });
});

exports.products = onRequest((req, res) => {
  cors(req, res, async () => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const snapshot = await db.collection("products").get();
      if (snapshot.empty) {
        if (process.env.FUNCTIONS_EMULATOR !== "true") {
          res.status(200).json([]);
          return;
        }
        // Seed default products in firestore
        const p1 = { id: "1", name: "1MC1PD: The Interview", price: 15000, inventory: 10, status: "for-sale", note: "Limited Edition" };
        const p2 = { id: "2", name: "Lyric Booklet", price: 0, inventory: 0, status: "not-for-sale", note: "Distributed in Listening Party" };
        await db.collection("products").doc(p1.id).set(p1);
        await db.collection("products").doc(p2.id).set(p2);
        res.status(200).json([p1, p2]);
        return;
      }
      const products = [];
      snapshot.forEach(doc => products.push(doc.data()));
      res.status(200).json(products);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

exports.admin = onRequest({ secrets: [ADMIN_TOKEN_SECRET] }, (req, res) => {
  cors(req, res, async () => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

    const authHeader = req.headers.authorization;
    const adminToken = getAdminToken();
    if (!adminToken) {
      res.status(500).json({ error: "Admin token is not configured" });
      return;
    }
    if (!authHeader || authHeader.replace(/^Bearer\s+/i, "") !== adminToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.method === "GET") {
      try {
        const productsSnap = await db.collection("products").get();
        const products = [];
        productsSnap.forEach(d => products.push(d.data()));

        const ordersSnap = await db.collection("orders").orderBy("created_at", "desc").get();
        const orders = [];
        ordersSnap.forEach(d => {
          const o = d.data();
          if (o.created_at) o.created_at = o.created_at.toDate().toISOString();
          orders.push({ id: d.id, ...o });
        });

        const subscribersSnap = await db.collection("subscribers").get();
        const subscribers = [];
        subscribersSnap.forEach(d => {
          const s = d.data();
          // Fallback to timestamp if created_at is missing (for older test records)
          let dateVal = s.created_at;
          if (!dateVal && s.timestamp) {
            dateVal = s.timestamp;
          }
          if (dateVal && typeof dateVal.toDate === 'function') {
            s.created_at = dateVal.toDate().toISOString();
          } else {
            s.created_at = null;
          }
          subscribers.push({ id: d.id, ...s });
        });

        // Sort subscribers by created_at descending in-memory
        subscribers.sort((a, b) => {
          const da = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dbVal = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dbVal - da;
        });

        res.status(200).json({ products, orders, subscribers });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    } else if (req.method === "POST") {
      try {
        const { action } = req.body;

        if (action === "update_order") {
          const { orderId, status, tracking_number } = req.body;
          if (!orderId || !status) {
            res.status(400).json({ error: "Missing required fields (orderId, status)" });
            return;
          }
          if (!VALID_ORDER_STATUSES.has(status)) {
            res.status(400).json({ error: "Invalid order status" });
            return;
          }

          const orderRef = db.collection("orders").doc(orderId);
          await db.runTransaction(async (transaction) => {
            const orderDoc = await transaction.get(orderRef);
            if (!orderDoc.exists) {
              throw new Error("Order not found");
            }
            const oData = orderDoc.data();
            const qty = parsePositiveInteger(oData.quantity, 1);
            if (!qty) {
              throw new Error("Invalid order quantity");
            }
            const inventoryTransition = getInventoryTransition(oData, status);

            let updateData = {
              status: status,
              tracking_number: tracking_number || "",
              inventory_deducted: inventoryTransition.inventory_deducted
            };

            // Transition into fulfillment: deduct inventory once.
            if (inventoryTransition.action === "deduct") {
              const productRef = db.collection("products").doc(oData.product_id);
              const productDoc = await transaction.get(productRef);
              if (!productDoc.exists) {
                throw new Error("Product not found");
              }
              const pData = productDoc.data();

              if (pData.inventory < qty) {
                throw new Error(`Insufficient inventory for product: ${pData.name} (Available: ${pData.inventory}, Ordered: ${qty})`);
              }

              const newInventory = pData.inventory - qty;
              const newStatus = newInventory === 0 ? "out-of-stock" : pData.status;

              transaction.update(productRef, {
                inventory: newInventory,
                status: newStatus
              });
            }

            // Transition out of fulfillment: restore inventory if it had already been deducted.
            if (inventoryTransition.action === "restore") {
              const productRef = db.collection("products").doc(oData.product_id);
              const productDoc = await transaction.get(productRef);
              if (!productDoc.exists) {
                throw new Error("Product not found");
              }
              const pData = productDoc.data();
              const restoredInventory = (Number(pData.inventory) || 0) + qty;
              const restoredStatus = pData.status === "out-of-stock" && restoredInventory > 0 ? "for-sale" : pData.status;

              transaction.update(productRef, {
                inventory: restoredInventory,
                status: restoredStatus
              });
            }

            transaction.update(orderRef, updateData);
          });

          res.status(200).json({ success: true });
          return;
        }

        if (action === "delete_product") {
          const { id } = req.body;
          if (!id) {
            res.status(400).json({ error: "Missing required field (id)" });
            return;
          }
          await db.collection("products").doc(id).delete();
          res.status(200).json({ success: true });
          return;
        }

        if (action === "delete_order") {
          const { id } = req.body;
          if (!id) {
            res.status(400).json({ error: "Missing required field (id)" });
            return;
          }

          const orderRef = db.collection("orders").doc(id);
          await db.runTransaction(async (transaction) => {
            const orderDoc = await transaction.get(orderRef);
            if (!orderDoc.exists) {
              throw new Error("Order not found");
            }
            const oData = orderDoc.data();
            const qty = parsePositiveInteger(oData.quantity, 1);
            if (!qty) {
              throw new Error("Invalid order quantity");
            }

            if (oData.inventory_deducted) {
              const productRef = db.collection("products").doc(oData.product_id);
              const productDoc = await transaction.get(productRef);
              if (!productDoc.exists) {
                throw new Error("Product not found");
              }
              const pData = productDoc.data();
              const restoredInventory = (Number(pData.inventory) || 0) + qty;
              const restoredStatus = pData.status === "out-of-stock" && restoredInventory > 0 ? "for-sale" : pData.status;

              transaction.update(productRef, {
                inventory: restoredInventory,
                status: restoredStatus
              });
            }

            transaction.delete(orderRef);
          });

          res.status(200).json({ success: true });
          return;
        }

        if (action === "delete_subscriber") {
          const { id } = req.body;
          if (!id) {
            res.status(400).json({ error: "Missing required field (id)" });
            return;
          }
          await db.collection("subscribers").doc(id).delete();
          res.status(200).json({ success: true });
          return;
        }

        // Default: save/update product
        let { id, name, price, inventory, status, note } = req.body;
        if (!name || price === undefined || inventory === undefined || !status) {
          res.status(400).json({ error: "Missing required fields" });
          return;
        }

        if (!id) {
          // Auto-generate numeric ID
          const productsSnap = await db.collection("products").get();
          let maxIdVal = 0;
          productsSnap.forEach(doc => {
            const numId = parseInt(doc.id, 10);
            if (!isNaN(numId) && numId > maxIdVal) {
              maxIdVal = numId;
            }
          });
          id = String(maxIdVal + 1);
          console.log(`[AUTO-ID] Generated new product ID: ${id} for product: ${name}`);
        }

        const productData = {
          id,
          name,
          price: Number(price),
          inventory: Number(inventory),
          status,
          note: note || ""
        };

        await db.collection("products").doc(id).set(productData);
        res.status(200).json({ success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  });
});
