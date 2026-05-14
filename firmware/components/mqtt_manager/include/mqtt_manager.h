#ifndef MQTT_MANAGER_H
#define MQTT_MANAGER_H

#include "esp_err.h"

// Định nghĩa kiểu hàm callback cho MQTT
typedef void (*mqtt_data_callback_t)(const char *topic, const char *data);

/**
 * @brief Khởi tạo MQTT client và kết nối tới broker
 * 
 * @return esp_err_t ESP_OK nếu khởi tạo thành công
 */
esp_err_t mqtt_manager_init(void);

/**
 * @brief Đăng ký callback khi nhận được dữ liệu MQTT
 */
void mqtt_manager_set_callback(mqtt_data_callback_t cb);

/**
 * @brief Publish dữ liệu lên topic
 * 
 * @param topic Topic cần gửi
 * @param data Dữ liệu cần gửi (chuỗi)
 * @return int Message ID, hoặc -1 nếu lỗi
 */
int mqtt_manager_publish(const char *topic, const char *data);

#endif // MQTT_MANAGER_H
