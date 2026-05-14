# 🚀 Smart Parking Backend (FastAPI)

The core logic engine of the Smart Parking System. This service manages hardware communication via MQTT, processes AI-based license plate recognition data, and serves a RESTful API for the management dashboard.

## 🛠️ Key Technologies
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Asynchronous Python)
- **Database**: [PostgreSQL](https://www.postgresql.org/) with `psycopg2`
- **Communication**: [MQTT](https://mqtt.org/) via `paho-mqtt`
- **Imaging**: [OpenCV](https://opencv.org/) (for proxying LPR streams)
- **Schema Validation**: [Pydantic](https://docs.pydantic.dev/)

## 🏗️ Architecture
- **API Layer**: Handles requests from the Frontend and external systems.
- **MQTT Manager**: Listens for hardware events (RFID scans, sensor changes) and publishes control commands (Servo open/close).
- **LPR Proxy**: Integrates with local Computer Vision services to provide live video feeds and detection results.
- **Database Layer**: Manages parking slots, user history, active vehicles, and pricing configurations.

## 📡 Primary API Endpoints

### 🚦 Gate Control
- `POST /api/control-gate`: Manually trigger gate open/close.
- `GET /api/gate-status`: Real-time status of Entry and Exit gates.
- `POST /api/gate/confirm`: Confirm or correct AI-detected license plates.

### 🅿️ Parking Management
- `GET /api/slots`: List all parking slots and their current occupancy.
- `GET /api/active-vehicles`: View vehicles currently inside the facility.
- `GET /api/history`: Searchable history of all parking events.

### 💰 Settings & Billing
- `GET /api/settings/pricing`: Retrieve current fee structure.
- `POST /api/settings/pricing`: Update billing rules (Hourly, Overnight, etc.).

### 📹 AI Camera Integration
- `GET /api/video_feed`: Live proxy stream from the Entry gate camera.
- `GET /api/video_feed_exit`: Live proxy stream from the Exit gate camera.
- `GET /api/last_detection`: Get the latest license plate data.

## 🚀 Setup & Installation

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure Database**
   Ensure PostgreSQL is running and update `database.py` with your credentials.

3. **Run the Server**
   ```bash
   python main.py
   ```
   The API will be available at `http://localhost:8000` and Interactive Documentation (Swagger) at `http://localhost:8000/docs`.

## 🗄️ Database Schema Summary
- `users`: Registered users and RFID UIDs.
- `active_parking`: Currently parked vehicles.
- `parking_history`: Permanent logs of entries/exits.
- `parking_slots`: Physical slot status.
- `parking_settings`: Pricing and system configuration.
