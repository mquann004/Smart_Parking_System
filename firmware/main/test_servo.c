#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "servo_motor.h"

static const char *TAG = "TEST_SERVO";

// Chân test như sơ đồ đã vạch ra
#define SERVO_IN_PIN 13
#define SERVO_OUT_PIN 14

void app_main(void)
{
    ESP_LOGI(TAG, "Bắt đầu chương trình test cả 2 Servo (Chân %d và %d)", SERVO_IN_PIN, SERVO_OUT_PIN);

    // Khởi tạo Servo IN trên kênh 0, Servo OUT trên kênh 1
    servo_init(SERVO_IN_PIN, LEDC_CHANNEL_0);
    servo_init(SERVO_OUT_PIN, LEDC_CHANNEL_1);

    while (1) {
        ESP_LOGI(TAG, "MỞ cả 2 thanh chắn LÊN (90 độ)...");
        servo_set_angle(LEDC_CHANNEL_0, 90);
        servo_set_angle(LEDC_CHANNEL_1, 90);
        vTaskDelay(pdMS_TO_TICKS(2000)); // Đợi 2 giây

        ESP_LOGI(TAG, "ĐÓNG cả 2 thanh chắn XUỐNG (0 độ)...");
        servo_set_angle(LEDC_CHANNEL_0, 0);
        servo_set_angle(LEDC_CHANNEL_1, 0);
        vTaskDelay(pdMS_TO_TICKS(2000)); // Đợi 2 giây
    }
}
