const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');
const templatesDir = path.join(baseDir, 'functions', 'templates');
const scratchDir = path.join(baseDir, 'scratch');

if (!fs.existsSync(scratchDir)) {
  fs.mkdirSync(scratchDir, { recursive: true });
}

// Helper to read templates
function getTemplates() {
  const customerPath = path.join(templatesDir, "customer-email-template.html");
  const adminPath = path.join(templatesDir, "admin-email-template.html");
  
  if (!fs.existsSync(customerPath) || !fs.existsSync(adminPath)) {
    console.error("Templates not found at:", templatesDir);
    return null;
  }
  
  const customerTemplate = fs.readFileSync(customerPath, "utf8");
  const adminTemplate = fs.readFileSync(adminPath, "utf8");
  return { customerTemplate, adminTemplate };
}

function generatePreviews() {
  const templates = getTemplates();
  if (!templates) return;

  const { customerTemplate, adminTemplate } = templates;

  // Mock Data
  const name = "김철수";
  const email = "chulsoo@example.com";
  const phone = "010-1234-5678";
  const address = "서울특별시 강남구 테헤란로 123";
  const productName = "1MC1PD: The Interview";
  const qty = 2;
  const productPrice = 15000;
  const totalPrice = productPrice * qty + 3000;
  const depName = "김철수";
  const chkNotes = "부재 시 경비실에 맡겨주세요.";
  const orderId = "order_mock_12345";
  const totalCount = 42;
  const docId = "waitlist_mock_54321";

  // 1. Customer Checkout HTML
  const customerCheckoutBody = `<p>안녕하세요, <strong>${name}</strong>님. artic. 입니다.</p>
<p><strong>'${productName}'</strong> 결제 요청이 접수되었습니다.<br>
아래 계좌로 주문 금액을 입금해 주시면 입금 확인 후 배송을 진행해 드리겠습니다.</p>`;

  const customerCheckoutTable = `<table class="data-table">
  <tr>
    <td class="label">상품명</td>
    <td class="value">${productName}</td>
  </tr>
  <tr>
    <td class="label">수량</td>
    <td class="value">${qty}개</td>
  </tr>
  <tr>
    <td class="label">총 결제 금액</td>
    <td class="value"><span class="bold">${totalPrice.toLocaleString()}원</span> (상품가 ${productPrice.toLocaleString()}원 * 수량 + 배송비 3,000원)</td>
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

  const customerCheckoutHtml = customerTemplate
    .replace(/{{TITLE}}/g, `[artic.] ${productName} 결제 요청 완료`)
    .replace("{{BODY_CONTENT}}", customerCheckoutBody)
    .replace("{{DATA_TABLE}}", customerCheckoutTable);

  fs.writeFileSync(path.join(scratchDir, "customer-checkout-preview.html"), customerCheckoutHtml, "utf8");

  // 2. Admin Checkout HTML
  const adminCheckoutBody = `<p>새로운 <strong>'${productName}'</strong> 결제 요청이 접수되었습니다.</p>`;

  const adminCheckoutTable = `<table class="data-table">
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
    <td class="value">${chkNotes}</td>
  </tr>
</table>`;

  const adminCheckoutHtml = adminTemplate
    .replace(/{{TITLE}}/g, "새로운 결제 요청 접수")
    .replace("{{BODY_CONTENT}}", adminCheckoutBody)
    .replace("{{DATA_TABLE}}", adminCheckoutTable)
    .replace("{{DB_COLLECTION}}", "orders")
    .replace("{{DB_DOC_ID}}", orderId);

  fs.writeFileSync(path.join(scratchDir, "admin-checkout-preview.html"), adminCheckoutHtml, "utf8");

  // 3. Customer Waitlist HTML
  const customerWaitlistBody = `<p style="text-align: left; margin-bottom: 18px; font-size: 14px; line-height: 1.6; color: #111111;">
  안녕하세요, <strong>${name}</strong>님.<br>
  quarterly artic. 대기명단 등록이 완료되었습니다.<br>
  새로운 소식이 준비되는 대로 가장 먼저 메일로 전해드리겠습니다.
</p>
<p style="text-align: left; margin-top: 18px; font-size: 13px; line-height: 1.6; color: #777777;">
  Hello, <strong>${name}</strong>.<br>
  You have been successfully registered on the quarterly artic. waitlist.
</p>`;

  const customerWaitlistTable = `<table class="data-table">
  <tr>
    <td class="label">이름</td>
    <td class="value">${name}</td>
  </tr>
  <tr>
    <td class="label">이메일</td>
    <td class="value">${email}</td>
  </tr>
  <tr>
    <td class="label">상태</td>
    <td class="value"><span class="bold">대기명단 등록 완료</span></td>
  </tr>
</table>`;

  const customerWaitlistHtml = customerTemplate
    .replace(/{{TITLE}}/g, "waitlist")
    .replace("{{BODY_CONTENT}}", customerWaitlistBody)
    .replace("{{DATA_TABLE}}", customerWaitlistTable);

  fs.writeFileSync(path.join(scratchDir, "customer-waitlist-preview.html"), customerWaitlistHtml, "utf8");

  // 4. Admin Waitlist HTML
  const adminWaitlistBody = `<p>새로운 고객이 <strong>Quarterly Join Waitlist</strong>에 가입하여 Firestore DB에 등록되었습니다.</p>`;

  const adminWaitlistTable = `<table class="data-table">
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

  const adminWaitlistHtml = adminTemplate
    .replace(/{{TITLE}}/g, "새로운 Waitlist 가입 알림")
    .replace("{{BODY_CONTENT}}", adminWaitlistBody)
    .replace("{{DATA_TABLE}}", adminWaitlistTable)
    .replace("{{DB_COLLECTION}}", "subscribers")
    .replace("{{DB_DOC_ID}}", docId);

  fs.writeFileSync(path.join(scratchDir, "admin-waitlist-preview.html"), adminWaitlistHtml, "utf8");

  console.log("Email previews generated successfully in scratch/ folder:");
  console.log("- Customer Checkout: http://localhost:8000/scratch/customer-checkout-preview.html");
  console.log("- Admin Checkout:    http://localhost:8000/scratch/admin-checkout-preview.html");
  console.log("- Customer Waitlist: http://localhost:8000/scratch/customer-waitlist-preview.html");
  console.log("- Admin Waitlist:    http://localhost:8000/scratch/admin-waitlist-preview.html");
}

generatePreviews();
