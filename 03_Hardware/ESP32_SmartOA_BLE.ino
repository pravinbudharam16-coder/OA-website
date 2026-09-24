/* SmartOA physical sensor bridge
 * ESP32 + 2x MPU6050 + 2x FSR
 * BLE transport: Nordic UART Service (NUS)
 * Packet: one JSON object per line, every 100 ms.
 *
 * Wiring (ESP32 DevKit):
 * MPU6050 #1: VCC->3V3, GND->GND, SDA->GPIO21, SCL->GPIO22, AD0->GND (0x68)
 * MPU6050 #2: VCC->3V3, GND->GND, SDA->GPIO21, SCL->GPIO22, AD0->3V3 (0x69)
 * FSR left: voltage divider -> GPIO34 (ADC1)
 * FSR right: voltage divider -> GPIO35 (ADC1)
 * Each FSR needs a 10k resistor to GND; FSR connects to 3.3V.
 */
#include <Arduino.h>
#include <Wire.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

static const uint8_t MPU_LEFT = 0x68;
static const uint8_t MPU_RIGHT = 0x69;
static const int SDA_PIN = 21;
static const int SCL_PIN = 22;
static const int FSR_LEFT_PIN = 34;
static const int FSR_RIGHT_PIN = 35;

static const char* SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
static const char* TX_UUID      = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
static const char* RX_UUID      = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

BLECharacteristic* txCharacteristic = nullptr;
volatile bool deviceConnected = false;

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override { deviceConnected = true; }
  void onDisconnect(BLEServer* server) override {
    deviceConnected = false;
    delay(100);
    server->startAdvertising();
  }
};

void writeReg(uint8_t address, uint8_t reg, uint8_t value) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission(true);
}

bool initMpu(uint8_t address) {
  writeReg(address, 0x6B, 0x00); // wake
  writeReg(address, 0x1C, 0x00); // +/-2g
  writeReg(address, 0x1B, 0x00); // +/-250 deg/s
  Wire.beginTransmission(address);
  Wire.write(0x75);
  if (Wire.endTransmission(false) != 0) return false;
  Wire.requestFrom(address, (uint8_t)1, true);
  return Wire.available() && Wire.read() == 0x68;
}

bool readMpu(uint8_t address, float &axG, float &ayG, float &azG, float &gxDps, float &gyDps, float &gzDps) {
  Wire.beginTransmission(address);
  Wire.write(0x3B); // ACCEL_XOUT_H through GYRO_ZOUT_L (14 bytes)
  if (Wire.endTransmission(false) != 0) return false;
  Wire.requestFrom(address, (uint8_t)14, true);
  if (Wire.available() < 14) return false;

  int16_t ax = (int16_t)((Wire.read() << 8) | Wire.read());
  int16_t ay = (int16_t)((Wire.read() << 8) | Wire.read());
  int16_t az = (int16_t)((Wire.read() << 8) | Wire.read());
  (void)((Wire.read() << 8) | Wire.read()); // temperature, not used
  int16_t gx = (int16_t)((Wire.read() << 8) | Wire.read());
  int16_t gy = (int16_t)((Wire.read() << 8) | Wire.read());
  int16_t gz = (int16_t)((Wire.read() << 8) | Wire.read());

  // MPU6050 configured to ±2 g and ±250 °/s.
  axG = ax / 16384.0f;
  ayG = ay / 16384.0f;
  azG = az / 16384.0f;
  gxDps = gx / 131.0f;
  gyDps = gy / 131.0f;
  gzDps = gz / 131.0f;
  return true;
}
void setup() {
  Serial.begin(115200);
  Wire.begin(SDA_PIN, SCL_PIN);
  analogReadResolution(12);
  analogSetPinAttenuation(FSR_LEFT_PIN, ADC_11db);
  analogSetPinAttenuation(FSR_RIGHT_PIN, ADC_11db);

  bool leftOk = initMpu(MPU_LEFT);
  bool rightOk = initMpu(MPU_RIGHT);
  Serial.printf("MPU left: %s, right: %s\n", leftOk ? "OK" : "FAIL", rightOk ? "OK" : "FAIL");

  BLEDevice::init("SmartOA-ESP32");
  BLEServer* server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  BLEService* service = server->createService(SERVICE_UUID);
  txCharacteristic = service->createCharacteristic(TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  txCharacteristic->addDescriptor(new BLE2902());
  BLECharacteristic* rx = service->createCharacteristic(RX_UUID, BLECharacteristic::PROPERTY_WRITE);
  rx->setValue("SmartOA");
  service->start();
  server->getAdvertising()->addServiceUUID(SERVICE_UUID);
  server->getAdvertising()->start();
}

void loop() {
  float lx=0, ly=0, lz=0, lgx=0, lgy=0, lgz=0;
  float rx=0, ry=0, rz=0, rgx=0, rgy=0, rgz=0;
  bool leftOk = readMpu(MPU_LEFT, lx, ly, lz, lgx, lgy, lgz);
  bool rightOk = readMpu(MPU_RIGHT, rx, ry, rz, rgx, rgy, rgz);
  int leftFsr = analogRead(FSR_LEFT_PIN);
  int rightFsr = analogRead(FSR_RIGHT_PIN);
  float leftV = leftFsr * 3.3f / 4095.0f;
  float rightV = rightFsr * 3.3f / 4095.0f;

  char packet[420];
  snprintf(packet, sizeof(packet),
    "{\"leftImuX\":%.4f,\"leftImuY\":%.4f,\"leftImuZ\":%.4f,\"leftGyroX\":%.3f,\"leftGyroY\":%.3f,\"leftGyroZ\":%.3f,\"rightImuX\":%.4f,\"rightImuY\":%.4f,\"rightImuZ\":%.4f,\"rightGyroX\":%.3f,\"rightGyroY\":%.3f,\"rightGyroZ\":%.3f,\"leftFsr\":%d,\"rightFsr\":%d,\"leftFsrVoltage\":%.3f,\"rightFsrVoltage\":%.3f,\"leftMpuOk\":%s,\"rightMpuOk\":%s}\n",
    lx,ly,lz,lgx,lgy,lgz,rx,ry,rz,rgx,rgy,rgz,leftFsr,rightFsr,leftV,rightV,leftOk?"true":"false",rightOk?"true":"false");

  if (deviceConnected && txCharacteristic) {
    txCharacteristic->setValue((uint8_t*)packet, strlen(packet));
    txCharacteristic->notify();
  }
  delay(100);
}
