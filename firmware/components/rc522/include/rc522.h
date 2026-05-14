#ifndef RC522_H
#define RC522_H

#include "driver/spi_master.h"
#include "driver/gpio.h"
#include "esp_err.h"





// --- Định nghĩa Register cơ bản của RC522 ---
#define RC522_REG_COMMAND       0x01
#define RC522_REG_COM_IEN       0x02
#define RC522_REG_DIV_IEN       0x03
#define RC522_REG_COM_IRQ       0x04
#define RC522_REG_DIV_IRQ       0x05
#define RC522_REG_ERROR         0x06
#define RC522_REG_STATUS1       0x07
#define RC522_REG_STATUS2       0x08
#define RC522_REG_FIFO_DATA     0x09
#define RC522_REG_FIFO_LEVEL    0x0A
#define RC522_REG_CONTROL       0x0C
#define RC522_REG_BIT_FRAMING   0x0D
#define RC522_REG_MODE          0x11
#define RC522_REG_TX_CONTROL    0x14
#define RC522_REG_TX_ASK        0x15
#define RC522_REG_VERSION       0x37

// --- Định nghĩa Lệnh (Commands) ---
#define RC522_CMD_IDLE          0x00
#define RC522_CMD_TRANSCEIVE    0x0C
#define RC522_CMD_SOFT_RESET    0x0F

#define PICC_CMD_REQA           0x26
#define PICC_CMD_ANTICOLL       0x93

// Cấu hình chân mặc định (Có thể thay đổi ở main.c)
typedef struct {
    int miso_io;
    int mosi_io;
    int sck_io;
    int sda_io; // Chân CS/SS
    int rst_io;
    spi_host_device_t spi_host;
} rc522_config_t;

// --- Public APIs ---
esp_err_t rc522_init(const rc522_config_t *config);
esp_err_t rc522_read_firmware_version(uint8_t *version);
bool rc522_check_card(void);
bool rc522_get_uid(uint8_t *uid, uint8_t *uid_len);

#endif // RC522_H