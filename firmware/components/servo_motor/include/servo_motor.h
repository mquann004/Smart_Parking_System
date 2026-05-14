#ifndef SERVO_MOTOR_H
#define SERVO_MOTOR_H

#include "driver/gpio.h"
#include "driver/ledc.h"

/**
 * @brief Khởi tạo kênh PWM cho động cơ Servo SG90
 * 
 * @param pin Chân GPIO kết nối với dây tín hiệu (màu vàng/cam) của Servo
 * @param channel Kênh LEDC (vd: LEDC_CHANNEL_0, LEDC_CHANNEL_1)
 */
void servo_init(gpio_num_t pin, ledc_channel_t channel);

/**
 * @brief Điều khiển Servo xoay đến một góc nhất định
 * 
 * @param channel Kênh LEDC đã khởi tạo cho Servo đó
 * @param angle Góc xoay (0 đến 180 độ)
 */
void servo_set_angle(ledc_channel_t channel, int angle);

#endif // SERVO_MOTOR_H
