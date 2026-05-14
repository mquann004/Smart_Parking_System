#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "ir_sensor.h"

static const char *TAG = "TEST_IR";

// Mảng chứa 5 chân GPIO cho 5 cảm biến
const int IR_PINS[5] = {32, 33, 25, 26, 27};

void app_main(void)
{
    ESP_LOGI(TAG, "Bắt đầu chương trình test đồng thời 5 cảm biến IR");

    // Khởi tạo cả 5 chân cảm biến
    for (int i = 0; i < 5; i++) {
        ir_sensor_init(IR_PINS[i]);
    }

    while (1) {
        char status_str[150] = "Trạng thái các bãi (1=Có xe, 0=Trống): ";
        char temp_str[20];

        // Đọc trạng thái cả 5 cảm biến
        for (int i = 0; i < 5; i++) {
            bool is_detected = ir_sensor_read(IR_PINS[i]);
            sprintf(temp_str, "[Bãi %d: %d] ", i + 1, is_detected ? 1 : 0);
            strcat(status_str, temp_str);
        }

        // In ra màn hình trên 1 dòng cho dễ nhìn
        ESP_LOGI(TAG, "%s", status_str);

        // Delay 500ms
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}
