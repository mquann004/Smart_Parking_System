#include "servo_motor.h"
#include "esp_log.h"

static const char *TAG = "SERVO";

// Cấu hình chuẩn cho Servo SG90
#define SERVO_MIN_PULSEWIDTH_US 500  // 0.5ms (Góc 0 độ)
#define SERVO_MAX_PULSEWIDTH_US 2500 // 2.5ms (Góc 180 độ)
#define SERVO_MAX_DEGREE        180  // Góc tối đa
#define LEDC_TIMER              LEDC_TIMER_0
#define LEDC_MODE               LEDC_LOW_SPEED_MODE // Dùng Low Speed Mode là an toàn nhất cho ESP32
#define LEDC_DUTY_RES           LEDC_TIMER_14_BIT   // Độ phân giải 14-bit (0-16383)
#define LEDC_FREQUENCY          50                  // Tần số 50Hz (Chu kỳ 20ms) cho Servo

void servo_init(gpio_num_t pin, ledc_channel_t channel) {
    // 1. Cấu hình Timer
    ledc_timer_config_t ledc_timer = {
        .speed_mode       = LEDC_MODE,
        .timer_num        = LEDC_TIMER,
        .duty_resolution  = LEDC_DUTY_RES,
        .freq_hz          = LEDC_FREQUENCY,
        .clk_cfg          = LEDC_AUTO_CLK
    };
    ledc_timer_config(&ledc_timer);

    // 2. Cấu hình Kênh (Channel)
    ledc_channel_config_t ledc_channel = {
        .speed_mode     = LEDC_MODE,
        .channel        = channel,
        .timer_sel      = LEDC_TIMER,
        .intr_type      = LEDC_INTR_DISABLE,
        .gpio_num       = pin,
        .duty           = 0, // Bắt đầu với duty = 0
        .hpoint         = 0
    };
    ledc_channel_config(&ledc_channel);
    
    ESP_LOGI(TAG, "Servo Timer & Channel %d initialized on GPIO %d", channel, pin);
}

void servo_set_angle(ledc_channel_t channel, int angle) {
    // Giới hạn góc từ 0 đến 180
    if (angle < 0) angle = 0;
    if (angle > SERVO_MAX_DEGREE) angle = SERVO_MAX_DEGREE;

    // Tính toán độ rộng xung (Pulse Width) tương ứng với góc
    uint32_t pulse_width = SERVO_MIN_PULSEWIDTH_US + 
        (((SERVO_MAX_PULSEWIDTH_US - SERVO_MIN_PULSEWIDTH_US) * angle) / SERVO_MAX_DEGREE);

    // Tính toán Duty Cycle tương ứng với Pulse Width
    // Duty = (Pulse_Width / 20000us) * (2^14 - 1)
    uint32_t duty = (pulse_width * 16384) / 20000;

    // Xuất xung PWM
    ledc_set_duty(LEDC_MODE, channel, duty);
    ledc_update_duty(LEDC_MODE, channel);
    
    ESP_LOGD(TAG, "Set angle to %d -> Duty %lu", angle, duty);
}
