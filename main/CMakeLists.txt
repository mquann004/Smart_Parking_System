idf_component_register(SRCS "main.c"
                    INCLUDE_DIRS "."
                    REQUIRES rc522 wifi_manager mqtt_manager nvs_flash esp_wifi
                    )
