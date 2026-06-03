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

# --- Firebase Admin SDK Initialization with Graceful Fallback ---
db = None
firebase_initialized = False

try:
    import firebase_admin
    from firebase_admin import credentials
    from firebase_admin import firestore
    from google.oauth2.credentials import Credentials

    # 1. Try environment variable first
    service_account_info = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
    if service_account_info:
        try:
            cert_dict = json.loads(service_account_info)
            cred = credentials.Certificate(cert_dict)
            firebase_admin.initialize_app(cred)
            db = firestore.client()
            firebase_initialized = True
            print("Firebase Admin SDK initialized successfully via environment variable.")
        except Exception as e:
            print(f"Error initializing Firebase via environment variable: {e}")

    # 2. Try local serviceAccountKey.json if env variable was not set/failed
    if not firebase_initialized and os.path.exists('serviceAccountKey.json'):
        try:
            cred = credentials.Certificate('serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
            db = firestore.client()
            firebase_initialized = True
            print("Firebase Admin SDK initialized successfully via local serviceAccountKey.json.")
        except Exception as e:
            print(f"Error initializing Firebase via local file: {e}")

    # 3. Try local firebase-tools user credentials (OAuth token)
    if not firebase_initialized:
        token_file = os.path.expanduser('~/.config/configstore/firebase-tools.json')
        if os.path.exists(token_file):
            try:
                with open(token_file, 'r', encoding='utf-8') as f:
                    creds_data = json.load(f)
                token_info = creds_data.get('tokens', {})
                access_token = token_info.get('access_token')
                refresh_token = token_info.get('refresh_token')
                client_id = creds_data.get('user', {}).get('aud')
                
                creds = Credentials(
                    token=access_token,
                    refresh_token=refresh_token,
                    token_uri="https://oauth2.googleapis.com/token",
                    client_id=client_id
                )
                
                firebase_admin.initialize_app(creds, {
                    'projectId': 'artic-official-home'
                })
                db = firestore.client()
                firebase_initialized = True
                print("Firebase Admin SDK initialized successfully via local firebase-tools User Token.")
            except Exception as e:
                print(f"Error initializing Firebase via local user token: {e}")

    if not firebase_initialized:
        print("No Firebase credentials found. Falling back to local SQLite database.")

except ImportError:
    print("firebase-admin package not installed. Falling back to local SQLite database.")


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
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS quarterly_subscribers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()


def save_to_sqlite(name, email, phone, address, quantity, depositor, notes):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO orders (name, email, phone, address, quantity, depositor, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (name, email, phone, address, quantity, depositor, notes))
        conn.commit()
        conn.close()
        print("Checkout successfully saved to local SQLite database.")
        return True
    except Exception as e:
        print(f"Error saving to SQLite: {e}")
        return False


def save_subscriber_to_sqlite(email):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO quarterly_subscribers (email)
            VALUES (?)
        ''', (email,))
        conn.commit()
        conn.close()
        print("Waitlist subscriber successfully saved to local SQLite database.")
        return True
    except Exception as e:
        print(f"Error saving subscriber to SQLite: {e}")
        return False


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

                # Save Data (Firestore priority, SQLite fallback)
                saved_to_cloud = False
                if db is not None:
                    try:
                        order_data = {
                            'name': name,
                            'email': email,
                            'phone': phone,
                            'address': address,
                            'quantity': quantity,
                            'depositor': depositor,
                            'notes': notes,
                            'created_at': firestore.SERVER_TIMESTAMP
                        }
                        doc_ref = db.collection('orders').document()
                        doc_ref.set(order_data)
                        print(f"Checkout successfully saved to Firestore (ID: {doc_ref.id}).")
                        saved_to_cloud = True
                    except Exception as fe:
                        print(f"Error saving to Firestore: {fe}. Falling back to SQLite.")
                        save_to_sqlite(name, email, phone, address, quantity, depositor, notes)
                else:
                    save_to_sqlite(name, email, phone, address, quantity, depositor, notes)

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
- 은행: 토스뱅크
- 계좌번호: 1002-1532-0842
- 예금주: 김민제

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
                self.wfile.write(json.dumps({'success': True, 'saved_to_cloud': saved_to_cloud}).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
        elif self.path == '/api/waitlist':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                email = data.get('email')

                if not email:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'Email is required'}).encode('utf-8'))
                    return

                # Save Data (Firestore priority, SQLite fallback)
                saved_to_cloud = False
                if db is not None:
                    try:
                        subscriber_data = {
                            'email': email,
                            'created_at': firestore.SERVER_TIMESTAMP
                        }
                        doc_ref = db.collection('quarterly_subscribers').document()
                        doc_ref.set(subscriber_data)
                        print(f"Waitlist subscriber successfully saved to Firestore (ID: {doc_ref.id}).")
                        saved_to_cloud = True
                    except Exception as fe:
                        print(f"Error saving subscriber to Firestore: {fe}. Falling back to SQLite.")
                        save_subscriber_to_sqlite(email)
                else:
                    save_subscriber_to_sqlite(email)

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'saved_to_cloud': saved_to_cloud}).encode('utf-8'))
                
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
