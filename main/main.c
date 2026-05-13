#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "rc522.h"
#include "wifi_manager.h"
#include "mqtt_manager.h"
#include "ir_sensor.h"
#include "servo_motor.h"
#include "cJSON.h"

static const char *TAG = "MAIN";

// Global state variables
static bool car_at_in = false;
static bool car_at_out = false;
static bool servo_in_open = false;
static bool servo_out_open = false;

// Hàm callback xử lý lệnh MQTT từ backend
void mqtt_data_handler(const char *topic, const char *data) {
    // Xử lý lệnh từ backend (RFID validation)
    if (strcmp(topic, "smart_parking/command") == 0) {
        cJSON *root = cJSON_Parse(data);
        if (root == NULL) return;
        
        cJSON *action = cJSON_GetObjectItem(root, "action");
        if (action && action->valuestring) {
            if (strcmp(action->valuestring, "allow_in") == 0) {
                ESP_LOGI(TAG, "==> RFID DANG KI VAO BAI THANH CONG. CHO CAMERA NHAN DIEN...");
                // KHÔNG mở servo ở đây nữa, chờ camera nhận diện
            } else if (strcmp(action->valuestring, "deny_in") == 0) {
                cJSON *msg = cJSON_GetObjectItem(root, "msg");
                ESP_LOGW(TAG, "==> TU CHOI VAO BAI: %s", msg ? msg->valuestring : "Unknown");
            } else if (strcmp(action->valuestring, "allow_out") == 0) {
                ESP_LOGI(TAG, "==> KIEM TRA RA BAI THANH CONG. MO BARIE OUT.");
                servo_set_angle(LEDC_CHANNEL_1, 90);
                servo_out_open = true;
            } else if (strcmp(action->valuestring, "deny_out") == 0) {
                cJSON *msg = cJSON_GetObjectItem(root, "msg");
                ESP_LOGW(TAG, "==> TU CHOI RA BAI: %s", msg ? msg->valuestring : "Unknown");
            }
        }
        cJSON_Delete(root);
    }
    
    // Xử lý lệnh mở servo (SAU KHI camera nhận diện biển số)
    else if (strcmp(topic, "smart_parking/servo/command") == 0) {
        cJSON *root = cJSON_Parse(data);
        if (root == NULL) return;
        
        cJSON *action = cJSON_GetObjectItem(root, "action");
        cJSON *gate = cJSON_GetObjectItem(root, "gate");
        cJSON *license_plate = cJSON_GetObjectItem(root, "license_plate");
        
        if (action && action->valuestring && gate && gate->valuestring) {
            if (strcmp(action->valuestring, "open_gate") == 0) {
                if (strcmp(gate->valuestring, "IN") == 0) {
                    ESP_LOGI(TAG, "========================================");
                    ESP_LOGI(TAG, "✅ CAMERA NHAN DIEN THANH CONG!");
                    if (license_plate && license_plate->valuestring) {
                        ESP_LOGI(TAG, "   Bien so xe: %s", license_plate->valuestring);
                    }
                    ESP_LOGI(TAG, "   => MO BARIE IN");
                    ESP_LOGI(TAG, "========================================");
                    
                    servo_set_angle(LEDC_CHANNEL_0, 90);
                    servo_in_open = true;
                } else if (strcmp(gate->valuestring, "OUT") == 0) {
                    ESP_LOGI(TAG, "========================================");
                    ESP_LOGI(TAG, "✅ CAMERA NHAN DIEN THANH CONG!");
                    if (license_plate && license_plate->valuestring) {
                        ESP_LOGI(TAG, "   Bien so xe: %s", license_plate->valuestring);
                    }
                    ESP_LOGI(TAG, "   => MO BARIE OUT");
                    ESP_LOGI(TAG, "========================================");
                    
                    servo_set_angle(LEDC_CHANNEL_1, 90);
                    servo_out_open = true;
                }
            }
        }
        cJSON_Delete(root);
    }
}

// Chân điều khiển Servo
#define SERVO_IN_PIN 13
#define SERVO_OUT_PIN 14

void app_main(void)
{
    // Cấu hình các chân kết nối VSPI mặc định của ESP32
    rc522_config_t config = {
        .miso_io = 19,
        .mosi_io = 23,
        .sck_io  = 18,
        .sda_io  = 5, // Chân CS/SDA
        .rst_io  = 22,
        .spi_host = VSPI_HOST
    };

    // Khởi tạo thư viện
    if (rc522_init(&config) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize RC522");
        return;
    }

    // Khởi tạo WiFi
    if (wifi_manager_init() == ESP_OK) {
        ESP_LOGI(TAG, "WiFi Connected. Initializing MQTT...");
        mqtt_manager_set_callback(mqtt_data_handler);
        mqtt_manager_init();
    } else {
        ESP_LOGE(TAG, "WiFi Connection Failed");
    }

    uint8_t version;
    rc522_read_firmware_version(&version);
    ESP_LOGI(TAG, "RC522 Firmware Version: 0x%02X", version);

    uint8_t uid[5];         // 4 byte UID + 1 byte BCC
    uint8_t uid_len;
    // uint8_t saved_uid[4];   // UID đang lưu (thẻ hiện tại)
    // bool card_present = false;       // Thẻ có đang trên đầu đọc không
    // int no_card_count = 0;           // Đếm số lần liên tiếp không thấy thẻ

    // Khởi tạo rỗng
    // memset(uid, 0, sizeof(uid));
    // memset(saved_uid, 0, sizeof(saved_uid));

    // Khởi tạo các chân IR
    const int IR_PINS[5] = {32, 33, 25, 26, 27};
    bool last_ir_states[5] = {false, false, false, false, false};
    for (int i = 0; i < 5; i++) {
        ir_sensor_init(IR_PINS[i]);
    }

    // Khởi tạo 2 Servo
    servo_init(SERVO_IN_PIN, LEDC_CHANNEL_0);
    servo_init(SERVO_OUT_PIN, LEDC_CHANNEL_1);
    
    // Đảm bảo barrier đang đóng lúc khởi động
    servo_set_angle(LEDC_CHANNEL_0, 0);
    servo_set_angle(LEDC_CHANNEL_1, 0);

    while (1) {
        // bool current_card_valid = false;
        // memset(uid, 0, sizeof(uid)); // Xóa UID cũ trước khi quét mới

        // if (rc522_check_card() && rc522_get_uid(uid, &uid_len)) {
        //     // Kiểm tra UID có hợp lệ không (lọc bỏ 00 00 00 00)
        //     for (int i = 0; i < 4; i++) {
        //         if (uid[i] != 0x00) {
        //             current_card_valid = true;
        //             break;
        //         }
        //     }
        // }

        // if (current_card_valid) {
        //     no_card_count = 0;  // Reset bộ đếm

        //     if (!card_present || memcmp(uid, saved_uid, 4) != 0) {
        //         // Thẻ MỚI được đặt lên -> in UID 1 lần duy nhất
        //         memcpy(saved_uid, uid, 4);
        //         card_present = true;
        //         ESP_LOGI(TAG, "Card detected! UID: %02X %02X %02X %02X",
        //                  saved_uid[0], saved_uid[1], saved_uid[2], saved_uid[3]);
                         
        //         // Publish JSON qua MQTT
        //         char payload[100];
        //         snprintf(payload, sizeof(payload), "{\"event\":\"card_detected\",\"uid\":\"%02X %02X %02X %02X\"}", 
        //                  saved_uid[0], saved_uid[1], saved_uid[2], saved_uid[3]);
        //         mqtt_manager_publish("smart_parking/rfid", payload);
        //     }
        //     // Nếu cùng thẻ -> không in lại
        // } else {
        //     // Không thấy thẻ HOẶC UID không hợp lệ (toàn 00) -> tăng bộ đếm
        //     if (card_present) {
        //         no_card_count++;
        //         // Cần 3 lần liên tiếp không thấy thẻ mới xác nhận rút ra
        //         // (tránh false negative do nhiễu)
        //         if (no_card_count >= 3) {
        //             ESP_LOGI(TAG, "Card removed. UID cleared.");
        //             memset(saved_uid, 0, sizeof(saved_uid));
        //             card_present = false;
        //             no_card_count = 0;
                    
        //             // Publish event card_removed
        //             mqtt_manager_publish("smart_parking/rfid", "{\"event\":\"card_removed\"}");
        //         }
        //     }
        // }

        // -----------------------RC522 ---------------------------------

        if (rc522_check_card()) {
            // Nếu có thẻ, tiến hành đọc UID (Anti-collision)
            if (rc522_get_uid(uid, &uid_len)) {
                ESP_LOGI(TAG, "Card detected! UID: %02X %02X %02X %02X", 
                         uid[0], uid[1], uid[2], uid[3]);

                // Xác định thẻ đang ở cổng nào dựa trên cảm biến IR
                const char* gate_ctx = "UNKNOWN";
                if (car_at_in) {
                    gate_ctx = "IN";
                } else if (car_at_out) {
                    gate_ctx = "OUT";
                } else {
                    ESP_LOGW(TAG, "The quet nhung khong co xe o cong nao!");
                }

                // Publish JSON qua MQTT
                char payload[150];
                snprintf(payload, sizeof(payload), "{\"event\":\"rfid_scan\",\"uid\":\"%02X %02X %02X %02X\",\"gate\":\"%s\"}", 
                         uid[0], uid[1], uid[2], uid[3], gate_ctx);
                mqtt_manager_publish("smart_parking/rfid", payload);
            }
            // Delay tránh đọc liên tục một thẻ quá nhanh
            vTaskDelay(pdMS_TO_TICKS(1000));
        }
        
        vTaskDelay(pdMS_TO_TICKS(100)); // Polling mỗi 100ms



        // --- Logic Đọc và Publish Cảm Biến IR ---
        for (int i = 0; i < 5; i++) {
            bool current_state = ir_sensor_read(IR_PINS[i]);
            
            // Chỉ gửi MQTT khi trạng thái bị thay đổi
            if (current_state != last_ir_states[i]) {
                last_ir_states[i] = current_state;
                char payload[150];
                
                if (i == 0) { // IR_PINS[0] = 32 (Gate IN)
                    car_at_in = current_state;
                    snprintf(payload, sizeof(payload), "{\"event\":\"gate_activity\",\"gate\":\"IN\",\"state\":\"%s\"}", current_state ? "detecting" : "cleared");
                    if (current_state) {
                        ESP_LOGI(TAG, "Gate IN: Xe vua toi cong (Cho quet the)");
                    } else {
                        ESP_LOGI(TAG, "Gate IN: Xe da qua cong -> DONG BARIE");
                        if (servo_in_open) {
                            servo_set_angle(LEDC_CHANNEL_0, 0);
                            servo_in_open = false;
                        }
                    }
                } else if (i == 1) { // IR_PINS[1] = 33 (Gate OUT)
                    car_at_out = current_state;
                    snprintf(payload, sizeof(payload), "{\"event\":\"gate_activity\",\"gate\":\"OUT\",\"state\":\"%s\"}", current_state ? "detecting" : "cleared");
                    if (current_state) {
                        ESP_LOGI(TAG, "Gate OUT: Xe vua toi cong (Cho quet the)");
                    } else {
                        ESP_LOGI(TAG, "Gate OUT: Xe da qua cong -> DONG BARIE");
                        if (servo_out_open) {
                            servo_set_angle(LEDC_CHANNEL_1, 0);
                            servo_out_open = false;
                        }
                    }
                } else { // IR_PINS[2,3,4] = 25, 26, 27 (Slots 1, 2, 3)
                    int slot_id = i - 1; // 1, 2, 3
                    snprintf(payload, sizeof(payload), "{\"event\":\"parking_update\",\"slot_id\":%d,\"is_occupied\":%s}", slot_id, current_state ? "true" : "false");
                    ESP_LOGI(TAG, "Slot %d: %s", slot_id, current_state ? "CÓ XE" : "TRỐNG");
                }
                
                // Gửi dữ liệu JSON lên MQTT
                mqtt_manager_publish("smart_parking/rfid", payload);
            }
        }

        vTaskDelay(pdMS_TO_TICKS(200)); // Polling mỗi 200ms
    }
}