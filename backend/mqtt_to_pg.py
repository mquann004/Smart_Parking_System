import json
import time
import paho.mqtt.client as mqtt
import psycopg2
from psycopg2 import sql
from datetime import datetime

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

# Biến trạng thái cổng vào (Sequential logic context)
gate_in_context = {
    "is_car_present": False,
    "is_session_active": False,
    "is_parking_full": False,
    "is_rfid_valid": False,
    "uid": None,
    "pending_entry_uid": None,
    "pending_entry_plate": None,
    "is_plate_handled": False
}

# Biến trạng thái cổng ra
gate_out_context = {
    "is_car_present": False,
    "is_session_active": False,
    "is_rfid_valid": False,
    "uid": None,
    "expected_plate": None,
    "pending_exit_uid": None,
    "is_plate_handled": False
}

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
                license_plate VARCHAR(20),
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
        
        # Tạo bảng parking_history (Lịch sử ra vào tổng hợp)
        db_cursor.execute("""
            CREATE TABLE IF NOT EXISTS parking_history (
                id SERIAL PRIMARY KEY,
                uid VARCHAR(50) NOT NULL,
                license_plate VARCHAR(20),
                type VARCHAR(10) NOT NULL, -- 'IN' hoặc 'OUT'
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Tạo bảng parking_settings (Cấu hình giá tiền)
        db_cursor.execute("""
            CREATE TABLE IF NOT EXISTS parking_settings (
                id INT PRIMARY KEY,
                first_hour_fee INT DEFAULT 5000,
                next_hour_fee INT DEFAULT 3000,
                overnight_fee INT DEFAULT 20000,
                first_period_mins INT DEFAULT 60,
                overnight_threshold_mins INT DEFAULT 720, -- 12h
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Đảm bảo các cột mới tồn tại nếu bảng đã có từ trước
            ALTER TABLE parking_settings ADD COLUMN IF NOT EXISTS first_period_mins INT DEFAULT 60;
            ALTER TABLE parking_settings ADD COLUMN IF NOT EXISTS overnight_threshold_mins INT DEFAULT 720;

            INSERT INTO parking_settings (id, first_hour_fee, next_hour_fee, overnight_fee, first_period_mins, overnight_threshold_mins)
            VALUES (1, 5000, 3000, 20000, 60, 720)
            ON CONFLICT (id) DO NOTHING;
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
        
        # Tạo bảng license_plate_logs (Lịch sử nhận diện biển số xe)
        db_cursor.execute("""
            CREATE TABLE IF NOT EXISTS license_plate_logs (
                id SERIAL PRIMARY KEY,
                license_plate VARCHAR(20) NOT NULL,
                confidence DECIMAL(3,2),
                timestamp TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Tạo bảng pending_confirmations (Chờ người dùng xác nhận biển số)
        db_cursor.execute("""
            CREATE TABLE IF NOT EXISTS pending_confirmations (
                gate VARCHAR(10) PRIMARY KEY, -- 'IN' hoặc 'OUT'
                uid VARCHAR(50),
                license_plate VARCHAR(20),
                confidence DECIMAL(3,2),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        print("✅ Đã kiểm tra và khởi tạo các bảng (users, rfid_logs, active_parking, parking_slots, gate_logs, license_plate_logs, pending_confirmations)")

    except Exception as e:
        print(f"❌ Lỗi kết nối Database: {e}")
        exit(1)

def handle_license_plate_message(data: dict, mqtt_client) -> bool:
    """
    Process license plate detection message for both entry and exit gates
    """
    try:
        # Validate required fields
        required_fields = ["event", "license_plate", "timestamp", "confidence", "gate"]
        for field in required_fields:
            if field not in data:
                print(f"⚠️ Missing required field: {field}")
                return False
        
        license_plate = data["license_plate"]
        confidence = data["confidence"]
        gate_type = data["gate"] # "entry" or "exit"
        
        try:
            timestamp = datetime.fromisoformat(data["timestamp"])
        except (ValueError, TypeError):
            timestamp = datetime.now()

        # 1. Lưu log biển số vào DB (luôn lưu lịch sử)
        db_cursor.execute(
            "INSERT INTO license_plate_logs (license_plate, confidence, timestamp) VALUES (%s, %s, %s)",
            (license_plate, confidence, timestamp)
        )
        print(f"💾 Đã lưu biển số xe: {license_plate} ({gate_type})")

        # 2. Xử lý logic cổng vào (ENTRY)
        if gate_type == "entry":
            if not gate_in_context["is_rfid_valid"]:
                print(f"⚠️ Từ chối cổng vào: Xe {license_plate} chưa quét thẻ RFID.")
                return False
            
            # 1. Kiểm tra xem đã có yêu cầu nào đang chờ chưa
            db_cursor.execute("SELECT 1 FROM pending_confirmations WHERE gate = %s", ("IN",))
            if db_cursor.fetchone():
                return True # Đang chờ xác nhận, không chèn thêm
            
            # 2. Kiểm tra cooldown (tránh việc vừa nhấn Xong nó lại hiện lên ngay)
            now = time.time()
            last_scan = gate_in_context.get("last_scan_time", 0)
            if now - last_scan < 5: # Cooldown 5 giây
                return True

            # Thay vì mở cổng ngay, lưu vào bảng chờ xác nhận
            db_cursor.execute(
                "INSERT INTO pending_confirmations (gate, uid, license_plate, confidence) VALUES (%s, %s, %s, %s) ON CONFLICT (gate) DO UPDATE SET uid = EXCLUDED.uid, license_plate = EXCLUDED.license_plate, confidence = EXCLUDED.confidence, timestamp = CURRENT_TIMESTAMP",
                ("IN", gate_in_context["uid"], license_plate, confidence)
            )
            gate_in_context["last_scan_time"] = now
            print(f"⏳ [ENTRY] Đang chờ người dùng xác nhận biển số: {license_plate}")
            return True

        # 3. Xử lý logic cổng ra (EXIT)
        elif gate_type == "exit":
            if not gate_out_context["is_rfid_valid"]:
                print(f"⚠️ Từ chối cổng ra: Xe {license_plate} chưa quét thẻ RFID.")
                return False
            
            # 1. Kiểm tra xem đã có yêu cầu nào đang chờ chưa
            db_cursor.execute("SELECT 1 FROM pending_confirmations WHERE gate = %s", ("OUT",))
            if db_cursor.fetchone():
                return True # Đang chờ xác nhận
            
            # 2. Kiểm tra cooldown
            now = time.time()
            last_scan = gate_out_context.get("last_scan_time", 0)
            if now - last_scan < 5:
                return True

            # ĐỐI CHIẾU BIỂN SỐ (Vẫn đối chiếu để cảnh báo nếu cần, nhưng vẫn chờ xác nhận)
            expected = gate_out_context["expected_plate"]
            if expected and license_plate != expected:
                print(f"❌ CẢNH BÁO: Biển số KHÔNG KHỚP! (Vào: {expected}, Ra: {license_plate})")
            
            # Lưu vào bảng chờ xác nhận
            db_cursor.execute(
                "INSERT INTO pending_confirmations (gate, uid, license_plate, confidence) VALUES (%s, %s, %s, %s) ON CONFLICT (gate) DO UPDATE SET uid = EXCLUDED.uid, license_plate = EXCLUDED.license_plate, confidence = EXCLUDED.confidence, timestamp = CURRENT_TIMESTAMP",
                ("OUT", gate_out_context["uid"], license_plate, confidence)
            )
            gate_out_context["last_scan_time"] = now
            print(f"⏳ [EXIT] Đang chờ người dùng xác nhận biển số: {license_plate}")
            return True

    except Exception as e:
        print(f"❌ Error handling license plate message: {e}")
        import traceback
        traceback.print_exc()
        return False

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ Đã kết nối tới MQTT Broker: {MQTT_BROKER}")
        client.subscribe(MQTT_TOPIC)
        print(f"📡 Đang lắng nghe trên topic: {MQTT_TOPIC}")
        
        # Subscribe to license plate topic
        client.subscribe("smart_parking/license_plate")
        print(f"📡 Đang lắng nghe trên topic: smart_parking/license_plate")
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
            
            # Nếu là cổng vào, kiểm tra xem đã có phiên đăng ký chưa (đã từng chạm IR)
            if gate == "IN":
                if gate_in_context.get("is_parking_full", False):
                    print(f"⚠️ Từ chối RFID: Bãi đỗ xe đã đầy.")
                    client.publish("smart_parking/command", json.dumps({"action": "deny_in", "msg": "Nhà xe đã hết chỗ"}))
                    return
                if not gate_in_context.get("is_session_active", False):
                    print(f"⚠️ Từ chối RFID: Chưa chạm cảm biến IR lần nào.")
                    client.publish("smart_parking/command", json.dumps({"action": "deny_in", "msg": "Hãy tiến xe vào cổng trước"}))
                    return

            # 3. Xử lý logic vào / ra
            db_cursor.execute("SELECT license_plate FROM active_parking WHERE uid = %s", (uid,))
            in_parking = db_cursor.fetchone()

            if gate == "IN":
                if in_parking:
                    print(f"⚠️ Từ chối vào: Thẻ {uid} ĐANG TRONG BÃI!")
                    db_cursor.execute(
                        "INSERT INTO rfid_logs (uid, event_type) VALUES (%s, %s)",
                        (uid, "deny_in_already_present")
                    )
                    client.publish("smart_parking/command", json.dumps({"action": "deny_in", "msg": "Thẻ đang trong bãi"}))
                else:
                    db_cursor.execute(
                        "INSERT INTO rfid_logs (uid, event_type) VALUES (%s, %s)",
                        (uid, "scan_in")
                    )
                    # ✅ Cập nhật context để cho phép nhận diện biển số
                    gate_in_context["is_rfid_valid"] = True
                    gate_in_context["uid"] = uid
                    print(f"✅ Đã quét thẻ thành công: Thẻ {uid}. Đang chờ nhận diện biển số...")
                    client.publish("smart_parking/command", json.dumps({"action": "allow_in"}))
            
            elif gate == "OUT":
                if not gate_out_context.get("is_session_active", False):
                    print(f"⚠️ Từ chối RFID: Xe chưa tiến vào vị trí cảm biến IR cổng ra.")
                    client.publish("smart_parking/command", json.dumps({"action": "deny_out", "msg": "Hãy tiến xe vào cổng trước"}))
                    return

                if in_parking:
                    license_plate_in = in_parking[0]
                    db_cursor.execute(
                        "INSERT INTO rfid_logs (uid, event_type) VALUES (%s, %s)",
                        (uid, "scan_out")
                    )
                    # Thiết lập trạng thái chờ camera đối chiếu
                    gate_out_context["is_rfid_valid"] = True
                    gate_out_context["uid"] = uid
                    gate_out_context["expected_plate"] = license_plate_in
                    
                    print(f"✅ Thẻ {uid} hợp lệ (Biển số đã đăng ký: {license_plate_in}). Đang chờ camera đối chiếu...")
                    client.publish("smart_parking/command", json.dumps({"action": "allow_out", "msg": "Chờ đối chiếu biển số"}))
                else:
                    print(f"⚠️ Từ chối ra: Thẻ {uid} KHÔNG HỢP LỆ (chưa đăng ký vào).")
                    db_cursor.execute(
                        "INSERT INTO rfid_logs (uid, event_type) VALUES (%s, %s)",
                        (uid, "deny_out_not_found")
                    )
                    client.publish("smart_parking/command", json.dumps({"action": "deny_out", "msg": "Thẻ chưa vào bãi"}))
            else:
                print("⚠️ Cổng không xác định, bỏ qua thẻ.")

        elif event == "card_removed":
             # Lưu log thẻ bị rút ra
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
                 
                 if gate == "IN":
                     if state == "detecting":
                         gate_in_context["is_car_present"] = True
                         gate_in_context["is_session_active"] = True
                         gate_in_context["is_rfid_valid"] = False
                         gate_in_context["is_plate_handled"] = False
                         gate_in_context["uid"] = None
                         
                         db_cursor.execute("SELECT COUNT(*) FROM active_parking")
                         count = db_cursor.fetchone()[0]
                         if count >= 3:
                             print(f"🚨 Bãi đỗ xe đã đầy ({count}/3)!")
                             gate_in_context["is_parking_full"] = True
                             db_cursor.execute(
                                 "INSERT INTO rfid_logs (uid, event_type) VALUES (%s, %s)",
                                 ("SYSTEM", "deny_full_in")
                             )
                             client.publish("smart_parking/command", json.dumps({"action": "full_parking", "msg": "Nhà xe đã hết chỗ"}))
                         else:
                             gate_in_context["is_parking_full"] = False
                             print(f"🚗 Xe đã tới cổng vào. (Sức chứa: {count}/3)")
                     elif state == "cleared":
                         gate_in_context["is_car_present"] = False
                         print("ℹ️ Cảm biến IR trống (giữ nguyên trạng thái chờ camera nếu đã quét thẻ).")
                     elif state == "closed":
                             gate_in_context["pending_entry_uid"] = None
                             gate_in_context["pending_entry_plate"] = None
                             gate_in_context["is_session_active"] = False
                             gate_in_context["is_plate_handled"] = False
                 
                 elif gate == "OUT":
                     if state == "detecting":
                         gate_out_context["is_car_present"] = True
                         gate_out_context["is_session_active"] = True
                         gate_out_context["is_rfid_valid"] = False
                         gate_out_context["is_plate_handled"] = False
                         gate_out_context["uid"] = None
                         gate_out_context["expected_plate"] = None
                         print("🚗 Xe đã tới cổng ra.")
                     elif state == "cleared":
                         gate_out_context["is_car_present"] = False
                         print("ℹ️ Cổng ra trống.")
                     elif state == "closed":
                         # Phiên đã kết thúc (dữ liệu đã được xóa lúc mở cổng)
                         print(f"✅ Xe đã rời cổng OUT. Kết thúc phiên.")
                         gate_out_context["is_session_active"] = False
                         gate_out_context["is_rfid_valid"] = False

                 state_str = "Vừa tới cổng" if state == "detecting" else "Vừa rời cổng"
                 print(f"💾 Đã lưu vào DB: Cổng {gate} -> {state_str}")
        
        elif event == "license_plate_detected":
             handle_license_plate_message(data, client)

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
