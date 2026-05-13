# Design Document: License Plate MQTT Integration

## Overview

Tính năng **License Plate MQTT Integration** tích hợp hệ thống nhận diện biển số xe AI (sử dụng YOLO và PaddleOCR) với backend MQTT-PostgreSQL hiện có. Thiết kế này mở rộng kiến trúc hiện tại của hệ thống smart parking để hỗ trợ luồng dữ liệu mới: **Camera → AI Recognition → MQTT → PostgreSQL**, song song với luồng hiện tại **ESP32 RFID/IR → MQTT → PostgreSQL**.

### Design Goals

1. **Minimal Disruption**: Tích hợp mà không ảnh hưởng đến logic RFID/IR hiện có
2. **Reliability**: Xử lý lỗi mạng và đảm bảo dữ liệu không bị mất
3. **Performance**: Giảm thiểu duplicate detections và tối ưu hóa database queries
4. **Maintainability**: Code rõ ràng, có logging đầy đủ, dễ debug

### Key Design Decisions

- **MQTT as Integration Layer**: Sử dụng MQTT làm message bus để decouple AI recognition system và database backend
- **Duplicate Detection at Source**: Xử lý duplicate detections tại AI system (main.py) thay vì database để giảm tải network và database
- **Backward Compatibility**: Duy trì SQLite storage song song với MQTT publishing để không phá vỡ workflow hiện tại
- **Persistent Connection**: Sử dụng MQTT persistent connection với automatic reconnection để đảm bảo reliability

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    License Plate Recognition System              │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐              │
│  │  Camera  │───▶│   YOLO   │───▶│  PaddleOCR   │              │
│  └──────────┘    └──────────┘    └──────────────┘              │
│                                           │                       │
│                                           ▼                       │
│                                  ┌─────────────────┐             │
│                                  │ Duplicate Cache │             │
│                                  │  (5-sec window) │             │
│                                  └─────────────────┘             │
│                                           │                       │
│                        ┌──────────────────┴──────────────────┐  │
│                        ▼                                      ▼  │
│                 ┌─────────────┐                      ┌──────────┐│
│                 │ MQTT Client │                      │  SQLite  ││
│                 │  Publisher  │                      │ Database ││
│                 └─────────────┘                      └──────────┘│
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ MQTT Message
                         │ Topic: smart_parking/license_plate
                         │
                         ▼
              ┌──────────────────────┐
              │   MQTT Broker        │
              │  (broker.hivemq.com) │
              └──────────────────────┘
                         │
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MQTT Backend (mqtt_to_pg.py)                  │
│  ┌─────────────┐                                                 │
│  │MQTT Client  │                                                 │
│  │ Subscriber  │                                                 │
│  └──────┬──────┘                                                 │
│         │                                                         │
│         ▼                                                         │
│  ┌─────────────────┐                                             │
│  │ Message Handler │                                             │
│  │  - Parse JSON   │                                             │
│  │  - Validate     │                                             │
│  │  - Log          │                                             │
│  └────────┬────────┘                                             │
│           │                                                       │
│           ▼                                                       │
│  ┌──────────────────┐                                            │
│  │   PostgreSQL     │                                            │
│  │   Database       │                                            │
│  │ - license_plate_ │                                            │
│  │   logs table     │                                            │
│  └──────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Detection Phase**:
   - Camera captures frame
   - YOLO detects license plate bounding box
   - PaddleOCR extracts text from bounding box
   - `clean_plate_text()` normalizes the text

2. **Deduplication Phase**:
   - Check if license plate exists in duplicate cache
   - If found and within 5-second window: skip
   - If not found or expired: proceed to publish

3. **Publishing Phase**:
   - Create JSON message with license plate data
   - Publish to MQTT topic `smart_parking/license_plate`
   - Update duplicate cache with current timestamp
   - Continue to save to SQLite (backward compatibility)

4. **Backend Processing Phase**:
   - MQTT backend receives message
   - Parse and validate JSON
   - Insert into PostgreSQL `license_plate_logs` table
   - Log success/failure

### Message Format

**MQTT Topic**: `smart_parking/license_plate`

**Message Payload** (JSON):
```json
{
  "event": "license_plate_detected",
  "license_plate": "30A-123.45",
  "timestamp": "2025-01-15T14:30:45.123456",
  "confidence": 0.95
}
```

**Field Specifications**:
- `event`: Always `"license_plate_detected"` (string, required)
- `license_plate`: Cleaned and formatted license plate number (string, required, max 20 chars)
- `timestamp`: ISO 8601 format with microseconds (string, required)
- `confidence`: OCR confidence score (float, required, range 0.0-1.0)

## Components and Interfaces

### 1. License Plate Recognition System (main.py)

#### New Components

**MQTTPublisher Class**:
```python
class MQTTPublisher:
    """Manages MQTT connection and publishing for license plate data"""
    
    def __init__(self, broker: str, port: int, topic: str):
        """Initialize MQTT client with connection parameters"""
        
    def connect(self) -> bool:
        """Establish connection to MQTT broker with retry logic"""
        
    def publish_detection(self, license_plate: str, confidence: float) -> bool:
        """Publish license plate detection event to MQTT"""
        
    def disconnect(self):
        """Gracefully disconnect from MQTT broker"""
        
    def _on_connect(self, client, userdata, flags, rc):
        """Callback for successful connection"""
        
    def _on_disconnect(self, client, userdata, rc):
        """Callback for disconnection, triggers reconnection"""
```

**DuplicateDetectionCache Class**:
```python
class DuplicateDetectionCache:
    """Time-based cache for detecting duplicate license plate detections"""
    
    def __init__(self, window_seconds: int = 5):
        """Initialize cache with time window"""
        
    def is_duplicate(self, license_plate: str) -> bool:
        """Check if license plate was detected within time window"""
        
    def add(self, license_plate: str):
        """Add license plate to cache with current timestamp"""
        
    def cleanup(self):
        """Remove expired entries from cache"""
```

#### Modified Functions

**process_frame()**: 
- Add duplicate detection check before saving
- Add MQTT publishing after duplicate check
- Maintain existing SQLite save logic

**Main Loop**:
- Initialize MQTT publisher at startup
- Initialize duplicate detection cache
- Add periodic cache cleanup
- Add graceful shutdown for MQTT connection

#### Configuration

New configuration variables (with defaults):
```python
MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.hivemq.com")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "smart_parking/license_plate")
DUPLICATE_WINDOW_SECONDS = int(os.getenv("DUPLICATE_WINDOW_SECONDS", "5"))
MQTT_RECONNECT_DELAY = int(os.getenv("MQTT_RECONNECT_DELAY", "5"))
MQTT_MAX_RECONNECT_ATTEMPTS = int(os.getenv("MQTT_MAX_RECONNECT_ATTEMPTS", "10"))
```

### 2. MQTT Backend (mqtt_to_pg.py)

#### New Components

**Database Schema**:
```sql
CREATE TABLE IF NOT EXISTS license_plate_logs (
    id SERIAL PRIMARY KEY,
    license_plate VARCHAR(20) NOT NULL,
    confidence DECIMAL(3,2),
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_license_plate_logs_plate ON license_plate_logs(license_plate);
CREATE INDEX idx_license_plate_logs_timestamp ON license_plate_logs(timestamp);
```

**Message Handler**:
```python
def handle_license_plate_message(data: dict):
    """
    Process license plate detection message
    
    Args:
        data: Parsed JSON message
        
    Returns:
        bool: True if successfully processed, False otherwise
    """
    # Validate required fields
    # Parse timestamp
    # Insert into database
    # Log result
```

#### Modified Functions

**init_db()**:
- Add creation of `license_plate_logs` table
- Add index creation

**on_message()**:
- Add new event type handler for `"license_plate_detected"`
- Route to `handle_license_plate_message()`

**MQTT_TOPIC Subscription**:
- Add subscription to `"smart_parking/license_plate"` topic

## Data Models

### License Plate Detection Event

**Python Data Class**:
```python
@dataclass
class LicensePlateDetection:
    license_plate: str
    confidence: float
    timestamp: datetime
    
    def to_mqtt_message(self) -> str:
        """Convert to JSON string for MQTT publishing"""
        return json.dumps({
            "event": "license_plate_detected",
            "license_plate": self.license_plate,
            "timestamp": self.timestamp.isoformat(),
            "confidence": round(self.confidence, 2)
        })
    
    @classmethod
    def from_mqtt_message(cls, message: str) -> 'LicensePlateDetection':
        """Parse from MQTT JSON message"""
        data = json.loads(message)
        return cls(
            license_plate=data["license_plate"],
            confidence=float(data["confidence"]),
            timestamp=datetime.fromisoformat(data["timestamp"])
        )
```

### PostgreSQL Schema

**license_plate_logs Table**:
- `id`: SERIAL PRIMARY KEY - Auto-incrementing unique identifier
- `license_plate`: VARCHAR(20) NOT NULL - Cleaned license plate number
- `confidence`: DECIMAL(3,2) - OCR confidence score (0.00 to 1.00)
- `timestamp`: TIMESTAMP NOT NULL - Detection time from AI system
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP - Database insertion time

**Indexes**:
- `idx_license_plate_logs_plate`: B-tree index on `license_plate` for fast lookups by plate number
- `idx_license_plate_logs_timestamp`: B-tree index on `timestamp` for time-range queries

**Rationale for Indexes**:
- License plate index: Supports queries like "find all detections of plate X"
- Timestamp index: Supports queries like "find all detections in time range Y"
- Both columns have high cardinality and are frequently used in WHERE clauses
- B-tree indexes are optimal for equality and range queries ([source](https://www.mydbops.com/blog/postgresql-indexing-best-practices-guide))

### Duplicate Detection Cache

**In-Memory Structure**:
```python
{
    "30A-123.45": datetime(2025, 1, 15, 14, 30, 45),
    "51F-79802": datetime(2025, 1, 15, 14, 30, 50),
    ...
}
```

**Cleanup Strategy**:
- Periodic cleanup every 10 seconds
- Remove entries older than `DUPLICATE_WINDOW_SECONDS`
- Prevents unbounded memory growth

## Error Handling

### MQTT Connection Errors

**Scenario**: Cannot connect to MQTT broker at startup

**Handling**:
1. Log error with broker address and port
2. Retry connection every `MQTT_RECONNECT_DELAY` seconds
3. After `MQTT_MAX_RECONNECT_ATTEMPTS` failures, enter offline mode
4. In offline mode: continue saving to SQLite, retry connection every 30 seconds
5. Log all connection attempts and state changes

**Code Pattern**:
```python
def connect_with_retry(self):
    for attempt in range(self.max_attempts):
        try:
            self.client.connect(self.broker, self.port, 60)
            self.client.loop_start()
            logger.info(f"Connected to MQTT broker: {self.broker}:{self.port}")
            return True
        except Exception as e:
            logger.error(f"Connection attempt {attempt+1} failed: {e}")
            if attempt < self.max_attempts - 1:
                time.sleep(self.reconnect_delay)
    
    logger.warning("Entering offline mode - will retry every 30 seconds")
    return False
```

### MQTT Publish Errors

**Scenario**: Publish fails due to network issue or broker unavailable

**Handling**:
1. Log error with license plate data and error message
2. Do NOT retry publish (to avoid blocking detection loop)
3. Continue with SQLite save (data not lost)
4. MQTT client will attempt reconnection automatically

**Rationale**: Real-time detection system should not block on network errors. SQLite provides backup storage.

### Database Errors (Backend)

**Scenario**: PostgreSQL insert fails

**Handling**:
1. Log full error details including:
   - SQL error message
   - License plate data
   - Timestamp
   - Stack trace
2. Do NOT crash the backend
3. Continue processing next messages
4. Consider adding dead-letter queue for failed messages (future enhancement)

**Code Pattern**:
```python
try:
    db_cursor.execute(
        "INSERT INTO license_plate_logs (license_plate, confidence, timestamp) VALUES (%s, %s, %s)",
        (license_plate, confidence, timestamp)
    )
    logger.info(f"Saved license plate: {license_plate} (confidence: {confidence})")
except Exception as e:
    logger.error(f"Database insert failed for {license_plate}: {e}", exc_info=True)
    # Continue processing - do not crash
```

### Invalid Message Format

**Scenario**: MQTT message is malformed or missing required fields

**Handling**:
1. Log warning with raw message content
2. Skip message processing
3. Continue listening for next message

**Validation Checks**:
- JSON is valid
- `event` field equals `"license_plate_detected"`
- `license_plate` field exists and is non-empty string
- `timestamp` field exists and is valid ISO 8601 format
- `confidence` field exists and is float between 0.0 and 1.0

### Duplicate Detection Edge Cases

**Scenario**: System restart clears cache, causing immediate duplicates

**Handling**: Acceptable - cache is intentionally volatile. After restart, first detection of each plate will be published even if it was recently detected before restart.

**Rationale**: Simplicity over perfect deduplication. 5-second window is short enough that restart-induced duplicates are rare and acceptable.

## Testing Strategy

### Unit Tests

**License Plate Recognition System (main.py)**:

1. **clean_plate_text() Function**:
   - Test valid Vietnamese license plates (7-8 characters)
   - Test invalid lengths (too short, too long)
   - Test character substitution rules (O→0, I→1, etc.)
   - Test formatting (dash and dot insertion)
   - Example: `"30A12345"` → `"30A-123.45"`

2. **DuplicateDetectionCache Class**:
   - Test `is_duplicate()` returns False for new plate
   - Test `is_duplicate()` returns True within time window
   - Test `is_duplicate()` returns False after time window expires
   - Test `cleanup()` removes expired entries
   - Test cache behavior with multiple plates

3. **MQTTPublisher Class**:
   - Test message format generation
   - Test connection callback handling
   - Test disconnect callback handling
   - Use mock MQTT client for isolation

**MQTT Backend (mqtt_to_pg.py)**:

1. **handle_license_plate_message() Function**:
   - Test valid message processing
   - Test missing required fields
   - Test invalid timestamp format
   - Test invalid confidence value
   - Test database insert success
   - Test database insert failure handling
   - Use mock database cursor

2. **Message Validation**:
   - Test JSON parsing errors
   - Test event type validation
   - Test field type validation

### Integration Tests

1. **End-to-End MQTT Flow**:
   - Start local MQTT broker (e.g., Mosquitto)
   - Start backend subscriber
   - Publish test message from recognition system
   - Verify message received by backend
   - Verify database insert
   - Verify logging output

2. **MQTT Reconnection**:
   - Start recognition system with MQTT connected
   - Stop MQTT broker
   - Verify offline mode activation
   - Restart MQTT broker
   - Verify automatic reconnection
   - Verify publishing resumes

3. **Duplicate Detection**:
   - Detect same license plate multiple times rapidly
   - Verify only first detection is published
   - Wait for time window to expire
   - Verify next detection is published

4. **Backward Compatibility**:
   - Run recognition system with MQTT integration
   - Verify SQLite database still receives data
   - Verify existing RFID/IR messages still processed by backend
   - Verify no interference between license plate and RFID topics

### Mock-Based Tests

1. **MQTT Client Mocking**:
   - Mock `paho.mqtt.client.Client` for unit tests
   - Verify `connect()`, `publish()`, `disconnect()` called correctly
   - Verify callbacks registered

2. **Database Mocking**:
   - Mock `psycopg2` connection and cursor
   - Verify SQL statements are correct
   - Verify parameter binding
   - Test error handling without real database

### Test Configuration

**Test Environment Variables**:
```python
# Use test broker for integration tests
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC = "test/license_plate"

# Use test database
DB_NAME = "smart_parking_test"

# Shorter timeouts for faster tests
DUPLICATE_WINDOW_SECONDS = 2
MQTT_RECONNECT_DELAY = 1
```

**Test Data**:
```python
VALID_LICENSE_PLATES = [
    "30A-123.45",
    "51F-79802",
    "61C-12345",
]

INVALID_LICENSE_PLATES = [
    "",
    "ABC",
    "123456789012345",
    "!!!@@@",
]

VALID_MQTT_MESSAGES = [
    {
        "event": "license_plate_detected",
        "license_plate": "30A-123.45",
        "timestamp": "2025-01-15T14:30:45.123456",
        "confidence": 0.95
    }
]

INVALID_MQTT_MESSAGES = [
    {},  # Empty
    {"event": "wrong_event"},  # Wrong event type
    {"event": "license_plate_detected"},  # Missing fields
    {"event": "license_plate_detected", "license_plate": "30A-123.45", "timestamp": "invalid", "confidence": 0.95},  # Invalid timestamp
]
```

### Testing Tools

- **pytest**: Test framework
- **pytest-mock**: Mocking library
- **unittest.mock**: Python standard library mocking
- **mosquitto**: Local MQTT broker for integration tests
- **psycopg2**: PostgreSQL adapter (with test database)

### Test Coverage Goals

- Unit test coverage: >80% for new code
- Integration test coverage: All critical paths (publish, subscribe, database insert)
- Error handling: All error scenarios tested

## Implementation Notes

### Dependencies

**License Plate Recognition System (main.py)**:
- Add to `requirements.txt`:
  ```
  paho-mqtt==1.6.1
  ```

**MQTT Backend (mqtt_to_pg.py)**:
- No new dependencies (already has `paho-mqtt` and `psycopg2`)

### Configuration Management

**Environment Variables** (recommended for production):
```bash
export MQTT_BROKER="broker.hivemq.com"
export MQTT_PORT="1883"
export MQTT_TOPIC="smart_parking/license_plate"
export DUPLICATE_WINDOW_SECONDS="5"
export MQTT_RECONNECT_DELAY="5"
export MQTT_MAX_RECONNECT_ATTEMPTS="10"
```

**Config File** (alternative, for development):
```python
# config.py
MQTT_CONFIG = {
    "broker": "broker.hivemq.com",
    "port": 1883,
    "topic": "smart_parking/license_plate",
    "reconnect_delay": 5,
    "max_reconnect_attempts": 10,
}

DUPLICATE_CONFIG = {
    "window_seconds": 5,
}
```

### Logging Configuration

**License Plate Recognition System**:
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('license_plate_recognition.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)
```

**MQTT Backend**:
```python
# Already has print statements, consider migrating to logging module
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('mqtt_backend.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)
```

### Performance Considerations

1. **MQTT QoS Level**: Use QoS 0 (at most once) for license plate messages
   - Rationale: Real-time detection system, occasional message loss acceptable
   - SQLite provides backup storage
   - Reduces network overhead

2. **Database Connection Pooling**: Not needed initially
   - Single backend process with single connection
   - Consider connection pooling if scaling to multiple backend instances

3. **Duplicate Cache Cleanup**: Run every 10 seconds
   - Balances memory usage vs. cleanup overhead
   - Cache size bounded by detection rate × window size

4. **Index Maintenance**: PostgreSQL auto-vacuums indexes
   - Monitor index bloat if table grows very large (>1M rows)
   - Consider partitioning by timestamp for long-term storage

### Security Considerations

1. **MQTT Authentication**: Currently using public broker without auth
   - **Recommendation**: Migrate to private broker with username/password
   - Add TLS/SSL for encrypted communication
   - Future enhancement: implement in Phase 2

2. **SQL Injection**: Using parameterized queries (safe)
   - All database inserts use `%s` placeholders
   - psycopg2 handles escaping automatically

3. **Input Validation**: License plate format validated by `clean_plate_text()`
   - Additional validation in backend before database insert
   - Confidence score range checked (0.0-1.0)

### Deployment Steps

1. **Update License Plate Recognition System**:
   - Install `paho-mqtt` dependency
   - Add MQTT publisher code
   - Add duplicate detection cache
   - Update `process_frame()` function
   - Test locally with mock broker

2. **Update MQTT Backend**:
   - Add `license_plate_logs` table creation
   - Add message handler for license plate events
   - Subscribe to new topic
   - Test with sample messages

3. **Integration Testing**:
   - Run both systems together
   - Verify end-to-end flow
   - Test error scenarios
   - Monitor logs

4. **Production Deployment**:
   - Deploy backend first (backward compatible)
   - Deploy recognition system
   - Monitor for errors
   - Verify data in PostgreSQL

### Monitoring and Observability

**Key Metrics to Monitor**:
1. MQTT connection status (connected/disconnected)
2. Message publish rate (messages/second)
3. Message publish failures
4. Duplicate detection rate (% of detections filtered)
5. Database insert rate
6. Database insert failures
7. Backend processing latency

**Logging Events**:
1. MQTT connection established
2. MQTT connection lost
3. MQTT reconnection attempts
4. License plate detected and published
5. Duplicate detection filtered
6. Database insert success
7. Database insert failure
8. Invalid message received

**Alerting** (future enhancement):
- Alert if MQTT disconnected for >5 minutes
- Alert if database insert failure rate >5%
- Alert if no detections for >1 hour (system may be down)

## References

- [Paho MQTT Python Client Documentation](https://eclipse.dev/paho/files/paho.mqtt.python/html/)
- [PostgreSQL Indexing Best Practices](https://www.mydbops.com/blog/postgresql-indexing-best-practices-guide)
- [MQTT QoS Levels Explained](https://www.hivemq.com/blog/mqtt-essentials-part-6-mqtt-quality-of-service-levels/)
- HiveMQ Public Broker: broker.hivemq.com:1883

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-15  
**Author**: Kiro AI Agent
