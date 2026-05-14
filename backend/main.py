from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from fastapi.responses import StreamingResponse
import database
import cv2
import json
import paho.mqtt.client as mqtt

app = FastAPI(title="Smart Parking API")

# --- MQTT Setup ---
MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883
mqtt_client = mqtt.Client()

@app.on_event("startup")
async def startup_event():
    try:
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start()
        print(f"✅ Backend MQTT client connected to {MQTT_BROKER}")
    except Exception as e:
        print(f"❌ Failed to connect MQTT: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    mqtt_client.loop_stop()
    mqtt_client.disconnect()

# Cho phép CORS cho frontend (Vite mặc định chạy ở 5173 hoặc 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---
class ParkingSlot(BaseModel):
    id: str
    label: str
    status: str # 'occupied' | 'available'
    plateNumber: Optional[str] = None

class Vehicle(BaseModel):
    id: str
    plateNumber: str
    type: str = "car"
    slotId: str
    checkInAt: str

class GateState(BaseModel):
    gate: str # 'entry' | 'exit'
    status: str
    isOpen: bool
    currentPlate: Optional[str] = None
    message: str
    pendingPlate: Optional[str] = None
    expectedPlate: Optional[str] = None
    entryTime: Optional[str] = None
    durationMinutes: Optional[int] = None
    totalFee: Optional[int] = None

class ParkingSettings(BaseModel):
    first_hour_fee: int
    next_hour_fee: int
    overnight_fee: int
    first_period_mins: int
    overnight_threshold_mins: int

class ConfirmationRequest(BaseModel):
    gate: str # "entry" or "exit"
    isConfirmed: bool
    correctedPlate: Optional[str] = None

class GateEvent(BaseModel):
    id: str
    gate: str
    eventType: str
    plateNumber: str
    timestamp: str
    success: bool
    note: str

class GateControlRequest(BaseModel):
    gate: str # 'entry' | 'exit'
    action: str # 'open' | 'close'

# --- Endpoints ---

@app.post("/api/control-gate")
async def control_gate(request: GateControlRequest):
    gate_mqtt = "IN" if request.gate == "entry" else "OUT"
    action_mqtt = "open_gate" if request.action == "open" else "close_gate"
    
    payload = {
        "action": action_mqtt,
        "gate": gate_mqtt,
        "reason": "manual_control"
    }
    
    try:
        mqtt_client.publish("smart_parking/servo/command", json.dumps(payload))
        return {"status": "success", "message": f"Sent {action_mqtt} to {gate_mqtt}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/slots", response_model=List[ParkingSlot])
async def get_slots():
    rows = database.query_db("SELECT * FROM parking_slots ORDER BY slot_id")
    if rows is None:
        raise HTTPException(status_code=500, detail="Lỗi kết nối database")
    
    slots = []
    for row in rows:
        slots.append({
            "id": str(row["slot_id"]),
            "label": f"SLOT {row['slot_id']}",
            "status": "occupied" if row["is_occupied"] else "available",
            "plateNumber": "Occupied" if row["is_occupied"] else None
        })
    return slots

@app.get("/api/active-vehicles", response_model=List[Vehicle])
async def get_active_vehicles():
    rows = database.query_db("""
        SELECT a.uid, a.license_plate, a.entry_time, u.name 
        FROM active_parking a 
        LEFT JOIN users u ON a.uid = u.uid
    """)
    if rows is None:
        return []
    
    vehicles = []
    for row in rows:
        vehicles.append({
            "id": row["uid"],
            "plateNumber": row["license_plate"] or row["name"] or row["uid"], # Ưu tiên biển số trong bãi
            "type": "car",
            "slotId": "unknown", # DB chưa lưu xe đỗ cụ thể bãi nào
            "checkInAt": row["entry_time"].isoformat()
        })
    return vehicles

@app.get("/api/gate-status", response_model=List[GateState])
async def get_gate_status():
    # Lấy trạng thái mới nhất của cổng IN và OUT
    gates = []
    for gate_name in ["IN", "OUT"]:
        # Lấy trạng thái cảm biến (IR)
        row_sensor = database.query_db(
            "SELECT state FROM gate_logs WHERE gate_name = %s AND state IN ('detecting', 'cleared') ORDER BY timestamp DESC LIMIT 1",
            (gate_name,), one=True
        )
        
        # Lấy trạng thái vật lý (Servo)
        row_physical = database.query_db(
            "SELECT state FROM gate_logs WHERE gate_name = %s AND state IN ('open', 'closed') ORDER BY timestamp DESC LIMIT 1",
            (gate_name,), one=True
        )
        
        status = "idle"
        message = "Cổng trống"
        
        # Lấy log quét thẻ gần nhất để kiểm tra lỗi
        row_rfid = database.query_db(
            "SELECT event_type FROM rfid_logs WHERE event_type LIKE %s ORDER BY timestamp DESC LIMIT 1",
            (f"%{gate_name.lower()}%",), one=True
        )

        # Kiểm tra xem có đang chờ xác nhận biển số không
        row_pending = database.query_db(
            "SELECT license_plate, uid FROM pending_confirmations WHERE gate = %s",
            (gate_name,), one=True
        )

        if row_pending:
            status = "waiting_confirmation"
            message = f"XÁC NHẬN BIỂN SỐ: {row_pending['license_plate']}"
        elif row_sensor:
            if row_sensor["state"] == "detecting":
                status = "vehicle_detected"
                message = "Phát hiện xe"
                
                # Nếu đang có xe và vừa quẹt thẻ bị từ chối, hiển thị lỗi
                if row_rfid:
                    if row_rfid["event_type"] == "deny_in_already_present":
                        message = "LỖI: Thẻ đang trong bãi"
                    elif row_rfid["event_type"] == "deny_out_not_found":
                        message = "LỖI: Thẻ chưa vào bãi"
                    elif "deny_full" in row_rfid["event_type"]:
                        message = "HẾT CHỖ: Nhà xe đã đầy"
        
        is_open = False
        if row_physical:
            is_open = (row_physical["state"] == "open")
            if is_open:
                message = "Cổng đang mở"
        
        # Nếu là cổng ra, lấy thêm thông tin phí và thời gian
        expected_plate = None
        entry_time_str = None
        duration_mins = None
        total_fee = None
        
        if gate_name == "OUT" and row_pending:
            # Lấy biển số đăng ký và thời gian vào
            row_active = database.query_db("SELECT license_plate, entry_time FROM active_parking WHERE uid = %s", (row_pending["uid"],), one=True)
            if row_active:
                expected_plate = row_active["license_plate"]
                entry_time = row_active["entry_time"]
                entry_time_str = entry_time.isoformat()
                
                # Tính phí
                settings = database.query_db("SELECT * FROM parking_settings WHERE id = 1", one=True)
                if settings:
                    now = datetime.now()
                    duration = now - entry_time
                    duration_mins = int(duration.total_seconds() / 60)
                    
                    # Ngưỡng qua đêm (ví dụ 12h = 720 phút)
                    if duration_mins >= settings["overnight_threshold_mins"]:
                        total_fee = settings["overnight_fee"]
                    else:
                        # Giai đoạn đầu (ví dụ 60 phút đầu)
                        total_fee = settings["first_hour_fee"]
                        if duration_mins > settings["first_period_mins"]:
                            extra_mins = duration_mins - settings["first_period_mins"]
                            extra_hours = math.ceil(extra_mins / 60)
                            total_fee += extra_hours * settings["next_hour_fee"]

        gates.append({
            "gate": "entry" if gate_name == "IN" else "exit",
            "status": status,
            "isOpen": is_open,
            "message": message,
            "pendingPlate": row_pending["license_plate"] if row_pending else None,
            "expectedPlate": expected_plate,
            "entryTime": entry_time_str,
            "durationMinutes": duration_mins,
            "totalFee": total_fee
        })
    return gates

@app.get("/api/settings/pricing")
async def get_pricing():
    settings = database.query_db("SELECT * FROM parking_settings WHERE id = 1", one=True)
    return settings

@app.post("/api/settings/pricing")
async def update_pricing(settings: ParkingSettings):
    success = database.execute_db(
        "UPDATE parking_settings SET first_hour_fee = %s, next_hour_fee = %s, overnight_fee = %s, first_period_mins = %s, overnight_threshold_mins = %s, updated_at = NOW() WHERE id = 1",
        (settings.first_hour_fee, settings.next_hour_fee, settings.overnight_fee, settings.first_period_mins, settings.overnight_threshold_mins)
    )
    if success:
        return {"status": "success", "message": "Đã cập nhật biểu phí"}
    raise HTTPException(status_code=500, detail="Không thể cập nhật biểu phí")

@app.post("/api/gate/confirm")
async def confirm_gate(req: ConfirmationRequest):
    gate_name = "IN" if req.gate == "entry" else "OUT"
    
    # 1. Lấy thông tin chờ xác nhận
    row = database.query_db(
        "SELECT * FROM pending_confirmations WHERE gate = %s",
        (gate_name,), one=True
    )
    
    if not row:
        raise HTTPException(status_code=404, detail="No pending confirmation found for this gate")
    
    uid = row["uid"]
    plate = req.correctedPlate or row["license_plate"]
    
    if req.isConfirmed:
        # ✅ NGƯỜI DÙNG XÁC NHẬN ĐÚNG
        print(f"✅ Xác nhận biển số: {plate} cho cổng {gate_name}")
        
        # Kiểm tra đối chiếu biển số nếu là cổng ra
        if gate_name == "OUT":
            row_active = database.query_db("SELECT license_plate FROM active_parking WHERE uid = %s", (uid,), one=True)
            if row_active:
                expected = row_active["license_plate"]
                if expected and plate != expected:
                    print(f"❌ Chặn cổng ra: Biển số không khớp! (Yêu cầu: {expected}, Thực tế: {plate})")
                    raise HTTPException(status_code=400, detail=f"Biển số KHÔNG KHỚP với lúc vào! (Yêu cầu: {expected})")
        
        # Gửi lệnh MQTT mở cổng
        servo_command = {
            "action": "open_gate",
            "gate": gate_name,
            "reason": "user_confirmed",
            "license_plate": plate,
            "rfid_uid": uid
        }
        mqtt_client.publish("smart_parking/servo/command", json.dumps(servo_command))
        
        # Xử lý lưu/xóa khỏi bãi đỗ xe
        if gate_name == "IN":
            database.execute_db(
                "INSERT INTO active_parking (uid, license_plate) VALUES (%s, %s) ON CONFLICT (uid) DO UPDATE SET license_plate = EXCLUDED.license_plate, entry_time = CURRENT_TIMESTAMP", 
                (uid, plate)
            )
            database.execute_db("INSERT INTO rfid_logs (uid, event_type) VALUES (%s, %s)", (uid, "allow_in"))
        elif gate_name == "OUT":
            database.execute_db("DELETE FROM active_parking WHERE uid = %s", (uid,))
            database.execute_db("INSERT INTO rfid_logs (uid, event_type) VALUES (%s, %s)", (uid, "allow_out"))
        
        # Lưu vào lịch sử tổng hợp
        database.execute_db(
            "INSERT INTO parking_history (uid, license_plate, type) VALUES (%s, %s, %s)",
            (uid, plate, gate_name)
        )
        
        # Xóa khỏi bảng chờ
        database.execute_db("DELETE FROM pending_confirmations WHERE gate = %s", (gate_name,))
        
        return {"status": "confirmed", "message": f"Cổng {gate_name} đã được mở"}
    else:
        # ❌ NGƯỜI DÙNG TỪ CHỐI (QUÉT LẠI)
        print(f"❌ Yêu cầu quét lại cho cổng {gate_name}")
        database.execute_db("DELETE FROM pending_confirmations WHERE gate = %s", (gate_name,))
        return {"status": "rejected", "message": "Vui lòng chờ camera quét lại"}
    return {"status": "error", "message": "Invalid action"}

@app.get("/api/history")
async def get_history(search: Optional[str] = None, filter: Optional[str] = None):
    query = "SELECT * FROM parking_history WHERE 1=1"
    args = []
    
    if search:
        query += " AND (uid ILIKE %s OR license_plate ILIKE %s)"
        args.extend([f"%{search}%", f"%{search}%"])
    
    if filter:
        if filter == "1h":
            query += " AND timestamp >= NOW() - INTERVAL '1 hour'"
        elif filter == "2h":
            query += " AND timestamp >= NOW() - INTERVAL '2 hours'"
        elif filter == "6h":
            query += " AND timestamp >= NOW() - INTERVAL '6 hours'"
        elif filter == "24h":
            query += " AND timestamp >= NOW() - INTERVAL '24 hours'"
        elif filter == "7d":
            query += " AND timestamp >= NOW() - INTERVAL '7 days'"
            
    query += " ORDER BY timestamp DESC"
    
    rows = database.query_db(query, tuple(args))
    return rows

@app.delete("/api/history/{record_id}")
async def delete_history(record_id: int):
    success = database.execute_db("DELETE FROM parking_history WHERE id = %s", (record_id,))
    if success:
        return {"status": "success", "message": "Đã xóa bản ghi"}
    raise HTTPException(status_code=500, detail="Không thể xóa bản ghi")

@app.delete("/api/history")
async def clear_history():
    success = database.execute_db("DELETE FROM parking_history")
    if success:
        return {"status": "success", "message": "Đã xóa toàn bộ lịch sử"}
    raise HTTPException(status_code=500, detail="Không thể xóa lịch sử")
    raise HTTPException(status_code=500, detail="Không thể xóa lịch sử")

async def get_parking_history_legacy():
    # Giữ lại nếu cần cho việc khác, nhưng API chính đã đổi
    return [][:50]

import httpx

# --- Camera Streaming Logic (Proxy từ License Plate scripts) ---

@app.get("/api/video_feed")
async def video_feed_entry():
    async def stream_proxy():
        async with httpx.AsyncClient() as client:
            try:
                # Cổng vào mặc định chạy ở 8001
                async with client.stream("GET", "http://localhost:8001/video_feed") as r:
                    async for chunk in r.aiter_bytes():
                        yield chunk
            except Exception as e:
                yield b"Error connecting to stream"

    return StreamingResponse(stream_proxy(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/api/video_feed_exit")
async def video_feed_exit():
    async def stream_proxy():
        async with httpx.AsyncClient() as client:
            try:
                # Cổng ra mặc định chạy ở 8002
                async with client.stream("GET", "http://localhost:8002/video_feed") as r:
                    async for chunk in r.aiter_bytes():
                        yield chunk
            except Exception as e:
                yield b"Error connecting to stream"

    return StreamingResponse(stream_proxy(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/api/last_detection")
async def get_last_detection_entry():
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get("http://localhost:8001/last_detection", timeout=2.0)
            return response.json()
        except Exception as e:
            return {"plate": "N/A", "image": None}

@app.get("/api/last_detection_exit")
async def get_last_detection_exit():
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get("http://localhost:8002/last_detection", timeout=2.0)
            return response.json()
        except Exception as e:
            return {"plate": "N/A", "image": None}

@app.get("/api/last-rfid")
async def get_last_rfid(gate: str = "entry"):
    gate_name = "IN" if gate == "entry" else "OUT"
    # Lấy log quét thẻ gần nhất cho cổng này
    row = database.query_db(
        "SELECT uid, timestamp FROM rfid_logs WHERE event_type LIKE %s ORDER BY timestamp DESC LIMIT 1",
        (f"%{gate_name.lower()}%",), one=True
    )
    if not row:
        return {"uid": None, "timestamp": None}
    return {"uid": row["uid"], "timestamp": row["timestamp"].isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
