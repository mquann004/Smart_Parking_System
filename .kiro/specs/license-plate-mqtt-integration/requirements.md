# Requirements Document

## Introduction

Tính năng **License Plate MQTT Integration** tích hợp hệ thống nhận diện biển số xe AI với backend MQTT-PostgreSQL hiện có. Hiện tại, hệ thống nhận diện biển số xe sử dụng YOLO và PaddleOCR để nhận diện biển số xe và lưu vào SQLite. Tính năng mới này sẽ cho phép dữ liệu biển số xe được publish lên MQTT broker và lưu trữ vào PostgreSQL database, tương tự như cách hệ thống xử lý dữ liệu từ cảm biến RFID và IR.

## Glossary

- **License_Plate_Recognition_System**: Hệ thống AI sử dụng YOLO và PaddleOCR để nhận diện biển số xe từ camera
- **MQTT_Backend**: Backend Python (mqtt_to_pg.py) xử lý tin nhắn MQTT và lưu vào PostgreSQL
- **MQTT_Broker**: HiveMQ broker công cộng (broker.hivemq.com) dùng để truyền tin nhắn
- **PostgreSQL_Database**: Cơ sở dữ liệu smart_parking lưu trữ tất cả dữ liệu hệ thống
- **License_Plate_Number**: Chuỗi ký tự biển số xe đã được làm sạch và định dạng (ví dụ: "56F-79802", "30A-123.45")
- **Detection_Event**: Sự kiện nhận diện thành công một biển số xe
- **MQTT_Topic**: Kênh truyền tin nhắn MQTT (ví dụ: "smart_parking/license_plate")
- **Confidence_Score**: Độ tin cậy của kết quả nhận diện OCR (0.0 đến 1.0)

## Requirements

### Requirement 1: Publish License Plate Data to MQTT

**User Story:** Là một hệ thống nhận diện biển số xe, tôi muốn publish dữ liệu biển số xe lên MQTT broker, để backend có thể nhận và xử lý dữ liệu tập trung.

#### Acceptance Criteria

1. WHEN THE License_Plate_Recognition_System nhận diện thành công một biển số xe, THE License_Plate_Recognition_System SHALL publish một tin nhắn JSON lên MQTT_Broker
2. THE tin nhắn JSON SHALL chứa các trường: event (giá trị "license_plate_detected"), license_plate (License_Plate_Number), timestamp (thời gian nhận diện theo định dạng ISO 8601), và confidence (Confidence_Score)
3. THE License_Plate_Recognition_System SHALL publish tin nhắn lên MQTT_Topic "smart_parking/license_plate"
4. WHEN việc publish thất bại, THE License_Plate_Recognition_System SHALL ghi log lỗi và tiếp tục hoạt động bình thường
5. THE License_Plate_Recognition_System SHALL duy trì kết nối persistent với MQTT_Broker để giảm độ trễ

### Requirement 2: Create License Plate Database Table

**User Story:** Là một database administrator, tôi muốn có bảng lưu trữ dữ liệu biển số xe trong PostgreSQL, để có thể truy vấn và phân tích lịch sử nhận diện.

#### Acceptance Criteria

1. THE MQTT_Backend SHALL tạo bảng "license_plate_logs" trong PostgreSQL_Database nếu bảng chưa tồn tại
2. THE bảng "license_plate_logs" SHALL có các cột: id (SERIAL PRIMARY KEY), license_plate (VARCHAR(20) NOT NULL), confidence (DECIMAL(3,2)), timestamp (TIMESTAMP DEFAULT CURRENT_TIMESTAMP), và created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
3. THE bảng "license_plate_logs" SHALL có index trên cột license_plate để tối ưu hóa truy vấn
4. THE bảng "license_plate_logs" SHALL có index trên cột timestamp để tối ưu hóa truy vấn theo thời gian

### Requirement 3: Subscribe and Process License Plate MQTT Messages

**User Story:** Là một MQTT backend, tôi muốn subscribe và xử lý tin nhắn biển số xe từ MQTT broker, để lưu dữ liệu vào PostgreSQL database.

#### Acceptance Criteria

1. WHEN MQTT_Backend khởi động, THE MQTT_Backend SHALL subscribe vào MQTT_Topic "smart_parking/license_plate"
2. WHEN MQTT_Backend nhận được tin nhắn với event "license_plate_detected", THE MQTT_Backend SHALL parse dữ liệu JSON
3. WHEN dữ liệu JSON hợp lệ, THE MQTT_Backend SHALL insert một bản ghi mới vào bảng "license_plate_logs" với các giá trị license_plate, confidence, và timestamp từ tin nhắn
4. IF dữ liệu JSON không hợp lệ hoặc thiếu trường bắt buộc, THEN THE MQTT_Backend SHALL ghi log lỗi và bỏ qua tin nhắn đó
5. WHEN việc insert vào database thất bại, THE MQTT_Backend SHALL ghi log lỗi chi tiết bao gồm nội dung tin nhắn và lỗi database

### Requirement 4: Maintain Backward Compatibility

**User Story:** Là một system administrator, tôi muốn hệ thống mới tương thích ngược với hệ thống cũ, để không ảnh hưởng đến các chức năng RFID và IR hiện có.

#### Acceptance Criteria

1. THE MQTT_Backend SHALL tiếp tục xử lý các tin nhắn từ topic "smart_parking/rfid" như hiện tại
2. THE MQTT_Backend SHALL tiếp tục duy trì và cập nhật các bảng hiện có (users, rfid_logs, active_parking, parking_slots, gate_logs)
3. THE License_Plate_Recognition_System SHALL tiếp tục lưu dữ liệu vào SQLite database (licensePlatesDatabase.db) song song với việc publish lên MQTT
4. WHEN MQTT_Backend xử lý tin nhắn license plate, THE MQTT_Backend SHALL không ảnh hưởng đến logic xử lý RFID và IR hiện có

### Requirement 5: Handle Duplicate License Plate Detections

**User Story:** Là một system operator, tôi muốn hệ thống xử lý các lần nhận diện trùng lặp một cách thông minh, để tránh spam database với cùng một biển số xe trong thời gian ngắn.

#### Acceptance Criteria

1. WHEN THE License_Plate_Recognition_System nhận diện cùng một License_Plate_Number nhiều lần trong khoảng thời gian 5 giây, THE License_Plate_Recognition_System SHALL chỉ publish tin nhắn MQTT cho lần nhận diện đầu tiên
2. WHEN khoảng thời gian giữa hai lần nhận diện cùng một License_Plate_Number lớn hơn 5 giây, THE License_Plate_Recognition_System SHALL publish tin nhắn MQTT mới
3. THE License_Plate_Recognition_System SHALL duy trì một cache tạm thời lưu trữ các biển số xe đã nhận diện gần đây và thời gian nhận diện
4. WHEN License_Plate_Recognition_System khởi động lại, THE cache SHALL được xóa và bắt đầu lại từ đầu

### Requirement 6: Configuration Management

**User Story:** Là một developer, tôi muốn cấu hình MQTT và database được quản lý tập trung, để dễ dàng thay đổi cấu hình khi cần thiết.

#### Acceptance Criteria

1. THE License_Plate_Recognition_System SHALL đọc cấu hình MQTT (broker address, port, topic) từ các biến cấu hình hoặc file cấu hình
2. THE MQTT_Backend SHALL sử dụng cùng cấu hình MQTT_Broker và port như hiện tại (broker.hivemq.com:1883)
3. WHERE cấu hình MQTT không được cung cấp, THE License_Plate_Recognition_System SHALL sử dụng giá trị mặc định: broker="broker.hivemq.com", port=1883, topic="smart_parking/license_plate"
4. THE License_Plate_Recognition_System SHALL ghi log thông tin cấu hình MQTT khi khởi động để hỗ trợ debugging

### Requirement 7: Error Handling and Logging

**User Story:** Là một system administrator, tôi muốn hệ thống ghi log chi tiết các lỗi và sự kiện quan trọng, để dễ dàng troubleshoot khi có vấn đề.

#### Acceptance Criteria

1. WHEN THE License_Plate_Recognition_System kết nối thành công với MQTT_Broker, THE License_Plate_Recognition_System SHALL ghi log thông báo kết nối thành công
2. IF THE License_Plate_Recognition_System không thể kết nối với MQTT_Broker, THEN THE License_Plate_Recognition_System SHALL ghi log lỗi và tiếp tục hoạt động ở chế độ offline (chỉ lưu SQLite)
3. WHEN THE MQTT_Backend nhận được tin nhắn license plate, THE MQTT_Backend SHALL ghi log bao gồm license_plate, confidence, và timestamp
4. WHEN THE MQTT_Backend lưu thành công vào database, THE MQTT_Backend SHALL ghi log xác nhận với ID bản ghi mới
5. IF bất kỳ lỗi nào xảy ra trong quá trình xử lý, THEN hệ thống SHALL ghi log lỗi với đầy đủ thông tin (stack trace, dữ liệu đầu vào, thời gian)

### Requirement 8: MQTT Connection Resilience

**User Story:** Là một system operator, tôi muốn hệ thống tự động kết nối lại khi mất kết nối MQTT, để đảm bảo hoạt động liên tục.

#### Acceptance Criteria

1. WHEN kết nối MQTT bị ngắt, THE License_Plate_Recognition_System SHALL tự động thử kết nối lại sau mỗi 5 giây
2. THE License_Plate_Recognition_System SHALL thử kết nối lại tối đa 10 lần trước khi chuyển sang chế độ offline
3. WHEN THE License_Plate_Recognition_System ở chế độ offline, THE License_Plate_Recognition_System SHALL tiếp tục thử kết nối lại mỗi 30 giây
4. WHEN kết nối MQTT được khôi phục, THE License_Plate_Recognition_System SHALL ghi log thông báo kết nối lại thành công và tiếp tục publish dữ liệu

