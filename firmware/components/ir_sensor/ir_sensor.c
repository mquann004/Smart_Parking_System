#include "ir_sensor.h"

void ir_sensor_init(gpio_num_t gpio_num) {
    gpio_config_t io_conf = {
        .intr_type = GPIO_INTR_DISABLE, // Không dùng ngắt
        .mode = GPIO_MODE_INPUT,        // Chế độ Input
        .pin_bit_mask = (1ULL << gpio_num), // Chọn chân
        .pull_down_en = 0,              // Tắt Pull-down
        .pull_up_en = 1,                // Bật Pull-up (do đa số module IR xuất mức thấp khi có vật)
    };
    gpio_config(&io_conf);
}

bool ir_sensor_read(gpio_num_t gpio_num) {
    // Đa số cảm biến hồng ngoại FC-51 xuất mức LOW (0) khi phát hiện vật cản
    int level = gpio_get_level(gpio_num);
    return (level == 0); 
}
