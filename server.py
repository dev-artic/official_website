import os
import json
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.header import Header
import http.server
import socketserver

PORT = 8000
DB_FILE = 'orders.db'

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
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
        )
    ''')
    conn.commit()
    conn.close()

def send_email(to_addr, subject, body):
    smtp_host = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
    smtp_port = int(os.environ.get('SMTP_PORT', '587'))
    smtp_user = os.environ.get('SMTP_USER')
    smtp_password = os.environ.get('SMTP_PASSWORD')
    from_addr = smtp_user or 'admin@artic.live'

    if not smtp_user or not smtp_password:
        print("\n=== [EMAIL MOCK] ===")
        print(f"To: {to_addr}")
        print(f"Subject: {subject}")
        print(f"Body:\n{body}")
        print("====================\n")
        return True

    try:
        msg = MIMEText(body, 'plain', 'utf-8')
        msg['Subject'] = Header(subject, 'utf-8')
        msg['From'] = from_addr
        msg['To'] = to_addr

        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(from_addr, [to_addr], msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Error sending email to {to_addr}: {e}")
        return False

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/checkout':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                name = data.get('name')
                email = data.get('email')
                phone = data.get('phone')
                address = data.get('address')
                quantity = int(data.get('quantity', 1))
                depositor = data.get('depositor', name)
                notes = data.get('notes', '')

                if not all([name, email, phone, address]):
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'Missing required fields'}).encode('utf-8'))
                    return

                # Save to database
                conn = sqlite3.connect(DB_FILE)
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO orders (name, email, phone, address, quantity, depositor, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (name, email, phone, address, quantity, depositor, notes))
                conn.commit()
                conn.close()

                # Send email to customer
                total_price = 15000 * quantity + 3000
                customer_subject = "[artic.] 1MC1PD: The Interview 결제 요청 완료"
                customer_body = f"""안녕하세요, {name}님. artic. 입니다.

'1MC1PD: The Interview' 결제 요청이 접수되었습니다.
아래 계좌로 주문 금액을 입금해 주시면 입금 확인 후 배송을 진행해 드리겠습니다.

[주문 정보]
- 상품명: 1MC1PD: The Interview (Limited Edition)
- 수량: {quantity}개
- 총 결제 금액: {total_price:,}원 (상품가 15,000원 * 수량 + 배송비 3,000원)
- 입금자명: {depositor}
- 배송지 주소: {address}
- 연락처: {phone}

[입금 계좌 정보]
- 은행: 국민은행
- 계좌번호: 123-4567-89012
- 예금주: artic

문의 사항이 있으실 경우 admin@artic.live 로 메일을 보내주시기 바랍니다.
감사합니다.

ⓒ 2026 artic. All Rights Reserved."""

                # Send email to admin
                admin_email = os.environ.get('ADMIN_EMAIL', 'admin@artic.live')
                admin_subject = f"[ADMIN] 새로운 결제 요청 접수 - {name}님"
                admin_body = f"""새로운 '1MC1PD: The Interview' 결제 요청이 접수되었습니다.

[신청 정보]
- 신청자명: {name}
- 이메일: {email}
- 연락처: {phone}
- 배송지 주소: {address}
- 수량: {quantity}개
- 입금자명: {depositor}
- 요청사항: {notes}

입금 및 주소를 확인해 주시기 바랍니다."""

                send_email(email, customer_subject, customer_body)
                send_email(admin_email, admin_subject, admin_body)

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True}).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    init_db()
    print(f"Starting Custom artic. Server on port {PORT}...")
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        httpd.serve_forever()
