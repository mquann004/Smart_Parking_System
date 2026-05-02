#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "rc522.h"
#include "wifi_manager.h"
#include "mqtt_manager.h"

static const char *TAG = "MAIN";

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
        mqtt_manager_init();
    } else {
        ESP_LOGE(TAG, "WiFi Connection Failed");
    }

    uint8_t version;
    rc522_read_firmware_version(&version);
    ESP_LOGI(TAG, "RC522 Firmware Version: 0x%02X", version);

    uint8_t uid[5];         // 4 byte UID + 1 byte BCC
    uint8_t uid_len = 0;
    uint8_t saved_uid[4];   // UID đang lưu (thẻ hiện tại)
    bool card_present = false;       // Thẻ có đang trên đầu đọc không
    int no_card_count = 0;           // Đếm số lần liên tiếp không thấy thẻ

    // Khởi tạo rỗng
    memset(uid, 0, sizeof(uid));
    memset(saved_uid, 0, sizeof(saved_uid));

    while (1) {
        bool current_card_valid = false;
        memset(uid, 0, sizeof(uid)); // Xóa UID cũ trước khi quét mới

        if (rc522_check_card() && rc522_get_uid(uid, &uid_len)) {
            // Kiểm tra UID có hợp lệ không (lọc bỏ 00 00 00 00)
            for (int i = 0; i < 4; i++) {
                if (uid[i] != 0x00) {
                    current_card_valid = true;
                    break;
                }
            }
        }

        if (current_card_valid) {
            no_card_count = 0;  // Reset bộ đếm

            if (!card_present || memcmp(uid, saved_uid, 4) != 0) {
                // Thẻ MỚI được đặt lên -> in UID 1 lần duy nhất
                memcpy(saved_uid, uid, 4);
                card_present = true;
                ESP_LOGI(TAG, "Card detected! UID: %02X %02X %02X %02X",
                         saved_uid[0], saved_uid[1], saved_uid[2], saved_uid[3]);
                         
                // Publish JSON qua MQTT
                char payload[100];
                snprintf(payload, sizeof(payload), "{\"event\":\"card_detected\",\"uid\":\"%02X %02X %02X %02X\"}", 
                         saved_uid[0], saved_uid[1], saved_uid[2], saved_uid[3]);
                mqtt_manager_publish("smart_parking/rfid", payload);
            }
            // Nếu cùng thẻ -> không in lại
        } else {
            // Không thấy thẻ HOẶC UID không hợp lệ (toàn 00) -> tăng bộ đếm
            if (card_present) {
                no_card_count++;
                // Cần 3 lần liên tiếp không thấy thẻ mới xác nhận rút ra
                // (tránh false negative do nhiễu)
                if (no_card_count >= 3) {
                    ESP_LOGI(TAG, "Card removed. UID cleared.");
                    memset(saved_uid, 0, sizeof(saved_uid));
                    card_present = false;
                    no_card_count = 0;
                    
                    // Publish event card_removed
                    mqtt_manager_publish("smart_parking/rfid", "{\"event\":\"card_removed\"}");
                }
            }
        }

        vTaskDelay(pdMS_TO_TICKS(200)); // Polling mỗi 200ms
    }
}