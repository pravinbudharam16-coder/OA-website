# SmartOA physical sensor connection

The web app no longer generates simulated sensor samples. It connects to the ESP32 over Web Bluetooth and receives newline-delimited JSON packets from the Nordic UART Service (NUS).

## Wiring
- MPU6050 left: I2C address 0x68, AD0 -> GND
- MPU6050 right: I2C address 0x69, AD0 -> 3V3
- Both IMUs share SDA GPIO21 and SCL GPIO22
- Left FSR divider output -> GPIO34
- Right FSR divider output -> GPIO35
- FSR voltage divider: FSR to 3.3V, 10 kΩ resistor to GND
- Power sensors from 3.3V and share GND

## Software
1. Flash `ESP32_SmartOA_BLE.ino` to the ESP32 using Arduino IDE.
2. Start the SmartOA server and open it on `http://127.0.0.1:4173`.
3. Open Sensors and press **Connect ESP32**.
4. Select `SmartOA-ESP32` if prompted.
5. The page receives real accelerometer X/Y/Z, gyroscope X/Y/Z, and FSR pressure-sensor ADC/voltage readings; no synthetic sensor generator remains.

FSR values are shown as raw ADC readings and voltage. Convert them to calibrated force/pressure only after physical calibration of the actual FSR/insole assembly.

## Separate sensor readings

Each MPU6050 provides two distinct measurement groups:
- **Accelerometer:** X/Y/Z in g, plus acceleration magnitude in the web UI.
- **Gyroscope:** X/Y/Z in degrees per second (°/s), plus angular-speed magnitude in the web UI.

Each FSR provides a distinct pressure-sensor reading:
- **Raw ADC:** 0–4095 from the ESP32 ADC.
- **Voltage:** calculated from the ADC reading.

The FSR is not converted to Newtons or kPa automatically because that requires calibration of the actual FSR, resistor, mechanical mounting, and insole.

## BLE packet fields

The ESP32 sends newline-delimited JSON containing `leftImuX/Y/Z`, `leftGyroX/Y/Z`, `rightImuX/Y/Z`, `rightGyroX/Y/Z`, `leftFsr`, `rightFsr`, `leftFsrVoltage`, and `rightFsrVoltage`.
