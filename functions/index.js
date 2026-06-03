const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// SMTP Email helper
async function sendEmail({ to, subject, body }) {
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const fromAddr = smtpUser || "admin@artic.live";

  if (!smtpUser || !smtpPassword) {
    console.log("\n=== [EMAIL MOCK] ===");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${body}`);
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

    await transporter.sendMail({
      from: fromAddr,
      to: to,
      subject: subject,
      text: body,
    });

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

      // 2. Prepare receipt emails
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

      // 3. Send emails
      await sendEmail({ to: email, subject: customerSubject, body: customerBody });
      await sendEmail({ to: adminEmail, subject: adminSubject, body: adminBody });

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

      res.status(200).json({ success: true, saved_to_cloud: true, id: docRef.id });
    } catch (err) {
      console.error("Internal server error during waitlist submission:", err);
      res.status(500).json({ error: err.message });
    }
  });
});

