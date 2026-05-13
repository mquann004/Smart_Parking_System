"""
Test script for Camera Trigger System
Simulates RFID scan to test the automatic camera trigger
"""

import paho.mqtt.client as mqtt
import json
import time

MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883

def test_rfid_scan():
    """Simulate RFID scan at IN gate"""
    print("🧪 Testing Camera Trigger System")
    print("=" * 50)
    
    client = mqtt.Client()
    
    print(f"📡 Connecting to MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start()
    
    time.sleep(2)  # Wait for connection
    
    # Simulate RFID scan at IN gate
    rfid_message = {
        "event": "rfid_scan",
        "gate": "IN",
        "uid": "TEST_ABC123"
    }
    
    print(f"\n📤 Publishing RFID scan message:")
    print(f"   Topic: smart_parking/rfid")
    print(f"   Message: {json.dumps(rfid_message, indent=2)}")
    
    result = client.publish("smart_parking/rfid", json.dumps(rfid_message))
    
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print("✅ Message published successfully!")
        print("\n📷 Camera should start automatically now...")
        print("   Check camera_trigger.log for details")
    else:
        print(f"❌ Failed to publish message, code: {result.rc}")
    
    time.sleep(2)
    client.loop_stop()
    client.disconnect()
    
    print("\n" + "=" * 50)
    print("✅ Test complete!")
    print("\nExpected behavior:")
    print("1. Camera Trigger Service receives RFID message")
    print("2. Camera (main.py) starts automatically")
    print("3. Camera detects license plate")
    print("4. Backend receives license plate and sends servo command")
    print("5. Servo opens gate")

if __name__ == "__main__":
    test_rfid_scan()
