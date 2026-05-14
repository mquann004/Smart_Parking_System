#include "rc522.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <string.h>

static const char *TAG = "RC522_DRIVER";
static spi_device_handle_t spi_handle;

// --- Hàm ghi vào Register ---
static esp_err_t rc522_write_reg(uint8_t reg, uint8_t val) {
    uint8_t tx_data[2];
    tx_data[0] = (reg << 1) & 0x7E; // Format địa chỉ ghi
    tx_data[1] = val;

    spi_transaction_t t = {
        .length = 16,
        .tx_buffer = tx_data,
    };
    return spi_device_transmit(spi_handle, &t);
}

// --- Hàm đọc từ Register ---
static uint8_t rc522_read_reg(uint8_t reg) {
    uint8_t tx_data[2];
    uint8_t rx_data[2];
    tx_data[0] = ((reg << 1) & 0x7E) | 0x80; // Format địa chỉ đọc (Set bit MSB)
    tx_data[1] = 0x00; // Dummy data

    spi_transaction_t t = {
        .length = 16,
        .tx_buffer = tx_data,
        .rx_buffer = rx_data,
    };
    spi_device_transmit(spi_handle, &t);
    return rx_data[1]; // Byte thứ 2 là dữ liệu trả về
}

// --- Hàm cấu hình Antenna ---
static void rc522_antenna_on() {
    uint8_t temp = rc522_read_reg(RC522_REG_TX_CONTROL);
    if (!(temp & 0x03)) {
        rc522_write_reg(RC522_REG_TX_CONTROL, temp | 0x03);
    }
}

// --- API Khởi tạo ---
esp_err_t rc522_init(const rc522_config_t *config) {
    esp_err_t ret;

    // 1. Cấu hình chân Reset
    gpio_set_direction(config->rst_io, GPIO_MODE_OUTPUT);
    gpio_set_level(config->rst_io, 1);

    // 2. Khởi tạo Bus SPI
    spi_bus_config_t buscfg = {
        .miso_io_num = config->miso_io,
        .mosi_io_num = config->mosi_io,
        .sclk_io_num = config->sck_io,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = 32
    };
    ret = spi_bus_initialize(config->spi_host, &buscfg, SPI_DMA_CH_AUTO);
    if (ret != ESP_OK) return ret;

    // 3. Thêm RC522 vào Bus SPI (Cấu hình CS)
    spi_device_interface_config_t devcfg = {
        .clock_speed_hz = 5 * 1000 * 1000, // 5 MHz
        .mode = 0,                         // SPI mode 0
        .spics_io_num = config->sda_io,    // Chân CS
        .queue_size = 7,
    };
    ret = spi_bus_add_device(config->spi_host, &devcfg, &spi_handle);
    if (ret != ESP_OK) return ret;

    // 4. Soft Reset RC522
    rc522_write_reg(RC522_REG_COMMAND, RC522_CMD_SOFT_RESET);
    vTaskDelay(pdMS_TO_TICKS(50));

    // 5. Cấu hình mặc định cho RC522
    rc522_write_reg(RC522_REG_TX_ASK, 0x40); // Force 100% ASK modulation
    rc522_write_reg(RC522_REG_MODE, 0x3D);   // CRC preset 0x6363
    rc522_antenna_on();

    ESP_LOGI(TAG, "RC522 Initialized successfully");
    return ESP_OK;
}

// --- API Đọc Firmware ---
esp_err_t rc522_read_firmware_version(uint8_t *version) {
    *version = rc522_read_reg(RC522_REG_VERSION);
    return ESP_OK;
}

// --- Hàm giao tiếp dữ liệu cốt lõi (Gửi -> Thẻ -> Nhận) ---
static bool rc522_to_card(uint8_t cmd, uint8_t *send_data, uint8_t send_len, uint8_t *back_data, uint32_t *back_len) {
    uint8_t irq_en = 0x00, wait_irq = 0x00;
    
    if (cmd == RC522_CMD_TRANSCEIVE) {
        irq_en = 0x77;
        wait_irq = 0x30;
    }

    rc522_write_reg(RC522_REG_COM_IEN, irq_en | 0x80);
    rc522_write_reg(RC522_REG_COM_IRQ, 0x7F); // Clear tất cả ngắt
    rc522_write_reg(RC522_REG_FIFO_LEVEL, 0x80); // Clear FIFO
    
    // Ghi dữ liệu vào FIFO
    for (uint8_t i = 0; i < send_len; i++) {
        rc522_write_reg(RC522_REG_FIFO_DATA, send_data[i]);
    }

    // Thực thi lệnh
    rc522_write_reg(RC522_REG_COMMAND, cmd);
    if (cmd == RC522_CMD_TRANSCEIVE) {
        uint8_t bit_framing = rc522_read_reg(RC522_REG_BIT_FRAMING);
        rc522_write_reg(RC522_REG_BIT_FRAMING, bit_framing | 0x80); // StartSend=1
    }

    // Chờ hoàn thành (Polling)
    uint16_t i = 2000;
    uint8_t n;
    do {
        n = rc522_read_reg(RC522_REG_COM_IRQ);
        i--;
    } while ((i != 0) && !(n & 0x01) && !(n & wait_irq));

    rc522_write_reg(RC522_REG_BIT_FRAMING, rc522_read_reg(RC522_REG_BIT_FRAMING) & 0x7F);

    if (i != 0 && !(rc522_read_reg(RC522_REG_ERROR) & 0x1B)) {
        bool status = true;
        if (n & 0x01 && !(n & wait_irq)) {
            // Chỉ có cờ TimerIRq bật -> Timeout, không có thẻ
            status = false;
        }
        
        if (status) {
            if (back_data && back_len) {
                uint8_t n_bytes = rc522_read_reg(RC522_REG_FIFO_LEVEL);
                uint8_t last_bits = rc522_read_reg(RC522_REG_CONTROL) & 0x07;
                *back_len = (n_bytes - 1) * 8 + (last_bits ? last_bits : 8);

                for (i = 0; i < n_bytes; i++) {
                    back_data[i] = rc522_read_reg(RC522_REG_FIFO_DATA);
                }
            }
            return true;
        }
    }
    return false;
}

// --- API Kiểm tra có thẻ hay không ---
bool rc522_check_card(void) {
    uint8_t req_mode = PICC_CMD_REQA;
    uint8_t back_data[2];
    uint32_t back_bits;

    rc522_write_reg(RC522_REG_BIT_FRAMING, 0x07); // 7 bit cho REQA
    return rc522_to_card(RC522_CMD_TRANSCEIVE, &req_mode, 1, back_data, &back_bits);
}

// --- API Đọc UID của thẻ ---
bool rc522_get_uid(uint8_t *uid, uint8_t *uid_len) {
    uint8_t send_data[2];
    uint32_t back_bits;
    
    send_data[0] = PICC_CMD_ANTICOLL;
    send_data[1] = 0x20;
    
    rc522_write_reg(RC522_REG_BIT_FRAMING, 0x00);
    
    if (rc522_to_card(RC522_CMD_TRANSCEIVE, send_data, 2, uid, &back_bits)) {
        *uid_len = 4; // UID thông thường dài 4 bytes + 1 byte BCC
        return true;
    }
    return false;
}