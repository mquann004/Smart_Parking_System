from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from fastapi.responses import StreamingResponse
import database
import cv2

app = FastAPI(title="Smart Parking API")

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
    currentPlate: Optional[str] = None
    message: str

class GateEvent(BaseModel):
    id: str
    gate: str
    eventType: str
    plateNumber: str
    timestamp: str
    success: bool
    note: str

# --- Endpoints ---

@app.get("/api/slots", response_model=List[ParkingSlot])
async def get_slots():
    rows = database.query_db("SELECT * FROM parking_slots ORDER BY slot_id")
    if rows is None:
        raise HTTPException(status_code=500, detail="Lỗi kết nối database")
    
    slots = []
    for row in rows:
        slots.append({
            "id": str(row["slot_id"]),
            "label": f"Bãi {row['slot_id']}",
            "status": "occupied" if row["is_occupied"] else "available",
            "plateNumber": "Xe đang đỗ" if row["is_occupied"] else None
        })
    return slots

@app.get("/api/active-vehicles", response_model=List[Vehicle])
async def get_active_vehicles():
    rows = database.query_db("""
        SELECT a.uid, a.entry_time, u.name 
        FROM active_parking a 
        LEFT JOIN users u ON a.uid = u.uid
    """)
    if rows is None:
        return []
    
    vehicles = []
    for row in rows:
        vehicles.append({
            "id": row["uid"],
            "plateNumber": row["name"] or row["uid"], # Ưu tiên tên user/biển số
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
        row = database.query_db(
            "SELECT state, timestamp FROM gate_logs WHERE gate_name = %s ORDER BY timestamp DESC LIMIT 1",
            (gate_name,), one=True
        )
        
        status = "idle"
        message = "Sẵn sàng"
        if row:
            if row["state"] == "detecting":
                status = "vehicle_detected"
                message = "Phát hiện xe"
            else:
                status = "idle"
                message = "Cổng trống"
        
        gates.append({
            "gate": "entry" if gate_name == "IN" else "exit",
            "status": status,
            "message": message
        })
    return gates

@app.get("/api/history", response_model=List[GateEvent])
async def get_history():
    # Kết hợp RFID logs và License Plate logs
    rfid_rows = database.query_db("SELECT * FROM rfid_logs ORDER BY timestamp DESC LIMIT 20")
    plate_rows = database.query_db("SELECT * FROM license_plate_logs ORDER BY timestamp DESC LIMIT 20")
    
    history = []
    
    if rfid_rows:
        for row in rfid_rows:
            history.append({
                "id": f"rfid_{row['id']}",
                "gate": "entry" if "IN" in row["event_type"] else "exit",
                "eventType": "rfid_scan",
                "plateNumber": row["uid"],
                "timestamp": row["timestamp"].isoformat(),
                "success": True,
                "note": f"Quét thẻ {row['event_type']}"
            })
            
    if plate_rows:
        for row in plate_rows:
            history.append({
                "id": f"plate_{row['id']}",
                "gate": "entry",
                "eventType": "license_plate_detected",
                "plateNumber": row["license_plate"],
                "timestamp": row["timestamp"].isoformat(),
                "success": True,
                "note": f"Nhận diện biển số (Confidence: {row['confidence']})"
            })
            
    # Sắp xếp theo thời gian giảm dần
    history.sort(key=lambda x: x["timestamp"], reverse=True)
    return history[:50]

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
