# Implementation Plan: License Plate MQTT Integration

## Overview

Tích hợp hệ thống nhận diện biển số xe AI với backend MQTT-PostgreSQL hiện có. Implementation sẽ thêm MQTT publishing vào `main.py`, thêm duplicate detection cache, và mở rộng `mqtt_to_pg.py` để xử lý license plate events và tạo bảng `license_plate_logs` trong PostgreSQL.

## Tasks

- [x] 1. Add MQTT dependencies and configuration to License Plate Recognition System
  - Add `paho-mqtt==1.6.1` to `license_plate_recognize/lisence-plate/requirements.txt`
  - Add configuration variables at top of `main.py`: `MQTT_BROKER`, `MQTT_PORT`, `MQTT_TOPIC`, `DUPLICATE_WINDOW_SECONDS`, `MQTT_RECONNECT_DELAY`, `MQTT_MAX_RECONNECT_ATTEMPTS`
  - Use `os.getenv()` with default values as specified in design
  - Add logging configuration using Python `logging` module
  - _Requirements: 6.1, 6.3, 6.4, 7.1_

- [x] 2. Implement DuplicateDetectionCache class in main.py
  - [x] 2.1 Create DuplicateDetectionCache class
    - Implement `__init__(self, window_seconds: int = 5)` method
    - Implement `is_duplicate(self, license_plate: str) -> bool` method
    - Implement `add(self, license_plate: str)` method
    - Implement `cleanup(self)` method to remove expired entries
    - Use dictionary to store license plate → timestamp mapping
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 2.2 Write unit tests for DuplicateDetectionCache
    - Test `is_duplicate()` returns False for new plate
    - Test `is_duplicate()` returns True within time window
    - Test `is_duplicate()` returns False after time window expires
    - Test `cleanup()` removes expired entries
    - Test cache behavior with multiple plates
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 3. Implement MQTTPublisher class in main.py
  - [x] 3.1 Create MQTTPublisher class with connection management
    - Implement `__init__(self, broker: str, port: int, topic: str)` method
    - Implement `connect(self) -> bool` method with retry logic
    - Implement `_on_connect(self, client, userdata, flags, rc)` callback
    - Implement `_on_disconnect(self, client, userdata, rc)` callback with auto-reconnection
    - Implement `disconnect(self)` method for graceful shutdown
    - Use `paho.mqtt.client.Client` for MQTT operations
    - Add logging for all connection events
    - _Requirements: 1.5, 8.1, 8.2, 8.3, 8.4, 7.1, 7.2_

  - [x] 3.2 Implement publish_detection method
    - Implement `publish_detection(self, license_plate: str, confidence: float) -> bool` method
    - Create JSON message with format: `{"event": "license_plate_detected", "license_plate": ..., "timestamp": ..., "confidence": ...}`
    - Use ISO 8601 format for timestamp with `datetime.now().isoformat()`
    - Publish to configured MQTT topic with QoS 0
    - Handle publish failures gracefully (log error, return False, do not crash)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.3_

  - [ ]* 3.3 Write unit tests for MQTTPublisher
    - Test message format generation
    - Test connection callback handling
    - Test disconnect callback handling
    - Use mock MQTT client for isolation
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 4. Integrate MQTT publishing into main.py detection loop
  - [x] 4.1 Initialize MQTT publisher and duplicate cache at startup
    - Create `MQTTPublisher` instance with configuration values
    - Call `connect()` method and handle connection failure (enter offline mode)
    - Create `DuplicateDetectionCache` instance
    - Add logging for initialization status
    - _Requirements: 1.5, 6.1, 6.3, 7.1, 7.2_

  - [x] 4.2 Modify process_frame() to add duplicate detection and MQTT publishing
    - After OCR extracts license plate text, check `duplicate_cache.is_duplicate(label)`
    - If duplicate: skip MQTT publish, continue to next detection
    - If not duplicate: call `mqtt_publisher.publish_detection(label, conf)` and `duplicate_cache.add(label)`
    - Maintain existing SQLite save logic (backward compatibility)
    - Add logging for duplicate detections and successful publishes
    - _Requirements: 1.1, 1.2, 1.3, 4.3, 5.1, 5.2, 7.3_

  - [x] 4.3 Add periodic cache cleanup and graceful shutdown
    - Add cache cleanup call every 10 seconds in main loop
    - Add graceful MQTT disconnect in cleanup section (after `cap.release()`)
    - Handle KeyboardInterrupt to ensure MQTT disconnection
    - _Requirements: 5.3, 8.1_

  - [ ]* 4.4 Write integration tests for detection loop
    - Test end-to-end flow: detection → duplicate check → MQTT publish → SQLite save
    - Test duplicate filtering behavior
    - Test offline mode when MQTT unavailable
    - Use local MQTT broker (Mosquitto) for testing
    - _Requirements: 1.1, 4.3, 5.1, 5.2_

- [x] 5. Checkpoint - Ensure License Plate Recognition System works correctly
  - Run `main.py` and verify MQTT connection logs
  - Test license plate detection and verify MQTT messages published
  - Test duplicate detection by showing same plate multiple times
  - Verify SQLite database still receives data (backward compatibility)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create license_plate_logs table in PostgreSQL backend
  - [x] 6.1 Add table creation to init_db() function in mqtt_to_pg.py
    - Add SQL CREATE TABLE statement for `license_plate_logs` with columns: `id` (SERIAL PRIMARY KEY), `license_plate` (VARCHAR(20) NOT NULL), `confidence` (DECIMAL(3,2)), `timestamp` (TIMESTAMP NOT NULL), `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
    - Add CREATE INDEX statements for `license_plate` and `timestamp` columns
    - Execute table creation after existing table creation code
    - Add logging to confirm table and indexes created
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 6.2 Write unit tests for table creation
    - Test table creation SQL is valid
    - Test indexes are created correctly
    - Use mock database cursor
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 7. Implement license plate message handler in mqtt_to_pg.py
  - [x] 7.1 Create handle_license_plate_message() function
    - Implement function signature: `handle_license_plate_message(data: dict) -> bool`
    - Validate required fields: `event`, `license_plate`, `timestamp`, `confidence`
    - Validate `event` equals `"license_plate_detected"`
    - Validate `license_plate` is non-empty string with max length 20
    - Validate `confidence` is float between 0.0 and 1.0
    - Parse `timestamp` from ISO 8601 format using `datetime.fromisoformat()`
    - Return False if validation fails, log warning with raw message
    - _Requirements: 3.2, 3.4, 7.5_

  - [x] 7.2 Add database insert logic to handle_license_plate_message()
    - Execute SQL INSERT: `INSERT INTO license_plate_logs (license_plate, confidence, timestamp) VALUES (%s, %s, %s)`
    - Use parameterized query with values from validated message
    - Wrap in try-except block to catch database errors
    - Log success with license plate and confidence on successful insert
    - Log error with full details (message content, error, stack trace) on failure
    - Return True on success, False on failure
    - Do not crash on database errors
    - _Requirements: 3.3, 3.5, 7.3, 7.4, 7.5_

  - [ ]* 7.3 Write unit tests for handle_license_plate_message()
    - Test valid message processing
    - Test missing required fields
    - Test invalid timestamp format
    - Test invalid confidence value
    - Test database insert success
    - Test database insert failure handling
    - Use mock database cursor
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [x] 8. Integrate license plate handler into MQTT message processing
  - [x] 8.1 Subscribe to license plate topic in on_connect()
    - Add subscription to `"smart_parking/license_plate"` topic after existing subscription
    - Log subscription confirmation
    - _Requirements: 3.1, 4.1_

  - [x] 8.2 Add event handler in on_message() function
    - Add new `elif` branch for `event == "license_plate_detected"`
    - Call `handle_license_plate_message(data)` in this branch
    - Maintain existing event handlers for RFID and IR events (backward compatibility)
    - _Requirements: 3.2, 4.1, 4.2, 4.4_

  - [ ]* 8.3 Write integration tests for MQTT backend
    - Test end-to-end: publish message → backend receives → database insert
    - Test invalid message handling
    - Test backward compatibility with RFID/IR messages
    - Use local MQTT broker and test database
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.4_

- [x] 9. Final checkpoint and verification
  - Start `mqtt_to_pg.py` backend and verify it connects to MQTT broker
  - Start `main.py` recognition system and verify it connects to MQTT broker
  - Test license plate detection end-to-end: camera → detection → MQTT → PostgreSQL
  - Verify data appears in `license_plate_logs` table with correct values
  - Test duplicate detection: show same plate multiple times within 5 seconds
  - Verify backward compatibility: RFID and IR events still work correctly
  - Test error scenarios: disconnect MQTT broker, verify reconnection
  - Review all logs for errors or warnings
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Unit tests validate specific components in isolation
- Integration tests validate end-to-end flows
- All code uses Python as specified in the design document
- MQTT QoS level 0 is used for performance (at-most-once delivery)
- Duplicate detection cache is in-memory and volatile (cleared on restart)
- SQLite storage is maintained for backward compatibility
