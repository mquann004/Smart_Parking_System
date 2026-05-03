#ifndef IR_SENSOR_H
#define IR_SENSOR_H

#include "driver/gpio.h"
#include <stdbool.h>

/**
 * @brief Khởi tạo chân GPIO cho cảm biến IR
 * 
 * @param gpio_num Số chân GPIO kết nối với chân OUT của IR sensor
 */
void ir_sensor_init(gpio_num_t gpio_num);

/**
 * @brief Đọc trạng thái của cảm biến IR
 * 
 * @param gpio_num Số chân GPIO
 * @return true nếu phát hiện vật cản (OUT = LOW)
 * @return false nếu không có vật cản (OUT = HIGH)
 */
bool ir_sensor_read(gpio_num_t gpio_num);

#endif // IR_SENSOR_H
