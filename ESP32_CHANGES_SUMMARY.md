# ESP32 Code Changes Summary

## Vấn đề đã sửa
❌ **Trước:** Servo mở NGAY SAU khi RFID scan (không đợi camera)
✅ **Sau:** Servo CHỈ mở SAU KHI camera nhận diện biển số thành công

## Files đã sửa

### 1. main/main.c

#### Thay đổi trong `mqtt_data_handler()`:

**TRƯỚC:**
```c
if (strcmp(action->valuestring, "allow_in") == 0) {
    ESP_LOGI(TAG, "==> DANG KI VAO BAI THANH CONG. MO BARIE IN.");
    servo_set_angle(LEDC_CHANNEL_0, 90);  // ❌ Mở servo ngay
    servo_in_open = true;
}
```

**SAU:**
```c
// Topic: smart_parking/command (RFID validation)
if (strcmp(action->valuestring, "allow_in") == 0) {
    ESP_LOGI(TAG, "==> RFID DANG KI VAO BAI THANH CONG. CHO CAMERA NHAN DIEN...");
    // ✅ KHÔNG mở servo ở đây, chờ camera nhận diện
}

// Topic: smart_parking/servo/command (Camera detection complete)
else if (strcmp(topic, "smart_parking/servo/command") == 0) {
    // Parse JSON và kiểm tra action == "open_gate"
    if (strcmp(action->valuestring, "open_gate") == 0) {
        if (strcmp(gate->valuestring, "IN") == 0) {
            ESP_LOGI(TAG, "✅ CAMERA NHAN DIEN THANH CONG!");
            ESP_LOGI(TAG, "   Bien so xe: %s", license_plate->valuestring);
            ESP_LOGI(TAG, "   => MO BARIE IN");
            
            servo_set_angle(LEDC_CHANNEL_0, 90);  // ✅ Mở servo ở đây
            servo_in_open = true;
        }
    }
}
```

### 2. components/mqtt_manager/mqtt_manager.c

#### Thêm subscribe topic mới:

**TRƯỚC:**
```c
case MQTT_EVENT_CONNECTED:
    ESP_LOGI(TAG, "MQTT_EVENT_CONNECTED");
    esp_mqtt_client_subscribe(client, "smart_parking/command", 0);
    break;
```

**SAU:**
```c
case MQTT_EVENT_CONNECTED:
    ESP_LOGI(TAG, "MQTT_EVENT_CONNECTED");
    esp_mqtt_client_subscribe(client, "smart_parking/command", 0);
    esp_mqtt_client_subscribe(client, "smart_parking/servo/command", 0);  // ✅ Thêm topic mới
    ESP_LOGI(TAG, "Subscribed to: smart_parking/command");
    ESP_LOGI(TAG, "Subscribed to: smart_parking/servo/command");
    break;
```

## Luồng hoạt động mới

```
1. IR Sensor phát hiện xe tại cổng IN
   ↓
2. User quét thẻ RFID
   ↓
3. ESP32 publish: smart_parking/rfid
   {"event":"rfid_scan","gate":"IN","uid":"..."}
   ↓
4. Backend validate RFID → Gửi: smart_parking/command
   {"action":"allow_in"}
   ↓
5. ESP32 nhận "allow_in" → Log: "CHO CAMERA NHAN DIEN..."
   ⚠️ SERVO CHƯA MỞ
   ↓
6. Camera Trigger Service → Tự động mở camera
   ↓
7. Camera nhận diện biển số → Publish: smart_parking/license_plate
   {"event":"license_plate_detected","license_plate":"30A-123.45",...}
   ↓
8. Backend nhận license plate → Lưu DB → Gửi: smart_parking/servo/command
   {"action":"open_gate","gate":"IN","license_plate":"30A-123.45"}
   ↓
9. ESP32 nhận servo command → Log: "✅ CAMERA NHAN DIEN THANH CONG!"
   ✅ BÂY GIỜ MỚI MỞ SERVO
   ↓
10. Xe đi qua → IR cleared → Servo đóng
```

## MQTT Topics

| Topic | Direction | Purpose | Trigger Servo? |
|-------|-----------|---------|----------------|
| `smart_parking/rfid` | ESP32 → Backend | RFID scan event | ❌ No |
| `smart_parking/command` | Backend → ESP32 | RFID validation result | ❌ No (chỉ log) |
| `smart_parking/license_plate` | Camera → Backend | License plate detection | ❌ No |
| `smart_parking/servo/command` | Backend → ESP32 | Servo control (after camera) | ✅ **YES** |

## Serial Monitor Output

### Khi RFID scan:
```
I (12345) MAIN: Card detected! UID: AB CD EF 12
I (12346) MQTT_MANAGER: sent publish successful, msg_id=1
I (12500) MAIN: ==> RFID DANG KI VAO BAI THANH CONG. CHO CAMERA NHAN DIEN...
```
⚠️ **Servo chưa mở**

### Khi camera nhận diện xong:
```
I (15000) MQTT_MANAGER: MQTT_EVENT_DATA
TOPIC=smart_parking/servo/command
DATA={"action":"open_gate","gate":"IN","license_plate":"30A-123.45"}
I (15001) MAIN: ========================================
I (15002) MAIN: ✅ CAMERA NHAN DIEN THANH CONG!
I (15003) MAIN:    Bien so xe: 30A-123.45
I (15004) MAIN:    => MO BARIE IN
I (15005) MAIN: ========================================
```
✅ **Servo mở bây giờ**

### Khi xe đi qua:
```
I (20000) MAIN: Gate IN: Xe da qua cong -> DONG BARIE
```
✅ **Servo đóng**

## Build và Flash

```bash
# Build project
idf.py build

# Flash to ESP32
idf.py -p COM3 flash monitor
```

## Testing

### Test 1: RFID scan không mở servo
1. Đưa tay vào IR sensor
2. Quét thẻ RFID
3. **Kết quả mong đợi:** Log "CHO CAMERA NHAN DIEN...", servo KHÔNG mở

### Test 2: Camera nhận diện mới mở servo
1. Sau RFID scan
2. Camera tự động mở và nhận diện
3. **Kết quả mong đợi:** Log "✅ CAMERA NHAN DIEN THANH CONG!", servo MỞ

### Test 3: Xe đi qua thì đóng servo
1. Sau khi servo mở
2. Xe đi qua (IR cleared)
3. **Kết quả mong đợi:** Log "DONG BARIE", servo ĐÓNG

## Troubleshooting

### Servo vẫn mở ngay sau RFID
- ❌ Code cũ chưa được flash
- ✅ Build lại và flash: `idf.py flash`

### Servo không mở sau camera nhận diện
- ❌ ESP32 không subscribe topic `smart_parking/servo/command`
- ✅ Check Serial Monitor: "Subscribed to: smart_parking/servo/command"
- ❌ Backend không gửi servo command
- ✅ Check backend log: "🚪 Đã gửi lệnh mở cổng IN"

### Camera không tự động mở
- ❌ Camera Trigger Service không chạy
- ✅ Chạy: `python camera_trigger.py`

## Rollback (nếu cần)

Nếu muốn quay lại logic cũ (mở servo ngay sau RFID):

```c
if (strcmp(action->valuestring, "allow_in") == 0) {
    ESP_LOGI(TAG, "==> DANG KI VAO BAI THANH CONG. MO BARIE IN.");
    servo_set_angle(LEDC_CHANNEL_0, 90);
    servo_in_open = true;
}
```

---

**Status:** ✅ Complete
**Date:** 2025-05-07
**Tested:** Pending user verification
