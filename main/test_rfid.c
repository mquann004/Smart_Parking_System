#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "rc522.h"

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

    uint8_t version;
    rc522_read_firmware_version(&version);
    ESP_LOGI(TAG, "RC522 Firmware Version: 0x%02X", version);

    uint8_t uid[5]; // 4 byte UID + 1 byte BCC
    uint8_t uid_len;

    while (1) {
        // Quét thẻ
        if (rc522_check_card()) {
            // Nếu có thẻ, tiến hành đọc UID (Anti-collision)
            if (rc522_get_uid(uid, &uid_len)) {
                ESP_LOGI(TAG, "Card detected! UID: %02X %02X %02X %02X", 
                         uid[0], uid[1], uid[2], uid[3]);
            }
            // Delay tránh đọc liên tục một thẻ quá nhanh
            vTaskDelay(pdMS_TO_TICKS(1000));
        }
        
        vTaskDelay(pdMS_TO_TICKS(100)); // Polling mỗi 100ms
    }
}