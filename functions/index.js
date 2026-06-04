const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const cors = require("cors")({ origin: true });
const fs = require("fs");
const path = require("path");

admin.initializeApp();
const db = admin.firestore();

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

  if (!smtpUser || !smtpPassword) {
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
    }
    if (body) {
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
      const { name, email, phone, address, quantity, depositor, notes } = req.body;
      const qty = parseInt(quantity || "1", 10);
      const depName = depositor || name;
      const chkNotes = notes || "";

      if (!name || !email || !phone || !address) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      // 1. Write to Firestore
      const orderData = {
        name,
        email,
        phone,
        address,
        quantity: qty,
        depositor: depName,
        notes: chkNotes,
        created_at: FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("orders").add(orderData);
      console.log(`Checkout successfully saved to Firestore (ID: ${docRef.id}).`);

      // 2. Prepare receipt emails (Plaintext fallback + Template HTML)
      const totalPrice = 15000 * qty + 3000;
      const customerSubject = "[artic.] 1MC1PD: The Interview 결제 요청 완료";
      const customerBody = `안녕하세요, ${name}님. artic. 입니다.

'1MC1PD: The Interview' 결제 요청이 접수되었습니다.
아래 계좌로 주문 금액을 입금해 주시면 입금 확인 후 배송을 진행해 드리겠습니다.

[주문 정보]
- 상품명: 1MC1PD: The Interview (Limited Edition)
- 수량: ${qty}개
- 총 결제 금액: ${totalPrice.toLocaleString()}원 (상품가 15,000원 * 수량 + 배송비 3,000원)
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
      const adminBody = `새로운 '1MC1PD: The Interview' 결제 요청이 접수되었습니다.

[신청 정보]
- 신청자명: ${name}
- 이메일: ${email}
- 연락처: ${phone}
- 배송지 주소: ${address}
- 수량: ${qty}개
- 입금자명: ${depName}
- 요청사항: ${chkNotes}

입금 및 주소를 확인해 주시기 바랍니다.`;

      // 3. Load HTML Email Templates and compile
      const { customerTemplate, adminTemplate } = getTemplates();
      let customerHtml = null;
      let adminHtml = null;

      if (customerTemplate) {
        const bodyHtml = `<p>안녕하세요, <strong>${name}</strong>님. artic. 입니다.</p>
<p><strong>'1MC1PD: The Interview'</strong> 결제 요청이 접수되었습니다.<br>
아래 계좌로 주문 금액을 입금해 주시면 입금 확인 후 배송을 진행해 드리겠습니다.</p>`;

        const dataTableHtml = `<table class="data-table">
  <tr>
    <td class="label">상품명</td>
    <td class="value">1MC1PD: The Interview (Limited Edition)</td>
  </tr>
  <tr>
    <td class="label">수량</td>
    <td class="value">${qty}개</td>
  </tr>
  <tr>
    <td class="label">총 결제 금액</td>
    <td class="value"><span class="bold">${totalPrice.toLocaleString()}원</span> (상품가 15,000원 * 수량 + 배송비 3,000원)</td>
  </tr>
  <tr>
    <td class="label">입금자명</td>
    <td class="value">${depName}</td>
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

        customerHtml = customerTemplate
          .replace("{{TITLE}}", customerSubject)
          .replace("{{BODY_CONTENT}}", bodyHtml)
          .replace("{{DATA_TABLE}}", dataTableHtml);
      }

      if (adminTemplate) {
        const adminBodyHtml = `<p>새로운 <strong>'1MC1PD: The Interview'</strong> 결제 요청이 접수되었습니다.</p>`;

        const adminDataTableHtml = `<table class="data-table">
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
    <td class="value">${qty}개</td>
  </tr>
  <tr>
    <td class="label">입금자명</td>
    <td class="value">${depName}</td>
  </tr>
  <tr>
    <td class="label">요청사항</td>
    <td class="value">${chkNotes || "(없음)"}</td>
  </tr>
</table>`;

        adminHtml = adminTemplate
          .replace("{{TITLE}}", "새로운 결제 요청 접수")
          .replace("{{BODY_CONTENT}}", adminBodyHtml)
          .replace("{{DATA_TABLE}}", adminDataTableHtml)
          .replace("{{DB_COLLECTION}}", "orders")
          .replace("{{DB_DOC_ID}}", docRef.id);
      }

      // 4. Send emails
      await sendEmail({ to: email, subject: customerSubject, body: customerBody, html: customerHtml });
      await sendEmail({ to: adminEmail, subject: adminSubject, body: adminBody, html: adminHtml });

      res.status(200).json({ success: true, saved_to_cloud: true, order_id: docRef.id });
    } catch (err) {
      console.error("Internal server error during checkout:", err);
      res.status(500).json({ error: err.message });
    }
  });
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
      const { email } = req.body;

      if (!email) {
        res.status(400).json({ error: "Email is required" });
        return;
      }

      // Simple email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ error: "Invalid email format" });
        return;
      }

      // Check duplicate email
      const snapshot = await db.collection("quarterly_subscribers")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        res.status(400).json({ error: "This email is already registered. Stay tuned!" });
        return;
      }

      const subscriberData = {
        email,
        created_at: FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("quarterly_subscribers").add(subscriberData);
      console.log(`Waitlist subscriber successfully saved to Firestore (ID: ${docRef.id}).`);

      // Count total subscribers
      const countSnapshot = await db.collection("quarterly_subscribers").get();
      const totalCount = countSnapshot.size;

      // 1. Prepare Waitlist emails
      const customerSubject = "[artic.] Join Waitlist 등록 완료";
      const customerBody = `안녕하세요. artic. 입니다.

artic.의 새로운 소식을 가장 먼저 받아보실 수 있는 대기 명단(Waitlist) 등록이 완료되었습니다.

"Stay tuned. We will share our official release with you first."

준비가 완료되는 대로 등록해 주신 이메일(${email})로 가장 먼저 공개 소식을 전해드리겠습니다.
감사합니다.

ⓒ 2026 artic. All Rights Reserved.`;

      const adminEmail = process.env.ADMIN_EMAIL || "admin@artic.live";
      const adminSubject = `[ADMIN] 새로운 Waitlist 구독 접수 - ${email}`;
      const adminBody = `새로운 고객이 Quarterly Join Waitlist에 가입했습니다.

[신청 정보]
- 가입 이메일: ${email}
- 가입 일시: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (KST)
- 현재 총 등록 인원: ${totalCount}명

Firestore 컬렉션 quarterly_subscribers에 적재되었습니다.`;

      // 2. Load HTML Email Templates and compile
      const { customerTemplate, adminTemplate } = getTemplates();
      let customerHtml = null;
      let adminHtml = null;

      if (customerTemplate) {
        const bodyHtml = `<p>안녕하세요. <strong>artic.</strong> 입니다.</p>
<p>artic.의 새로운 소식을 가장 먼저 받아보실 수 있는 <strong>대기 명단(Waitlist) 등록이 완료</strong>되었습니다.</p>
<p style="font-size: 16px; font-style: italic; color: #111111; margin: 30px 0; text-align: center; font-weight: 300;">
  "Stay tuned. We will share our official release with you first."
</p>
<p>준비가 완료되는 대로 등록해 주신 이메일(<strong>${email}</strong>)로 가장 먼저 공개 소식을 전해드리겠습니다.</p>`;

        const dataTableHtml = `<table class="data-table">
  <tr>
    <td class="label">등록 이메일</td>
    <td class="value">${email}</td>
  </tr>
  <tr>
    <td class="label">상태</td>
    <td class="value"><span class="bold">대기 명단 등록 완료</span></td>
  </tr>
</table>`;

        customerHtml = customerTemplate
          .replace("{{TITLE}}", "Join Waitlist 등록 완료")
          .replace("{{BODY_CONTENT}}", bodyHtml)
          .replace("{{DATA_TABLE}}", dataTableHtml);
      }

      if (adminTemplate) {
        const adminBodyHtml = `<p>새로운 고객이 <strong>Quarterly Join Waitlist</strong>에 가입했습니다.</p>`;

        const adminDataTableHtml = `<table class="data-table">
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

        adminHtml = adminTemplate
          .replace("{{TITLE}}", "새로운 Waitlist 가입 알림")
          .replace("{{BODY_CONTENT}}", adminBodyHtml)
          .replace("{{DATA_TABLE}}", adminDataTableHtml)
          .replace("{{DB_COLLECTION}}", "quarterly_subscribers")
          .replace("{{DB_DOC_ID}}", docRef.id);
      }

      // 3. Send emails
      await sendEmail({ to: email, subject: customerSubject, body: customerBody, html: customerHtml });
      await sendEmail({ to: adminEmail, subject: adminSubject, body: adminBody, html: adminHtml });

      res.status(200).json({ success: true, saved_to_cloud: true, id: docRef.id, total_subscribers: totalCount });
    } catch (err) {
      console.error("Internal server error during waitlist submission:", err);
      res.status(500).json({ error: err.message });
    }
  });
});
