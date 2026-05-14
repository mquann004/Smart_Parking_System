# 🔌 Smart Parking Firmware (ESP32)

High-performance IoT firmware developed using the **Espressif IoT Development Framework (ESP-IDF)**. This module handles real-time sensor data acquisition, RFID authentication, and precise hardware control.

## 🛠️ Key Features
- **Deterministic Hardware Control**: Real-time management of Servo motors and IR sensors.
- **Robust Communication**: WiFi connectivity with automatic reconnection and MQTT protocol integration.
- **Modular Design**: Clean separation of concerns (WiFi, MQTT, RFID, Sensors, Servos).
- **Security**: RFID UID verification against a central database via MQTT.

## 📐 Hardware Specifications & Pin Mapping

### ESP32 Peripherals
- **RFID (RC522)**: SPI Protocol
  - `MISO`: 19
  - `MOSI`: 23
  - `SCK`: 18
  - `SDA (CS)`: 5
  - `RST`: 22
- **Servo Motors (Gate Barrier)**: PWM (LEDC)
  - `Entry Gate`: GPIO 13
  - `Exit Gate`: GPIO 14
- **IR Sensors (Detection)**:
  - `Entry Sensor`: GPIO 32
  - `Exit Sensor`: GPIO 33
  - `Parking Slot 1`: GPIO 25
  - `Parking Slot 2`: GPIO 26
  - `Parking Slot 3`: GPIO 27

## 📡 Communication Protocol (MQTT)

### Published Topics (ESP32 -> Backend)
- `smart_parking/rfid`: Sends RFID scans, sensor status changes, and gate activity in JSON format.

### Subscribed Topics (Backend -> ESP32)
- `smart_parking/command`: Receives validation results for RFID scans.
- `smart_parking/servo/command`: Receives direct gate control commands (Open/Close) after AI confirmation.

## 🚀 Build & Flash Instructions

### Prerequisites
- [ESP-IDF v5.0+](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/get-started/index.html)
- VS Code with ESP-IDF Extension (Recommended)

### Steps
1. **Configure the Project**
   - Use `idf.py menuconfig` to set WiFi credentials and MQTT Broker IP.
2. **Build**
   ```bash
   idf.py build
   ```
3. **Flash**
   ```bash
   idf.py -p [PORT] flash monitor
   ```

## 🏗️ Project Structure
- `main/main.c`: Core application logic and task management.
- `components/`: Custom drivers for RC522, Servo, IR Sensors, and MQTT/WiFi managers.
- `CMakeLists.txt`: Build system configuration.
