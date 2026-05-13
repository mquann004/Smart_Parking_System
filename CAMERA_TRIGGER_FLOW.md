# Camera Trigger System - Luồng hoạt động chi tiết

## Sơ đồ tổng quan

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ESP32 (Cổng IN)                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                      │
│  │IR Sensor │───▶│  RFID    │───▶│  Servo   │                      │
│  │(Phát hiện│    │ (Quét thẻ)│    │ (Mở cửa) │                      │
│  │   xe)    │    └──────────┘    └──────────┘                      │
│  └──────────┘          │                ▲                            │
└────────────────────────┼────────────────┼────────────────────────────┘
                         │                │
                         │ ①RFID Scan     │ ⑤Servo Command
                         │                │
                    ┌────▼────────────────┴─────┐
                    │    MQTT Broker             │
                    │  (broker.hivemq.com)       │
                    └────┬────────────────┬──────┘
                         │                │
          ②Camera Trigger│                │④License Plate
                         │                │
        ┌────────────────▼──┐    ┌───────▼──────────────┐
        │ Camera Trigger    │    │   Backend            │
        │    Service        │    │  (mqtt_to_pg.py)     │
        │(camera_trigger.py)│    │                      │
        └────────┬──────────┘    │  - Lưu database      │
                 │                │  - Gửi servo command │
                 │③Start Camera   └──────────────────────┘
                 │
        ┌────────▼──────────┐
        │   Camera Main     │
        │    (main.py)      │
        │                   │
        │  - YOLO Detection │
        │  - PaddleOCR      │
        │  - MQTT Publish   │
        └───────────────────┘
```

## Chi tiết từng bước

### Bước 1: IR Sensor phát hiện xe + RFID Scan
**Thiết bị:** ESP32 tại cổng IN

**Hành động:**
1. IR Sensor phát hiện xe đến gần
2. Người dùng quét thẻ RFID
3. ESP32 publish MQTT message:

```json
Topic: smart_parking/rfid
Message: {
  "event": "rfid_scan",
  "gate": "IN",
  "uid": "ABC123"
}
```

**Code ESP32 (tham khảo):**
```c
void publishRFIDScan(String uid) {
  StaticJsonDocument<200> doc;
  doc["event"] = "rfid_scan";
  doc["gate"] = "IN";
  doc["uid"] = uid;
  
  char buffer[200];
  serializeJson(doc, buffer);
  
  client.publish("smart_parking/rfid", buffer);
}
```

---

### Bước 2: Camera Trigger Service nhận event
**Service:** `camera_trigger.py`

**Hành động:**
1. Subscribe topic `smart_parking/rfid`
2. Nhận message RFID scan
3. Kiểm tra `gate == "IN"`
4. Trigger camera bằng cách start subprocess `main.py`

**Log output:**
```
📩 Received message from smart_parking/rfid: {"event":"rfid_scan","gate":"IN","uid":"ABC123"}
🚗 RFID scan detected at IN gate (UID: ABC123)
📷 Triggering camera for license plate recognition...
📷 Starting license plate recognition camera...
✅ Camera started successfully
```

**Code Python:**
```python
def on_message(client, userdata, msg):
    data = json.loads(msg.payload.decode('utf-8'))
    if data.get("event") == "rfid_scan" and data.get("gate") == "IN":
        start_camera()  # Start main.py as subprocess
```

---

### Bước 3: Camera nhận diện biển số xe
**Script:** `main.py`

**Hành động:**
1. Camera tự động mở
2. YOLO detect license plate bounding box
3. PaddleOCR extract text từ bounding box
4. Clean và format biển số xe (VD: "30A-123.45")
5. Publish MQTT message với biển số xe
6. **Tự động thoát** sau khi nhận diện thành công

**Log output:**
```
🚀 Initializing MQTT Publisher and Duplicate Detection Cache...
✅ Connected to MQTT broker: broker.hivemq.com:1883
✅ MQTT Publisher ready
=======================================
HƯỚNG DẪN SỬ DỤNG WEBCAM (TỰ ĐỘNG):
- Đưa biển số xe vào khung hình camera.
- Hệ thống sẽ tự động nhận diện và THOÁT khi phát hiện biển số.
- Nhấn phím 'q' để THOÁT thủ công.
=======================================
[DEBUG] Raw OCR Text: '30A12345'
[DEBUG] OCR Text sau khi xóa dấu: '30A12345'
[DEBUG] Text sau khi qua hàm clean_plate_text: '30A-123.45'
📤 Published to MQTT: 30A-123.45 (confidence: 0.95)
✅ Đã phát hiện biển số xe! Tự động thoát...
🛑 Cleaning up resources...
✅ Shutdown complete
```

**MQTT Message:**
```json
Topic: smart_parking/license_plate
Message: {
  "event": "license_plate_detected",
  "license_plate": "30A-123.45",
  "timestamp": "2025-05-07T14:30:45.123456",
  "confidence": 0.95
}
```

---

### Bước 4: Backend xử lý license plate
**Service:** `mqtt_to_pg.py`

**Hành động:**
1. Subscribe topic `smart_parking/license_plate`
2. Nhận message license plate detection
3. Validate message (event, license_plate, timestamp, confidence)
4. **Lưu vào PostgreSQL** table `license_plate_logs`
5. **Gửi lệnh mở servo** qua MQTT

**Log output:**
```
📩 Nhận được tin nhắn từ smart_parking/license_plate: {"event":"license_plate_detected",...}
💾 Đã lưu biển số xe: 30A-123.45 (confidence: 0.95)
🚪 Đã gửi lệnh mở cổng IN cho xe 30A-123.45
```

**Database:**
```sql
INSERT INTO license_plate_logs (license_plate, confidence, timestamp)
VALUES ('30A-123.45', 0.95, '2025-05-07 14:30:45');
```

**MQTT Message (gửi đến ESP32):**
```json
Topic: smart_parking/servo/command
Message: {
  "action": "open_gate",
  "gate": "IN",
  "reason": "license_plate_verified",
  "license_plate": "30A-123.45"
}
```

---

### Bước 5: ESP32 mở servo
**Thiết bị:** ESP32 tại cổng IN

**Hành động:**
1. Subscribe topic `smart_parking/servo/command`
2. Nhận message servo command
3. Parse JSON và kiểm tra `action == "open_gate"` và `gate == "IN"`
4. **Mở servo motor** để mở cổng
5. Delay một khoảng thời gian (VD: 5 giây)
6. Đóng servo motor

**Code ESP32 (tham khảo):**
```c
void callback(char* topic, byte* payload, unsigned int length) {
  if (strcmp(topic, "smart_parking/servo/command") == 0) {
    StaticJsonDocument<256> doc;
    deserializeJson(doc, payload, length);
    
    String action = doc["action"];
    String gate = doc["gate"];
    String license_plate = doc["license_plate"];
    
    if (action == "open_gate" && gate == "IN") {
      Serial.print("Opening gate for: ");
      Serial.println(license_plate);
      
      // Mở servo
      servoIN.write(90);  // Góc mở
      delay(5000);        // Giữ mở 5 giây
      servoIN.write(0);   // Đóng lại
      
      Serial.println("Gate closed");
    }
  }
}
```

---

## Timeline tổng hợp

```
T+0s    : IR Sensor phát hiện xe
T+1s    : User quét thẻ RFID
T+1.1s  : ESP32 publish RFID message lên MQTT
T+1.2s  : Camera Trigger Service nhận message
T+1.3s  : Camera Trigger Service start main.py
T+2s    : Camera mở và bắt đầu nhận diện
T+3s    : Camera detect license plate
T+3.5s  : Camera publish license plate lên MQTT
T+3.6s  : Backend nhận license plate message
T+3.7s  : Backend lưu vào database
T+3.8s  : Backend publish servo command
T+3.9s  : ESP32 nhận servo command
T+4s    : Servo mở cổng
T+9s    : Servo đóng cổng
```

**Tổng thời gian:** ~9 giây từ khi quét RFID đến khi cổng đóng lại

---

## Xử lý lỗi

### Lỗi 1: Camera không mở
**Nguyên nhân:**
- Camera Trigger Service không chạy
- MQTT connection failed
- main.py không tìm thấy

**Giải pháp:**
- Kiểm tra Camera Trigger Service đang chạy
- Verify MQTT broker accessible
- Check file path của main.py

### Lỗi 2: Camera không nhận diện được
**Nguyên nhân:**
- Ánh sáng kém
- Góc camera không phù hợp
- Model weights không tốt

**Giải pháp:**
- Cải thiện ánh sáng
- Điều chỉnh góc camera
- Retrain model với data tốt hơn

### Lỗi 3: Servo không mở
**Nguyên nhân:**
- ESP32 không subscribe topic servo/command
- MQTT message không đến ESP32
- Servo hardware lỗi

**Giải pháp:**
- Verify ESP32 subscribe đúng topic
- Check MQTT connection của ESP32
- Test servo hardware độc lập

---

## Monitoring & Debugging

### Logs cần theo dõi:
1. **camera_trigger.log** - Camera trigger events
2. **license_plate_recognition.log** - Camera detection logs
3. **Backend console** - Database và MQTT events
4. **ESP32 Serial Monitor** - Servo commands

### MQTT Topics cần monitor:
```bash
# Subscribe tất cả topics để debug
mosquitto_sub -h broker.hivemq.com -t "smart_parking/#" -v
```

### Database queries:
```sql
-- Xem license plates gần đây
SELECT * FROM license_plate_logs 
ORDER BY created_at DESC 
LIMIT 10;

-- Xem RFID logs
SELECT * FROM rfid_logs 
WHERE event_type LIKE 'scan_IN' 
ORDER BY timestamp DESC 
LIMIT 10;
```

---

## Tối ưu hóa

### Giảm thời gian phản hồi:
1. Sử dụng MQTT QoS 1 thay vì QoS 0 (đảm bảo message delivery)
2. Tăng FPS của camera
3. Optimize YOLO model (sử dụng model nhỏ hơn)
4. Giảm delay trong ESP32 servo control

### Tăng độ chính xác:
1. Retrain YOLO model với nhiều data hơn
2. Cải thiện lighting tại camera
3. Sử dụng camera chất lượng cao hơn
4. Thêm validation logic cho license plate format

### Tăng reliability:
1. Thêm retry logic cho MQTT publish
2. Implement dead letter queue cho failed messages
3. Add health check cho các services
4. Implement watchdog để restart services khi crash
