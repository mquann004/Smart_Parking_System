import json
import time
import paho.mqtt.client as mqtt
import psycopg2
from psycopg2 import sql

# --- Cấu hình PostgreSQL ---
DB_HOST = "localhost"
DB_NAME = "smart_parking"
DB_USER = "postgres"
DB_PASS = "admin"
DB_PORT = "5432"

# --- Cấu hình MQTT ---
MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883
MQTT_TOPIC = "smart_parking/rfid"

# Biến toàn cục lưu kết nối DB
db_conn = None
db_cursor = None

def init_db():
    """Tạo kết nối DB và khởi tạo các bảng cần thiết nếu chưa có"""
    global db_conn, db_cursor
    try:
        db_conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            port=DB_PORT
        )
        db_conn.autocommit = True
        db_cursor = db_conn.cursor()
        print(f"✅ Đã kết nối thành công tới Database PostgreSQL: {DB_NAME}")

        # Tạo bảng users (chủ thẻ)
        db_cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                uid VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Tạo bảng rfid_logs (lịch sử quét thẻ)
        db_cursor.execute("""
            CREATE TABLE IF NOT EXISTS rfid_logs (
                id SERIAL PRIMARY KEY,
                uid VARCHAR(50) NOT NULL,
                event_type VARCHAR(20) NOT NULL, -- 'card_detected' hoặc 'card_removed'
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Tạo bảng active_parking (Xe đang trong bãi)
        db_cursor.execute("""
            CREATE TABLE IF NOT EXISTS active_parking (
                uid VARCHAR(50) PRIMARY KEY,
                entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Tạo bảng parking_slots (Trạng thái bãi đỗ)
        db_cursor.execute("""
            CREATE TABLE IF NOT EXISTS parking_slots (
                slot_id INT PRIMARY KEY,
                is_occupied BOOLEAN DEFAULT FALSE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Khởi tạo 3 bãi đỗ nếu chưa có
        for i in range(1, 4):
            db_cursor.execute("INSERT INTO parking_slots (slot_id) VALUES (%s) ON CONFLICT (slot_id) DO NOTHING", (i,))

        # Tạo bảng gate_logs (Lịch sử ra vào cổng IR)
        db_cursor.execute("""
            CREATE TABLE IF NOT EXISTS gate_logs (
                id SERIAL PRIMARY KEY,
                gate_name VARCHAR(20) NOT NULL, -- 'IN' hoặc 'OUT'
                state VARCHAR(20) NOT NULL, -- 'detecting' hoặc 'cleared'
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        print("✅ Đã kiểm tra và khởi tạo các bảng (users, rfid_logs, active_parking, parking_slots, gate_logs)")

    except Exception as e:
        print(f"❌ Lỗi kết nối Database: {e}")
        exit(1)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ Đã kết nối tới MQTT Broker: {MQTT_BROKER}")
        client.subscribe(MQTT_TOPIC)
        print(f"📡 Đang lắng nghe trên topic: {MQTT_TOPIC}")
    else:
        print(f"❌ Lỗi kết nối MQTT, mã lỗi: {rc}")

def on_message(client, userdata, msg):
    payload = msg.payload.decode('utf-8')
    print(f"\n📩 Nhận được tin nhắn từ {msg.topic}: {payload}")
    
    try:
        data = json.loads(payload)
        event = data.get("event")
        uid = data.get("uid", None)

        if event == "rfid_scan" and uid:
            gate = data.get("gate", "UNKNOWN")
            # 1. Lưu log quét thẻ
            db_cursor.execute(
                "INSERT INTO rfid_logs (uid, event_type) VALUES (%s, %s)",
                (uid, f"scan_{gate}")
            )
            print(f"💾 Đã lưu log quét thẻ [{uid}] tại cổng {gate}.")

            # 2. Tự động thêm user nếu UID này chưa từng tồn tại
            db_cursor.execute("SELECT id FROM users WHERE uid = %s", (uid,))
            if not db_cursor.fetchone():
                db_cursor.execute(
                    "INSERT INTO users (uid, name) VALUES (%s, %s)",
                    (uid, f"User_{uid.replace(' ', '')}")
                )
                print(f"🆕 Phát hiện thẻ mới! Đã tự động tạo User: User_{uid.replace(' ', '')}")

            # 3. Xử lý logic vào / ra
            db_cursor.execute("SELECT entry_time FROM active_parking WHERE uid = %s", (uid,))
            in_parking = db_cursor.fetchone()

            if gate == "IN":
                if in_parking:
                    print(f"⚠️ Từ chối vào: Thẻ {uid} ĐANG TRONG BÃI!")
                    client.publish("smart_parking/command", json.dumps({"action": "deny_in", "msg": "thẻ này đang trong bãi"}))
                else:
                    db_cursor.execute("INSERT INTO active_parking (uid) VALUES (%s)", (uid,))
                    print(f"✅ Cho phép vào: Thẻ {uid} đã đăng ký vào bãi.")
                    client.publish("smart_parking/command", json.dumps({"action": "allow_in"}))
            
            elif gate == "OUT":
                if in_parking:
                    db_cursor.execute("DELETE FROM active_parking WHERE uid = %s", (uid,))
                    print(f"✅ Cho phép ra: Thẻ {uid} hợp lệ, đã rời bãi.")
                    client.publish("smart_parking/command", json.dumps({"action": "allow_out"}))
                else:
                    print(f"⚠️ Từ chối ra: Thẻ {uid} KHÔNG HỢP LỆ (chưa đăng ký vào).")
                    client.publish("smart_parking/command", json.dumps({"action": "deny_out", "msg": "thẻ ko hợp lệ"}))
            else:
                print("⚠️ Cổng không xác định, bỏ qua thẻ.")

        elif event == "card_removed":
             # Lưu log thẻ bị rút ra (uid có thể null hoặc không truyền gửi, nên ta lưu chuỗi rỗng hoặc xử lý thêm tùy logic)
             # Ở đây ESP32 đang gửi {"event":"card_removed"} không có UID, nên uid sẽ là None.
             db_cursor.execute(
                "INSERT INTO rfid_logs (uid, event_type) VALUES (%s, %s)",
                ("UNKNOWN", event)
             )
             print(f"💾 Đã lưu vào DB: Thẻ vừa bị RÚT RA.")

        elif event == "parking_update":
             slot_id = data.get("slot_id")
             is_occupied = data.get("is_occupied")
             if slot_id is not None and is_occupied is not None:
                 db_cursor.execute(
                     "UPDATE parking_slots SET is_occupied = %s, updated_at = CURRENT_TIMESTAMP WHERE slot_id = %s",
                     (is_occupied, slot_id)
                 )
                 state_str = "Có xe" if is_occupied else "Trống"
                 print(f"💾 Đã cập nhật DB: Bãi {slot_id} -> {state_str}")

        elif event == "gate_activity":
             gate = data.get("gate")
             state = data.get("state")
             if gate and state:
                 db_cursor.execute(
                     "INSERT INTO gate_logs (gate_name, state) VALUES (%s, %s)",
                     (gate, state)
                 )
                 state_str = "Vừa tới cổng" if state == "detecting" else "Vừa rời cổng"
                 print(f"💾 Đã lưu vào DB: Cổng {gate} -> {state_str}")

    except json.JSONDecodeError:
        print("❌ Lỗi: Tin nhắn không đúng định dạng JSON.")
    except Exception as e:
        print(f"❌ Lỗi xử lý dữ liệu: {e}")

if __name__ == "__main__":
    init_db()

    mqtt_client = mqtt.Client()
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message

    print("🔄 Đang kết nối tới MQTT Broker...")
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)

    try:
        mqtt_client.loop_forever()
    except KeyboardInterrupt:
        print("\n🛑 Đang đóng kết nối...")
        if db_cursor:
            db_cursor.close()
        if db_conn:
            db_conn.close()
        mqtt_client.disconnect()
        print("Tạm biệt!")
