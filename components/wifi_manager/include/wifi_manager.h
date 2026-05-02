#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include "esp_err.h"

#define WIFI_SSID "trantiendat"
#define WIFI_PASS "123456789"

/**
 * @brief Khởi tạo WiFi ở chế độ Station
 * 
 * @return esp_err_t ESP_OK nếu kết nối thành công, ngược lại trả về mã lỗi
 */
esp_err_t wifi_manager_init(void);

#endif // WIFI_MANAGER_H
